package api

import "time"

type TechnicalPerformanceScope struct {
	OrganizationID string
	TeamIDs        []string // nil represents an organization-wide mandate.
	SubjectID      string   // self-service scope when populated.
	From, To       time.Time
}

type TechnicalFact struct {
	TicketID      string
	Kind          string
	At            time.Time
	Seconds       int64
	Due, Endpoint *time.Time
	Gross, Net    *int64
}
