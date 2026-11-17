package api

import (
	identity "helpdesk.local/m0/internal/modules/m1/api"
	classify "helpdesk.local/m0/internal/modules/m4/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"time"
)

type Create struct {
	ServiceID           string            `json:"service_id"`
	ServiceVersion      int64             `json:"service_version"`
	FormVersion         int64             `json:"form_version"`
	PolicyVersion       int64             `json:"policy_version"`
	Title               string            `json:"title"`
	Description         string            `json:"description"`
	Answers             map[string]string `json:"answers"`
	ReportingOrgID      string            `json:"reporting_org_id,omitempty"`
	ReportingDivisionID string            `json:"reporting_division_id,omitempty"`
	ReportedCategoryID  string            `json:"reported_category_id,omitempty"`
}
type Ticket struct {
	ID                     string                     `json:"id"`
	Version                int64                      `json:"version"`
	Number                 string                     `json:"number"`
	ServiceID              string                     `json:"service_id"`
	RequesterKind          string                     `json:"requester_kind"`
	RequesterID            string                     `json:"requester_id"`
	RequesterOrg           *string                    `json:"requester_org_id"`
	ReportingContext       *identity.ReportingContext `json:"reporting_context,omitempty"`
	ReportedCategory       *identity.DirectoryEntry   `json:"reported_category,omitempty"`
	OwnerOrg               string                     `json:"service_owner_org_id"`
	HandlingTeamID         *string                    `json:"handling_team_id,omitempty"`
	AssigneeID             *string                    `json:"assignee_id,omitempty"`
	ActiveAttemptID        *string                    `json:"active_attempt_id,omitempty"`
	ReopenUntil            *time.Time                 `json:"reopen_until,omitempty"`
	State                  string                     `json:"state"`
	Verification           string                     `json:"verification"`
	Title                  string                     `json:"title"`
	Description            string                     `json:"description"`
	Accepted               time.Time                  `json:"accepted_at"`
	Updated                time.Time                  `json:"updated_at"`
	PolicyVersion          int64                      `json:"policy_version"`
	FormVersion            int64                      `json:"form_version"`
	EpisodeStartedAt       *time.Time                 `json:"episode_started_at,omitempty"`
	ResponseDue            *time.Time                 `json:"response_due_at,omitempty"`
	FirstResponse          *time.Time                 `json:"first_response_at,omitempty"`
	SLAPolicy              *sla.PolicySnapshot        `json:"-"`
	Due                    time.Time                  `json:"resolution_due_at"`
	Calendar               string                     `json:"calendar_version"`
	ArchivedAt             *time.Time                 `json:"archived_at,omitempty"`
	Answers                map[string]string          `json:"answers"`
	Classification         classify.Proposal          `json:"classification"`
	ClassificationDecision *ClassificationDecision    `json:"classification_decision,omitempty"`
	EpisodeID              string                     `json:"episode_id"`
}
type LifecycleInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Action          string `json:"action"`
	Reason          string `json:"reason"`
}
type ClassificationDecision struct {
	CategoryName string    `json:"category_name"`
	CategoryID   string    `json:"category_id"`
	Priority     string    `json:"priority"`
	VerifiedBy   string    `json:"verified_by"`
	VerifiedAt   time.Time `json:"verified_at"`
}
type VerificationInput struct {
	ExpectedVersion   int64  `json:"expected_version"`
	CategoryID        string `json:"category_id"`
	Priority          string `json:"priority"`
	Reason            string `json:"reason"`
	ClassifierVersion int    `json:"classifier_version"`
	EvidenceDigest    string `json:"evidence_digest"`
}
type DispatchInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	TeamID          string `json:"team_id"`
	AssigneeID      string `json:"assignee_id"`
	ProposalDigest  string `json:"proposal_digest,omitempty"`
	ProposalVersion int64  `json:"proposal_version"`
	Reason          string `json:"reason"`
	Tier            string `json:"tier,omitempty"`
}
type RejectInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	RejectionReason string `json:"rejection_reason"`
	Reason          string `json:"reason,omitempty"`
}
type CommentInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Body            string `json:"body"`
	Visibility      string `json:"visibility"`
}
type Comment struct {
	ID         string    `json:"id"`
	Version    int64     `json:"version"`
	Body       string    `json:"body"`
	Visibility string    `json:"visibility"`
	Created    time.Time `json:"created_at"`
}
type History struct {
	ID      string    `json:"id"`
	Version int64     `json:"version"`
	Action  string    `json:"action"`
	Summary string    `json:"summary"`
	Created time.Time `json:"created_at"`
}
type Attachment struct {
	ID       string `json:"id"`
	Version  int64  `json:"version"`
	Name     string `json:"name"`
	MIME     string `json:"mime"`
	Size     int64  `json:"size_bytes"`
	Status   string `json:"status"`
	Audience string `json:"audience"`
	Scan     string `json:"scan_detail"`
}
type Tracking struct {
	ID       string    `json:"id"`
	Version  int64     `json:"version"`
	TicketID string    `json:"ticket_id"`
	Expires  time.Time `json:"expires_at"`
}

type ResolutionInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Summary         string `json:"summary"`
	ActionNotes     string `json:"action_notes,omitempty"`
}

type ResolutionAttempt struct {
	ID                string    `json:"id"`
	Version           int64     `json:"version"`
	TicketID          string    `json:"ticket_id"`
	EpisodeID         string    `json:"episode_id"`
	ResolvedBy        string    `json:"resolved_by"`
	Summary           string    `json:"summary"`
	ResolvedAt        time.Time `json:"resolved_at"`
	ConfirmationDueAt time.Time `json:"confirmation_due_at"`
	Outcome           string    `json:"outcome"`
}

type ConfirmationInput struct {
	AttemptID       string `json:"attempt_id,omitempty"`
	ExpectedVersion int64  `json:"expected_version"`
	Decision        string `json:"decision"`
	Reason          string `json:"reason,omitempty"`
	RejectionReason string `json:"rejection_reason,omitempty"`
	Feedback        string `json:"feedback,omitempty"`
}

type AutoCloseInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	AttemptID       string `json:"attempt_id"`
}

type VendorCaseInput struct {
	ExpectedVersion   int64      `json:"expected_version"`
	VendorID          string     `json:"vendor_id"`
	InternalPICID     string     `json:"internal_pic_id"`
	ExternalReference string     `json:"external_reference,omitempty"`
	ReferenceNo       string     `json:"reference_no,omitempty"`
	ContractReference string     `json:"contract_reference,omitempty"`
	Summary           string     `json:"summary,omitempty"`
	ExpectedReturnAt  *time.Time `json:"expected_return_at,omitempty"`
	NextFollowupAt    *time.Time `json:"next_followup_at,omitempty"`
	EvidenceIDs       []string   `json:"evidence_ids,omitempty"`
}

type PauseInput struct {
	ExpectedVersion int64      `json:"expected_version"`
	PolicyVersion   int64      `json:"policy_version,omitempty"`
	Reason          string     `json:"reason"`
	Until           *time.Time `json:"until,omitempty"`
	DurationMinutes int        `json:"duration_minutes,omitempty"`
}

type PauseInterval struct {
	StartsAt      time.Time `json:"starts_at"`
	EndsAt        time.Time `json:"ends_at"`
	PolicyVersion int64     `json:"policy_version"`
	Reason        string    `json:"reason"`
}

type HandoffInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	TargetOrgID     string `json:"target_org_id"`
	TargetTeamID    string `json:"target_team_id"`
	Reason          string `json:"reason"`
}

type HandoffOffer struct {
	ID            string `json:"id"`
	TicketID      string `json:"ticket_id"`
	TicketVersion int64  `json:"ticket_version"`
	FromOrgID     string `json:"from_org_id"`
	TargetOrgID   string `json:"target_org_id"`
	TargetTeamID  string `json:"target_team_id"`
}

type AcceptHandoffInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type EscalateInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Level           string `json:"level"`
	Reason          string `json:"reason"`
}

type Operation struct {
	ID          string    `json:"id"`
	Version     int64     `json:"version"`
	TicketID    string    `json:"ticket_id,omitempty"`
	PrincipalID string    `json:"principal_id,omitempty"`
	Kind        string    `json:"kind"`
	State       string    `json:"state"`
	Reason      string    `json:"reason,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SearchHit struct {
	ID      string `json:"id"`
	Owner   string `json:"owner"`
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

type ArchiveInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type RestoreArchiveInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}
