package store

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

// Lookup only reads this owner's persisted receipt. Caller must recheck current authority/binding.
func (s Store) Receipt(ctx context.Context, actor, key string, payload any) (database.Result, bool, error) {
	return s.MutationReceipt(ctx, actor, "CreateTicket", "new", key, payload)
}

func (s Store) MutationReceipt(ctx context.Context, actor, command, target, key string, payload any) (database.Result, bool, error) {
	var v database.Result
	if len(key) < 16 || len(key) > 128 {
		return v, false, web.Fail(400, "Idempotency-Key diperlukan (16–128 karakter)")
	}
	var digest []byte
	var expires time.Time
	e := s.Pool.QueryRow(ctx, `SELECT response_status,response_body,payload_digest,expires_at FROM intake.idempotency_records WHERE actor_scope=$1 AND command=$2 AND target=$3 AND key=$4`, actor, command, target, key).Scan(&v.Status, &v.Body, &digest, &expires)
	if e == pgx.ErrNoRows {
		return v, false, nil
	}
	if e != nil {
		return v, false, e
	}
	raw, _ := json.Marshal(payload)
	h := sha256.Sum256(raw)
	if !hmac.Equal(digest, h[:]) || !expires.After(time.Now()) {
		return v, false, web.Fail(409, "Key telah digunakan untuk intent berbeda atau kedaluwarsa")
	}
	return v, true, nil
}

// HandoffReceiptVisible binds a stored result to its audited offer and current owner.
func (s Store) HandoffReceiptVisible(ctx context.Context, ticket, offer, actor, key string, orgs []string) (bool, error) {
	var visible bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(
  SELECT 1 FROM intake.handoff_requests h
  JOIN intake.tickets t ON t.id=h.ticket_id AND t.service_owner_org_id=h.target_org_id
  JOIN intake.idempotency_records r ON r.actor_scope=$3 AND r.command='AcceptHandoff' AND r.target=t.id::text AND r.key=$4
  JOIN intake.audit_intents a ON a.actor_id=h.accepted_by AND a.action=r.command AND a.object_id=t.id
    AND a.scope=h.id::text AND a.occurred_at=r.created_at
  WHERE t.id=$1 AND h.id=$2 AND h.accepted_by=$3::uuid AND h.state='ACCEPTED' AND h.target_org_id=ANY($5::uuid[])
 )`, ticket, offer, actor, key, orgs).Scan(&visible)
	return visible, err
}
