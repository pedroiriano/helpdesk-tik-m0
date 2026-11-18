package app

import (
	"context"
	"errors"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

// ScheduledAutoClose refreshes the version only for the same still-pending attempt.
// The write path rechecks version, proof and attempt under M3's transaction.
func (s *Service) ScheduledAutoClose(ctx context.Context, ticketID, attemptID string, expectedVersion int64, now time.Time) (stale bool, err error) {
	if !web.UUID(ticketID) || !web.UUID(attemptID) || expectedVersion < 1 {
		return false, delivery.ErrIntegrity
	}
	state, active, outcome, version, err := s.Store.AutoCloseFacts(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	if version < expectedVersion {
		return false, delivery.ErrIntegrity
	}
	if active == nil || *active != attemptID {
		return true, nil
	}
	if state == "CLOSED" && outcome != nil && *outcome == "AUTO_NO_RESPONSE" {
		return false, nil // The effect was committed before the scheduler acknowledged it.
	}
	if state != "RESOLVED" || outcome == nil || *outcome != "PENDING" {
		return true, nil
	}
	_, err = s.AutoClose(ctx, ticketID, api.AutoCloseInput{AttemptID: attemptID, ExpectedVersion: version}, now)
	return false, err
}

func (s *Service) AuthorizeScheduler(ctx context.Context, id, token, csrf string, write bool) (string, error) {
	actor, err := s.Identity.Authenticate(ctx, identity.Credentials{Token: token, CSRF: csrf, Write: write})
	if err != nil {
		return "", err
	}
	orgs := actor.Orgs("system.job")
	if actor.Kind != "STAFF" || len(orgs) == 0 {
		return "", web.Fail(403, "Mandat pekerjaan sistem diperlukan")
	}
	allowed, err := s.Store.JobScope(ctx, id, orgs)
	if err != nil {
		return "", err
	}
	if !allowed {
		return "", web.Fail(404, "Job scheduler tidak ditemukan")
	}
	return actor.ID, nil
}

func (s *Service) AuthorizeSchedulerBatch(ctx context.Context, token string, ticketIDs []string) ([]string, error) {
	actor, err := s.Identity.Authenticate(ctx, identity.Credentials{Token: token})
	if err != nil {
		return nil, err
	}
	orgs := actor.Orgs("system.job")
	if actor.Kind != "STAFF" || len(orgs) == 0 {
		return nil, web.Fail(403, "Mandat pekerjaan sistem diperlukan")
	}
	return s.Store.FilterTicketsInOrgs(ctx, orgs, ticketIDs)
}
