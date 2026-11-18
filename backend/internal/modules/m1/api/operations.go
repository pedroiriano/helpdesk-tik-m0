package api

import (
	"context"
	"encoding/json"
	"time"
)

// MaintenancePolicyInput defines the input payload for configuring maintenance windows.
type MaintenancePolicyInput struct {
	ExpectedVersion int64     `json:"expected_version,omitempty"`
	TargetID        string    `json:"target_id,omitempty"`
	OrgID           *string   `json:"org_id,omitempty"`
	OrganizationID  string    `json:"organization_id,omitempty"`
	Mode            string    `json:"mode"`
	ScheduleKind    string    `json:"schedule_kind,omitempty"`
	DisplayMode     string    `json:"display_mode,omitempty"`
	StartsAt        time.Time `json:"starts_at"`
	EndsAt          time.Time `json:"ends_at"`
	Message         string    `json:"message"`
}

// MaintenancePolicy represents a scheduled or unscheduled maintenance policy.
type MaintenancePolicy struct {
	ID           string    `json:"id"`
	Version      int64     `json:"version"`
	OrgID        *string   `json:"org_id,omitempty"`
	Mode         string    `json:"mode"`
	ScheduleKind string    `json:"schedule_kind"`
	DisplayMode  string    `json:"display_mode"`
	StartsAt     time.Time `json:"starts_at"`
	EndsAt       time.Time `json:"ends_at"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// PublicMaintenanceStatus exposes active and upcoming maintenance windows to public portals.
type PublicMaintenanceStatus struct {
	Active     *MaintenancePolicy  `json:"active"`
	Upcoming   []MaintenancePolicy `json:"upcoming"`
	ObservedAt time.Time           `json:"observed_at"`
}

// AdminMaintenanceOverview exposes active, upcoming, and recent maintenance windows in admin.
type AdminMaintenanceOverview struct {
	Active     *MaintenancePolicy  `json:"active"`
	Upcoming   []MaintenancePolicy `json:"upcoming"`
	Recent     []MaintenancePolicy `json:"recent"`
	ObservedAt time.Time           `json:"observed_at"`
}

// SystemJobInput defines the request body for running a scoped operational job.
type SystemJobInput struct {
	ExpectedVersion int64   `json:"expected_version,omitempty"`
	Kind            string  `json:"kind"`
	TargetID        string  `json:"target_id,omitempty"`
	Reason          string  `json:"reason"`
	ApprovedBy      *string `json:"approved_by,omitempty"`
}

// PurgeRequestInput defines the input payload for requesting a data purge.
type PurgeRequestInput struct {
	ExpectedVersion        int64  `json:"expected_version,omitempty"`
	ObjectID               string `json:"object_id,omitempty"`
	TargetID               string `json:"target_id,omitempty"`
	RetentionPolicyVersion int64  `json:"retention_policy_version,omitempty"`
	Reason                 string `json:"reason"`
}

type ApproveSystemJobInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type ExecuteSystemJobInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type BackupManifestArtifact struct {
	Payload []byte
	SHA256  string
}

type BackupManifestRunner struct {
	Execute      func(ctx context.Context, targetID, jobID, actorID string, version int64) (json.RawMessage, error)
	ReadArtifact func(ctx context.Context, jobID string, receipt json.RawMessage) (BackupManifestArtifact, error)
}

type PurgeRunner struct {
	Preflight func(ctx context.Context, ticketID string) error
	Execute   func(ctx context.Context, ticketID, actorID, reason string) (json.RawMessage, error)
}

// SystemJob represents an operation job record in identity.system_operation_requests.
type SystemJob struct {
	ID               string          `json:"id"`
	Version          int64           `json:"version"`
	Kind             string          `json:"kind"`
	RequestedBy      string          `json:"requested_by"`
	TargetID         string          `json:"target_id"`
	State            string          `json:"state"`
	Reason           string          `json:"reason"`
	ApprovedBy       *string         `json:"approved_by,omitempty"`
	ApprovedAt       *time.Time      `json:"approved_at,omitempty"`
	ExecutionReceipt json.RawMessage `json:"execution_receipt,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// RedactedHealth contains sanitized health evaluation of all 9 modules and platform services.
type RedactedHealth struct {
	Status                string            `json:"status"`
	Modules               map[string]string `json:"modules"`
	Scanner               string            `json:"scanner"`
	Storage               string            `json:"storage"`
	OutboxLag             *int64            `json:"outbox_lag"`
	InboxLag              *int64            `json:"inbox_lag"`
	OldestDeliverySeconds *int64            `json:"oldest_delivery_seconds"`
	DeadLetters           *int64            `json:"dead_letters"`
	Worker                string            `json:"worker"`
	ObservedAt            time.Time         `json:"observed_at"`
}
