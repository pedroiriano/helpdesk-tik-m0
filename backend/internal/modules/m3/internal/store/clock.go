package store

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/web"
)

type clockReader interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

type SLAClock struct {
	TicketID        string     `json:"ticket_id"`
	EpisodeID       string     `json:"episode_id"`
	AcceptedAt      time.Time  `json:"accepted_at"`
	Start           time.Time  `json:"episode_started_at"`
	Endpoint        *time.Time `json:"resolution_endpoint"`
	AsOf            time.Time  `json:"as_of"`
	Due             time.Time  `json:"resolution_due_at"`
	DueAlias        time.Time  `json:"due_at"`
	ResponseDue     *time.Time `json:"response_due_at,omitempty"`
	FirstResponse   *time.Time `json:"first_response_at,omitempty"`
	Gross           int64      `json:"gross_seconds"`
	Net             int64      `json:"net_seconds"`
	Working         *int64     `json:"working_seconds,omitempty"`
	PolicyVersion   int64      `json:"policy_version"`
	CalendarVersion int64      `json:"calendar_version"`
	Status          string     `json:"status"`
	PolicySource    string     `json:"policy_source"`
}

func ReadClock(ctx context.Context, db clockReader, ticket api.Ticket, now time.Time) (SLAClock, error) {
	var resolved *time.Time
	var pauses []sla.PauseInterval
	clock := SLAClock{
		TicketID: ticket.ID, EpisodeID: ticket.EpisodeID, AcceptedAt: ticket.Accepted,
		Start: ticket.Accepted, AsOf: now, Due: ticket.Due, ResponseDue: ticket.ResponseDue,
		FirstResponse: ticket.FirstResponse, PolicyVersion: ticket.PolicyVersion, PolicySource: "LEGACY",
	}
	if ticket.EpisodeStartedAt != nil {
		clock.Start = *ticket.EpisodeStartedAt
	}
	err := db.QueryRow(ctx, `
 SELECT COALESCE(t.episode_started_at,r.opened_at,t.accepted_at), a.resolved_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('starts_at',p.starts_at,'ends_at',p.ends_at))
          FROM intake.pause_intervals p
          WHERE p.ticket_id=t.id AND p.policy_version=t.policy_version
            AND (p.episode_id=t.episode_id OR (p.episode_id IS NULL AND r.episode_id IS NULL))), '[]'::jsonb)
 FROM intake.tickets t
 LEFT JOIN intake.episode_reopens r ON r.episode_id=t.episode_id AND r.ticket_id=t.id
 LEFT JOIN intake.resolution_attempts a ON a.id=t.active_attempt_id AND a.ticket_id=t.id AND a.episode_id=t.episode_id
 WHERE t.id=$1 AND t.version=$2`, ticket.ID, ticket.Version).Scan(&clock.Start, &resolved, &pauses)
	if errors.Is(err, pgx.ErrNoRows) {
		return SLAClock{}, web.Fail(409, "Tiket berubah saat SLA dibaca; muat ulang")
	}
	if err != nil {
		return SLAClock{}, err
	}
	terminal := ticket.State == "RESOLVED" || ticket.State == "CLOSED"
	if terminal && resolved != nil {
		clock.Endpoint, clock.AsOf = resolved, *resolved
	} else if ticket.State == "CANCELLED" || terminal {
		clock.AsOf = ticket.Updated
	}
	clock.Gross, clock.Net = sla.Elapsed(clock.Start, clock.AsOf, pauses)
	var paused bool
	var targetSeconds int64
	if ticket.SLAPolicy != nil {
		priority := "NORMAL"
		if ticket.ClassificationDecision != nil {
			priority = ticket.ClassificationDecision.Priority
		}
		calc, working, active, err := sla.Evaluate(ctx, ticket.SLAPolicy.Targets[priority], clock.Start, clock.AsOf, pauses)
		if err != nil {
			return SLAClock{}, err
		}
		clock.Working = &working
		clock.Due, clock.CalendarVersion = calc.Due, calc.CalendarVersion
		targetSeconds = int64(calc.WorkingMinutes) * 60
		paused = active
		clock.PolicySource = "SERVICE_SNAPSHOT"
		if ticket.SLAPolicy.SyntheticDefault {
			clock.PolicySource = "LAB_DEFAULT"
		}
	} else {
		_, revision, _ := strings.Cut(ticket.Calendar, "-v")
		clock.CalendarVersion, _ = strconv.ParseInt(revision, 10, 64)
	}
	clock.DueAlias = clock.Due
	switch {
	case ticket.State == "CANCELLED":
		clock.Status = "CANCELLED"
	case clock.Due.Before(clock.Start) || (terminal && resolved == nil):
		clock.Status = "UNAVAILABLE"
	case clock.AsOf.After(clock.Due):
		clock.Status = "BREACHED"
	case terminal:
		clock.Status = "ON_TRACK"
	case paused:
		clock.Status = "PAUSED"
	case clock.Working != nil && *clock.Working*5 >= targetSeconds*4:
		clock.Status = "AT_RISK"
	default:
		clock.Status = "ON_TRACK"
	}
	return clock, nil
}
