package domain

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"
)

func TestPasswordVerifier(t *testing.T) {
	password := "synthetic-password-only"
	a, err := HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	b, err := HashPassword(password)
	if err != nil || a == b {
		t.Fatal("independent salts required")
	}
	if ok, upgrade := VerifyPassword(a, password); !ok || upgrade {
		t.Fatal("adaptive verifier rejected proof")
	}
	for _, bad := range []string{"", "wrong", strings.Repeat("x", 1025)} {
		if ok, _ := VerifyPassword(a, bad); ok {
			t.Fatal("invalid proof accepted")
		}
	}
	legacy := fmt.Sprintf("legacy-sha256$%x", sha256.Sum256([]byte(password)))
	if ok, upgrade := VerifyPassword(legacy, password); !ok || !upgrade {
		t.Fatal("legacy proof must request upgrade")
	}
	for _, bad := range []string{"broken", "pbkdf2-sha256$v1$999999999$00$00", "pbkdf2-sha256$v1$1$00$00"} {
		if ok, _ := VerifyPassword(bad, password); ok {
			t.Fatal("malformed verifier accepted")
		}
	}
}
