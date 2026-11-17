package api

import (
	"context"
	identity "helpdesk.local/m0/internal/modules/m1/api"
)

type Snapshot struct {
	Service Service `json:"service"`
	Form    Form    `json:"form"`
	Policy  Policy  `json:"policy"`
}
type Port interface {
	Snapshot(context.Context, identity.Credentials, string) (Snapshot, error)
	VerificationCategories(context.Context, string) ([]Category, error)
	AdminService(context.Context, identity.Credentials, string) (Service, error)
}

type Field struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Required bool     `json:"required"`
	Options  []string `json:"options"`
}
type Service struct {
	ID          string  `json:"id"`
	Version     int64   `json:"version"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	AccessMode  string  `json:"access_mode"`
	OwnerOrgID  string  `json:"owner_org_id"`
	CategoryID  *string `json:"category_id"`
	FormVersion int64   `json:"form_version"`
	Active      bool    `json:"active"`
}
type Category struct {
	ID         string `json:"id"`
	Version    int64  `json:"version"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	OwnerOrgID string `json:"owner_org_id"`
	Active     bool   `json:"active"`
}
type Form struct {
	ID          string  `json:"id"`
	Version     int64   `json:"version"`
	FormVersion int64   `json:"form_version"`
	Fields      []Field `json:"fields"`
}
type Policy struct {
	ID            string   `json:"id"`
	Version       int64    `json:"version"`
	PolicyVersion int64    `json:"policy_version"`
	UploadMax     int64    `json:"upload_max_bytes"`
	AllowedMIME   []string `json:"allowed_mime"`
	AudienceOrgs  []string `json:"audience_org_ids"`
}
type ServiceInput struct {
	ExpectedVersion int64   `json:"expected_version,omitempty"`
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	Active          bool    `json:"active"`
	AccessMode      string  `json:"access_mode"`
	OwnerOrgID      string  `json:"owner_org_id"`
	CategoryID      *string `json:"category_id"`
	FormVersion     int64   `json:"form_version"`
}
type CategoryInput struct {
	ExpectedVersion int64  `json:"expected_version,omitempty"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	Active          bool   `json:"active"`
	OwnerOrgID      string `json:"owner_org_id"`
}
type FormInput struct {
	ExpectedVersion int64   `json:"expected_version"`
	FormVersion     int64   `json:"form_version"`
	Fields          []Field `json:"fields"`
}
type PolicyInput struct {
	ExpectedVersion int64    `json:"expected_version"`
	PolicyVersion   int64    `json:"policy_version"`
	UploadMax       int64    `json:"upload_max_bytes"`
	AllowedMIME     []string `json:"allowed_mime"`
	AudienceOrgs    []string `json:"audience_org_ids"`
}

type NavigationItem struct {
	ID          string `json:"id"`
	Version     int64  `json:"version"`
	Route       string `json:"route"`
	Label       string `json:"label"`
	Audience    string `json:"audience"`
	Position    int    `json:"position"`
	FeatureCode string `json:"feature_code,omitempty"`
}

type NavigationWriteInput struct {
	ExpectedVersion int64  `json:"expected_version"`
	Route           string `json:"route"`
	Label           string `json:"label"`
	Audience        string `json:"audience"`
	Position        int    `json:"position"`
}

type Receipt struct {
	ID      string `json:"id"`
	Version int64  `json:"version"`
}

type SearchHit struct {
	ID      string `json:"id"`
	Owner   string `json:"owner"`
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}
