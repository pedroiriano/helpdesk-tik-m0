package domain

import "testing"

func TestCredentialSeparationAndCeiling(t *testing.T) {
	key := []byte("synthetic-unit-key-32bytes-minimum-only")
	a := Derive(key, "session", "fixture")
	csrf := Derive(key, "csrf", a)
	if len(a) != 64 || a == csrf || a == Derive(key, "session", "other") || !EqualHash(a, Digest(a)) || EqualHash(csrf, Digest(a)) {
		t.Fatal("credential separation failed")
	}
	if !Subset([]string{"catalog.write"}, []string{"catalog.write"}) || Subset([]string{"identity.grant"}, []string{"catalog.write"}) {
		t.Fatal("ceiling failed")
	}
	if Text("", 200) || Text("   ", 200) {
		t.Fatal("empty master accepted")
	}
}
