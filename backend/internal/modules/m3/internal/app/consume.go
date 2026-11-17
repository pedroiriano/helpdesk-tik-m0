package app

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) Consume(ctx context.Context, v delivery.Event) error {
	hash, err := delivery.Digest(v.Payload)
	if err != nil || !hmac.Equal(hash, v.Digest) || !web.UUID(v.ID) || !web.UUID(v.Aggregate) || v.Version < 1 || v.SchemaVersion != 1 {
		return delivery.ErrIntegrity
	}

	if v.Type != "NotificationStored" || v.Producer != "M9" {
		return delivery.ErrIntegrity
	}

	var p struct {
		TicketID  string `json:"ticket_id"`
		AttemptID string `json:"attempt_id"`
	}
	if err := json.Unmarshal(v.Payload, &p); err != nil || !web.UUID(p.TicketID) || !web.UUID(p.AttemptID) {
		return delivery.ErrIntegrity
	}

	tx, err := s.Store.Pool.Begin(ctx)
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
	err = tx.QueryRow(ctx, `SELECT digest, aggregate_id::text, aggregate_version FROM intake.inbox WHERE consumer_id='M3' AND event_id=$1`, v.ID).Scan(&old, &oldAggregate, &oldVersion)
	if err == nil {
		if !hmac.Equal(old, v.Digest) || oldAggregate != v.Aggregate || oldVersion != v.Version {
			return delivery.ErrIntegrity
		}
		return tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	// Simpan bukti ke intake.confirmation_notifications
	notifID := v.Aggregate
	eventID := v.ID
	id := web.ID()
	storedAt := v.Occurred
	if storedAt.IsZero() {
		storedAt = s.now()
	}
	_, err = tx.Exec(ctx, `INSERT INTO intake.confirmation_notifications(id, version, ticket_id, attempt_id, notification_id, event_id, stored_at)
		VALUES($1, 1, $2, $3, $4, $5, $6)
		ON CONFLICT(ticket_id, attempt_id, notification_id) DO NOTHING`,
		id, p.TicketID, p.AttemptID, notifID, eventID, storedAt)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `INSERT INTO intake.inbox(consumer_id, event_id, digest, aggregate_id, aggregate_version) VALUES('M3', $1, $2, $3, $4)`,
		v.ID, v.Digest, v.Aggregate, v.Version)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
