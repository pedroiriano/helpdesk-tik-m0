package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func Event(ctx context.Context, tx pgx.Tx, kind, aggregate string, version int64, payload any, consumers []string) error {
	raw, e := json.Marshal(payload)
	if e != nil {
		return e
	}
	digest, e := delivery.Digest(raw)
	if e != nil {
		return e
	}
	id := web.ID()
	_, e = tx.Exec(ctx, `INSERT INTO intake.outbox(event_id,event_type,schema_version,aggregate_id,aggregate_version,occurred_at,correlation_id,payload,digest) VALUES($1,$2,1,$3,$4,now(),$5,$6,$7)`, id, kind, aggregate, version, web.CorrelationID(ctx), raw, digest)
	if e != nil {
		return e
	}
	for _, c := range consumers {
		if _, e = tx.Exec(ctx, `INSERT INTO intake.outbox_delivery(event_id,consumer_id,state) VALUES($1,$2,'PENDING')`, id, c); e != nil {
			return e
		}
	}
	return nil
}
