package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/platform/web"
)

type ClaimedDeliveryJob struct {
	ID             string
	NotificationID string
	RecipientID    string
	Title          string
	Channel        string
	Attempts       int
	TargetChatID   string
}

func (s Store) CreateChannelBinding(ctx context.Context, subjectID, orgID, verificationCode, channel, maskedRef, targetChatID string) (*api.Receipt, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	id := web.ID()
	now := time.Now().UTC()
	hash := sha256.Sum256([]byte(strings.TrimSpace(verificationCode)))
	tag, err := tx.Exec(ctx, `DELETE FROM notify_audit.sink_challenges WHERE subject_id=$1 AND org_id=$2 AND digest=$3 AND expires_at>now()`, subjectID, orgID, hash[:])
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, web.Fail(422, "Kode verifikasi tidak valid, kedaluwarsa, atau sudah dipakai")
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.telegram_bindings (id, version, subject_id, org_id, chat_ref, target_chat_id, verified_at, channel, created_at, updated_at)
		VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $6, $6)
	`, id, subjectID, orgID, maskedRef, targetChatID, now, channel)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.audit_intents (id, actor_id, action, object_id, scope, reason, outcome, correlation_id, occurred_at)
		VALUES ($1, $2, 'VerifyTelegramBinding', $3, 'M9.telegram_binding', 'Pengikatan saluran terverifikasi ' || $4, 'SUCCESS', $5, $6)
	`, web.ID(), subjectID, id, maskedRef, web.ID(), now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &api.Receipt{ID: id, Version: 1}, nil
}

func (s Store) ClaimDueDeliveryJobs(ctx context.Context, limit int) ([]ClaimedDeliveryJob, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		WITH picked AS (
			SELECT id FROM notify_audit.delivery_jobs
			WHERE channel IN ('TELEGRAM','EMAIL')
			  AND ((state IN ('PENDING','FAILED') AND next_attempt_at<=now())
			       OR (state='LEASED' AND lease_until IS NOT NULL AND lease_until<=now()))
			  AND attempts<5
			ORDER BY next_attempt_at ASC, id ASC
			FOR UPDATE SKIP LOCKED
			LIMIT $1
		)
		UPDATE notify_audit.delivery_jobs dj
		SET state='LEASED',
		    attempts=dj.attempts+1,
		    lease_until=now()+interval '30 seconds',
		    version=dj.version+1,
		    updated_at=now()
		FROM picked, notify_audit.notifications n
		WHERE dj.id=picked.id AND n.id=dj.notification_id
		RETURNING dj.id::text, dj.notification_id::text, n.recipient_id::text, n.title, dj.channel, dj.attempts,
		  COALESCE((SELECT tb.target_chat_id FROM notify_audit.telegram_bindings tb
		            WHERE tb.subject_id=n.recipient_id AND tb.channel='TELEGRAM' AND tb.revoked_at IS NULL
		            ORDER BY tb.verified_at DESC LIMIT 1), '')`,
		limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ClaimedDeliveryJob{}
	for rows.Next() {
		var j ClaimedDeliveryJob
		if err := rows.Scan(&j.ID, &j.NotificationID, &j.RecipientID, &j.Title, &j.Channel, &j.Attempts, &j.TargetChatID); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (s Store) FinishDeliveryJob(ctx context.Context, id, finalState, errCode string, nextAttempt time.Time) error {
	now := time.Now().UTC()
	var errVal any
	if strings.TrimSpace(errCode) != "" {
		errVal = errCode
	}
	var deliveredVal any
	if finalState == "ACKED" {
		deliveredVal = now
	}
	_, err := s.Pool.Exec(ctx, `
		UPDATE notify_audit.delivery_jobs
		SET state=$2,
		    error_code=$3,
		    next_attempt_at=$4,
		    delivered_at=COALESCE($5, delivered_at),
		    lease_until=NULL,
		    version=version+1,
		    updated_at=$6
		WHERE id=$1 AND state='LEASED'`,
		id, finalState, errVal, nextAttempt.UTC(), deliveredVal, now)
	return err
}

type RawDeliveryJobRow struct {
	Record      api.DeliveryJobRecord
	RecipientID string
}

func (s Store) ListDeliveryJobs(ctx context.Context, stateFilter string, limit int) ([]RawDeliveryJobRow, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT dj.id::text, dj.version, dj.notification_id::text, n.title, dj.channel, dj.state,
		       dj.attempts, dj.error_code, dj.next_attempt_at, dj.delivered_at, dj.created_at,
		       n.recipient_id::text,
		       COALESCE((SELECT tb.chat_ref FROM notify_audit.telegram_bindings tb
		                 WHERE tb.subject_id=n.recipient_id AND tb.revoked_at IS NULL
		                 ORDER BY tb.verified_at DESC LIMIT 1), '')
		FROM notify_audit.delivery_jobs dj
		JOIN notify_audit.notifications n ON n.id=dj.notification_id
		WHERE ($1='' OR dj.state=$1)
		ORDER BY dj.created_at DESC, dj.id DESC
		LIMIT $2`, strings.TrimSpace(stateFilter), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RawDeliveryJobRow{}
	for rows.Next() {
		var r RawDeliveryJobRow
		var errCode sql.NullString
		var delivered sql.NullTime
		var maskedChat string
		if err := rows.Scan(
			&r.Record.ID, &r.Record.Version, &r.Record.Notification, &r.Record.Title,
			&r.Record.Channel, &r.Record.State, &r.Record.Attempts, &errCode,
			&r.Record.NextAttemptAt, &delivered, &r.Record.CreatedAt,
			&r.RecipientID, &maskedChat,
		); err != nil {
			return nil, err
		}
		if errCode.Valid {
			v := errCode.String
			r.Record.LastErrorCode = &v
		}
		if delivered.Valid {
			t := delivered.Time
			r.Record.DeliveredAt = &t
		}
		if maskedChat != "" {
			r.Record.TargetMasked = maskedChat
		} else if r.Record.Channel == "SINK" {
			r.Record.TargetMasked = "SYNTHETIC_SINK"
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s Store) ReplayDeliveryJob(ctx context.Context, id, actorID, reason string, expectedVersion int64) (*api.DeliveryJobRecord, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var currentVer int64
	var currentState string
	err = tx.QueryRow(ctx, `SELECT version, state FROM notify_audit.delivery_jobs WHERE id=$1 FOR UPDATE`, id).Scan(&currentVer, &currentState)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, web.Fail(404, "Job pengiriman notifikasi tidak ditemukan")
	} else if err != nil {
		return nil, err
	}
	if currentVer != expectedVersion {
		return nil, web.Fail(409, fmt.Sprintf("Versi konflik: diharapkan %d, aktual %d", expectedVersion, currentVer))
	}
	if currentState != "FAILED" && currentState != "DEAD_LETTER" {
		return nil, web.Fail(409, "Hanya job berstatus FAILED atau DEAD_LETTER yang dapat diputar ulang")
	}

	now := time.Now().UTC()
	var rec api.DeliveryJobRecord
	var errCode sql.NullString
	var delivered sql.NullTime
	err = tx.QueryRow(ctx, `
		UPDATE notify_audit.delivery_jobs dj
		SET state='PENDING',
		    attempts=0,
		    error_code=NULL,
		    lease_until=NULL,
		    next_attempt_at=$2,
		    version=dj.version+1,
		    updated_at=$2
		FROM notify_audit.notifications n
		WHERE dj.id=$1 AND dj.version=$3 AND n.id=dj.notification_id
		RETURNING dj.id::text, dj.version, dj.notification_id::text, n.title, dj.channel, dj.state,
		          dj.attempts, dj.error_code, dj.next_attempt_at, dj.delivered_at, dj.created_at`,
		id, now, expectedVersion).Scan(
		&rec.ID, &rec.Version, &rec.Notification, &rec.Title, &rec.Channel,
		&rec.State, &rec.Attempts, &errCode, &rec.NextAttemptAt, &delivered, &rec.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO notify_audit.audit_intents (id, actor_id, action, object_id, scope, reason, outcome, correlation_id, occurred_at)
		VALUES ($1, $2, 'ReplayDeliveryJob', $3, 'M9.delivery', $4, 'SUCCESS', $5, $6)`,
		web.ID(), actorID, id, reason, web.ID(), now); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	rec.TargetMasked = "***"
	return &rec, nil
}
