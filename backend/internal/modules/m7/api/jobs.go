package api

import (
	"errors"
	"time"
)

var ErrStaleJob = errors.New("scheduled attempt is no longer applicable")
var ErrLostLease = errors.New("scheduler lease was reclaimed")

type Job struct {
	ID              string    `json:"id"`
	TicketID        string    `json:"ticket_id"`
	AttemptID       *string   `json:"attempt_id"`
	LeaseVersion    int64     `json:"-"`
	Attempts        int       `json:"attempts"`
	ExpectedVersion int64     `json:"expected_version"`
	Kind            string    `json:"kind"`
	IdempotencyKey  string    `json:"idempotency_key"`
	DueAt           time.Time `json:"due_at"`
	State           string    `json:"state"`
}

type ReplayRequest struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type ReplayReceipt struct {
	ID      string `json:"id"`
	Version int64  `json:"version"`
	State   string `json:"state"`
}

type JobStatus struct {
	ID        string     `json:"id"`
	Version   int64      `json:"version"`
	State     string     `json:"state"`
	DueAt     time.Time  `json:"due_at"`
	RetryAt   *time.Time `json:"retry_at"`
	Attempts  int        `json:"attempts"`
	LastError *string    `json:"last_error_code"`
}
