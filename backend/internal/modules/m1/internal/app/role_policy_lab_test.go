package app

import (
	"reflect"
	"testing"

	"helpdesk.local/m0/internal/modules/m1/api"
)

func TestSuperAdminLabReportGrant(t *testing.T) {
	for _, tc := range []struct {
		name     string
		lab      bool
		fixture  bool
		alter    func(*api.Actor)
		wantRead bool
	}{
		{name: "granted synthetic PD", lab: true, fixture: true, wantRead: true},
		{name: "production", fixture: true},
		{name: "non-fixture session", lab: true},
		{name: "different synthetic account", lab: true, fixture: true, alter: func(a *api.Actor) { a.ID = "other" }},
		{name: "different PD", lab: true, fixture: true, alter: func(a *api.Actor) { a.Memberships[0].OrganizationID = "other" }},
		{name: "inactive PD", lab: true, fixture: true, alter: func(a *api.Actor) { a.Memberships[0].OrganizationActive = false }},
		{name: "team mandate", lab: true, fixture: true, alter: func(a *api.Actor) {
			team := "team"
			a.Memberships[0].TeamID = &team
		}},
		{name: "grant missing", lab: true, fixture: true, alter: func(a *api.Actor) {
			a.Memberships[0].Permissions = []string{"identity.grant"}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := Service{Options: Options{Lab: tc.lab}}
			actor := api.Actor{ID: labSuperAdminID, Kind: "STAFF", Role: "SUPER_ADMIN", Memberships: []api.Membership{{
				OrganizationID: labReportsOrgID, OrganizationActive: true,
				Permissions: []string{"identity.grant", "report.read", "report.export", "ticket.read"},
			}}}
			if tc.alter != nil {
				tc.alter(&actor)
			}
			if err := s.applyRolePolicy(t.Context(), &actor, tc.fixture); err != nil {
				t.Fatal(err)
			}
			want := []string{"identity.grant"}
			if tc.wantRead {
				want = append(want, "report.read")
			}
			if got := actor.Memberships[0].Permissions; !reflect.DeepEqual(got, want) {
				t.Fatalf("permissions = %v, want %v", got, want)
			}
		})
	}
}
