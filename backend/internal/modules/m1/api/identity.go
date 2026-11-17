package api

import (
	"context"
	"strings"

	"helpdesk.local/m0/internal/platform/web"
)

type Credentials struct {
	Token, CSRF string
	Write       bool
}
type Membership struct {
	OrganizationActive bool     `json:"organization_active"`
	ID                 string   `json:"id"`
	OrganizationID     string   `json:"organization_id"`
	TeamID             *string  `json:"team_id"`
	Permissions        []string `json:"permissions"`
	GrantCeiling       []string `json:"grant_ceiling"`
}

// Actor is a value snapshot from a live session lookup, never from request JSON.
type Actor struct {
	ID          string       `json:"subject_id"`
	Role        string       `json:"role"`
	Kind        string       `json:"kind"`
	Name        string       `json:"name"`
	Memberships []Membership `json:"memberships"`
}

func (a Actor) Can(permission, org string) bool {
	for _, m := range a.Memberships {
		if m.OrganizationID == org && (m.OrganizationActive || strings.HasPrefix(permission, "identity.")) {
			for _, p := range m.Permissions {
				if p == permission {
					return true
				}
			}
		}
	}
	return false
}
func (a Actor) Orgs(permission string) []string {
	out := []string{}
	for _, m := range a.Memberships {
		if (permission == "" && m.OrganizationActive) || (permission != "" && a.Can(permission, m.OrganizationID)) {
			out = append(out, m.OrganizationID)
		}
	}
	return out
}

type Port interface {
	Authenticate(context.Context, Credentials) (Actor, error)
	OrganizationActive(context.Context, string) (bool, error)
	ReportingContext(context.Context, string, string, bool) (ReportingContext, error)
	ActiveTeamInOrg(context.Context, string, string) (bool, error)
	RoutingDestination(context.Context, string, string) (string, error)
	HandoffTargets(context.Context, string, string, web.Page) ([]DirectoryEntry, error)
	Subject(context.Context, string) (Subject, error)
	Access(context.Context, string) (Actor, error)
	ActiveMaintenance(context.Context, string) (*MaintenancePolicy, error)
}
