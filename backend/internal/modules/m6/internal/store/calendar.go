package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/web"
)

type Store struct {
	Pool *pgxpool.Pool
}

func (s Store) GetHolidays(ctx context.Context, calendarCode string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT to_char(h.holiday, 'YYYY-MM-DD') FROM sla.holidays h JOIN sla.calendars c ON h.calendar_id = c.id WHERE c.code=$1 ORDER BY h.holiday`, calendarCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var holidays []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		holidays = append(holidays, d)
	}
	return holidays, rows.Err()
}

func (s Store) GetClock(ctx context.Context, ticketID string, now time.Time) (api.ClockProjection, error) {
	var v api.ClockProjection
	var snapshot []byte
	err := s.Pool.QueryRow(ctx, `SELECT ticket_id::text, accepted_at, due_at, gross_seconds, net_seconds, policy_version, clock_snapshot FROM sla.clock_projection WHERE ticket_id=$1`, ticketID).Scan(&v.TicketID, &v.AcceptedAt, &v.DueAt, &v.GrossSeconds, &v.NetSeconds, &v.PolicyVersion, &snapshot)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.ClockProjection{}, web.Fail(404, "Data SLA tiket tidak ditemukan")
		}
		return api.ClockProjection{}, err
	}

	if len(snapshot) > 0 {
		if err := json.Unmarshal(snapshot, &v); err != nil {
			return api.ClockProjection{}, err
		}
	} else {
		v.Status = "UNAVAILABLE"
	}

	return v, nil
}

func (s Store) RecordClock(ctx context.Context, ticketID string, sourceVersion int64, acceptedAt, dueAt time.Time, grossSeconds, netSeconds int64, policyVersion int64) error {
	id := web.ID()
	if policyVersion < 1 {
		policyVersion = 1
	}
	if grossSeconds < 0 {
		grossSeconds = 0
	}
	if netSeconds < 0 {
		netSeconds = 0
	}
	if netSeconds > grossSeconds {
		netSeconds = grossSeconds
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO sla.clock_projection(id, version, ticket_id, source_version, accepted_at, due_at, gross_seconds, net_seconds, policy_version, updated_at)
		VALUES($1, 1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT(ticket_id) DO UPDATE SET
			source_version = EXCLUDED.source_version,
   due_at = EXCLUDED.due_at,
			gross_seconds = EXCLUDED.gross_seconds,
			net_seconds = EXCLUDED.net_seconds,
			policy_version = EXCLUDED.policy_version,
			version = sla.clock_projection.version + 1,
			updated_at = now()
		WHERE sla.clock_projection.source_version < EXCLUDED.source_version`,
		id, ticketID, sourceVersion, acceptedAt, dueAt, grossSeconds, netSeconds, policyVersion)
	return err
}
