package domain

import (
	"testing"
)

func TestValidateTelegramBinding(t *testing.T) {
	// Kasus 1: Public mengikat ke org -> harus ditolak
	err := ValidateTelegramBinding("10000000-0000-4000-8000-000000000001", "PUBLIC", []string{"10000000-0000-4000-8000-000000000001"}, "SINK", "CODE-123")
	if err == nil {
		t.Fatal("Expected error for public binding to org")
	}

	// Kasus 2: Channel bukan SINK -> harus ditolak
	err = ValidateTelegramBinding("10000000-0000-4000-8000-000000000001", "STAFF", []string{"10000000-0000-4000-8000-000000000001"}, "TELEGRAM_BOT", "CODE-123")
	if err == nil {
		t.Fatal("Expected error for non-SINK channel")
	}

	// Kasus 3: Staf mengikat ke org di luar wewenangnya -> harus ditolak (403)
	err = ValidateTelegramBinding("10000000-0000-4000-8000-000000000002", "STAFF", []string{"10000000-0000-4000-8000-000000000001"}, "SINK", "CODE-123")
	if err == nil {
		t.Fatal("Expected error for staff binding to unauthorized org")
	}

	// Kasus 4: Staf mengikat ke org dalam wewenangnya -> sah
	err = ValidateTelegramBinding("10000000-0000-4000-8000-000000000001", "STAFF", []string{"10000000-0000-4000-8000-000000000001"}, "SINK", "CODE-123")
	if err != nil {
		t.Fatalf("Expected nil error for authorized staff binding, got %v", err)
	}
}

func TestMaskSecret(t *testing.T) {
	// Secret pendek
	if m := MaskSecret("123"); m != "TG-***" {
		t.Fatalf("Expected TG-***, got %s", m)
	}

	// Secret panjang (contoh Telegram token)
	token := "123456789"
	masked := MaskSecret(token)
	if masked != "123****89" {
		t.Fatalf("Expected 123****89, got %s", masked)
	}
}

func TestSanitizeCSV(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"},
		{"+12345", "'+12345"},
		{"-formula", "'-formula"},
		{"@SUM(A1:A10)", "'@SUM(A1:A10)"},
		{"Normal Text", "Normal Text"},
		{"", ""},
	}

	for _, tc := range cases {
		got := SanitizeCSV(tc.in)
		if got != tc.want {
			t.Errorf("SanitizeCSV(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
