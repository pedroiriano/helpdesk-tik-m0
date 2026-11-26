package api

import (
	"context"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/database"
	"time"
)

type RoutingRule struct {
	Version        int64    `json:"version"`
	ID             string   `json:"id"`
	ServiceID      string   `json:"service_id"`
	TeamID         string   `json:"team_id"`
	Level          string   `json:"level"`
	RequiredSkills []string `json:"required_skills"`
	Active         bool     `json:"active"`
	CategoryID     string   `json:"category_id,omitempty"`
	TargetOrgID    string   `json:"target_org_id,omitempty"`
}

type RosterEntry struct {
	Capacity        *int       `json:"capacity"`
	Availability    string     `json:"availability"`
	WaitingVendor   *int       `json:"waiting_vendor"`
	WaitingReporter *int       `json:"waiting_reporter"`
	Version         int64      `json:"version"`
	AvailableFrom   time.Time  `json:"available_from"`
	AvailableUntil  time.Time  `json:"available_until"`
	ActiveTickets   int        `json:"active_tickets"`
	ProjectionAsOf  *time.Time `json:"projection_as_of,omitempty"`
	ID              string     `json:"id"`
	SubjectID       string     `json:"subject_id"`
	TeamID          string     `json:"team_id"`
	Skills          []string   `json:"skills"`
}

type Proposal struct {
	Digest         string      `json:"digest"`
	Status         string      `json:"status"`
	Candidates     []Candidate `json:"candidates"`
	ProjectionAsOf *time.Time  `json:"projection_as_of,omitempty"`
	TicketID       string      `json:"ticket_id"`
	TicketVersion  int64       `json:"ticket_version"`
	AssigneeID     string      `json:"assignee_id"`
	TeamID         string      `json:"team_id"`
	Level          string      `json:"level"`
	Explanation    string      `json:"explanation"`
	TargetOrgID    string      `json:"target_org_id,omitempty"`
	Destination    string      `json:"destination,omitempty"`
}

type Candidate struct {
	Roster   RosterEntry `json:"roster"`
	Name     string      `json:"name"`
	TeamName string      `json:"team_name,omitempty"`
}
type Technician struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	TeamID string   `json:"team_id"`
	Level  string   `json:"level"`
	Skills []string `json:"skills"`
}

type RoutingInput struct {
	ExpectedVersion int64    `json:"expected_version"`
	TeamID          string   `json:"team_id"`
	RequiredSkills  []string `json:"required_skills"`
	Active          bool     `json:"active"`
	Reason          string   `json:"reason"`
	TargetOrgID     string   `json:"target_org_id,omitempty"`
}
type Port interface {
	ReadRouting(context.Context, identity.Actor, string, string, string, string) (RoutingRule, error)
	WriteRouting(context.Context, identity.Actor, string, string, string, string, string, RoutingInput) (database.Result, error)
	Propose(ctx context.Context, ticketID string, ticketVersion int64, serviceID, org, level, category string) (Proposal, error)
	ListTechnicians(ctx context.Context, teamID string) ([]Technician, error)
	ManualCandidates(context.Context, identity.Actor, string) ([]Candidate, error)
	AbsentTechnicians(context.Context, []string) (map[string]bool, error)
}

// DispatchFact is an optional part of the complete committed M3 ticket snapshot.
type DispatchFact struct {
	TeamID                string `json:"team_id"`
	AssigneeID            string `json:"assignee_id"`
	Explanation           string `json:"explanation"`
	Tier                  string `json:"tier"`
	ProposalDigest        string `json:"proposal_digest"`
	RecommendedAssigneeID string `json:"recommended_assignee_id"`
}
