package api

import "time"

// TicketJobView exposes scheduler execution and replay metadata for Web Admin UI.
type TicketJobView struct {
	ID              string     `json:"id"`
	TicketID        string     `json:"ticket_id"`
	Kind            string     `json:"kind"`
	State           string     `json:"state"`
	Version         int64      `json:"version"`
	ExpectedVersion int64      `json:"expected_version"`
	Attempts        int        `json:"attempts"`
	DueAt           time.Time  `json:"due_at"`
	RetryAt         *time.Time `json:"retry_at"`
	LastError       *string    `json:"last_error_code"`
	AttemptID       *string    `json:"attempt_id"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
