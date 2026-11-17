package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/platform/web"
)

type Store struct {
	Pool *pgxpool.Pool
}

func (s Store) CreateJob(ctx context.Context, ticketID, attemptID string, expectedVersion int64, kind, idempotencyKey string, dueAt time.Time) error {
	id := web.ID()
	_, err := s.Pool.Exec(ctx, `INSERT INTO escalation.jobs(id, version, ticket_id, attempt_id, expected_version, kind, idempotency_key, due_at, state)
		VALUES($1, 1, $2, $3, $4, $5, $6, $7, 'PENDING')
		ON CONFLICT(idempotency_key) DO NOTHING`,
		id, ticketID, attemptID, expectedVersion, kind, idempotencyKey, dueAt)
	return err
}

const MaxAttempts = 8

func (s Store) ClaimDueJob(ctx context.Context, now time.Time) (api.Job, error) {
	// Expired claims are fenced by an incremented version. A late ACK from the former worker cannot win.
	_, err := s.Pool.Exec(ctx, `WITH exhausted AS (
		SELECT id FROM escalation.jobs WHERE kind='AUTO_CLOSE' AND state='LEASED' AND attempts >= $1 AND lease_until <= $2
		ORDER BY lease_until,id FOR UPDATE SKIP LOCKED LIMIT 20
	) UPDATE escalation.jobs j SET state='DEAD_LETTER',lease_until=NULL,retry_at=NULL,
		last_error_code='RETRY_EXHAUSTED',updated_at=$2 FROM exhausted WHERE j.id=exhausted.id`, MaxAttempts, now)
	if err != nil {
		return api.Job{}, err
	}
	var j api.Job
	err = s.Pool.QueryRow(ctx, `WITH candidate AS (
		SELECT id FROM escalation.jobs
		WHERE kind='AUTO_CLOSE' AND attempts<$3 AND (
			(state='PENDING' AND COALESCE(retry_at,due_at)<=$1) OR
			(state='LEASED' AND lease_until<=$1))
		ORDER BY COALESCE(retry_at,due_at),id
		FOR UPDATE SKIP LOCKED LIMIT 1
	) UPDATE escalation.jobs j SET state='LEASED',lease_until=$2,version=j.version+1,
		attempts=j.attempts+1,updated_at=$1
	FROM candidate WHERE j.id=candidate.id
	RETURNING j.id::text,j.ticket_id::text,j.attempt_id::text,j.expected_version,j.kind,
		j.idempotency_key,j.due_at,j.state,j.version,j.attempts`, now, now.Add(30*time.Second), MaxAttempts).
		Scan(&j.ID, &j.TicketID, &j.AttemptID, &j.ExpectedVersion, &j.Kind, &j.IdempotencyKey, &j.DueAt, &j.State, &j.LeaseVersion, &j.Attempts)
	return j, err
}

func (s Store) FinishJob(ctx context.Context, job api.Job, now time.Time, state, code string, retryAt *time.Time) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE escalation.jobs SET state=$1,lease_until=NULL,retry_at=$2,
		last_error_code=NULLIF($3,''),updated_at=$4
	WHERE id=$5 AND state='LEASED' AND version=$6`, state, retryAt, code, now, job.ID, job.LeaseVersion)
	if err == nil && tag.RowsAffected() != 1 {
		return api.ErrLostLease
	}
	return err
}

func (s Store) JobStatus(ctx context.Context, ticket, id string) (api.JobStatus, error) {
	var status api.JobStatus
	err := s.Pool.QueryRow(ctx, `SELECT id::text,version,state,due_at,retry_at,attempts,last_error_code
  FROM escalation.jobs WHERE ticket_id=$1 AND id=$2 AND kind='AUTO_CLOSE'`, ticket, id).
		Scan(&status.ID, &status.Version, &status.State, &status.DueAt, &status.RetryAt, &status.Attempts, &status.LastError)
	if errors.Is(err, pgx.ErrNoRows) {
		return status, web.Fail(404, "Job scheduler tidak ditemukan")
	}
	return status, err
}

func (s Store) Replay(ctx context.Context, ticket, id, actor, key string, in api.ReplayRequest) (api.ReplayReceipt, error) {
	result := api.ReplayReceipt{ID: id, State: "PENDING"}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	var version int64
	var state string
	err = tx.QueryRow(ctx, `SELECT version,state FROM escalation.jobs WHERE ticket_id=$1 AND id=$2 AND kind='AUTO_CLOSE' FOR UPDATE`, ticket, id).Scan(&version, &state)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, web.Fail(404, "Job scheduler tidak ditemukan")
	}
	if err != nil {
		return result, err
	}
	var previous int64
	var reason string
	err = tx.QueryRow(ctx, `SELECT expected_version,reason,result_version FROM escalation.job_replays WHERE job_id=$1 AND actor_id=$2 AND request_key=$3`,
		id, actor, key).Scan(&previous, &reason, &result.Version)
	if err == nil {
		if previous != in.ExpectedVersion || reason != in.Reason {
			return result, web.Fail(409, "Key telah dipakai untuk tindakan berbeda")
		}
		return result, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if version != in.ExpectedVersion || state != "DEAD_LETTER" {
		return result, web.Fail(409, "Job sudah berubah atau belum masuk dead-letter")
	}
	err = tx.QueryRow(ctx, `UPDATE escalation.jobs SET version=version+1,state='PENDING',attempts=0,lease_until=NULL,
  last_error_code=NULL,retry_at=GREATEST(now(),due_at),updated_at=now() WHERE id=$1 RETURNING version`, id).Scan(&result.Version)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO escalation.job_replays(job_id,actor_id,request_key,expected_version,result_version,reason,correlation_id)
  VALUES($1,$2,$3,$4,$5,$6,$7)`, id, actor, key, in.ExpectedVersion, result.Version, in.Reason, web.CorrelationID(ctx))
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
