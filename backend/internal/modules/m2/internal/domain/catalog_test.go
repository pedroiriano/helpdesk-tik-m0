package domain

import (
	"helpdesk.local/m0/internal/modules/m2/api"
	"testing"
)

func TestFormAndPolicyValidation(t *testing.T) {
	valid := []api.Field{{Key: "masalah", Label: "Masalah", Kind: "choice", Options: []string{"Jaringan", "Aplikasi"}, Required: true}}
	if !ValidFields(valid) {
		t.Fatal("valid form rejected")
	}
	if ValidFields(append(valid, valid[0])) || ValidFields([]api.Field{{Key: "bad key", Label: "Bad", Kind: "html"}}) {
		t.Fatal("unsafe form accepted")
	}
	if ValidPolicy(api.PolicyInput{UploadMax: 10485761, AllowedMIME: []string{"text/html"}}) || ValidMode("SUPER_ADMIN") || ValidMaster("bad code", "name") {
		t.Fatal("invalid policy accepted")
	}
}
