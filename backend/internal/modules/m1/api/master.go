package api

type Organization struct {
	ID               string `json:"id"`
	Version          int64  `json:"version"`
	Code             string `json:"code"`
	Name             string `json:"name"`
	Active           bool   `json:"active"`
	ReportingVisible bool   `json:"reporting_visible"`
}
type Division struct {
	ID             string `json:"id"`
	Version        int64  `json:"version"`
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
	Active         bool   `json:"active"`
}
type DirectoryEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type ReportingContext struct {
	Organization DirectoryEntry  `json:"organization"`
	Division     *DirectoryEntry `json:"division,omitempty"`
	Verified     bool            `json:"verified"`
}
type Team struct {
	DivisionID     *string `json:"division_id,omitempty"`
	ID             string  `json:"id"`
	Version        int64   `json:"version"`
	OrganizationID string  `json:"organization_id"`
	Name           string  `json:"name"`
	Active         bool    `json:"active"`
}
type Binding struct {
	ID             string   `json:"id"`
	Version        int64    `json:"version"`
	SubjectID      string   `json:"subject_id"`
	OrganizationID string   `json:"organization_id"`
	TeamID         *string  `json:"team_id"`
	Permissions    []string `json:"permissions"`
	ExpiresAt      string   `json:"expires_at"`
	Revoked        bool     `json:"revoked"`
}
type Subject struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
	Role string `json:"role"`
}

type MasterInput struct {
	ExpectedVersion  int64    `json:"expected_version"`
	Code             string   `json:"code,omitempty"`
	Name             string   `json:"name,omitempty"`
	Active           bool     `json:"active"`
	OrganizationID   string   `json:"organization_id,omitempty"`
	SubjectID        string   `json:"subject_id,omitempty"`
	TeamID           *string  `json:"team_id,omitempty"`
	Permissions      []string `json:"permissions,omitempty"`
	ExpiresAt        string   `json:"expires_at,omitempty"`
	Revoked          bool     `json:"revoked"`
	Reason           string   `json:"reason,omitempty"`
	ReportingVisible *bool    `json:"reporting_visible,omitempty"`
	DivisionID       *string  `json:"division_id,omitempty"`
}
