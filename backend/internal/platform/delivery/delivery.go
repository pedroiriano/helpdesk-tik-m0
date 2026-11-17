// Package delivery provides owner-bound durable transport metadata, not business data queries.
package delivery

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

type Event struct {
	ID            string          `json:"event_id"`
	Type          string          `json:"event_type"`
	Producer      string          `json:"producer"`
	SchemaVersion int             `json:"schema_version"`
	Aggregate     string          `json:"aggregate_id"`
	Version       int64           `json:"aggregate_version"`
	Occurred      time.Time       `json:"occurred_at"`
	Correlation   string          `json:"correlation_id"`
	Payload       json.RawMessage `json:"payload"`
	Digest        []byte          `json:"-"`
	Lease         string          `json:"-"`
	Attempts      int             `json:"-"`
}

// Sources are created by the owning module, using only its own pool/schema.
type Source struct {
	pool          *pgxpool.Pool
	schema, owner string
	ConsumerID    string
	hasLease      bool
	Now           func() time.Time
}

func (s *Source) consumer() string {
	if s.ConsumerID != "" {
		return s.ConsumerID
	}
	return "M9"
}

func New(pool *pgxpool.Pool, owner string) *Source {
	return NewForConsumer(pool, owner, "M9")
}

func NewForConsumer(pool *pgxpool.Pool, owner string, consumerID string) *Source {
	schema := map[string]string{
		"M1": "identity",
		"M2": "catalog",
		"M3": "intake",
		"M4": "classification",
		"M5": "assignment",
		"M6": "sla",
		"M7": "escalation",
		"M8": "knowledge",
		"M9": "notify_audit",
	}[owner]
	if schema == "" {
		panic("unsupported delivery owner")
	}
	if consumerID == "" {
		consumerID = "M9"
	}
	hasLease := owner == "M1" || owner == "M2" || owner == "M3"
	return &Source{pool: pool, schema: schema, owner: owner, ConsumerID: consumerID, hasLease: hasLease, Now: time.Now}
}

func (s *Source) Claim(ctx context.Context) (Event, error) {
	var v Event
	now := s.Now().UTC()
	v.Lease = web.ID()
	v.Producer = s.owner
	target := s.consumer()
	tx, e := s.pool.Begin(ctx)
	if e != nil {
		return v, e
	}
	defer tx.Rollback(ctx)

	if s.hasLease {
		_, e = tx.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='DEAD_LETTER',lease_until=NULL,lease_token=NULL,last_error_code='RETRY_EXHAUSTED' WHERE consumer_id=$1 AND state='LEASED' AND attempts>=8 AND lease_until<=$2`, target, now)
		if e != nil {
			return v, e
		}
		e = tx.QueryRow(ctx, `SELECT event_id::text,attempts FROM `+s.schema+`.outbox_delivery WHERE consumer_id=$1 AND attempts<8 AND ((state='PENDING' AND next_attempt_at<=$2) OR (state='LEASED' AND lease_until<=$2)) ORDER BY event_id FOR UPDATE SKIP LOCKED LIMIT 1`, target, now).Scan(&v.ID, &v.Attempts)
		if e != nil {
			if errors.Is(e, pgx.ErrNoRows) {
				if commitErr := tx.Commit(ctx); commitErr != nil {
					return v, commitErr
				}
				return v, ErrEmpty
			}
			return v, e
		}
		_, e = tx.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='LEASED',lease_token=$1,lease_until=$2,attempts=attempts+1 WHERE event_id=$3 AND consumer_id=$4`, v.Lease, now.Add(20*time.Second), v.ID, target)
		if e != nil {
			return v, e
		}
	} else {
		_, e = tx.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='DEAD_LETTER',lease_until=NULL,last_error_code='RETRY_EXHAUSTED' WHERE consumer_id=$1 AND state='LEASED' AND attempts>=8 AND lease_until<=$2`, target, now)
		if e != nil {
			return v, e
		}
		e = tx.QueryRow(ctx, `SELECT event_id::text,attempts FROM `+s.schema+`.outbox_delivery WHERE consumer_id=$1 AND attempts<8 AND (state='PENDING' OR (state='LEASED' AND lease_until<=$2)) ORDER BY event_id FOR UPDATE SKIP LOCKED LIMIT 1`, target, now).Scan(&v.ID, &v.Attempts)
		if e != nil {
			if errors.Is(e, pgx.ErrNoRows) {
				if commitErr := tx.Commit(ctx); commitErr != nil {
					return v, commitErr
				}
				return v, ErrEmpty
			}
			return v, e
		}
		_, e = tx.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='LEASED',lease_until=$1,attempts=attempts+1 WHERE event_id=$2 AND consumer_id=$3`, now.Add(20*time.Second), v.ID, target)
		if e != nil {
			return v, e
		}
	}

	v.Attempts++
	e = tx.QueryRow(ctx, `SELECT event_type,schema_version,aggregate_id::text,aggregate_version,occurred_at,correlation_id::text,payload,digest FROM `+s.schema+`.outbox WHERE event_id=$1`, v.ID).Scan(&v.Type, &v.SchemaVersion, &v.Aggregate, &v.Version, &v.Occurred, &v.Correlation, &v.Payload, &v.Digest)
	if e != nil {
		return v, e
	}
	e = tx.Commit(ctx)
	return v, e
}

func (s *Source) Ack(ctx context.Context, v Event) error {
	if s.hasLease {
		tag, e := s.pool.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='ACKED',acked_at=$1,lease_until=NULL,lease_token=NULL,last_error_code=NULL WHERE event_id=$2 AND consumer_id=$3 AND state='LEASED' AND lease_token=$4`, s.Now().UTC(), v.ID, s.consumer(), v.Lease)
		if e == nil && tag.RowsAffected() != 1 {
			return errors.New("stale delivery lease")
		}
		return e
	}
	tag, e := s.pool.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state='ACKED',acked_at=$1,lease_until=NULL,last_error_code=NULL WHERE event_id=$2 AND consumer_id=$3 AND state='LEASED'`, s.Now().UTC(), v.ID, s.consumer())
	if e == nil && tag.RowsAffected() != 1 {
		return errors.New("stale delivery lease")
	}
	return e
}

func (s *Source) Retry(ctx context.Context, v Event, integrity bool) error {
	state, code := "PENDING", "CONSUMER_UNAVAILABLE"
	if integrity || v.Attempts >= 8 {
		state, code = "DEAD_LETTER", "INTEGRITY_OR_ATTEMPTS"
	}
	if s.hasLease {
		_, e := s.pool.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state=$1,lease_until=NULL,lease_token=NULL,last_error_code=$2,next_attempt_at=$3 WHERE event_id=$4 AND consumer_id=$5 AND state='LEASED' AND lease_token=$6`, state, code, s.Now().UTC().Add(time.Duration(1<<min(v.Attempts, 6))*time.Second), v.ID, s.consumer(), v.Lease)
		return e
	}
	_, e := s.pool.Exec(ctx, `UPDATE `+s.schema+`.outbox_delivery SET state=$1,lease_until=NULL,last_error_code=$2 WHERE event_id=$3 AND consumer_id=$4 AND state='LEASED'`, state, code, v.ID, s.consumer())
	return e
}
func Digest(payload []byte) ([]byte, error) {
	var value any
	if e := json.Unmarshal(payload, &value); e != nil {
		return nil, e
	}
	raw, e := json.Marshal(value)
	if e != nil {
		return nil, e
	}
	hash := sha256.Sum256(raw)
	return hash[:], nil
}

var ErrIntegrity = errors.New("event integrity mismatch")
var ErrEmpty = errors.New("no pending delivery")

type Consumer interface {
	Consume(context.Context, Event) error
}

// Fault hooks are injectable only in tests, never controlled by HTTP.
type Hooks struct {
	AfterConsumer func() error
	BeforeACK     func() error
}

func Step(ctx context.Context, source *Source, consumer Consumer, h Hooks) error {
	v, e := source.Claim(ctx)
	if e != nil {
		return e
	}
	e = consumer.Consume(ctx, v)
	if e != nil {
		_ = source.Retry(ctx, v, errors.Is(e, ErrIntegrity))
		return e
	}
	if h.AfterConsumer != nil {
		if e = h.AfterConsumer(); e != nil {
			return e
		}
	}
	if h.BeforeACK != nil {
		if e = h.BeforeACK(); e != nil {
			return e
		}
	}
	return source.Ack(ctx, v)
}

type Binding struct {
	Source   *Source
	Consumer Consumer
}

func RunBindings(ctx context.Context, bindings []Binding) {
	timer := time.NewTicker(time.Second)
	defer timer.Stop()
	for {
		for _, b := range bindings {
			for n := 0; n < 20; n++ {
				if ctx.Err() != nil {
					return
				}
				if e := Step(ctx, b.Source, b.Consumer, Hooks{}); e != nil {
					break
				}
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
	}
}

func Run(ctx context.Context, sources []*Source, consumer Consumer) {
	bindings := make([]Binding, len(sources))
	for i, s := range sources {
		bindings[i] = Binding{Source: s, Consumer: consumer}
	}
	RunBindings(ctx, bindings)
}

type Backlog struct {
	Pending int64
	Dead    int64
	Oldest  *time.Time
}

// Inspect returns bounded redacted delivery metadata for the configured binding.
func (s *Source) Inspect(ctx context.Context) (Backlog, error) {
	var info Backlog
	err := s.pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE d.state IN ('PENDING','LEASED')),
  count(*) FILTER(WHERE d.state='DEAD_LETTER'),
  min(o.occurred_at) FILTER(WHERE d.state IN ('PENDING','LEASED'))
 FROM `+s.schema+`.outbox_delivery d JOIN `+s.schema+`.outbox o USING(event_id)
 WHERE d.consumer_id=$1 AND d.state<>'ACKED'`, s.consumer()).Scan(&info.Pending, &info.Dead, &info.Oldest)
	return info, err
}
