package app

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

var validTicketStates = map[string]bool{
	"OPEN": true, "TRIAGED": true, "NEEDS_INFORMATION": true, "ASSIGNED": true,
	"IN_PROGRESS": true, "RESOLVED": true, "CLOSED": true, "CANCELLED": true,
}

func (s *Service) ListFiltered(ctx context.Context, c Credentials, p web.Page, state, serviceID, query string) (any, error) {
	actor, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	state = strings.ToUpper(strings.TrimSpace(state))
	if state != "" && !validTicketStates[state] {
		return nil, web.Fail(400, "Filter status tiket tidak valid")
	}
	serviceID = strings.TrimSpace(serviceID)
	if serviceID != "" && !web.UUID(serviceID) {
		return nil, web.Fail(400, "Filter layanan tidak valid")
	}
	query = strings.TrimSpace(query)
	if query != "" && (len(query) < 2 || len(query) > 100) {
		return nil, web.Fail(400, "Kata kunci tiket harus 2–100 byte")
	}
	tickets, err := s.Store.ListFiltered(ctx, scope, p, state, serviceID, query)
	if err != nil {
		return nil, err
	}
	if scope.Internal {
		if err := s.assessAbsences(ctx, actor, tickets); err != nil {
			return nil, err
		}
	}
	return web.List(tickets, p.Limit, func(item api.Ticket) string { return item.ID }), nil
}

func (s *Service) assessAbsences(ctx context.Context, actor identity.Actor, tickets []api.Ticket) error {
	indexes := []int{}
	subjects := []string{}
	for i, ticket := range tickets {
		if ticket.AssigneeID == nil || ticket.HandlingTeamID == nil || (ticket.State != "ASSIGNED" && ticket.State != "IN_PROGRESS") {
			continue
		}
		if !actor.HasTeamMandate(ticket.OwnerOrg, *ticket.HandlingTeamID, "ticket.dispatch") {
			continue
		}
		indexes = append(indexes, i)
		subjects = append(subjects, *ticket.AssigneeID)
	}
	if len(subjects) == 0 {
		return nil
	}
	absent, err := s.Assignment.AbsentTechnicians(ctx, subjects)
	if err != nil {
		return err
	}
	for _, i := range indexes {
		tickets[i].AssignmentNeedsReview = absent[*tickets[i].AssigneeID]
	}
	return nil
}

func (s *Service) ReadOperationalRecords(ctx context.Context, c Credentials, id string) (map[string]any, error) {
	_, scope, _, e := s.authorized(ctx, c, id, false)
	if e != nil {
		return nil, e
	}
	if !scope.Internal {
		return nil, web.Fail(403, "Catatan operasional internal hanya untuk petugas berizin")
	}
	return s.Store.ReadOperationalRecords(ctx, id)
}

func (s *Service) CloseVendorCase(ctx context.Context, c Credentials, id, caseID, key string, in api.CloseVendorCaseInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !web.UUID(caseID) {
		return database.Result{}, web.Fail(404, "Kasus vendor tidak ditemukan")
	}
	if !scope.Internal || (!a.Can("ticket.vendor", v.OwnerOrg) && !technicianAllowed(a, scope, v)) {
		return database.Result{}, web.Fail(403, "Izin koordinasi vendor diperlukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Versi tiket dan ringkasan penutupan vendor wajib diisi (minimal 5 karakter)")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "CloseVendorCase", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: struct {
			CaseID string `json:"case_id"`
			api.CloseVendorCaseInput
		}{caseID, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.CloseVendorCase(ctx, tx, id, caseID, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{"id": caseID, "version": updated.Version, "ticket_id": updated.ID, "state": "CLOSED"})
	})
}

func (s *Service) ResumePause(ctx context.Context, c Credentials, id, pauseID, key string, in api.ArchiveInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !web.UUID(pauseID) {
		return database.Result{}, web.Fail(404, "Jeda SLA tidak ditemukan")
	}
	if !scope.Internal || !a.Can("ticket.pause", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin koordinator untuk mengelola jeda diperlukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Versi tiket dan alasan pengakhiran jeda wajib diisi")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "ResumePause", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: struct {
			PauseID string `json:"pause_id"`
			api.ArchiveInput
		}{pauseID, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.ResumePause(ctx, tx, id, pauseID, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{"id": pauseID, "version": updated.Version, "ticket_id": updated.ID, "state": "RESUMED"})
	})
}

func (s *Service) ListHandoffs(ctx context.Context, c Credentials, limit int) ([]api.HandoffSummary, error) {
	a, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	if !scope.Internal {
		return nil, web.Fail(403, "Hanya petugas internal yang dapat melihat antrean handoff")
	}
	acceptOrgs := []string{}
	for _, o := range a.Orgs("ticket.handoff.accept") {
		if a.Can("ticket.read", o) {
			acceptOrgs = append(acceptOrgs, o)
		}
	}
	outgoingOrgs := []string{}
	for _, o := range a.Orgs("ticket.handoff") {
		if a.Can("ticket.read", o) {
			outgoingOrgs = append(outgoingOrgs, o)
		}
	}
	if len(acceptOrgs) == 0 && len(outgoingOrgs) == 0 {
		return nil, web.Fail(403, "Izin pengelolaan handoff diperlukan")
	}
	return s.Store.ListHandoffs(ctx, acceptOrgs, outgoingOrgs, limit)
}

func (s *Service) RejectHandoff(ctx context.Context, c Credentials, id, handoffID, key string, in api.AcceptHandoffInput) (database.Result, error) {
	a, scope, e := s.actor(ctx, c, true)
	if e != nil {
		return database.Result{}, e
	}
	acceptOrgs := []string{}
	for _, org := range a.Orgs("ticket.handoff.accept") {
		if a.Can("ticket.read", org) {
			acceptOrgs = append(acceptOrgs, org)
		}
	}
	if !scope.Internal || len(acceptOrgs) == 0 {
		return database.Result{}, web.Fail(403, "Izin penerimaan/penolakan handoff diperlukan")
	}
	if !web.UUID(id) || !web.UUID(handoffID) {
		return database.Result{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Versi tiket dan alasan penolakan handoff wajib diisi (minimal 5 karakter)")
	}
	offer, err := s.Store.ReadHandoffOffer(ctx, id, handoffID, acceptOrgs)
	if err != nil {
		return database.Result{}, err
	}
	if err = identity.CheckMaintenance(ctx, s.Identity, false, offer.FromOrgID, offer.TargetOrgID); err != nil {
		return database.Result{}, err
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "RejectHandoff", Target: id, Key: key, Scope: handoffID, Reason: in.Reason, Payload: struct {
			HandoffID string `json:"handoff_id"`
			api.AcceptHandoffInput
		}{handoffID, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.ResolveHandoffPending(ctx, tx, id, handoffID, a.ID, acceptOrgs, "REJECTED", in.Reason, in.ExpectedVersion, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
}

func (s *Service) CancelHandoff(ctx context.Context, c Credentials, id, handoffID, key string, in api.AcceptHandoffInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.handoff", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin pembatalan handoff diperlukan")
	}
	if !web.UUID(handoffID) {
		return database.Result{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Versi tiket dan alasan pembatalan wajib diisi (minimal 5 karakter)")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "CancelHandoff", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: struct {
			HandoffID string `json:"handoff_id"`
			api.AcceptHandoffInput
		}{handoffID, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.ResolveHandoffPending(ctx, tx, id, handoffID, a.ID, []string{v.OwnerOrg}, "CANCELLED", in.Reason, in.ExpectedVersion, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
}

func (s *Service) RecordWorkLog(ctx context.Context, c Credentials, id, key string, in api.WorkLogInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.worklog", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin pencatatan log kerja (ticket.worklog) diperlukan")
	}
	in.Summary = strings.TrimSpace(in.Summary)
	now := s.now()
	if in.ExpectedVersion < 1 || len(in.Summary) < 3 || len(in.Summary) > 2000 || in.StartedAt.IsZero() || in.EndedAt.IsZero() || in.EndedAt.Before(in.StartedAt) {
		return database.Result{}, web.Fail(422, "Versi, rentang waktu kerja valid, dan ringkasan kerja wajib diisi")
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "RecordWorkLog", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Summary, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		rec, err := s.Store.RecordWorkLog(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, rec)
	})
}

func (s *Service) BulkTicketCommand(ctx context.Context, c Credentials, key string, in api.BulkCommandInput) (database.Result, error) {
	a, scope, e := s.actor(ctx, c, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || len(a.Orgs("ticket.bulk")) == 0 {
		return database.Result{}, web.Fail(403, "Izin tindakan massal (ticket.bulk) diperlukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if (in.Action != "ARCHIVE" && in.Action != "REASSIGN") || len(in.Targets) == 0 || len(in.Targets) > 50 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Aksi massal (ARCHIVE/REASSIGN), daftar target 1-50, dan alasan minimal 5 karakter wajib diisi")
	}
	if in.Action == "REASSIGN" && (!web.UUID(in.TeamID) || !web.UUID(in.AssigneeID)) {
		return database.Result{}, web.Fail(422, "Reassign massal memerlukan tim dan teknisi tujuan yang valid")
	}
	mut := database.Mutation{Owner: "M3", Actor: a.ID, Command: "BulkTicketCommand", Target: a.ID, Key: key, Scope: in.Action, Reason: in.Reason, Payload: in}
	if cached, found, err := database.LookupIdempotency(ctx, s.Store.Pool, mut); err != nil || found {
		return cached, err
	}

	results := make([]api.BulkItemResult, 0, len(in.Targets))
	for _, target := range in.Targets {
		if !web.UUID(target.ID) || target.ExpectedVersion < 1 {
			results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "NOT_FOUND", Version: max64(target.ExpectedVersion, 1)})
			continue
		}
		ticket, itemScope, itemActor, err := s.authorized(ctx, c, target.ID, false)
		if err != nil {
			results = append(results, api.BulkItemResult{ID: target.ID, Outcome: bulkOutcome(err), Version: target.ExpectedVersion})
			continue
		}
		if !itemScope.Internal || !itemActor.Can("ticket.bulk", ticket.OwnerOrg) {
			results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "FORBIDDEN", Version: ticket.Version})
			continue
		}
		itemKey := bulkItemKey(key, target.ID)
		switch in.Action {
		case "ARCHIVE":
			if !itemActor.Can("ticket.archive", ticket.OwnerOrg) {
				results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "FORBIDDEN", Version: ticket.Version})
				continue
			}
			if _, err := s.Archive(ctx, c, target.ID, itemKey, api.ArchiveInput{ExpectedVersion: target.ExpectedVersion, Reason: in.Reason}); err != nil {
				results = append(results, api.BulkItemResult{ID: target.ID, Outcome: bulkOutcome(err), Version: ticket.Version})
				continue
			}
			results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "SUCCESS", Version: ticket.Version + 1})
		case "REASSIGN":
			if !itemActor.Can("ticket.dispatch", ticket.OwnerOrg) {
				results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "FORBIDDEN", Version: ticket.Version})
				continue
			}
			dIn := api.DispatchInput{ExpectedVersion: target.ExpectedVersion, TeamID: in.TeamID, AssigneeID: in.AssigneeID, ProposalVersion: 1, Reason: in.Reason}
			if _, err := s.Reassign(ctx, c, target.ID, itemKey, dIn); err != nil {
				results = append(results, api.BulkItemResult{ID: target.ID, Outcome: bulkOutcome(err), Version: ticket.Version})
				continue
			}
			results = append(results, api.BulkItemResult{ID: target.ID, Outcome: "SUCCESS", Version: ticket.Version + 1})
		}
	}

	body := map[string]any{"items": results, "as_of": s.now().UTC().Format(time.RFC3339)}
	return database.Mutate(ctx, s.Store.Pool, mut, func(tx pgx.Tx) (database.Result, error) {
		return database.Response(200, body)
	})
}

func bulkItemKey(key, targetID string) string {
	if len(key) > 80 {
		key = key[:80]
	}
	return key + ":" + targetID
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func bulkOutcome(err error) string {
	var we *web.Error
	if errors.As(err, &we) {
		switch we.Status {
		case 403:
			return "FORBIDDEN"
		case 404:
			return "NOT_FOUND"
		}
	}
	return "CONFLICT"
}
