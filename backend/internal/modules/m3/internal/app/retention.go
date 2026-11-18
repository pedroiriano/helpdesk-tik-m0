package app

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/domain"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) ConfigureRetention(ctx context.Context, c Credentials, id, key string, in api.RetentionInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || (!a.Can("ticket.archive", v.OwnerOrg) && a.Role != "SUPER_ADMIN") {
		return database.Result{}, web.Fail(403, "Izin pengelola retensi atau Super Admin diperlukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || !domain.Text(in.Reason, 500) {
		return database.Result{}, web.Fail(422, "Versi tiket dan alasan retensi wajib diisi")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner:   "M3",
		Actor:   a.ID,
		Command: "ConfigureRetention",
		Target:  id,
		Key:     key,
		Scope:   v.OwnerOrg,
		Reason:  in.Reason,
		Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		st, err := s.Store.SetRetention(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, st)
	})
}

func (s *Service) PreflightRetentionPurge(ctx context.Context, ticketID string) error {
	_, err := s.Store.PreflightRetentionPurge(ctx, ticketID, s.now())
	return err
}

func (s *Service) ExecuteRetentionPurge(ctx context.Context, ticketID, actorID, reason string) (json.RawMessage, error) {
	ownerOrg, err := s.Store.PreflightRetentionPurge(ctx, ticketID, s.now())
	if err != nil {
		return nil, err
	}
	now := s.now()
	var keys []string
	var nextVer int64
	_, err = database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner:   "M3",
		Actor:   actorID,
		Command: "PurgeRetentionTicket",
		Target:  ticketID,
		Key:     "purge-exec-" + ticketID,
		Scope:   ownerOrg,
		Reason:  reason,
		Payload: map[string]any{"ticket_id": ticketID, "reason": reason},
	}, func(tx pgx.Tx) (database.Result, error) {
		var removed []string
		var e error
		ownerOrg, removed, nextVer, e = s.Store.PurgeTicketData(ctx, tx, ticketID, actorID, reason, now)
		if e != nil {
			return database.Result{}, e
		}
		keys = removed
		return database.Response(200, map[string]any{"ticket_id": ticketID, "version": nextVer})
	})
	if err != nil {
		return nil, err
	}
	blobsRemoved := 0
	for _, k := range keys {
		shared := false
		if s.SharedBlobReferences != nil {
			shared, _ = s.SharedBlobReferences(ctx, k)
		}
		if !shared && s.Files != nil {
			if s.Files.Remove(k) == nil {
				blobsRemoved++
			}
		}
	}
	return json.Marshal(map[string]any{
		"status":         "PURGED",
		"ticket_id":      ticketID,
		"ticket_version": nextVer,
		"blobs_removed":  blobsRemoved,
		"executed_by":    actorID,
		"executed_at":    now,
	})
}
