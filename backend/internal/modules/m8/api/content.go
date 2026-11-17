package api

import (
	"time"
)

type ContentItem struct {
	ID             string    `json:"id"`
	Version        int64     `json:"version"`
	Kind           string    `json:"kind,omitempty"`
	Slug           string    `json:"slug"`
	Title          string    `json:"title"`
	Body           string    `json:"body"`
	Audience       string    `json:"audience"`
	State          string    `json:"state"`
	OrgID          *string   `json:"org_id,omitempty"`
	PrincipalID    string    `json:"principal_id,omitempty"`
	CreatedAt      time.Time `json:"created_at,omitempty"`
	UpdatedAt      time.Time `json:"updated_at,omitempty"`
	LatestRevision int       `json:"latest_revision,omitempty"`
}

type ContentWriteInput struct {
	ExpectedVersion int64   `json:"expected_version"`
	Title           string  `json:"title"`
	Slug            string  `json:"slug"`
	Body            string  `json:"body"`
	Audience        string  `json:"audience"`
	Alt             string  `json:"alt"`
	OrgID           *string `json:"org_id,omitempty"`
}

type EditorialTransitionInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Action          string `json:"action"`
	Reason          string `json:"reason"`
}

type SearchHit struct {
	ID      string `json:"id"`
	Owner   string `json:"owner"`
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}
