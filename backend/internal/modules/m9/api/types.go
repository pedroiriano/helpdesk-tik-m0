// Package api exposes public DTOs and contracts for notify_audit (M9).
package api

import "time"

type Notification struct {
	ID            string    `json:"id"`
	Version       int64     `json:"version"`
	Title         string    `json:"title"`
	CreatedAt     time.Time `json:"created_at"`
	Read          bool      `json:"read"`
	DeliveryState string    `json:"delivery_state"`
}

type NotificationListResponse struct {
	Items      []Notification `json:"items"`
	NextCursor *string        `json:"next_cursor"`
	AsOf       time.Time      `json:"as_of"`
}

type VersionedReason struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

type TelegramBindingInput struct {
	ExpectedVersion  int64  `json:"expected_version"`
	VerificationCode string `json:"verification_code"`
	ScopeOrgID       string `json:"scope_org_id"`
	Channel          string `json:"channel"`
}

type SinkChallengeInput struct {
	ScopeOrgID string `json:"scope_org_id"`
}

type SinkChallenge struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
}

type ReportQuery struct {
	From           time.Time `json:"from"`
	To             time.Time `json:"to"`
	Timezone       string    `json:"timezone"`
	OrganizationID string    `json:"organization_id"`
	Cohort         string    `json:"cohort"`
	Format         string    `json:"format"`
}

type Report struct {
	AsOf          time.Time  `json:"as_of"`
	Watermark     *time.Time `json:"watermark"`
	Timezone      string     `json:"timezone"`
	PolicyVersion *int64     `json:"policy_version"`
	Denominator   int64      `json:"denominator"`
	Count         int64      `json:"count"`
	Measure       string     `json:"measure"`
	Accepted      int64      `json:"accepted"`
	Backlog       int64      `json:"backlog"`
	Completed     int64      `json:"completed"`
	Breached      int64      `json:"breached"`
	Cancelled     int64      `json:"cancelled"`
	Unmeasured    int64      `json:"unmeasured"`
	GrossSeconds  int64      `json:"gross_seconds"`
	NetSeconds    int64      `json:"net_seconds"`
	SLAPercent    *float64   `json:"sla_percent"`
}

type Operation struct {
	ID        string    `json:"id"`
	Version   int64     `json:"version"`
	State     string    `json:"state"`
	Kind      string    `json:"kind"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Download struct {
	ID           string    `json:"id"`
	ExpiresAt    time.Time `json:"expires_at"`
	DownloadPath string    `json:"download_path"`
}

type Audit struct {
	ID            string    `json:"id"`
	ActorID       string    `json:"actor_id"`
	Action        string    `json:"action"`
	ObjectID      string    `json:"object_id"`
	Scope         string    `json:"scope"`
	Reason        string    `json:"reason"`
	Outcome       string    `json:"outcome"`
	CorrelationID string    `json:"correlation_id"`
	OccurredAt    time.Time `json:"occurred_at"`
}

type AuditListResponse struct {
	Items      []Audit   `json:"items"`
	NextCursor *string   `json:"next_cursor"`
	AsOf       time.Time `json:"as_of"`
}

type Receipt struct {
	ID      string `json:"id"`
	Version int64  `json:"version"`
}
