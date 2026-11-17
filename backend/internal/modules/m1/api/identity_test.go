package api

import "testing"

func TestInactiveOrganizationRecoveryWithoutCatalogGrant(t *testing.T) {
	a := Actor{Memberships: []Membership{{OrganizationID: "a", Permissions: []string{"identity.grant", "catalog.write"}}}}
	if !a.Can("identity.grant", "a") || a.Can("catalog.write", "a") || len(a.Orgs("")) != 0 || a.Can("identity.grant", "b") {
		t.Fatal("scope bypass")
	}
}
