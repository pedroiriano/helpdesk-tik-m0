package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/platform/web"
)

// ListNotifications retrieves notifications for the recipient.
func (s Store) ListNotifications(ctx context.Context, recipientID string, limit int, cursor string) ([]api.Notification, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := `
		SELECT n.id, n.version, n.title, n.created_at, (n.read_at IS NOT NULL),
		       COALESCE(dj.state, 'STORED') as delivery_state
		FROM notify_audit.notifications n
		LEFT JOIN notify_audit.delivery_jobs dj ON dj.notification_id = n.id
		WHERE n.recipient_id = $1
	`
	args := []any{recipientID}
	argIdx := 2

	if cursor != "" {
		query += fmt.Sprintf(" AND n.id > $%d", argIdx)
		args = append(args, cursor)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY n.created_at DESC, n.id ASC LIMIT $%d", argIdx)
	args = append(args, limit+1)

	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []api.Notification
	for rows.Next() {
		var n api.Notification
		var state string
		if err := rows.Scan(&n.ID, &n.Version, &n.Title, &n.CreatedAt, &n.Read, &state); err != nil {
			return nil, nil, err
		}
		// Normalisasi state delivery
		switch state {
		case "ACKED":
			n.DeliveryState = "SINK_ACCEPTED"
		case "DEAD_LETTER":
			n.DeliveryState = "DEAD_LETTER"
		case "FAILED":
			n.DeliveryState = "FAILED"
		default:
			n.DeliveryState = "STORED"
		}
		items = append(items, n)
	}

	var nextCursor *string
	if len(items) > limit {
		next := items[limit-1].ID
		nextCursor = &next
		items = items[:limit]
	}

	if items == nil {
		items = []api.Notification{}
	}
	return items, nextCursor, nil
}

// MarkNotificationRead marks a notification as read with CAS guard.
func (s Store) MarkNotificationRead(ctx context.Context, id, recipientID string, expectedVersion int64, reason string) (*api.Receipt, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var currentVersion int64
	var ownerID string
	err = tx.QueryRow(ctx, `SELECT version, recipient_id::text FROM notify_audit.notifications WHERE id = $1`, id).Scan(&currentVersion, &ownerID)
	if err == pgx.ErrNoRows {
		return nil, web.Fail(404, "Notifikasi tidak ditemukan")
	} else if err != nil {
		return nil, err
	}

	if ownerID != recipientID {
		return nil, web.Fail(403, "Bukan pemilik notifikasi")
	}

	if currentVersion != expectedVersion {
		return nil, web.Fail(409, fmt.Sprintf("Versi konflik: diharapkan %d tetapi versi aktual adalah %d", expectedVersion, currentVersion))
	}

	newVersion := currentVersion + 1
	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE notify_audit.notifications
		SET read_at = $1, version = $2, updated_at = $1
		WHERE id = $3 AND version = $4
	`, now, newVersion, id, currentVersion)
	if err != nil {
		return nil, err
	}

	// Catat intent audit
	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.audit_intents (id, actor_id, action, object_id, scope, reason, outcome, correlation_id, occurred_at)
		VALUES ($1, $2, 'MarkNotificationRead', $3, 'M9.notification', $4, 'SUCCESS', $5, $6)
	`, web.ID(), recipientID, id, reason, web.ID(), now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &api.Receipt{ID: id, Version: newVersion}, nil
}

func (s Store) IssueSinkChallenge(ctx context.Context, subject, org string) (*api.SinkChallenge, error) {
	var random [24]byte
	if _, err := rand.Read(random[:]); err != nil {
		return nil, err
	}
	code := hex.EncodeToString(random[:])
	hash := sha256.Sum256([]byte(code))
	expires := time.Now().UTC().Add(5 * time.Minute)
	_, err := s.Pool.Exec(ctx, `INSERT INTO notify_audit.sink_challenges(subject_id,org_id,digest,expires_at) VALUES($1,$2,$3,$4)
  ON CONFLICT(subject_id,org_id) DO UPDATE SET digest=EXCLUDED.digest,expires_at=EXCLUDED.expires_at`,
		subject, org, hash[:], expires)
	if err != nil {
		return nil, err
	}
	return &api.SinkChallenge{Code: code, ExpiresAt: expires}, nil
}

// CreateTelegramBinding stores a verified Telegram binding.
func (s Store) CreateTelegramBinding(ctx context.Context, subjectID, orgID, rawChatRef, channel string) (*api.Receipt, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	id := web.ID()
	now := time.Now().UTC()
	hash := sha256.Sum256([]byte(strings.TrimSpace(rawChatRef)))
	tag, err := tx.Exec(ctx, `DELETE FROM notify_audit.sink_challenges WHERE subject_id=$1 AND org_id=$2 AND digest=$3 AND expires_at>now()`, subjectID, orgID, hash[:])
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, web.Fail(422, "Kode sink tidak valid, kedaluwarsa, atau sudah dipakai")
	}
	maskedChatRef := "SYNTHETIC_SINK"

	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.telegram_bindings (id, version, subject_id, org_id, chat_ref, verified_at, channel, created_at, updated_at)
		VALUES ($1, 1, $2, $3, $4, $5, $6, $5, $5)
	`, id, subjectID, orgID, maskedChatRef, now, channel)
	if err != nil {
		return nil, err
	}

	// Catat intent audit dengan data tersensor
	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.audit_intents (id, actor_id, action, object_id, scope, reason, outcome, correlation_id, occurred_at)
		VALUES ($1, $2, 'VerifyTelegramBinding', $3, 'M9.telegram_binding', 'Pengikatan Telegram terverifikasi ' || $4, 'SUCCESS', $5, $6)
	`, web.ID(), subjectID, id, maskedChatRef, web.ID(), now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &api.Receipt{ID: id, Version: 1}, nil
}

// RevokeTelegramBinding deactivates a binding with CAS check.
func (s Store) RevokeTelegramBinding(ctx context.Context, id, subjectID string, orgs []string, expectedVersion int64, reason string) (*api.Receipt, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var currentVersion int64
	var ownerID string
	var revokedAt *time.Time
	err = tx.QueryRow(ctx, `SELECT version, subject_id::text, revoked_at FROM notify_audit.telegram_bindings WHERE id=$1 AND org_id=ANY($2::uuid[]) FOR UPDATE`, id, orgs).Scan(&currentVersion, &ownerID, &revokedAt)
	if err == pgx.ErrNoRows {
		return nil, web.Fail(404, "Telegram binding tidak ditemukan")
	} else if err != nil {
		return nil, err
	}

	if ownerID != subjectID {
		return nil, web.Fail(403, "Bukan pemilik binding")
	}

	if revokedAt != nil {
		return nil, web.Fail(409, "Telegram binding sudah dicabut")
	}

	if currentVersion != expectedVersion {
		return nil, web.Fail(409, fmt.Sprintf("Versi konflik: diharapkan %d tetapi versi aktual adalah %d", expectedVersion, currentVersion))
	}

	newVersion := currentVersion + 1
	now := time.Now().UTC()

	_, err = tx.Exec(ctx, `
		UPDATE notify_audit.telegram_bindings
		SET revoked_at = $1, version = $2, updated_at = $1
		WHERE id = $3 AND version = $4
	`, now, newVersion, id, currentVersion)
	if err != nil {
		return nil, err
	}

	// Catat audit intent
	_, err = tx.Exec(ctx, `
		INSERT INTO notify_audit.audit_intents (id, actor_id, action, object_id, scope, reason, outcome, correlation_id, occurred_at)
		VALUES ($1, $2, 'RevokeTelegramBinding', $3, 'M9.telegram_binding', $4, 'SUCCESS', $5, $6)
	`, web.ID(), subjectID, id, reason, web.ID(), now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &api.Receipt{ID: id, Version: newVersion}, nil
}

// ListAudit retrieves append-only audit entries.
func (s Store) ListAudit(ctx context.Context, limit int, cursor string) ([]api.Audit, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := `
		SELECT id, actor_id, action, object_id, scope, reason, outcome, correlation_id, created_at
		FROM notify_audit.audit_entries
	`
	args := []any{}
	argIdx := 1

	if cursor != "" {
		query += fmt.Sprintf(" WHERE id > $%d", argIdx)
		args = append(args, cursor)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC, id ASC LIMIT $%d", argIdx)
	args = append(args, limit+1)

	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []api.Audit
	for rows.Next() {
		var a api.Audit
		if err := rows.Scan(&a.ID, &a.ActorID, &a.Action, &a.ObjectID, &a.Scope, &a.Reason, &a.Outcome, &a.CorrelationID, &a.OccurredAt); err != nil {
			return nil, nil, err
		}
		items = append(items, a)
	}

	var nextCursor *string
	if len(items) > limit {
		next := items[limit-1].ID
		nextCursor = &next
		items = items[:limit]
	}

	if items == nil {
		items = []api.Audit{}
	}
	return items, nextCursor, nil
}
