package domain

import (
	"context"
	"testing"
	"time"
)

func TestCAL1(t *testing.T) {
	for _, tc := range []struct {
		start    string
		minutes  int
		holidays []string
		want     string
	}{
		{"2026-11-06T08:30:00Z", 480, nil, "2026-11-09T08:30:00Z"},
		{"2026-11-07T01:00:00Z", 480, nil, "2026-11-09T09:00:00Z"},
		{"2026-11-09T00:00:00Z", 480, nil, "2026-11-09T09:00:00Z"},
		// AC08 fixture verification
		{"2026-11-06T08:30:00Z", 120, nil, "2026-11-09T02:30:00Z"},
		{"2026-11-06T08:30:00Z", 120, []string{"2026-11-09"}, "2026-11-10T02:30:00Z"},
		{"2026-11-09T01:00:00Z", 60, nil, "2026-11-09T02:00:00Z"},
		{"2026-11-06T09:00:00Z", 60, nil, "2026-11-09T02:00:00Z"},
		{"2026-11-07T01:00:00Z", 60, nil, "2026-11-09T02:00:00Z"},
	} {
		start, _ := time.Parse(time.RFC3339, tc.start)
		due, err := CalculateCAL1(context.Background(), start, tc.minutes, tc.holidays)
		if err != nil {
			t.Fatalf("unexpected error for %s: %v", tc.start, err)
		}
		if got := due.Format(time.RFC3339); got != tc.want {
			t.Fatalf("start=%s, min=%d: got %s, want %s", tc.start, tc.minutes, got, tc.want)
		}
	}
}

func TestCAL247(t *testing.T) {
	start, _ := time.Parse(time.RFC3339, "2026-11-06T08:30:00Z")
	due, err := Calculate247(context.Background(), start, 120)
	if err != nil {
		t.Fatal(err)
	}
	if got := due.Format(time.RFC3339); got != "2026-11-06T10:30:00Z" {
		t.Fatalf("24/7 calc mismatch: got %s, want 2026-11-06T10:30:00Z", got)
	}
}
