package database

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/platform/web"
)

// Mutation is infrastructure metadata, not a shared business repository.
type Mutation struct {
	Owner, Actor, Command, Target, Key, Scope, Reason string
	Payload                                           any
}
type Result struct {
	Status int
	Body   json.RawMessage
}

func ownerSchema(owner string) (string, error) {
	switch owner {
	case "M1":
		return "identity", nil
	case "M2":
		return "catalog", nil
	case "M3":
		return "intake", nil
	case "M4":
		return "classification", nil
	case "M5":
		return "assignment", nil
	case "M6":
		return "sla", nil
	case "M7":
		return "escalation", nil
	case "M8":
		return "knowledge", nil
	default:
		return "", fmt.Errorf("unsupported mutation owner")
	}
}

func idempotencyDigest(m Mutation) (string, []byte, error) {
	if len(m.Key) < 16 || len(m.Key) > 128 {
		return "", nil, web.Fail(400, "Idempotency-Key diperlukan (16–128 karakter)")
	}
	schema, err := ownerSchema(m.Owner)
	if err != nil {
		return "", nil, err
	}
	payload, err := json.Marshal(m.Payload)
	if err != nil {
		return "", nil, err
	}
	digest := sha256.Sum256(payload)
	return schema, digest[:], nil
}

// LookupIdempotency checks a prior durable response before non-atomic pre-checks run.
func LookupIdempotency(ctx context.Context, pool *pgxpool.Pool, m Mutation) (Result, bool, error) {
	var zero Result
	schema, digest, err := idempotencyDigest(m)
	if err != nil {
		return zero, false, err
	}
	var previous Result
	var previousDigest []byte
	var expires time.Time
	err = pool.QueryRow(ctx, "SELECT payload_digest,response_status,response_body,expires_at FROM "+schema+".idempotency_records WHERE actor_scope=$1 AND command=$2 AND target=$3 AND key=$4", m.Actor, m.Command, m.Target, m.Key).Scan(&previousDigest, &previous.Status, &previous.Body, &expires)
	if err == pgx.ErrNoRows {
		return zero, false, nil
	}
	if err != nil {
		return zero, false, err
	}
	if string(previousDigest) != string(digest) || !expires.After(time.Now()) {
		return zero, false, web.Fail(409, "Key telah digunakan untuk intent berbeda atau kedaluwarsa")
	}
	return previous, true, nil
}

func Mutate(ctx context.Context, pool *pgxpool.Pool, m Mutation, apply func(pgx.Tx) (Result, error)) (Result, error) {
	var zero Result
	schema, digest, err := idempotencyDigest(m)
	if err != nil {
		return zero, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return zero, err
	}
	defer tx.Rollback(ctx)
	// Serialize the same logical intent, including concurrent lost-response retries.
	_, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", m.Actor+"|"+m.Command+"|"+m.Target+"|"+m.Key)
	if err != nil {
		return zero, err
	}
	var previous Result
	var previousDigest []byte
	var expires time.Time
	err = tx.QueryRow(ctx, "SELECT payload_digest,response_status,response_body,expires_at FROM "+schema+".idempotency_records WHERE actor_scope=$1 AND command=$2 AND target=$3 AND key=$4", m.Actor, m.Command, m.Target, m.Key).Scan(&previousDigest, &previous.Status, &previous.Body, &expires)
	if err == nil {
		if string(previousDigest) != string(digest[:]) || !expires.After(time.Now()) {
			return zero, web.Fail(409, "Key telah digunakan untuk intent berbeda atau kedaluwarsa")
		}
		return previous, nil
	}
	if err != pgx.ErrNoRows {
		return zero, err
	}
	result, err := apply(tx)
	if err != nil {
		return zero, err
	}
	_, err = tx.Exec(ctx, "INSERT INTO "+schema+".idempotency_records(actor_scope,command,target,key,payload_digest,response_status,response_body,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '24 hours')", m.Actor, m.Command, m.Target, m.Key, digest[:], result.Status, result.Body)
	if err != nil {
		return zero, err
	}
	actor := m.Actor
	if !web.UUID(actor) {
		actor = "00000000-0000-4000-8000-000000000000"
	}
	object := m.Target
	var receipt struct {
		ID      string `json:"id"`
		Version int64  `json:"version"`
	}
	_ = json.Unmarshal(result.Body, &receipt)
	if web.UUID(receipt.ID) {
		object = receipt.ID
	}
	if !web.UUID(object) {
		return zero, fmt.Errorf("mutation object unavailable")
	}
	if receipt.Version < 1 {
		receipt.Version = 1
	}
	auditID, correlation := web.ID(), web.CorrelationID(ctx)
	now := time.Now().UTC()
	audit := map[string]any{"actor_id": actor, "action": m.Command, "object_id": object, "scope": m.Scope, "reason": m.Reason, "outcome": "SUCCESS"}
	raw, _ := json.Marshal(audit)
	hash := sha256.Sum256(raw)
	_, err = tx.Exec(ctx, "INSERT INTO "+schema+".audit_intents(id,actor_id,action,object_id,scope,reason,outcome,correlation_id) VALUES($1,$2,$3,$4,$5,$6,'SUCCESS',$7)", auditID, actor, m.Command, object, m.Scope, m.Reason, correlation)
	if err != nil {
		return zero, err
	}
	_, err = tx.Exec(ctx, "INSERT INTO "+schema+".outbox(event_id,event_type,schema_version,aggregate_id,aggregate_version,occurred_at,correlation_id,payload,digest) VALUES($1,'AuditRecorded',1,$2,$3,$4,$5,$6,$7)", auditID, object, receipt.Version, now, correlation, raw, hash[:])
	if err != nil {
		return zero, err
	}
	_, err = tx.Exec(ctx, "INSERT INTO "+schema+".outbox_delivery(event_id,consumer_id,state) VALUES($1,'M9','PENDING')", auditID)
	if err != nil {
		return zero, err
	}
	if err = tx.Commit(ctx); err != nil {
		return zero, err
	}
	return result, nil
}
func Response(status int, value any) (Result, error) {
	b, err := json.Marshal(value)
	return Result{status, b}, err
}
