package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
)

// ListFiltered applies mandatory visibility ACL before optional state/service filters and cursor pagination.
func (s Store) ListFiltered(ctx context.Context, scope Scope, p web.Page, state, serviceID, query string) ([]api.Ticket, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+columns+` FROM intake.tickets t
		WHERE `+visible+`
		  AND ($5='' OR t.id::text>$5)
		  AND ($6='' OR t.service_owner_org_id::text=$6)
		  AND ($8='' OR t.state=$8)
		  AND ($9='' OR t.service_id::text=$9)
		  AND ($10='' OR strpos(lower(t.title),lower($10))>0 OR strpos(lower(t.number),lower($10))>0)
		ORDER BY t.id LIMIT $7`,
		scope.ID, scope.TicketID, scope.Orgs, scope.Role, p.Cursor, p.Organization, p.Limit+1, state, serviceID, query)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []api.Ticket{}
	for rows.Next() {
		v, e := scan(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s Store) ReadOperationalRecords(ctx context.Context, ticketID string) (map[string]any, error) {
	vCases := []api.VendorCaseRecord{}
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,ticket_id::text,vendor_id::text,internal_pic_id::text,
		external_reference,contract_reference,expected_return_at,next_followup_at,state,closed_at,resolution_note,created_at
		FROM intake.vendor_cases WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC`, ticketID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r api.VendorCaseRecord
		if err := rows.Scan(&r.ID, &r.Version, &r.TicketID, &r.VendorID, &r.InternalPICID, &r.ExternalReference,
			&r.ContractReference, &r.ExpectedReturnAt, &r.NextFollowupAt, &r.State, &r.ClosedAt, &r.ResolutionNote, &r.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		vCases = append(vCases, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	pauses := []api.PauseRecord{}
	rows, err = s.Pool.Query(ctx, `SELECT id::text,version,starts_at,ends_at,approved_by::text,policy_version,reason,resumed_early_at,resume_reason
		FROM intake.pause_intervals WHERE ticket_id=$1 ORDER BY starts_at DESC,id DESC`, ticketID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r api.PauseRecord
		if err := rows.Scan(&r.ID, &r.Version, &r.StartsAt, &r.EndsAt, &r.ApprovedBy, &r.PolicyVersion, &r.Reason, &r.ResumedEarlyAt, &r.ResumeReason); err != nil {
			rows.Close()
			return nil, err
		}
		pauses = append(pauses, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	handoffs := []api.HandoffSummary{}
	rows, err = s.Pool.Query(ctx, `SELECT h.id::text,h.version,h.ticket_id::text,t.version,h.from_org_id::text,h.target_org_id::text,h.target_team_id::text,
		h.requested_by::text,h.reason,h.state,h.response_reason,h.responded_at,h.created_at
		FROM intake.handoff_requests h JOIN intake.tickets t ON t.id=h.ticket_id
		WHERE h.ticket_id=$1 ORDER BY h.created_at DESC,h.id DESC`, ticketID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r api.HandoffSummary
		if err := rows.Scan(&r.ID, &r.Version, &r.TicketID, &r.TicketVersion, &r.FromOrgID, &r.TargetOrgID, &r.TargetTeamID,
			&r.RequestedBy, &r.Reason, &r.State, &r.ResponseReason, &r.RespondedAt, &r.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		handoffs = append(handoffs, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	logs := []api.WorkLogRecord{}
	rows, err = s.Pool.Query(ctx, `SELECT id::text,version,ticket_id::text,actor_id::text,started_at,ended_at,summary,created_at
		FROM intake.work_logs WHERE ticket_id=$1 ORDER BY started_at DESC,id DESC`, ticketID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r api.WorkLogRecord
		if err := rows.Scan(&r.ID, &r.Version, &r.TicketID, &r.ActorID, &r.StartedAt, &r.EndedAt, &r.Summary, &r.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		logs = append(logs, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	return map[string]any{
		"vendor_cases": vCases,
		"pauses":       pauses,
		"handoffs":     handoffs,
		"work_logs":    logs,
	}, nil
}

func (s Store) CloseVendorCase(ctx context.Context, tx pgx.Tx, ticketID, caseID, actor string, in api.CloseVendorCaseInput, now time.Time) (api.Ticket, error) {
	var state string
	var ver int64
	err := tx.QueryRow(ctx, `SELECT state,version FROM intake.tickets WHERE id=$1 FOR UPDATE`, ticketID).Scan(&state, &ver)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if ver != in.ExpectedVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if state == "CLOSED" || state == "CANCELLED" {
		return api.Ticket{}, web.Fail(409, "Tiket sudah ditutup atau dibatalkan")
	}
	var cState string
	err = tx.QueryRow(ctx, `SELECT state FROM intake.vendor_cases WHERE id=$1 AND ticket_id=$2 FOR UPDATE`, caseID, ticketID).Scan(&cState)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Kasus vendor tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if cState != "OPEN" {
		return api.Ticket{}, web.Fail(409, "Kasus vendor sudah ditutup")
	}
	_, err = tx.Exec(ctx, `UPDATE intake.vendor_cases SET state='CLOSED',closed_at=$1,closed_by=$2,resolution_note=$3,version=version+1,updated_at=$1 WHERE id=$4`,
		now, actor, in.Reason, caseID)
	if err != nil {
		return api.Ticket{}, err
	}
	nextVer, err := Bump(ctx, tx, ticketID, in.ExpectedVersion)
	if err != nil {
		return api.Ticket{}, err
	}
	if err = History(ctx, tx, ticketID, nextVer, actor, "CloseVendorCase", "Kasus vendor ditutup: "+in.Reason); err != nil {
		return api.Ticket{}, err
	}
	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, ticketID))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitState(ctx, tx, ticket)
}

func (s Store) ResumePause(ctx context.Context, tx pgx.Tx, ticketID, pauseID, actor string, in api.ArchiveInput, now time.Time) (api.Ticket, error) {
	var state string
	var ver, pVer int64
	err := tx.QueryRow(ctx, `SELECT state,version,policy_version FROM intake.tickets WHERE id=$1 FOR UPDATE`, ticketID).Scan(&state, &ver, &pVer)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if ver != in.ExpectedVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if state == "CLOSED" || state == "CANCELLED" || state == "RESOLVED" {
		return api.Ticket{}, web.Fail(409, "Jeda hanya dapat diakhiri pada episode aktif")
	}
	var startsAt, endsAt time.Time
	var resumed *time.Time
	err = tx.QueryRow(ctx, `SELECT starts_at,ends_at,resumed_early_at FROM intake.pause_intervals WHERE id=$1 AND ticket_id=$2 FOR UPDATE`, pauseID, ticketID).Scan(&startsAt, &endsAt, &resumed)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Jeda SLA tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if resumed != nil || !endsAt.After(now) {
		return api.Ticket{}, web.Fail(409, "Jeda SLA sudah berakhir sebelumnya")
	}
	effectiveEnd := now
	if !effectiveEnd.After(startsAt) {
		effectiveEnd = startsAt.Add(time.Second)
	}
	if effectiveEnd.After(endsAt) {
		effectiveEnd = endsAt
	}
	_, err = tx.Exec(ctx, `UPDATE intake.pause_intervals SET ends_at=$1,resumed_early_at=$2,resumed_by=$3,resume_reason=$4,version=version+1,updated_at=$2 WHERE id=$5`,
		effectiveEnd, now, actor, in.Reason, pauseID)
	if err != nil {
		return api.Ticket{}, err
	}
	nextVer, err := Bump(ctx, tx, ticketID, in.ExpectedVersion)
	if err != nil {
		return api.Ticket{}, err
	}
	if err = History(ctx, tx, ticketID, nextVer, actor, "ResumePause", "Jeda penanganan diakhiri lebih awal: "+in.Reason); err != nil {
		return api.Ticket{}, err
	}
	payload := map[string]any{"pause_id": pauseID, "policy_version": pVer}
	if err = Event(ctx, tx, "PauseChanged", ticketID, nextVer, payload, []string{"M7", "M9"}); err != nil {
		return api.Ticket{}, err
	}
	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, ticketID))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitState(ctx, tx, ticket)
}

func (s Store) ListHandoffs(ctx context.Context, acceptOrgs, outgoingOrgs []string, limit int) ([]api.HandoffSummary, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.Pool.Query(ctx, `SELECT h.id::text,h.version,
		CASE WHEN h.target_org_id=ANY($1::uuid[]) AND t.service_owner_org_id=h.from_org_id THEN 'INCOMING' ELSE 'OUTGOING' END,
		h.ticket_id::text,t.number,t.title,t.version,h.from_org_id::text,h.target_org_id::text,h.target_team_id::text,
		h.requested_by::text,h.reason,h.state,h.response_reason,h.responded_at,h.created_at
		FROM intake.handoff_requests h
		JOIN intake.tickets t ON t.id=h.ticket_id
		WHERE t.archived_at IS NULL AND h.state='PENDING' AND t.state NOT IN ('CLOSED','CANCELLED')
		  AND ((h.target_org_id=ANY($1::uuid[]) AND t.service_owner_org_id=h.from_org_id) OR h.from_org_id=ANY($2::uuid[]))
		ORDER BY h.created_at DESC,h.id DESC LIMIT $3`, acceptOrgs, outgoingOrgs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.HandoffSummary{}
	for rows.Next() {
		var r api.HandoffSummary
		if err := rows.Scan(&r.ID, &r.Version, &r.Direction, &r.TicketID, &r.TicketNumber, &r.TicketTitle, &r.TicketVersion,
			&r.FromOrgID, &r.TargetOrgID, &r.TargetTeamID, &r.RequestedBy, &r.Reason, &r.State, &r.ResponseReason, &r.RespondedAt, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s Store) ResolveHandoffPending(ctx context.Context, tx pgx.Tx, ticketID, handoffID, actor string, actorOrgs []string, newState, reason string, expectedVersion int64, now time.Time) (api.Ticket, error) {
	var fromOrgID, targetOrgID, state string
	err := tx.QueryRow(ctx, `SELECT from_org_id::text,target_org_id::text,state FROM intake.handoff_requests WHERE id=$1 AND ticket_id=$2 FOR UPDATE`, handoffID, ticketID).
		Scan(&fromOrgID, &targetOrgID, &state)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if state != "PENDING" {
		return api.Ticket{}, web.Fail(409, "Permohonan handoff sudah diproses")
	}
	matchOrg := fromOrgID
	if newState == "REJECTED" {
		matchOrg = targetOrgID
	}
	allowed := false
	for _, o := range actorOrgs {
		if o == matchOrg {
			allowed = true
			break
		}
	}
	if !allowed {
		return api.Ticket{}, web.Fail(403, "Anda tidak memiliki mandat memproses handoff ini")
	}
	var curVer int64
	var curState, owner string
	err = tx.QueryRow(ctx, `SELECT version,state,service_owner_org_id::text FROM intake.tickets WHERE id=$1 AND archived_at IS NULL FOR UPDATE`, ticketID).Scan(&curVer, &curState, &owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
	}
	if err != nil {
		return api.Ticket{}, err
	}
	if curVer != expectedVersion || owner != fromOrgID || curState == "CLOSED" || curState == "CANCELLED" {
		return api.Ticket{}, web.Fail(409, "Versi atau status tiket berubah; muat ulang")
	}
	_, err = tx.Exec(ctx, `UPDATE intake.handoff_requests SET state=$1,responded_by=$2,responded_at=$3,response_reason=$4,version=version+1,updated_at=$3 WHERE id=$5`,
		newState, actor, now, reason, handoffID)
	if err != nil {
		return api.Ticket{}, err
	}
	nextVer, err := Bump(ctx, tx, ticketID, expectedVersion)
	if err != nil {
		return api.Ticket{}, err
	}
	action := "CancelHandoff"
	summary := "Permohonan handoff dibatalkan oleh OPD pengirim: " + reason
	if newState == "REJECTED" {
		action = "RejectHandoff"
		summary = "Permohonan handoff ditolak oleh OPD tujuan: " + reason
	}
	if err = History(ctx, tx, ticketID, nextVer, actor, action, summary); err != nil {
		return api.Ticket{}, err
	}
	return scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, ticketID))
}

func (s Store) RecordWorkLog(ctx context.Context, tx pgx.Tx, ticketID, actor string, in api.WorkLogInput, now time.Time) (api.WorkLogRecord, error) {
	var curVer int64
	var curState, owner string
	var team *string
	err := tx.QueryRow(ctx, `SELECT version,state,service_owner_org_id::text,handling_team_id::text FROM intake.tickets WHERE id=$1 AND archived_at IS NULL FOR UPDATE`, ticketID).Scan(&curVer, &curState, &owner, &team)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.WorkLogRecord{}, web.Fail(404, "Tiket tidak ditemukan")
	}
	if err != nil {
		return api.WorkLogRecord{}, err
	}
	if curVer != in.ExpectedVersion {
		return api.WorkLogRecord{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if curState == "CLOSED" || curState == "CANCELLED" {
		return api.WorkLogRecord{}, web.Fail(409, "Work log tidak dapat ditambahkan pada tiket terminal")
	}
	id := web.ID()
	var rec api.WorkLogRecord
	err = tx.QueryRow(ctx, `INSERT INTO intake.work_logs(id,version,ticket_id,actor_id,started_at,ended_at,summary,created_at,updated_at,service_owner_org_id,handling_team_id)
		VALUES($1,1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
		RETURNING id::text,version,ticket_id::text,actor_id::text,started_at,ended_at,summary,created_at`,
		id, ticketID, actor, in.StartedAt, in.EndedAt, in.Summary, now, owner, team).
		Scan(&rec.ID, &rec.Version, &rec.TicketID, &rec.ActorID, &rec.StartedAt, &rec.EndedAt, &rec.Summary, &rec.CreatedAt)
	if err != nil {
		return api.WorkLogRecord{}, err
	}
	nextVer, err := Bump(ctx, tx, ticketID, in.ExpectedVersion)
	if err != nil {
		return api.WorkLogRecord{}, err
	}
	if err = History(ctx, tx, ticketID, nextVer, actor, "RecordWorkLog", "Catatan kerja teknisi: "+in.Summary); err != nil {
		return api.WorkLogRecord{}, err
	}
	rec.Version = nextVer
	return rec, nil
}

func (s Store) FilterTicketsInOrgs(ctx context.Context, orgs, ids []string) ([]string, error) {
	if len(orgs) == 0 || len(ids) == 0 {
		return []string{}, nil
	}
	rows, err := s.Pool.Query(ctx, `SELECT id::text FROM intake.tickets WHERE id=ANY($1::uuid[]) AND service_owner_org_id=ANY($2::uuid[])`, ids, orgs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
