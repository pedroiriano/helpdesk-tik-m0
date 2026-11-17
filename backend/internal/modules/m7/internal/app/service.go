package app

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/modules/m7/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

type Service struct {
	Store store.Store
	Pool  *pgxpool.Pool
	Now   func() time.Time
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		Store: store.Store{Pool: pool},
		Pool:  pool,
		Now:   time.Now,
	}
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func (s *Service) Consume(ctx context.Context, v delivery.Event) error {
	hash, err := delivery.Digest(v.Payload)
	if err != nil || !hmac.Equal(hash, v.Digest) || !web.UUID(v.ID) || !web.UUID(v.Aggregate) || v.Version < 1 || v.SchemaVersion != 1 {
		return delivery.ErrIntegrity
	}

	valid := (v.Type == "ResolutionProposed" || v.Type == "VendorCaseRecorded" || v.Type == "PauseChanged" || v.Type == "HandoffAccepted" || v.Type == "EscalationRequested" || v.Type == "TicketCreated" || v.Type == "TicketStateChanged" || v.Type == "ConfirmationRecorded") && v.Producer == "M3"
	if !valid {
		return delivery.ErrIntegrity
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, v.ID)
	if err != nil {
		return err
	}

	var old []byte
	var oldAggregate string
	var oldVersion int64
	err = tx.QueryRow(ctx, `SELECT digest, aggregate_id::text, aggregate_version FROM escalation.inbox WHERE consumer_id='M7' AND event_id=$1`, v.ID).Scan(&old, &oldAggregate, &oldVersion)
	if err == nil {
		if !hmac.Equal(old, v.Digest) || oldAggregate != v.Aggregate || oldVersion != v.Version {
			return delivery.ErrIntegrity
		}
		return tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if v.Type == "ResolutionProposed" {
		var p struct {
			AttemptID         string    `json:"attempt_id"`
			ConfirmationDueAt time.Time `json:"confirmation_due_at"`
		}
		if err := json.Unmarshal(v.Payload, &p); err != nil || !web.UUID(p.AttemptID) || p.ConfirmationDueAt.IsZero() {
			return delivery.ErrIntegrity
		}

		idempotencyKey := fmt.Sprintf("autoclose:%s:%s", v.Aggregate, p.AttemptID)
		jobID := web.ID()
		_, err = tx.Exec(ctx, `INSERT INTO escalation.jobs(id, version, ticket_id, attempt_id, expected_version, kind, idempotency_key, due_at, state, correlation_id)
			VALUES($1, 1, $2, $3, $4, 'AUTO_CLOSE', $5, $6, 'PENDING', NULLIF($7,'')::uuid)
			ON CONFLICT(idempotency_key) DO NOTHING`,
			jobID, v.Aggregate, p.AttemptID, v.Version, idempotencyKey, p.ConfirmationDueAt, v.Correlation)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `INSERT INTO escalation.inbox(consumer_id, event_id, digest, aggregate_id, aggregate_version) VALUES('M7', $1, $2, $3, $4)`,
		v.ID, v.Digest, v.Aggregate, v.Version)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Service) RunDueAutoClose(ctx context.Context, now time.Time, executeClose func(ctx context.Context, ticketID string, attemptID string, expectedVersion int64, now time.Time) error) (int, error) {
	if now.IsZero() {
		now = s.now()
	}
	tickStart := time.Now()
	for processed := 0; processed < 20; processed++ {
		claimAt := now.Add(time.Since(tickStart))
		job, err := s.Store.ClaimDueJob(ctx, claimAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return processed, nil
		}
		if err != nil {
			return processed, err
		}
		if job.AttemptID == nil {
			err = delivery.ErrIntegrity
		} else {
			attemptCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err = executeClose(attemptCtx, job.TicketID, *job.AttemptID, job.ExpectedVersion, claimAt)
			cancel()
		}
		finishedAt := now.Add(time.Since(tickStart))
		state, code, retryAt := jobOutcome(job, finishedAt, err)
		if err = s.Store.FinishJob(ctx, job, finishedAt, state, code, retryAt); err != nil && !errors.Is(err, api.ErrLostLease) {
			return processed, err
		}
	}
	return 20, nil
}

func jobOutcome(job api.Job, now time.Time, err error) (state, code string, retryAt *time.Time) {
	switch {
	case err == nil:
		return "ACKED", "", nil
	case errors.Is(err, api.ErrStaleJob):
		return "ACKED", "STALE_ATTEMPT", nil
	case errors.Is(err, delivery.ErrIntegrity):
		return "DEAD_LETTER", "INTEGRITY_ERROR", nil
	}
	code = "DEPENDENCY_UNAVAILABLE"
	var httpErr *web.Error
	if errors.As(err, &httpErr) {
		switch httpErr.Status {
		case 412:
			code = "NOTIFICATION_PROOF_PENDING"
		case 409:
			code = "AGGREGATE_CHANGED"
		case 400, 401, 403, 404, 422:
			return "DEAD_LETTER", "PERMANENT_REJECTION", nil
		}
	}
	if job.Attempts >= store.MaxAttempts {
		return "DEAD_LETTER", code, nil
	}
	next := now.Add(time.Duration(1<<min(job.Attempts, 8)) * time.Second)
	return "PENDING", code, &next
}
