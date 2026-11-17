package domain

import (
	"context"
	"testing"
)

func TestProposal(t *testing.T) {
	for _, tc := range []struct {
		text, category string
		confidence     float64
	}{{" WIFI   tidak terhubung ", "NETWORK", .7}, {"Internet dan aplikasi gagal", "MANUAL", .3},
		{"Permintaan umum", "MANUAL", 0}, {"Aplikasi SIPD-Penganggaran gagal", "CAT-SIPD-BUDGET", .7},
		{"WiFi publik tidak terhubung", "CAT-PUBLIC-WIFI", .7}, {"Email dan CCTV gagal", "MANUAL", .3}} {
		v, e := (Baseline{}).Propose(context.Background(), tc.text)
		if e != nil || v.Category != tc.category || v.Confidence != tc.confidence || v.Explanation == "" {
			t.Fatal("proposal mismatch", v, e)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := (Baseline{}).Propose(ctx, "wifi"); e == nil {
		t.Fatal("cancellation ignored")
	}
}
