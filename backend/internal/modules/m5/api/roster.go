package api

import "time"

type ManagedRoster struct {
	TeamName       string        `json:"team_name,omitempty"`
	Capacity       *int          `json:"capacity"`
	UpdatedAt      time.Time     `json:"updated_at"`
	Availability   *Availability `json:"availability,omitempty"`
	ID             string        `json:"id"`
	Version        int64         `json:"version"`
	SubjectID      string        `json:"subject_id"`
	TeamID         string        `json:"team_id"`
	Skills         []string      `json:"skills"`
	AvailableFrom  time.Time     `json:"available_from"`
	AvailableUntil time.Time     `json:"available_until"`
	Active         bool          `json:"active"`
}

type RosterInput struct {
	Capacity        *int      `json:"capacity,omitempty"`
	SubjectID       string    `json:"subject_id"`
	ExpectedVersion int64     `json:"expected_version"`
	Skills          []string  `json:"skills"`
	AvailableFrom   time.Time `json:"available_from"`
	AvailableUntil  time.Time `json:"available_until"`
	Active          bool      `json:"active"`
	Reason          string    `json:"reason"`
}
