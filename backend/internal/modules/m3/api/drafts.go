package api

import (
	"time"
)

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

type MediaItem struct {
	OrgID           *string   `json:"org_id,omitempty"`
	ID              string    `json:"id"`
	Version         int64     `json:"version"`
	Owner           string    `json:"owner"`
	PrincipalID     string    `json:"principal_id"`
	StorageKey      string    `json:"storage_key,omitempty"`
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
