package api

import "time"

type Absence struct {
	ID        string    `json:"id"`
	Version   int64     `json:"version"`
	StartsAt  time.Time `json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	Cancelled bool      `json:"cancelled"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AbsenceInput struct {
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
	Reason   string    `json:"reason"`
}

type Availability struct {
	Status     string    `json:"status"`
	Remaining  *int      `json:"remaining"`
	AssessedAt time.Time `json:"assessed_at"`
}

type CapacitySummary struct {
	Technicians int       `json:"technicians"`
	Measured    int       `json:"measured"`
	Remaining   int       `json:"remaining"`
	Available   int       `json:"available"`
	AssessedAt  time.Time `json:"assessed_at"`
}
