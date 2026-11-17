package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/domain"
	assignment "helpdesk.local/m0/internal/modules/m5/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/web"
)

const reopenCloseTime = "SELECT updated_at FROM intake.resolution_attempts WHERE ticket_id=$1 AND id=$2 AND episode_id=$3 AND outcome IN ('ACCEPTED','AUTO_NO_RESPONSE')"

func (s Store) ReopenUntil(ctx context.Context, ticket api.Ticket, window time.Duration) (*time.Time, error) {
	var closedAt time.Time
	err := s.Pool.QueryRow(ctx, reopenCloseTime, ticket.ID, ticket.ActiveAttemptID, ticket.EpisodeID).Scan(&closedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	until := closedAt.Add(window)
	return &until, nil
}

func (s Store) Transition(ctx context.Context, tx pgx.Tx, authorized api.Ticket, actor string, in api.LifecycleInput, now time.Time, reopenWindow time.Duration, calc *sla.Calculation) (api.Ticket, error) {
	const locked = "SELECT " + columns + " FROM intake.tickets t WHERE id=$1 FOR UPDATE"
	current, err := scan(tx.QueryRow(ctx, locked, authorized.ID))
	if err != nil {
		return api.Ticket{}, err
	}
	if current.Version != in.ExpectedVersion || current.OwnerOrg != authorized.OwnerOrg || current.ArchivedAt != nil {
		return api.Ticket{}, web.Fail(409, "Tiket berubah atau diarsipkan. Muat ulang detail tiket")
	}
	next, err := domain.LifecycleNext(in.Action, current.State)
	if err != nil {
		return api.Ticket{}, err
	}
	if in.Action == "START" && (current.AssigneeID == nil || *current.AssigneeID != actor) {
		return api.Ticket{}, web.Fail(403, "Tiket sudah tidak ditugaskan kepada Anda")
	}
	episode := current.EpisodeID
	resetVerification := in.Action == "SUPPLY_INFORMATION" || in.Action == "REOPEN"
	if in.Action == "REOPEN" {
		var closedAt time.Time
		err := tx.QueryRow(ctx, reopenCloseTime,
			current.ID, current.ActiveAttemptID, episode).Scan(&closedAt)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && !now.Before(closedAt.Add(reopenWindow))) {
			return api.Ticket{}, web.Fail(409, "Tiket berada di luar jangka waktu buka kembali")
		}
		if err != nil {
			return api.Ticket{}, err
		}
		newEpisode := web.ID()
		_, err = tx.Exec(ctx, "INSERT INTO intake.episode_reopens(episode_id,ticket_id,previous_episode_id,opened_at,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)", newEpisode, current.ID, episode, now, actor, in.Reason)
		if err != nil {
			return api.Ticket{}, err
		}
		episode = newEpisode
	}
	clearAssignment := resetVerification || in.Action == "CANCEL"
	var due, response *time.Time
	var calendar *string
	if calc != nil {
		due, response, calendar = &calc.Due, &calc.ResponseDue, &calc.Version
	}
	updated, err := scan(tx.QueryRow(ctx, "UPDATE intake.tickets t SET state=$2,episode_id=$3,verification=CASE WHEN $4 THEN 'PENDING' ELSE verification END, "+
		"classification_decision=CASE WHEN $4 THEN NULL ELSE classification_decision END, "+
		"assignee_id=CASE WHEN $5 THEN NULL ELSE assignee_id END,handling_team_id=CASE WHEN $5 THEN NULL ELSE handling_team_id END, "+
		"episode_started_at=CASE WHEN $7='REOPEN' THEN $6 ELSE episode_started_at END, "+
		"first_response_at=CASE WHEN $7='REOPEN' THEN NULL WHEN $7='REQUEST_INFORMATION' THEN COALESCE(first_response_at,$6) ELSE first_response_at END, "+
		"resolution_due_at=COALESCE($8,resolution_due_at),response_due_at=COALESCE($9,response_due_at),calendar_version=COALESCE($10,calendar_version), "+
		"active_attempt_id=CASE WHEN $5 THEN NULL ELSE active_attempt_id END,version=version+1,updated_at=$6 WHERE id=$1 RETURNING "+columns,
		current.ID, next, episode, resetVerification, clearAssignment, now, in.Action, due, response, calendar))
	if err != nil {
		return api.Ticket{}, err
	}
	if err := History(ctx, tx, updated.ID, updated.Version, actor, in.Action, in.Reason); err != nil {
		return api.Ticket{}, err
	}
	return updated, emitState(ctx, tx, updated)
}

func emitState(ctx context.Context, tx pgx.Tx, ticket api.Ticket) error {
	return emitStateSnapshot(ctx, tx, ticket, nil)
}

func emitStateSnapshot(ctx context.Context, tx pgx.Tx, ticket api.Ticket, fact *assignment.DispatchFact) error {
	return emitTicketSnapshot(ctx, tx, "TicketStateChanged", ticket, ticket.Updated, fact)
}

func emitTicketSnapshot(ctx context.Context, tx pgx.Tx, kind string, ticket api.Ticket, asOf time.Time, fact *assignment.DispatchFact) error {
	clock, err := ReadClock(ctx, tx, ticket, asOf)
	if err != nil {
		return err
	}
	payload := map[string]any{
		"state": ticket.State, "requester_id": ticket.RequesterID, "service_id": ticket.ServiceID,
		"service_owner_org_id": ticket.OwnerOrg, "accepted_at": ticket.Accepted, "resolution_due_at": clock.Due,
		"policy_version": ticket.PolicyVersion, "episode_id": ticket.EpisodeID, "assignee_id": ticket.AssigneeID,
		"handling_team_id": ticket.HandlingTeamID, "resolution_endpoint": clock.Endpoint, "gross_seconds": clock.Gross, "net_seconds": clock.Net,
		"sla_clock": clock,
	}
	if fact != nil {
		payload["dispatch"] = fact
	}
	return Event(ctx, tx, kind, ticket.ID, ticket.Version, payload, []string{"M5", "M6", "M7", "M9"})
}
