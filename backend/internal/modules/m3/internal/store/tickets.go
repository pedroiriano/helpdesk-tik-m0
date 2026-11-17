package store

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	catalog "helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/modules/m3/api"
	classify "helpdesk.local/m0/internal/modules/m4/api"
	assignment "helpdesk.local/m0/internal/modules/m5/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

type Store struct{ Pool *pgxpool.Pool }
type Scope struct {
	ID, TicketID, Role string
	Orgs               []string
	Internal           bool
	Permissions        []string
}

func (s Store) InternalAllowed(ctx context.Context, scope Scope, id string) (bool, error) {
	var ok bool
	e := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM intake.tickets WHERE id=$1 AND service_owner_org_id=ANY($2::uuid[]) AND ($3<>'TECHNICIAN' OR assignee_id=$4))`, id, scope.Orgs, scope.Role, scope.ID).Scan(&ok)
	return ok, e
}

const visible = `((t.requester_id=$1 AND $2='' AND ($4='PUBLIC' OR ($4='ASN' AND t.requester_org_id=ANY($3::uuid[])))) OR (t.id::text=$2 AND t.requester_kind='GUEST') OR ($4 NOT IN ('PUBLIC','ASN','GUEST') AND t.service_owner_org_id=ANY($3::uuid[]) AND ($4<>'TECHNICIAN' OR t.assignee_id=$1)))`
const columns = `t.id::text,t.version,t.number,t.service_id::text,t.requester_kind,t.requester_id::text,t.requester_org_id::text,t.service_owner_org_id::text,t.handling_team_id::text,t.assignee_id::text,t.state,t.verification,t.title,t.description,t.accepted_at,t.updated_at,t.policy_version,t.form_version,t.resolution_due_at,t.calendar_version,t.answers,t.classification_snapshot,t.active_attempt_id::text,t.archived_at,t.episode_id::text,t.classification_decision,t.sla_snapshot,t.episode_started_at,t.response_due_at,t.first_response_at,t.reporting_context,t.reported_category`

func scan(row pgx.Row) (v api.Ticket, err error) {
	var answers, classification []byte
	var due *time.Time
	err = row.Scan(&v.ID, &v.Version, &v.Number, &v.ServiceID, &v.RequesterKind, &v.RequesterID, &v.RequesterOrg, &v.OwnerOrg, &v.HandlingTeamID, &v.AssigneeID, &v.State, &v.Verification, &v.Title, &v.Description, &v.Accepted, &v.Updated, &v.PolicyVersion, &v.FormVersion, &due, &v.Calendar, &answers, &classification, &v.ActiveAttemptID, &v.ArchivedAt, &v.EpisodeID, &v.ClassificationDecision, &v.SLAPolicy, &v.EpisodeStartedAt, &v.ResponseDue, &v.FirstResponse, &v.ReportingContext, &v.ReportedCategory)
	if err == nil {
		if due != nil {
			v.Due = *due
		}
		err = json.Unmarshal(answers, &v.Answers)
		if err == nil {
			err = json.Unmarshal(classification, &v.Classification)
		}
	}
	return
}
func (s Store) Read(ctx context.Context, scope Scope, id string) (api.Ticket, error) {
	v, e := scan(s.Pool.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE `+visible+` AND t.id=$5`, scope.ID, scope.TicketID, scope.Orgs, scope.Role, id))
	if e == pgx.ErrNoRows {
		e = web.Fail(404, "Tiket tidak ditemukan")
	}
	return v, e
}
func (s Store) List(ctx context.Context, scope Scope, p web.Page) ([]api.Ticket, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE `+visible+` AND ($5='' OR t.id::text>$5) AND ($6='' OR t.service_owner_org_id::text=$6) ORDER BY t.id LIMIT $7`, scope.ID, scope.TicketID, scope.Orgs, scope.Role, p.Cursor, p.Organization, p.Limit+1)
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
func (s Store) ReplayBinding(ctx context.Context, hash []byte) error {
	var valid bool
	e := s.Pool.QueryRow(ctx, `SELECT expires_at>now() AND revoked_at IS NULL FROM intake.guest_capabilities WHERE capability_hash=$1`, hash).Scan(&valid)
	if e == pgx.ErrNoRows {
		return nil
	}
	if e != nil {
		return e
	}
	if !valid {
		return web.Fail(401, "Kunci pelacakan tidak berlaku")
	}
	return nil
}
func (s Store) Create(ctx context.Context, tx pgx.Tx, in api.Create, snap catalog.Snapshot, p classify.Proposal, calc sla.Calculation, policy sla.PolicySnapshot, id, requester, kind string, org *string, capHash []byte, now time.Time, reporting *identity.ReportingContext, reportedCategory *identity.DirectoryEntry) (api.Ticket, error) {
	answers, _ := json.Marshal(in.Answers)
	snapshot, _ := json.Marshal(snap)
	classification, _ := json.Marshal(p)
	_, e := tx.Exec(ctx, `INSERT INTO intake.tickets(id,number,service_id,form_version,policy_version,requester_kind,requester_id,requester_org_id,service_owner_org_id,state,verification,title,description,accepted_at,episode_id,answers,service_snapshot,classification_snapshot,resolution_due_at,calendar_version,sla_snapshot,episode_started_at,response_due_at,reporting_context,reported_category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN','PENDING',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$12,$20,$21,$22)`, id, "HD-"+id, in.ServiceID, in.FormVersion, in.PolicyVersion, kind, requester, org, snap.Service.OwnerOrgID, in.Title, in.Description, now, web.ID(), answers, snapshot, classification, calc.Due, calc.Version, policy, calc.ResponseDue, reporting, reportedCategory)
	if e != nil {
		return api.Ticket{}, e
	}
	if capHash != nil {
		_, e = tx.Exec(ctx, `INSERT INTO intake.guest_capabilities(id,ticket_id,capability_hash,scopes,expires_at) VALUES($1,$2,$3,ARRAY['ticket.read','ticket.comment','ticket.attach','ticket.confirm','ticket.transition'],now()+interval '30 days')`, web.ID(), id, capHash)
		if e != nil {
			return api.Ticket{}, e
		}
	}
	if e = History(ctx, tx, id, 1, requester, "CreateTicket", "Tiket diterima; menunggu verifikasi operator"); e != nil {
		return api.Ticket{}, e
	}
	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitTicketSnapshot(ctx, tx, "TicketCreated", ticket, now, nil)
}
func History(ctx context.Context, tx pgx.Tx, ticket string, version int64, actor, action, summary string) error {
	_, e := tx.Exec(ctx, `INSERT INTO intake.ticket_versions(id,ticket_id,ticket_version,actor_id,action,reason,public_summary,correlation_id) VALUES($1,$2,$3,$4,$5,'Operasi lab',$6,$7)`, web.ID(), ticket, version, actor, action, summary, web.CorrelationID(ctx))
	return e
}
func Bump(ctx context.Context, tx pgx.Tx, id string, version int64) (int64, error) {
	var next int64
	e := tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING version`, id, version).Scan(&next)
	if e == pgx.ErrNoRows {
		e = web.Fail(409, "Versi tiket berubah; muat ulang dan tinjau")
	}
	return next, e
}
func (s Store) Comment(ctx context.Context, tx pgx.Tx, id, actor string, in api.CommentInput, requester bool, humanResponseAt *time.Time) (map[string]any, error) {
	var currentState string
	var activeAttemptID *string
	_ = tx.QueryRow(ctx, `SELECT state, active_attempt_id::text FROM intake.tickets WHERE id=$1`, id).Scan(&currentState, &activeAttemptID)

	next, e := Bump(ctx, tx, id, in.ExpectedVersion)
	if e != nil {
		return nil, e
	}
	if humanResponseAt != nil {
		if _, e = tx.Exec(ctx, `UPDATE intake.tickets SET first_response_at=COALESCE(first_response_at,$2) WHERE id=$1`, id, *humanResponseAt); e != nil {
			return nil, e
		}
	}
	cid := web.ID()
	_, e = tx.Exec(ctx, `INSERT INTO intake.comments(id,ticket_id,author_id,visibility,body) VALUES($1,$2,$3,$4,$5)`, cid, id, actor, in.Visibility, in.Body)
	if e != nil {
		return nil, e
	}
	summary := "Komentar pemohon/petugas ditambahkan"
	if in.Visibility == "INTERNAL" {
		summary = "Aktivitas internal"
	} else if requester && currentState == "RESOLVED" && activeAttemptID != nil && *activeAttemptID != "" {
		// Komentar pemohon pada masa konfirmasi menahan auto-close
		_, e = tx.Exec(ctx, `UPDATE intake.resolution_attempts SET outcome='REVIEW_REQUIRED', updated_at=now() WHERE id=$1 AND outcome='PENDING'`, *activeAttemptID)
		if e != nil {
			return nil, e
		}
		summary = "Tanggapan pemohon menahan auto-close (review required)"
		if e = Event(ctx, tx, "ConfirmationRecorded", id, next, map[string]any{"attempt_id": *activeAttemptID, "decision": "FEEDBACK"}, []string{"M6", "M7", "M9"}); e != nil {
			return nil, e
		}
	}
	e = History(ctx, tx, id, next, actor, "AddComment", summary)
	return map[string]any{"id": id, "version": next}, e
}
func (s Store) Comments(ctx context.Context, id string, internal bool, p web.Page) ([]api.Comment, error) {
	rows, e := s.Pool.Query(ctx, `SELECT id::text,version,body,visibility,created_at FROM intake.comments WHERE ticket_id=$1 AND (visibility='REQUESTER' OR $2) AND ($3='' OR (created_at,id)>(SELECT created_at,id FROM intake.comments WHERE id::text=$3 AND ticket_id=$1 AND (visibility='REQUESTER' OR $2))) ORDER BY created_at,id LIMIT $4`, id, internal, p.Cursor, p.Limit+1)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []api.Comment{}
	for rows.Next() {
		var v api.Comment
		if e = rows.Scan(&v.ID, &v.Version, &v.Body, &v.Visibility, &v.Created); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) Histories(ctx context.Context, id string, internal bool, p web.Page) ([]api.History, error) {
	rows, e := s.Pool.Query(ctx, `SELECT id::text,ticket_version,action,public_summary,created_at FROM intake.ticket_versions WHERE ticket_id=$1 AND ($2 OR public_summary<>'Aktivitas internal') AND ($3='' OR ticket_version>(SELECT ticket_version FROM intake.ticket_versions WHERE id::text=$3 AND ticket_id=$1 AND ($2 OR public_summary<>'Aktivitas internal'))) ORDER BY ticket_version,id LIMIT $4`, id, internal, p.Cursor, p.Limit+1)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []api.History{}
	for rows.Next() {
		var v api.History
		if e = rows.Scan(&v.ID, &v.Version, &v.Action, &v.Summary, &v.Created); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s Store) Verify(ctx context.Context, tx pgx.Tx, ticket api.Ticket, actor string, in api.VerificationInput, overridden bool, categoryName string, now time.Time, calc *sla.Calculation) (api.Ticket, error) {
	decision := api.ClassificationDecision{CategoryID: in.CategoryID, CategoryName: categoryName, Priority: in.Priority, VerifiedBy: actor, VerifiedAt: now}
	var due, response *time.Time
	var calendar *string
	if calc != nil {
		due, response, calendar = &calc.Due, &calc.ResponseDue, &calc.Version
	}
	updated, e := scan(tx.QueryRow(ctx, `UPDATE intake.tickets t SET state='TRIAGED',first_response_at=COALESCE(first_response_at,$2),resolution_due_at=COALESCE($6,resolution_due_at),response_due_at=COALESCE($7,response_due_at),calendar_version=COALESCE($8,calendar_version),verification='VERIFIED',classification_decision=$1,version=version+1,updated_at=$2 WHERE id=$3 AND version=$4 AND service_owner_org_id=$5 AND verification='PENDING' AND state='OPEN' AND archived_at IS NULL RETURNING `+columns, decision, decision.VerifiedAt, ticket.ID, in.ExpectedVersion, ticket.OwnerOrg, due, response, calendar))
	if errors.Is(e, pgx.ErrNoRows) {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau tiket telah diverifikasi; muat ulang")
	}
	if e != nil {
		return api.Ticket{}, e
	}
	evidence, err := json.Marshal(struct {
		TicketID    string
		Version     int64
		Title       string
		Description string
		Answers     map[string]string
		Proposed    classify.Proposal
		Decision    api.ClassificationDecision
		Reason      string
	}{ticket.ID, ticket.Version, ticket.Title, ticket.Description, ticket.Answers, ticket.Classification, decision, in.Reason})
	if err != nil {
		return api.Ticket{}, err
	}
	digest := sha256.Sum256(evidence)
	original := updated.Classification
	ruleVersion := max(1, original.RuleVersion)
	var overrideReason string
	if overridden {
		overrideReason = in.Reason
	}
	_, e = tx.Exec(ctx, `INSERT INTO intake.ticket_verifications(id,ticket_id,verified_by,proposed_category,confirmed_category,confidence,classifier_version,explanation,override_reason,evidence_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, web.ID(), ticket.ID, actor, original.CategoryID, in.CategoryID, original.Confidence, ruleVersion, original.Explanation, overrideReason, digest[:])
	if e != nil {
		return api.Ticket{}, e
	}
	if e = History(ctx, tx, ticket.ID, updated.Version, actor, "VerifyTicket", "Tiket diverifikasi oleh operator"); e != nil {
		return api.Ticket{}, e
	}
	if e = Event(ctx, tx, "TicketVerified", ticket.ID, updated.Version, map[string]any{"verification": "VERIFIED", "category_id": in.CategoryID}, []string{"M9"}); e != nil {
		return api.Ticket{}, e
	}
	return updated, emitState(ctx, tx, updated)
}

func (s Store) Dispatch(ctx context.Context, tx pgx.Tx, before api.Ticket, actor string, in api.DispatchInput, proposal assignment.Proposal, command string) (api.Ticket, error) {
	id := before.ID
	next := "ASSIGNED"
	if command == "ReassignTicket" {
		next = before.State
	}
	var nextVersion int64
	e := tx.QueryRow(ctx, `UPDATE intake.tickets SET state=$6, handling_team_id=$1, assignee_id=$2, version=version+1, updated_at=now() WHERE id=$3 AND version=$4 AND verification='VERIFIED' AND archived_at IS NULL AND service_owner_org_id=$5 AND state=$7 RETURNING version`, in.TeamID, in.AssigneeID, id, in.ExpectedVersion, before.OwnerOrg, next, before.State).Scan(&nextVersion)
	if e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau tiket telah diperbarui oleh petugas lain")
		}
		return api.Ticket{}, e
	}
	if e = History(ctx, tx, id, nextVersion, actor, command, "Tiket ditugaskan ke teknisi"); e != nil {
		return api.Ticket{}, e
	}
	if e = Event(ctx, tx, "AssignmentChanged", id, nextVersion, map[string]any{"team_id": in.TeamID, "assignee_id": in.AssigneeID}, []string{"M9"}); e != nil {
		return api.Ticket{}, e
	}
	ticket, e := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if e != nil {
		return api.Ticket{}, e
	}
	fact := assignment.DispatchFact{TeamID: in.TeamID, AssigneeID: in.AssigneeID, Explanation: in.Reason, Tier: proposal.Level, ProposalDigest: proposal.Digest, RecommendedAssigneeID: proposal.AssigneeID}
	return ticket, emitStateSnapshot(ctx, tx, ticket, &fact)
}

func (s Store) Reject(ctx context.Context, tx pgx.Tx, id, ownerOrg, actor, reason string, expectedVersion int64) (api.Ticket, error) {
	var nextVersion int64
	e := tx.QueryRow(ctx, `UPDATE intake.tickets SET state='CANCELLED', version=version+1, updated_at=now() WHERE id=$1 AND version=$2 AND state IN ('OPEN','TRIAGED','NEEDS_INFORMATION') AND archived_at IS NULL AND service_owner_org_id=$3 RETURNING version`, id, expectedVersion, ownerOrg).Scan(&nextVersion)
	if e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau tiket telah diproses; muat ulang")
		}
		return api.Ticket{}, e
	}
	if e = History(ctx, tx, id, nextVersion, actor, "RejectTicket", "Tiket ditolak oleh operator: "+reason); e != nil {
		return api.Ticket{}, e
	}
	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitState(ctx, tx, ticket)
}

func (s Store) QueueVerification(ctx context.Context, scope Scope, p web.Page) ([]api.Ticket, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE t.service_owner_org_id=ANY($1::uuid[]) AND t.state='OPEN' AND t.verification='PENDING' AND t.archived_at IS NULL AND ($2='' OR t.id::text>$2) ORDER BY t.id LIMIT $3`, scope.Orgs, p.Cursor, p.Limit+1)
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

func (s Store) QueueDispatch(ctx context.Context, scope Scope, p web.Page) ([]api.Ticket, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE t.service_owner_org_id=ANY($1::uuid[]) AND t.verification='VERIFIED' AND t.state IN ('TRIAGED','OPEN') AND t.archived_at IS NULL AND ($2='' OR t.id::text>$2) ORDER BY t.id LIMIT $3`, scope.Orgs, p.Cursor, p.Limit+1)
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

func (s Store) QueueMyTasks(ctx context.Context, scope Scope, p web.Page) ([]api.Ticket, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE t.assignee_id=$1 AND t.service_owner_org_id=ANY($4::uuid[]) AND t.state IN ('ASSIGNED','IN_PROGRESS') AND t.archived_at IS NULL AND ($2='' OR t.id::text>$2) ORDER BY t.id LIMIT $3`, scope.ID, p.Cursor, p.Limit+1, scope.Orgs)
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

func (s Store) Resolve(ctx context.Context, tx pgx.Tx, id, actor string, in api.ResolutionInput, now time.Time) (api.Ticket, string, error) {
	var currentState string
	var currentVersion int64
	var assigneeID *string
	var episode string
	err := tx.QueryRow(ctx, `SELECT state, version, assignee_id::text, episode_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).Scan(&currentState, &currentVersion, &assigneeID, &episode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, "", web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, "", err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, "", web.Fail(409, "Versi tiket berubah; muat ulang data")
	}
	if currentState != "IN_PROGRESS" || assigneeID == nil || *assigneeID != actor {
		return api.Ticket{}, "", web.Fail(409, "Tiket tidak dalam status yang dapat diselesaikan (harus IN_PROGRESS dan ditangani oleh teknisi yang ditugaskan)")
	}

	attemptID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.resolution_attempts(id, version, ticket_id, episode_id, resolved_by, summary, resolved_at, confirmation_due_at, outcome)
		VALUES($1, 1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz + interval '24 hours', 'PENDING')`,
		attemptID, id, episode, actor, in.Summary, now)
	if err != nil {
		return api.Ticket{}, "", err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets
		SET state='RESOLVED', active_attempt_id=$1, version=version+1, updated_at=$2
		WHERE id=$3 AND version=$4 AND state='IN_PROGRESS' AND archived_at IS NULL
		RETURNING version`,
		attemptID, now, id, in.ExpectedVersion).Scan(&nextVersion)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, "", web.Fail(409, "Versi tiket berubah atau tiket telah diselesaikan; muat ulang")
		}
		return api.Ticket{}, "", err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "ResolveTicket", "Tiket diselesaikan oleh teknisi: "+in.Summary); err != nil {
		return api.Ticket{}, "", err
	}

	due24 := now.Add(24 * time.Hour)
	resPayload := map[string]any{
		"attempt_id":          attemptID,
		"confirmation_due_at": due24,
	}
	var recipient string
	if err = tx.QueryRow(ctx, `SELECT requester_id::text FROM intake.tickets WHERE id=$1`, id).Scan(&recipient); err != nil {
		return api.Ticket{}, "", err
	}
	resPayload["requester_id"] = recipient
	if err = Event(ctx, tx, "ResolutionProposed", id, nextVersion, resPayload, []string{"M7", "M9"}); err != nil {
		return api.Ticket{}, "", err
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, "", err
	}

	if err = emitState(ctx, tx, ticket); err != nil {
		return api.Ticket{}, "", err
	}

	return ticket, attemptID, nil
}

func (s Store) Confirm(ctx context.Context, tx pgx.Tx, id, actor string, in api.ConfirmationInput, now time.Time) (api.Ticket, error) {
	var currentState string
	var currentVersion int64
	var activeAttemptID *string
	var episode string
	var acceptedAt, dueAt time.Time
	var serviceID, ownerOrg, requesterID string
	var policyVersion int64
	var assigneeID, handlingTeamID *string

	err := tx.QueryRow(ctx, `SELECT state, version, active_attempt_id::text, episode_id::text, accepted_at, resolution_due_at, service_id::text, service_owner_org_id::text, policy_version, requester_id::text, assignee_id::text, handling_team_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion, &activeAttemptID, &episode, &acceptedAt, &dueAt, &serviceID, &ownerOrg, &policyVersion, &requesterID, &assigneeID, &handlingTeamID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if currentState != "RESOLVED" {
		return api.Ticket{}, web.Fail(409, "Tiket tidak dalam masa konfirmasi resolusi (status harus RESOLVED)")
	}
	if activeAttemptID == nil || *activeAttemptID == "" {
		return api.Ticket{}, web.Fail(409, "Tiket tidak memiliki upaya resolusi aktif")
	}

	if in.AttemptID != "" && in.AttemptID != *activeAttemptID {
		return api.Ticket{}, web.Fail(409, "Upaya resolusi aktif berubah")
	}
	var attemptDue time.Time
	var attemptOutcome string
	err = tx.QueryRow(ctx, `SELECT confirmation_due_at,outcome FROM intake.resolution_attempts WHERE id=$1 AND ticket_id=$2 AND episode_id=$3`, *activeAttemptID, id, episode).Scan(&attemptDue, &attemptOutcome)
	if err != nil {
		return api.Ticket{}, err
	}
	if (attemptOutcome != "PENDING" && attemptOutcome != "REVIEW_REQUIRED") || (in.Decision == "REJECT" && !now.Before(attemptDue)) {
		return api.Ticket{}, web.Fail(409, "Upaya resolusi tidak lagi dapat ditanggapi dengan tindakan ini")
	}
	var nextVersion int64

	switch in.Decision {
	case "ACCEPT":
		confID := web.ID()
		_, err = tx.Exec(ctx, `INSERT INTO intake.confirmation_events(id, version, ticket_id, attempt_id, actor_id, decision)
			VALUES($1, 1, $2, $3, $4, 'ACCEPT')`, confID, id, *activeAttemptID, actor)
		if err != nil {
			return api.Ticket{}, err
		}

		_, err = tx.Exec(ctx, `UPDATE intake.resolution_attempts SET outcome='ACCEPTED', updated_at=$1 WHERE id=$2 AND ticket_id=$3`, now, *activeAttemptID, id)
		if err != nil {
			return api.Ticket{}, err
		}

		err = tx.QueryRow(ctx, `UPDATE intake.tickets SET state='CLOSED', version=version+1, updated_at=$1 WHERE id=$2 AND version=$3 AND state='RESOLVED' RETURNING version`, now, id, in.ExpectedVersion).Scan(&nextVersion)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau tiket telah ditutup; muat ulang")
			}
			return api.Ticket{}, err
		}

		if err = History(ctx, tx, id, nextVersion, actor, "ConfirmResolution", "Konfirmasi diterima: Pemohon menyetujui hasil penanganan"); err != nil {
			return api.Ticket{}, err
		}

		if err = Event(ctx, tx, "ConfirmationRecorded", id, nextVersion, map[string]any{"attempt_id": *activeAttemptID, "decision": "ACCEPT"}, []string{"M6", "M7", "M9"}); err != nil {
			return api.Ticket{}, err
		}

	case "REJECT":
		confID := web.ID()
		_, err = tx.Exec(ctx, `INSERT INTO intake.confirmation_events(id, version, ticket_id, attempt_id, actor_id, decision)
			VALUES($1, 1, $2, $3, $4, 'REJECT')`, confID, id, *activeAttemptID, actor)
		if err != nil {
			return api.Ticket{}, err
		}

		_, err = tx.Exec(ctx, `UPDATE intake.resolution_attempts SET outcome='REJECTED', updated_at=$1 WHERE id=$2 AND ticket_id=$3`, now, *activeAttemptID, id)
		if err != nil {
			return api.Ticket{}, err
		}

		err = tx.QueryRow(ctx, `UPDATE intake.tickets SET state='IN_PROGRESS', active_attempt_id=NULL, version=version+1, updated_at=$1 WHERE id=$2 AND version=$3 AND state='RESOLVED' RETURNING version`, now, id, in.ExpectedVersion).Scan(&nextVersion)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau tiket telah ditanggapi; muat ulang")
			}
			return api.Ticket{}, err
		}

		if err = History(ctx, tx, id, nextVersion, actor, "RejectResolution", "Penolakan resolusi oleh pemohon: "+in.Reason); err != nil {
			return api.Ticket{}, err
		}

		if err = Event(ctx, tx, "ConfirmationRecorded", id, nextVersion, map[string]any{"attempt_id": *activeAttemptID, "decision": "REJECT"}, []string{"M6", "M7", "M9"}); err != nil {
			return api.Ticket{}, err
		}

	case "FEEDBACK":
		confID := web.ID()
		_, err = tx.Exec(ctx, `INSERT INTO intake.confirmation_events(id, version, ticket_id, attempt_id, actor_id, decision)
			VALUES($1, 1, $2, $3, $4, 'FEEDBACK')`, confID, id, *activeAttemptID, actor)
		if err != nil {
			return api.Ticket{}, err
		}

		_, err = tx.Exec(ctx, `UPDATE intake.resolution_attempts SET outcome='REVIEW_REQUIRED', updated_at=$1 WHERE id=$2 AND ticket_id=$3 AND outcome='PENDING'`, now, *activeAttemptID, id)
		if err != nil {
			return api.Ticket{}, err
		}

		err = tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1, updated_at=$1 WHERE id=$2 AND version=$3 RETURNING version`, now, id, in.ExpectedVersion).Scan(&nextVersion)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang")
			}
			return api.Ticket{}, err
		}

		if err = History(ctx, tx, id, nextVersion, actor, "AddFeedback", "Tanggapan pemohon masa konfirmasi: "+in.Feedback); err != nil {
			return api.Ticket{}, err
		}

		if err = Event(ctx, tx, "ConfirmationRecorded", id, nextVersion, map[string]any{"attempt_id": *activeAttemptID, "decision": "FEEDBACK"}, []string{"M6", "M7", "M9"}); err != nil {
			return api.Ticket{}, err
		}
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, err
	}
	if in.Decision != "FEEDBACK" {
		err = emitState(ctx, tx, ticket)
	}
	return ticket, err
}

func (s Store) AutoClose(ctx context.Context, tx pgx.Tx, id string, in api.AutoCloseInput, now time.Time) (api.Ticket, error) {
	var currentState string
	var currentVersion int64
	var activeAttemptID *string
	var episode string
	var acceptedAt, dueAt time.Time
	var serviceID, ownerOrg, requesterID string
	var policyVersion int64
	var assigneeID, handlingTeamID *string

	err := tx.QueryRow(ctx, `SELECT state, version, active_attempt_id::text, episode_id::text, accepted_at, resolution_due_at, service_id::text, service_owner_org_id::text, policy_version, requester_id::text, assignee_id::text, handling_team_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion, &activeAttemptID, &episode, &acceptedAt, &dueAt, &serviceID, &ownerOrg, &policyVersion, &requesterID, &assigneeID, &handlingTeamID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, err
	}

	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah atau telah ditanggapi (CAS guard)")
	}
	if currentState != "RESOLVED" {
		return api.Ticket{}, web.Fail(409, "Tiket tidak dalam status RESOLVED")
	}
	if activeAttemptID == nil || *activeAttemptID != in.AttemptID {
		return api.Ticket{}, web.Fail(409, "Upaya resolusi aktif tidak cocok atau telah kedaluwarsa")
	}

	var outcome string
	var confirmationDueAt, resolvedAt time.Time
	err = tx.QueryRow(ctx, `SELECT outcome, confirmation_due_at, resolved_at FROM intake.resolution_attempts WHERE id=$1 AND ticket_id=$2`, in.AttemptID, id).Scan(&outcome, &confirmationDueAt, &resolvedAt)
	if err != nil {
		return api.Ticket{}, err
	}
	if outcome != "PENDING" {
		return api.Ticket{}, web.Fail(409, "Upaya resolusi berstatus "+outcome+"; auto-close ditahan atau tidak diizinkan")
	}

	if now.Before(confirmationDueAt) {
		return api.Ticket{}, web.Fail(409, "Batas waktu konfirmasi 24 jam kalender belum terlampaui")
	}

	var proofExists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM intake.confirmation_notifications WHERE ticket_id=$1 AND attempt_id=$2)`, id, in.AttemptID).Scan(&proofExists)
	if err != nil {
		return api.Ticket{}, err
	}
	if !proofExists {
		return api.Ticket{}, web.Fail(412, "CONFIRMATION_NOTIFICATION_MISSING: Bukti notifikasi belum durable di intake")
	}

	var nextVersion int64
	_, err = tx.Exec(ctx, `UPDATE intake.resolution_attempts SET outcome='AUTO_NO_RESPONSE', updated_at=$1 WHERE id=$2 AND ticket_id=$3 AND outcome='PENDING'`, now, in.AttemptID, id)
	if err != nil {
		return api.Ticket{}, err
	}

	confID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.confirmation_events(id, version, ticket_id, attempt_id, actor_id, decision)
		VALUES($1, 1, $2, $3, '00000000-0000-4000-8000-000000000000', 'AUTO_NO_RESPONSE')`,
		confID, id, in.AttemptID)
	if err != nil {
		return api.Ticket{}, err
	}

	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET state='CLOSED', version=version+1, updated_at=$1 WHERE id=$2 AND version=$3 AND state='RESOLVED' RETURNING version`, now, id, in.ExpectedVersion).Scan(&nextVersion)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(409, "Versi tiket berubah (CAS collision); auto-close dibatalkan")
		}
		return api.Ticket{}, err
	}

	if err = History(ctx, tx, id, nextVersion, "00000000-0000-4000-8000-000000000000", "AutoCloseTicket", "Tiket ditutup otomatis oleh sistem setelah 24 jam kalender tanpa tanggapan"); err != nil {
		return api.Ticket{}, err
	}

	if err = Event(ctx, tx, "ConfirmationRecorded", id, nextVersion, map[string]any{"attempt_id": in.AttemptID, "decision": "AUTO_NO_RESPONSE"}, []string{"M6", "M7", "M9"}); err != nil {
		return api.Ticket{}, err
	}
	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitState(ctx, tx, ticket)
}

func (s Store) StoreConfirmationNotification(ctx context.Context, ticketID, attemptID, notificationID, eventID string, storedAt time.Time) error {
	id := web.ID()
	_, err := s.Pool.Exec(ctx, `INSERT INTO intake.confirmation_notifications(id, version, ticket_id, attempt_id, notification_id, event_id, stored_at)
		VALUES($1, 1, $2, $3, $4, $5, $6)
		ON CONFLICT(ticket_id, attempt_id, notification_id) DO NOTHING`,
		id, ticketID, attemptID, notificationID, eventID, storedAt)
	return err
}

func (s Store) ListResolutionAttempts(ctx context.Context, ticketID string) ([]api.ResolutionAttempt, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, version, ticket_id::text, episode_id::text, resolved_by::text, summary, resolved_at, confirmation_due_at, outcome
		FROM intake.resolution_attempts WHERE ticket_id=$1 ORDER BY resolved_at DESC`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []api.ResolutionAttempt
	for rows.Next() {
		var a api.ResolutionAttempt
		if err := rows.Scan(&a.ID, &a.Version, &a.TicketID, &a.EpisodeID, &a.ResolvedBy, &a.Summary, &a.ResolvedAt, &a.ConfirmationDueAt, &a.Outcome); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (s Store) RecordVendorCase(ctx context.Context, tx pgx.Tx, id string, actor string, in api.VendorCaseInput, now time.Time) (api.Ticket, string, error) {
	var currentState string
	var currentVersion int64
	err := tx.QueryRow(ctx, `SELECT state, version FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, "", web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, "", err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, "", web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if currentState == "CLOSED" || currentState == "CANCELLED" {
		return api.Ticket{}, "", web.Fail(409, "Tiket sudah ditutup atau dibatalkan")
	}

	caseID := web.ID()
	evidenceIDs := in.EvidenceIDs
	if evidenceIDs == nil {
		evidenceIDs = []string{}
	}

	_, err = tx.Exec(ctx, `INSERT INTO intake.vendor_cases(id, version, ticket_id, vendor_id, internal_pic_id, external_reference, contract_reference, evidence_ids, expected_return_at, next_followup_at)
		VALUES($1, 1, $2, $3, $4, $5, $6, $7::uuid[], $8, $9)`,
		caseID, id, in.VendorID, in.InternalPICID, in.ExternalReference, in.ContractReference, evidenceIDs, in.ExpectedReturnAt, in.NextFollowupAt)
	if err != nil {
		return api.Ticket{}, "", err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1, updated_at=$1 WHERE id=$2 RETURNING version`, now, id).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, "", err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "RecordVendorCase", "Kasus vendor dicatat: "+in.ExternalReference); err != nil {
		return api.Ticket{}, "", err
	}

	payload := map[string]any{
		"case_id":          caseID,
		"internal_pic_id":  in.InternalPICID,
		"next_followup_at": in.NextFollowupAt.Format(time.RFC3339),
	}
	if err := Event(ctx, tx, "VendorCaseRecorded", id, nextVersion, payload, []string{"M7", "M9"}); err != nil {
		return api.Ticket{}, "", err
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	return ticket, caseID, err
}

func (s Store) ApprovePause(ctx context.Context, tx pgx.Tx, id string, actor string, in api.PauseInput, now time.Time) (api.Ticket, string, error) {
	var currentState, episode string
	var currentVersion int64
	err := tx.QueryRow(ctx, `SELECT state, version, episode_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion, &episode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, "", web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, "", err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, "", web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if currentState == "CLOSED" || currentState == "CANCELLED" || currentState == "RESOLVED" {
		return api.Ticket{}, "", web.Fail(409, "Jeda hanya dapat disetujui pada episode aktif")
	}

	pauseID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.pause_intervals(id, version, ticket_id, starts_at, ends_at, approved_by, policy_version, reason, episode_id)
		VALUES($1, 1, $2, $3, $4, $5, $6, $7, $8)`,
		pauseID, id, now, in.Until, actor, in.PolicyVersion, in.Reason, episode)
	if err != nil {
		return api.Ticket{}, "", err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1, updated_at=$1 WHERE id=$2 RETURNING version`, now, id).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, "", err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "ApprovePause", "Jeda penanganan berizin disetujui: "+in.Reason); err != nil {
		return api.Ticket{}, "", err
	}

	payload := map[string]any{
		"pause_id":       pauseID,
		"policy_version": in.PolicyVersion,
	}
	if err := Event(ctx, tx, "PauseChanged", id, nextVersion, payload, []string{"M7", "M9"}); err != nil {
		return api.Ticket{}, "", err
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, "", err
	}
	return ticket, pauseID, emitState(ctx, tx, ticket)
}

func (s Store) RequestHandoff(ctx context.Context, tx pgx.Tx, id string, actor string, in api.HandoffInput, now time.Time) (api.Ticket, string, error) {
	var currentState string
	var currentVersion int64
	var currentOwnerOrg string
	err := tx.QueryRow(ctx, `SELECT state, version, service_owner_org_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion, &currentOwnerOrg)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, "", web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, "", err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Ticket{}, "", web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if currentState == "CLOSED" || currentState == "CANCELLED" {
		return api.Ticket{}, "", web.Fail(409, "Tiket sudah ditutup atau dibatalkan")
	}
	if currentOwnerOrg == in.TargetOrgID {
		return api.Ticket{}, "", web.Fail(400, "OPD tujuan transfer harus berbeda dengan OPD pemilik tiket saat ini")
	}

	var hasPending bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT FROM intake.handoff_requests WHERE ticket_id=$1 AND state='PENDING')`, id).Scan(&hasPending)
	if err != nil {
		return api.Ticket{}, "", err
	}
	if hasPending {
		return api.Ticket{}, "", web.Fail(409, "Masih terdapat permohonan handoff yang menunggu persetujuan")
	}

	handoffID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.handoff_requests(id, version, ticket_id, from_org_id, target_org_id, target_team_id, requested_by, reason, state)
		VALUES($1, 1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
		handoffID, id, currentOwnerOrg, in.TargetOrgID, in.TargetTeamID, actor, in.Reason)
	if err != nil {
		return api.Ticket{}, "", err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1, updated_at=$1 WHERE id=$2 RETURNING version`, now, id).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, "", err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "RequestHandoff", "Permohonan handoff diajukan ke OPD tujuan: "+in.Reason); err != nil {
		return api.Ticket{}, "", err
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	return ticket, handoffID, err
}

func (s Store) ReadHandoffOffer(ctx context.Context, ticket, id string, orgs []string) (api.HandoffOffer, error) {
	var offer api.HandoffOffer
	err := s.Pool.QueryRow(ctx, `
  SELECT h.id::text,t.id::text,t.version,h.from_org_id::text,h.target_org_id::text,h.target_team_id::text
  FROM intake.handoff_requests h JOIN intake.tickets t ON t.id=h.ticket_id
  WHERE h.id=$1 AND t.id=$2 AND h.target_org_id=ANY($3::uuid[])
    AND h.state='PENDING' AND t.service_owner_org_id=h.from_org_id
    AND t.archived_at IS NULL AND t.state NOT IN ('CLOSED','CANCELLED')`, id, ticket, orgs).
		Scan(&offer.ID, &offer.TicketID, &offer.TicketVersion, &offer.FromOrgID, &offer.TargetOrgID, &offer.TargetTeamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return offer, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	return offer, err
}

func (s Store) AcceptHandoff(ctx context.Context, tx pgx.Tx, id string, handoffID string, actor string, actorOrgs []string, in api.AcceptHandoffInput, now time.Time) (api.Ticket, error) {
	var fromOrgID, targetOrgID, targetTeamID, state string
	err := tx.QueryRow(ctx, `SELECT from_org_id::text, target_org_id::text, target_team_id::text, state FROM intake.handoff_requests WHERE id=$1 AND ticket_id=$2 FOR UPDATE`, handoffID, id).
		Scan(&fromOrgID, &targetOrgID, &targetTeamID, &state)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
		}
		return api.Ticket{}, err
	}
	if state != "PENDING" {
		return api.Ticket{}, web.Fail(409, "Permohonan handoff sudah diproses")
	}

	targetMatch := false
	for _, o := range actorOrgs {
		if o == targetOrgID {
			targetMatch = true
			break
		}
	}
	if !targetMatch {
		return api.Ticket{}, web.Fail(403, "Hanya koordinator atau staf berwenang OPD tujuan yang dapat menerima handoff")
	}

	var currentVersion int64
	var currentState, owner string
	err = tx.QueryRow(ctx, `SELECT version,state,service_owner_org_id::text FROM intake.tickets WHERE id=$1 AND archived_at IS NULL FOR UPDATE`, id).
		Scan(&currentVersion, &currentState, &owner)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, err
	}
	if currentVersion != in.ExpectedVersion || owner != fromOrgID || currentState == "CLOSED" || currentState == "CANCELLED" {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}

	_, err = tx.Exec(ctx, `UPDATE intake.handoff_requests SET state='ACCEPTED',version=version+1, accepted_by=$1, accepted_at=$2, updated_at=$2 WHERE id=$3`, actor, now, handoffID)
	if err != nil {
		return api.Ticket{}, err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET service_owner_org_id=$1, handling_team_id=$2, assignee_id=NULL, version=version+1, updated_at=$3 WHERE id=$4 RETURNING version`,
		targetOrgID, targetTeamID, now, id).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "AcceptHandoff", "Handoff diterima: Tanggung jawab beralih ke OPD tujuan ("+in.Reason+")"); err != nil {
		return api.Ticket{}, err
	}

	handoffPayload := map[string]any{
		"from_org_id": fromOrgID,
		"to_org_id":   targetOrgID,
		"team_id":     targetTeamID,
	}
	if err = Event(ctx, tx, "HandoffAccepted", id, nextVersion, handoffPayload, []string{"M5", "M6", "M7", "M9"}); err != nil {
		return api.Ticket{}, err
	}

	ticket, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
	if err != nil {
		return api.Ticket{}, err
	}
	return ticket, emitState(ctx, tx, ticket)
}

func (s Store) RequestEscalation(ctx context.Context, tx pgx.Tx, id string, actor string, in api.EscalateInput, now time.Time) (api.Operation, error) {
	var currentVersion int64
	var currentState, episode string
	err := tx.QueryRow(ctx, `SELECT state, version, episode_id::text FROM intake.tickets WHERE id=$1 FOR UPDATE`, id).
		Scan(&currentState, &currentVersion, &episode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Operation{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Operation{}, err
	}
	if currentVersion != in.ExpectedVersion {
		return api.Operation{}, web.Fail(409, "Versi tiket berubah; muat ulang")
	}
	if currentState == "CLOSED" || currentState == "CANCELLED" {
		return api.Operation{}, web.Fail(409, "Tiket sudah ditutup atau dibatalkan")
	}

	escalationID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.escalation_marks(id, version, ticket_id, episode_id, level, rule_version, reason)
		VALUES($1, 1, $2, $3, $4, 1, $5)`, escalationID, id, episode, in.Level, in.Reason)
	if err != nil {
		return api.Operation{}, err
	}

	operationID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO intake.operations(id, version, ticket_id, principal_id, kind, state, reason, updated_at)
		VALUES($1, 1, $2, $3, 'ESCALATE', 'SUCCEEDED', $4, $5)`, operationID, id, actor, in.Reason, now)
	if err != nil {
		return api.Operation{}, err
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `UPDATE intake.tickets SET version=version+1, updated_at=$1 WHERE id=$2 RETURNING version`, now, id).Scan(&nextVersion)
	if err != nil {
		return api.Operation{}, err
	}

	if err = History(ctx, tx, id, nextVersion, actor, "EscalateTicket", fmt.Sprintf("Eskalasi ke tingkat %s diajukan: %s", in.Level, in.Reason)); err != nil {
		return api.Operation{}, err
	}

	payload := map[string]any{
		"operation_id": operationID,
		"level":        in.Level,
	}
	if err := Event(ctx, tx, "EscalationRequested", id, nextVersion, payload, []string{"M7", "M9"}); err != nil {
		return api.Operation{}, err
	}

	return api.Operation{
		ID:          operationID,
		Version:     1,
		TicketID:    id,
		PrincipalID: actor,
		Kind:        "ESCALATE",
		State:       "SUCCEEDED",
		Reason:      in.Reason,
		UpdatedAt:   now,
	}, nil
}

func (s Store) ReadOperation(ctx context.Context, opID string) (api.Operation, error) {
	var op api.Operation
	err := s.Pool.QueryRow(ctx, `SELECT id::text, version, ticket_id::text, principal_id::text, kind, state, reason, updated_at
		FROM intake.operations WHERE id=$1`, opID).
		Scan(&op.ID, &op.Version, &op.TicketID, &op.PrincipalID, &op.Kind, &op.State, &op.Reason, &op.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Operation{}, web.Fail(404, "Operasi tidak ditemukan")
		}
		return api.Operation{}, err
	}
	return op, nil
}

func (s Store) ListPauses(ctx context.Context, ticketID string) ([]api.PauseInterval, error) {
	rows, err := s.Pool.Query(ctx, `SELECT starts_at, ends_at, policy_version, reason FROM intake.pause_intervals WHERE ticket_id=$1 ORDER BY starts_at ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pauses []api.PauseInterval
	for rows.Next() {
		var p api.PauseInterval
		if err := rows.Scan(&p.StartsAt, &p.EndsAt, &p.PolicyVersion, &p.Reason); err != nil {
			return nil, err
		}
		pauses = append(pauses, p)
	}
	return pauses, rows.Err()
}

func (s Store) SearchTickets(ctx context.Context, actorID string, isGuest bool, guestCapHash []byte, orgIDs []string, query string, limit int, roles ...string) ([]api.SearchHit, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	pattern := "%" + query + "%"

	var rows pgx.Rows
	var err error

	if isGuest && len(guestCapHash) == 32 {
		rows, err = s.Pool.Query(ctx, `
			SELECT t.id::text, t.title, t.description
			FROM intake.tickets t
			JOIN intake.guest_capabilities gc ON gc.ticket_id = t.id
			WHERE gc.capability_hash = $1
			  AND gc.expires_at > now()
			  AND gc.revoked_at IS NULL
 AND 'ticket.read'=ANY(gc.scopes)
			  AND (t.title ILIKE $2 OR t.description ILIKE $2)
			ORDER BY t.id ASC
			LIMIT $3
		`, guestCapHash, pattern, limit)
	} else if actorID != "" {
		role := "PUBLIC"
		if len(roles) == 1 {
			role = roles[0]
		}
		rows, err = s.Pool.Query(ctx, `SELECT t.id::text,t.title,t.description FROM intake.tickets t WHERE `+visible+` AND (t.title ILIKE $5 OR t.description ILIKE $5) ORDER BY t.id LIMIT $6`, actorID, "", orgIDs, role, pattern, limit)

	} else {
		return []api.SearchHit{}, nil
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := make([]api.SearchHit, 0)
	for rows.Next() {
		var id, title, desc string
		if err := rows.Scan(&id, &title, &desc); err != nil {
			return nil, err
		}
		snippet := desc
		if len(snippet) > 200 {
			snippet = snippet[:200] + "..."
		}
		hits = append(hits, api.SearchHit{
			ID:      id,
			Owner:   "M3",
			Kind:    "TICKET",
			Title:   title,
			Snippet: snippet,
		})
	}
	return hits, nil
}

// Archive archives a ticket if it is in terminal state (CLOSED or CANCELLED) (AC22).
func (s Store) Archive(ctx context.Context, tx pgx.Tx, id, actor string, in api.ArchiveInput, now time.Time) (api.Ticket, error) {
	var currentState string
	var currentVersion int64
	var isArchived bool

	err := tx.QueryRow(ctx, `SELECT state, version, (archived_at IS NOT NULL) FROM intake.tickets WHERE id = $1`, id).
		Scan(&currentState, &currentVersion, &isArchived)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, err
	}

	if isArchived {
		return api.Ticket{}, web.Fail(409, "Tiket sudah diarsipkan")
	}

	if currentState != "CLOSED" && currentState != "CANCELLED" {
		return api.Ticket{}, web.Fail(409, "Hanya tiket berstatus terminal (CLOSED atau CANCELLED) yang dapat diarsipkan")
	}

	if in.ExpectedVersion != currentVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang data sebelum mengarsipkan")
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `
		UPDATE intake.tickets
		SET archived_at = $1, version = version + 1, updated_at = $1
		WHERE id = $2 AND version = $3
		RETURNING version
	`, now, id, in.ExpectedVersion).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, err
	}

	reason := in.Reason
	if reason == "" {
		reason = "Tiket diarsipkan"
	}

	if err = History(ctx, tx, id, nextVersion, actor, "ArchiveTicket", fmt.Sprintf("Tiket diarsipkan: %s", reason)); err != nil {
		return api.Ticket{}, err
	}

	return scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
}

// RestoreArchive restores an archived ticket (AC22).
func (s Store) RestoreArchive(ctx context.Context, tx pgx.Tx, id, actor string, in api.RestoreArchiveInput, now time.Time) (api.Ticket, error) {
	var currentVersion int64
	var isArchived bool

	err := tx.QueryRow(ctx, `SELECT version, (archived_at IS NOT NULL) FROM intake.tickets WHERE id = $1`, id).
		Scan(&currentVersion, &isArchived)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Ticket{}, web.Fail(404, "Tiket tidak ditemukan")
		}
		return api.Ticket{}, err
	}

	if !isArchived {
		return api.Ticket{}, web.Fail(409, "Tiket tidak dalam kondisi terarsip")
	}

	if in.ExpectedVersion != currentVersion {
		return api.Ticket{}, web.Fail(409, "Versi tiket berubah; muat ulang data sebelum memulihkan")
	}

	var nextVersion int64
	err = tx.QueryRow(ctx, `
		UPDATE intake.tickets
		SET archived_at = NULL, version = version + 1, updated_at = $1
		WHERE id = $2 AND version = $3
		RETURNING version
	`, now, id, in.ExpectedVersion).Scan(&nextVersion)
	if err != nil {
		return api.Ticket{}, err
	}

	reason := in.Reason
	if reason == "" {
		reason = "Tiket dipulihkan dari arsip"
	}

	if err = History(ctx, tx, id, nextVersion, actor, "RestoreTicketArchive", fmt.Sprintf("Tiket dipulihkan dari arsip: %s", reason)); err != nil {
		return api.Ticket{}, err
	}

	return scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM intake.tickets t WHERE id=$1`, id))
}

func (s Store) AutoCloseFacts(ctx context.Context, id string) (state string, active, outcome *string, version int64, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT t.state,t.active_attempt_id::text,a.outcome,t.version
		FROM intake.tickets t LEFT JOIN intake.resolution_attempts a ON a.id=t.active_attempt_id AND a.ticket_id=t.id AND a.episode_id=t.episode_id
		WHERE t.id=$1`, id).Scan(&state, &active, &outcome, &version)
	return
}

func (s Store) JobScope(ctx context.Context, ticket string, orgs []string) (bool, error) {
	var allowed bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM intake.tickets WHERE id=$1 AND service_owner_org_id=ANY($2::uuid[]))`, ticket, orgs).Scan(&allowed)
	return allowed, err
}
