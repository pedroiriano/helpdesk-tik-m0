package api

import (
	"context"
	"time"
)

type Calendar struct {
	ID        string   `json:"id"`
	Code      string   `json:"code"`
	Version   int64    `json:"version"`
	Zone      string   `json:"zone"`
	WorkDays  []int    `json:"work_days"`
	WorkStart string   `json:"work_start"`
	WorkEnd   string   `json:"work_end"`
	Holidays  []string `json:"holidays"`
}
type Target struct {
	Calendar          Calendar `json:"calendar"`
	ResponseMinutes   int      `json:"response_minutes"`
	ResolutionMinutes int      `json:"resolution_minutes"`
}
type PolicySnapshot struct {
	ServiceID        string            `json:"service_id"`
	Version          int64             `json:"policy_version"`
	SyntheticDefault bool              `json:"synthetic_default"`
	Targets          map[string]Target `json:"targets"`
}
type Calculation struct {
	ResponseDue     time.Time `json:"response_due_at"`
	CalendarVersion int64     `json:"calendar_revision"`
	Due             time.Time `json:"due_at"`
	Version         string    `json:"calendar_version"`
	WorkingMinutes  int       `json:"working_minutes"`
}

type ClockProjection struct {
	TicketID      string    `json:"ticket_id"`
	AcceptedAt    time.Time `json:"accepted_at"`
	DueAt         time.Time `json:"due_at"`
	GrossSeconds  int64     `json:"gross_seconds"`
	NetSeconds    int64     `json:"net_seconds"`
	PolicyVersion int64     `json:"policy_version"`
	Status        string    `json:"status"` // 'ON_TRACK', 'AT_RISK', 'BREACHED', 'PAUSED'
	AsOf          time.Time `json:"as_of"`
}

type PauseInterval struct {
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
}

type Port interface {
	Policy(context.Context, string, int64, bool) (PolicySnapshot, error)
	Targets(context.Context, PolicySnapshot, string, time.Time) (Calculation, error)
	Evaluate(context.Context, Target, time.Time, time.Time, []PauseInterval) (Calculation, int64, bool, error)
	Calculate(context.Context, time.Time) (Calculation, error)
	CalculateTarget(ctx context.Context, start time.Time, minutes int, holidays []string) (time.Time, error)
	CalculateDue(ctx context.Context, serviceID string, priority string, acceptedAt time.Time) (time.Time, string, error)
	GetClock(ctx context.Context, ticketID string, now time.Time) (ClockProjection, error)
	RecordClock(ctx context.Context, ticketID string, sourceVersion int64, acceptedAt, dueAt time.Time, grossSeconds, netSeconds int64, policyVersion int64) error
	CalculateGrossAndNet(ctx context.Context, acceptedAt, now time.Time, pauses []PauseInterval) (grossSeconds, netSeconds int64, isPaused bool)
}
