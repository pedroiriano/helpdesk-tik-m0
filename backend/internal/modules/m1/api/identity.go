package api

import (
	"context"
	"slices"
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

// HasTeamMandate checks a single active binding with all requested permissions.
func (a Actor) HasTeamMandate(org, team string, permissions ...string) bool {
	if a.Kind != "STAFF" {
		return false
	}
	for _, m := range a.Memberships {
		if !m.OrganizationActive || m.OrganizationID != org || (m.TeamID != nil && *m.TeamID != team) {
			continue
		}
		if slices.ContainsFunc(permissions, func(p string) bool { return !slices.Contains(m.Permissions, p) }) {
			continue
		}
		return true
	}
	return false
}

// CanManageRoster grants only roster operations within the same live mandate.
func (a Actor) CanManageRoster(org, team string) bool {
	return a.HasTeamMandate(org, team, "identity.grant", "rules.write") ||
		(a.Role == "COORDINATOR" && a.HasTeamMandate(org, team, "ticket.dispatch"))
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
	DispatchTeams(context.Context, string, web.Page) ([]DirectoryEntry, error)
	RoutingDestination(context.Context, string, string) (string, error)
	HandoffTargets(context.Context, string, string, web.Page) ([]DirectoryEntry, error)
	Subject(context.Context, string) (Subject, error)
	Access(context.Context, string) (Actor, error)
	ActiveMaintenance(context.Context, string) (*MaintenancePolicy, error)
}
