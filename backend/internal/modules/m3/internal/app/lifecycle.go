package app

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/domain"
	"helpdesk.local/m0/internal/modules/m3/internal/store"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

const labReopenWindow = 7 * 24 * time.Hour

func canReopen(ticket api.Ticket, scope store.Scope, actor identity.Actor) bool {
	return (requesterAllowed(actor, scope, ticket) && writeAllowed(actor, scope, ticket, "ticket.transition")) ||
		(scope.Internal && actor.Role == "OPERATOR" && actor.Can("ticket.transition", ticket.OwnerOrg))
}

func (s *Service) Transition(ctx context.Context, c Credentials, id, key string, in api.LifecycleInput) (database.Result, error) {
	ticket, scope, actor, err := s.authorized(ctx, c, id, true)
	if err != nil {
		return database.Result{}, err
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || !domain.Text(in.Reason, 4000) {
		return database.Result{}, web.Fail(422, "Versi tiket dan alasan tindakan wajib diisi")
	}
	requester := requesterAllowed(actor, scope, ticket) && writeAllowed(actor, scope, ticket, "ticket.transition")
	operator := scope.Internal && actor.Role == "OPERATOR" && actor.Can("ticket.transition", ticket.OwnerOrg)
	var permitted bool
	switch in.Action {
	case "REQUEST_INFORMATION":
		permitted = operator
	case "SUPPLY_INFORMATION", "CANCEL":
		permitted = requester || operator
	case "REOPEN":
		permitted = canReopen(ticket, scope, actor)
	case "START":
		permitted = technicianAllowed(actor, scope, ticket) && actor.Can("ticket.transition", ticket.OwnerOrg)
	default:
		return database.Result{}, web.Fail(422, "Tindakan lifecycle tidak dikenal")
	}
	if !permitted {
		return database.Result{}, web.Fail(403, "Anda tidak berwenang melakukan tindakan ini")
	}
	now := s.now()
	var calc *sla.Calculation
	var reopenWindow time.Duration
	if in.Action == "REOPEN" {
		if !s.LabLifecycle {
			return database.Result{}, web.Fail(409, "Kebijakan buka kembali belum disahkan")
		}
		reopenWindow = labReopenWindow
		calc, err = s.episodeTargets(ctx, ticket, "NORMAL", now)
		if err != nil {
			return database.Result{}, err
		}
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: actor.ID, Command: "TransitionTicket", Target: id, Key: key, Scope: ticket.OwnerOrg, Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.Transition(ctx, tx, ticket, actor.ID, in, now, reopenWindow, calc)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
}
