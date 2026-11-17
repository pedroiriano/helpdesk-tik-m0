package api

import (
	"time"
)

type MediaItem struct {
	ID              string    `json:"id"`
	Version         int64     `json:"version"`
	Owner           string    `json:"owner"`
	PrincipalID     string    `json:"principal_id"`
	OrgID           *string   `json:"org_id,omitempty"`
	StorageKey      string    `json:"-"`
	Status          string    `json:"status"`
	Visibility      string    `json:"visibility"`
	MIME            string    `json:"mime,omitempty"`
	SizeBytes       int64     `json:"size_bytes"`
	SHA256          string    `json:"sha256"`
	Alt             string    `json:"alt"`
	Caption         string    `json:"caption,omitempty"`
	License         string    `json:"license"`
	Source          string    `json:"source,omitempty"`
	SanitizedFromID *string   `json:"sanitized_from_id,omitempty"`
	ApprovedBy      *string   `json:"approved_by,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	DownloadPath    string    `json:"download_path,omitempty"`
}

type MediaUploadInput struct {
	HeroCandidate   bool    `json:"hero_candidate,omitempty"`
	OrgID           *string `json:"org_id,omitempty"`
	ExpectedVersion int64   `json:"expected_version"`
	Filename        string  `json:"filename"`
	MIME            string  `json:"mime"`
	SizeBytes       int64   `json:"size_bytes"`
	SHA256          string  `json:"sha256"`
	Alt             string  `json:"alt"`
	License         string  `json:"license"`
	Caption         string  `json:"caption,omitempty"`
	Source          string  `json:"source,omitempty"`
}

type MediaApprovalInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	SanitizedCopyID string `json:"sanitized_copy_id"`
	TargetID        string `json:"target_id"`
	TargetAudience  string `json:"target_audience"`
	Reason          string `json:"reason"`
}

type DraftItem struct {
	ID          string            `json:"id"`
	Version     int64             `json:"version"`
	FormVersion int               `json:"form_version"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Answers     map[string]string `json:"answers,omitempty"`
	UpdatedAt   time.Time         `json:"updated_at"`
	ExpiresAt   time.Time         `json:"expires_at"`
}

type DraftWriteInput struct {
	ExpectedVersion int64             `json:"expected_version"`
	FormVersion     int               `json:"form_version"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	Answers         map[string]string `json:"answers,omitempty"`
	ExpiresAt       *time.Time        `json:"expires_at,omitempty"`
}

type ReuseMediaInput struct {
	ExpectedVersion int64   `json:"expected_version"`
	TargetOwner     string  `json:"target_owner"`
	TargetID        string  `json:"target_id"`
	TargetAudience  string  `json:"target_audience"`
	SanitizedCopyID *string `json:"sanitized_copy_id,omitempty"`
	ApprovalID      *string `json:"approval_id,omitempty"`
	Reason          string  `json:"reason"`
}

type DownloadReceipt struct {
	ID           string    `json:"id"`
	ExpiresAt    time.Time `json:"expires_at"`
	DownloadPath string    `json:"download_path"`
}
