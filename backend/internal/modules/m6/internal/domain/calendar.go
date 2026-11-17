package domain

import (
	"context"
	"fmt"
	"helpdesk.local/m0/internal/modules/m6/api"
	"time"
)

type Baseline struct{}

// CAL-1: 8 working hours Mon-Fri 08:00-16:00 WIB; skip weekends & holidays.
func CalculateCAL1(ctx context.Context, start time.Time, minutes int, holidays []string) (time.Time, error) {
	loc := time.FixedZone("WIB", 7*3600)
	t := start.In(loc)
	remaining := time.Duration(minutes) * time.Minute

	holidayMap := make(map[string]bool, len(holidays))
	for _, h := range holidays {
		holidayMap[h] = true
	}

	for remaining > 0 {
		if err := ctx.Err(); err != nil {
			return time.Time{}, err
		}
		y, m, d := t.Date()
		dateStr := fmt.Sprintf("%04d-%02d-%02d", y, m, d)
		open := time.Date(y, m, d, 8, 0, 0, 0, loc)
		close := open.Add(8 * time.Hour)

		if t.Weekday() == time.Saturday || t.Weekday() == time.Sunday || holidayMap[dateStr] || !t.Before(close) {
			t = open.AddDate(0, 0, 1)
			continue
		}
		if t.Before(open) {
			t = open
		}
		available := close.Sub(t)
		if available >= remaining {
			t = t.Add(remaining)
			remaining = 0
		} else {
			remaining -= available
			t = close
		}
	}
	return t.UTC(), nil
}

// Calculate247: continuous 24/7 calendar for emergency/critical services.
func Calculate247(ctx context.Context, start time.Time, minutes int) (time.Time, error) {
	if err := ctx.Err(); err != nil {
		return time.Time{}, err
	}
	return start.UTC().Add(time.Duration(minutes) * time.Minute), nil
}

func (Baseline) Calculate(ctx context.Context, start time.Time) (api.Calculation, error) {
	due, err := CalculateCAL1(ctx, start, 480, nil)
	if err != nil {
		return api.Calculation{}, err
	}
	return api.Calculation{Due: due, Version: "CAL-1-LAB-v1", WorkingMinutes: 480}, nil
}

func (Baseline) CalculateTarget(ctx context.Context, start time.Time, minutes int, holidays []string) (time.Time, error) {
	return CalculateCAL1(ctx, start, minutes, holidays)
}

func (b Baseline) CalculateDue(ctx context.Context, serviceID string, priority string, acceptedAt time.Time) (time.Time, string, error) {
	// Standard CAL-1 target based on priority
	minutes := 480 // default 8 hours
	switch priority {
	case "CRITICAL":
		minutes = 120 // 2 hours
	case "HIGH":
		minutes = 240 // 4 hours
	case "NORMAL":
		minutes = 480 // 8 hours
	case "LOW":
		minutes = 1440 // 24 working hours (3 working days)
	}
	due, err := CalculateCAL1(ctx, acceptedAt, minutes, nil)
	if err != nil {
		return time.Time{}, "", err
	}
	return due, "CAL-1-LAB-v1", nil
}

func (Baseline) GetClock(ctx context.Context, ticketID string, now time.Time) (api.ClockProjection, error) {
	return api.ClockProjection{
		TicketID:      ticketID,
		AcceptedAt:    now,
		DueAt:         now.Add(8 * time.Hour),
		GrossSeconds:  0,
		NetSeconds:    0,
		PolicyVersion: 1,
		Status:        "ON_TRACK",
		AsOf:          now,
	}, nil
}

func (Baseline) RecordClock(ctx context.Context, ticketID string, sourceVersion int64, acceptedAt, dueAt time.Time, grossSeconds, netSeconds int64, policyVersion int64) error {
	return nil
}

// CoalescePauseIntervals merges overlapping or contiguous intervals into non-overlapping ones.
func CoalescePauseIntervals(intervals []api.PauseInterval) []api.PauseInterval {
	return api.MergePauses(intervals)
}

func CalculateDeduplicatedPauseDuration(intervals []api.PauseInterval, boundStart, boundEnd time.Time) time.Duration {
	if len(intervals) == 0 || !boundEnd.After(boundStart) {
		return 0
	}
	coalesced := CoalescePauseIntervals(intervals)
	var total time.Duration
	for _, inv := range coalesced {
		s := inv.StartsAt
		e := inv.EndsAt
		if s.Before(boundStart) {
			s = boundStart
		}
		if e.After(boundEnd) {
			e = boundEnd
		}
		if e.After(s) {
			total += e.Sub(s)
		}
	}
	return total
}

func (Baseline) CalculateGrossAndNet(ctx context.Context, acceptedAt, now time.Time, pauses []api.PauseInterval) (grossSeconds, netSeconds int64, isPaused bool) {
	if !now.After(acceptedAt) {
		return 0, 0, false
	}
	gross := int64(now.Sub(acceptedAt).Seconds())
	pauseDur := CalculateDeduplicatedPauseDuration(pauses, acceptedAt, now)
	pauseSec := int64(pauseDur.Seconds())
	net := gross - pauseSec
	if net < 0 {
		net = 0
	}
	for _, p := range pauses {
		if (p.StartsAt.Before(now) || p.StartsAt.Equal(now)) && p.EndsAt.After(now) {
			isPaused = true
			break
		}
	}
	return gross, net, isPaused
}
