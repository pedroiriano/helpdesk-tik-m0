package app

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/modules/m6/internal/domain"
	"helpdesk.local/m0/internal/modules/m6/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

type Service struct {
	Store store.Store
	Pool  *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		Store: store.Store{Pool: pool},
		Pool:  pool,
	}
}

func (s *Service) Policy(ctx context.Context, service string, version int64, lab bool) (api.PolicySnapshot, error) {
	return s.Store.Policy(ctx, service, version, lab)
}
func (s *Service) Targets(ctx context.Context, p api.PolicySnapshot, priority string, start time.Time) (api.Calculation, error) {
	result, _, _, err := api.Evaluate(ctx, p.Targets[priority], start, start, nil)
	return result, err
}
func (s *Service) Evaluate(ctx context.Context, t api.Target, start, asOf time.Time, pauses []api.PauseInterval) (api.Calculation, int64, bool, error) {
	return api.Evaluate(ctx, t, start, asOf, pauses)
}

func (s *Service) Calculate(ctx context.Context, start time.Time) (api.Calculation, error) {
	return (domain.Baseline{}).Calculate(ctx, start)
}

func (s *Service) CalculateTarget(ctx context.Context, start time.Time, minutes int, holidays []string) (time.Time, error) {
	return domain.CalculateCAL1(ctx, start, minutes, holidays)
}

func (s *Service) CalculateDue(ctx context.Context, serviceID string, priority string, acceptedAt time.Time) (time.Time, string, error) {
	holidays, err := s.Store.GetHolidays(ctx, "CAL-1")
	if err != nil {
		return time.Time{}, "", err
	}
	minutes := 480
	switch priority {
	case "CRITICAL":
		minutes = 120
	case "HIGH":
		minutes = 240
	case "NORMAL":
		minutes = 480
	case "LOW":
		minutes = 1440
	}
	due, err := domain.CalculateCAL1(ctx, acceptedAt, minutes, holidays)
	if err != nil {
		return time.Time{}, "", err
	}
	return due, "CAL-1-LAB-v1", nil
}

func (s *Service) GetClock(ctx context.Context, ticketID string, now time.Time) (api.ClockProjection, error) {
	return s.Store.GetClock(ctx, ticketID, now)
}

func (s *Service) RecordClock(ctx context.Context, ticketID string, sourceVersion int64, acceptedAt, dueAt time.Time, grossSeconds, netSeconds int64, policyVersion int64) error {
	return s.Store.RecordClock(ctx, ticketID, sourceVersion, acceptedAt, dueAt, grossSeconds, netSeconds, policyVersion)
}

func (s *Service) CalculateGrossAndNet(ctx context.Context, acceptedAt, now time.Time, pauses []api.PauseInterval) (grossSeconds, netSeconds int64, isPaused bool) {
	return (domain.Baseline{}).CalculateGrossAndNet(ctx, acceptedAt, now, pauses)
}

func (s *Service) Consume(ctx context.Context, v delivery.Event) error {
	hash, err := delivery.Digest(v.Payload)
	if err != nil || !hmac.Equal(hash, v.Digest) || !web.UUID(v.ID) || !web.UUID(v.Aggregate) || v.Version < 1 || v.SchemaVersion != 1 {
		return delivery.ErrIntegrity
	}

	valid := (v.Type == "TicketCreated" || v.Type == "TicketStateChanged" || v.Type == "ResolutionProposed" || v.Type == "ConfirmationRecorded" || v.Type == "HandoffAccepted" || v.Type == "PauseChanged") && v.Producer == "M3"
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
	err = tx.QueryRow(ctx, `SELECT digest, aggregate_id::text, aggregate_version FROM sla.inbox WHERE consumer_id='M6' AND event_id=$1`, v.ID).Scan(&old, &oldAggregate, &oldVersion)
	if err == nil {
		if !hmac.Equal(old, v.Digest) || oldAggregate != v.Aggregate || oldVersion != v.Version {
			return delivery.ErrIntegrity
		}
		return tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if v.Type == "TicketCreated" || v.Type == "TicketStateChanged" {
		var p struct {
			AcceptedAt      time.Time       `json:"accepted_at"`
			ResolutionDueAt time.Time       `json:"resolution_due_at"`
			PolicyVersion   int64           `json:"policy_version"`
			Gross           int64           `json:"gross_seconds"`
			Net             int64           `json:"net_seconds"`
			Clock           json.RawMessage `json:"sla_clock"`
		}
		if err := json.Unmarshal(v.Payload, &p); err != nil || p.AcceptedAt.IsZero() || p.PolicyVersion < 1 || p.Gross < 0 || p.Net < 0 || p.Net > p.Gross {
			return delivery.ErrIntegrity
		}
		if !p.ResolutionDueAt.IsZero() {
			_, err = tx.Exec(ctx, `INSERT INTO sla.clock_projection(id,version,ticket_id,source_version,accepted_at,due_at,gross_seconds,net_seconds,policy_version,clock_snapshot)
            VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT(ticket_id) DO UPDATE SET source_version=EXCLUDED.source_version,
             due_at=EXCLUDED.due_at,gross_seconds=EXCLUDED.gross_seconds,net_seconds=EXCLUDED.net_seconds,
             policy_version=EXCLUDED.policy_version,clock_snapshot=EXCLUDED.clock_snapshot,
             version=sla.clock_projection.version+1,updated_at=now()
            WHERE sla.clock_projection.source_version<EXCLUDED.source_version`,
				web.ID(), v.Aggregate, v.Version, p.AcceptedAt, p.ResolutionDueAt, p.Gross, p.Net, p.PolicyVersion, p.Clock)
			if err != nil {
				return err
			}
		}
	}

	_, err = tx.Exec(ctx, `INSERT INTO sla.inbox(consumer_id, event_id, digest, aggregate_id, aggregate_version) VALUES('M6', $1, $2, $3, $4)`, v.ID, v.Digest, v.Aggregate, v.Version)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
