package store

import (
	"context"
	"slices"
	"time"

	"helpdesk.local/m0/internal/modules/m9/api"
)

var wib = time.FixedZone("WIB", 7*60*60)
var ageKeys = []string{"age_lt24", "age_24_72", "age_gte72"}
var deadlineKeys = []string{"overdue", "due_soon", "on_track", "paused", "unmeasured"}

type DashboardPauseReader func(context.Context, string, []string, time.Time) (map[string]bool, error)

func DashboardSegmentValid(key string) bool {
	return key == "" || key == "active" || key == "completed" ||
		slices.Contains(ageKeys, key) || slices.Contains(deadlineKeys, key)
}

func reportState(state string) string {
	switch state {
	case "RESOLVED", "CLOSED":
		return "completed"
	case "CANCELLED":
		return "cancelled"
	default:
		return "active"
	}
}

func deadlineBucket(f reportFact, at time.Time, paused bool) string {
	switch {
	case f.Due == nil || f.Due.IsZero():
		return "unmeasured"
	case f.Due.Before(at):
		return "overdue"
	case paused:
		return "paused"
	case !f.Due.After(at.Add(24 * time.Hour)):
		return "due_soon"
	default:
		return "on_track"
	}
}

func ageBucket(elapsed time.Duration) string {
	switch {
	case elapsed < 24*time.Hour:
		return "age_lt24"
	case elapsed < 72*time.Hour:
		return "age_24_72"
	default:
		return "age_gte72"
	}
}

func (s Store) dashboardFacts(ctx context.Context, q api.ReportQuery, pauses DashboardPauseReader) ([]reportFact, *time.Time, map[string]bool, error) {
	q.Cohort = "ACCEPTED"
	facts, _, watermark, err := s.loadReport(ctx, q)
	if err != nil {
		return nil, nil, nil, err
	}
	active := make([]string, 0)
	for _, f := range facts {
		if reportState(f.State) == "active" && f.Due != nil {
			active = append(active, f.Ticket)
		}
	}
	var paused map[string]bool
	if len(active) > 0 {
		paused, err = pauses(ctx, q.OrganizationID, active, q.To)
	}
	return facts, watermark, paused, err
}

func dashboardAnalytics(facts []reportFact, from, to time.Time, paused map[string]bool) *api.DashboardAnalytics {
	data := &api.DashboardAnalytics{EvaluatedAt: to}
	daily := make(map[string]int)
	local := from.In(wib)
	for d := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, wib); d.Before(to); d = d.AddDate(0, 0, 1) {
		day := d.Format(time.DateOnly)
		daily[day] = len(data.Daily)
		data.Daily = append(data.Daily, api.DashboardDay{Day: day})
	}
	counts := make(map[string]int64)
	for _, f := range facts {
		day := &data.Daily[daily[f.Accepted.In(wib).Format(time.DateOnly)]]
		day.Accepted++
		switch reportState(f.State) {
		case "active":
			day.Active++
			counts[ageBucket(to.Sub(f.Accepted))]++
			counts[deadlineBucket(f, to, paused[f.Ticket])]++
		case "completed":
			day.Completed++
		}
	}
	for _, key := range ageKeys {
		data.Age = append(data.Age, api.DashboardBucket{Key: key, Count: counts[key]})
	}
	for _, key := range deadlineKeys {
		data.Deadline = append(data.Deadline, api.DashboardBucket{Key: key, Count: counts[key]})
	}
	return data
}

func (s Store) DashboardReport(ctx context.Context, q api.ReportQuery, pauses DashboardPauseReader) (*api.Report, error) {
	facts, watermark, paused, err := s.dashboardFacts(ctx, q, pauses)
	if err != nil {
		return nil, err
	}
	report := summarizeReport(facts, watermark)
	report.Analytics = dashboardAnalytics(facts, q.From, q.To, paused)
	return report, nil
}

func (s Store) DashboardSelection(ctx context.Context, q api.ReportQuery, day, segment string, pauses DashboardPauseReader) (map[string]api.DashboardRow, []string, error) {
	facts, _, paused, err := s.dashboardFacts(ctx, q, pauses)
	if err != nil {
		return nil, nil, err
	}
	rows := make(map[string]api.DashboardRow)
	ids := make([]string, 0)
	for _, f := range facts {
		if day != "" && f.Accepted.In(wib).Format(time.DateOnly) != day {
			continue
		}
		row := api.DashboardRow{ID: f.Ticket, State: f.State, AcceptedAt: f.Accepted, DueAt: f.Due, Deadline: "none"}
		state := reportState(f.State)
		age := ""
		if state == "active" {
			elapsed := q.To.Sub(f.Accepted)
			age = ageBucket(elapsed)
			seconds := int64(elapsed / time.Second)
			row.AgeSeconds = &seconds
			row.Deadline = deadlineBucket(f, q.To, paused[f.Ticket])
		}
		if segment != "" && segment != state && segment != age && segment != row.Deadline {
			continue
		}
		rows[f.Ticket] = row
		ids = append(ids, f.Ticket)
	}
	return rows, ids, nil
}
