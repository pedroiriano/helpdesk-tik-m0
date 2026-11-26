package app

import (
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/modules/m5/internal/store"
)

func TestAvailabilityUsesHalfOpenWindowAndPrecedence(t *testing.T) {
	start := time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	capacity := 2
	shift := api.ManagedRoster{Active: true, AvailableFrom: start, AvailableUntil: end, Capacity: &capacity}
	for _, test := range []struct {
		name                      string
		at                        time.Time
		eligible, absent, current bool
		active                    int
		want                      string
	}{
		{"before", start.Add(-time.Nanosecond), true, false, true, 0, outsideSchedule},
		{"start inclusive", start, true, false, true, 0, available},
		{"end exclusive", end, true, false, true, 0, outsideSchedule},
		{"absence precedence", start, true, true, true, 2, unavailable},
		{"absence outside shift", end, true, true, true, 0, unavailable},
		{"account inactive", start, false, true, true, 0, inactive},
		{"zero with pending events", start, true, false, false, 0, unknownLoad},
		{"at capacity", start, true, false, true, 2, full},
	} {
		t.Run(test.name, func(t *testing.T) {
			value := evaluateAvailability(test.at, shift, test.eligible, store.TechnicianLoad{Absent: test.absent, Active: test.active}, test.current)
			if value.Status != test.want {
				t.Fatalf("status %s, want %s", value.Status, test.want)
			}
		})
	}
}
