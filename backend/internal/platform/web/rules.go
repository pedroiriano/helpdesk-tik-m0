package web

import "strings"

// RuleWrite mirrors OpenAPI RuleWrite for administrative rule updates.
type RuleWrite struct {
	ExpectedVersion int64  `json:"expected_version"`
	Code            string `json:"code"`
	RuleVersion     int64  `json:"rule_version"`
	Active          bool   `json:"active"`
	Reason          string `json:"reason"`
}

// RuleView represents a configurable M4/M5/M6/M7 rule row.
type RuleView struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Code        string `json:"code"`
	Version     int64  `json:"version"`
	RuleVersion int64  `json:"rule_version"`
	Active      bool   `json:"active"`
	Summary     string `json:"summary"`
}

// ValidateRuleWrite normalizes and validates administrative rule payloads.
func ValidateRuleWrite(in *RuleWrite) error {
	in.Code = strings.TrimSpace(in.Code)
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || in.RuleVersion < 1 || in.Code == "" || len(in.Code) > 200 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
		return Fail(422, "Versi, kode aturan, dan alasan perubahan minimal 5 karakter wajib diisi")
	}
	return nil
}
