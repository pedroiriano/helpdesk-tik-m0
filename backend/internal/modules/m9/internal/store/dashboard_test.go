package store

import (
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m9/api"
)

func TestDashboardBucketsMatchCards(t *testing.T) {
	from := time.Date(2026, 11, 20, 16, 0, 0, 0, time.UTC)
	to := from.Add(4 * 24 * time.Hour)
	soon, future, expired := to.Add(24*time.Hour), to.Add(24*time.Hour+time.Second), to.Add(-time.Second)
	facts := []reportFact{
		{Ticket: "A", Accepted: from, State: "OPEN", Due: &expired},
		{Ticket: "B", Accepted: to.Add(-72 * time.Hour), State: "ASSIGNED", Due: &future},
		{Ticket: "C", Accepted: to.Add(-24 * time.Hour), State: "IN_PROGRESS", Due: &soon},
		{Ticket: "D", Accepted: to.Add(-time.Hour), State: "IN_PROGRESS", Due: &soon},
		{Ticket: "E", Accepted: from.Add(time.Hour), State: "RESOLVED"},
		{Ticket: "F", Accepted: from, State: "CANCELLED"},
		{Ticket: "G", Accepted: to.Add(-2 * time.Hour), State: "OPEN"},
	}
	report := summarizeReport(facts, nil)
	dashboard := dashboardAnalytics(facts, from, to, map[string]bool{"D": true})
	var trend api.DashboardDay
	for _, day := range dashboard.Daily {
		trend.Accepted += day.Accepted
		trend.Active += day.Active
		trend.Completed += day.Completed
	}
	if trend.Accepted != report.Accepted || trend.Active != report.Backlog || trend.Completed != report.Completed {
		t.Fatalf("trend %+v does not match summary %+v", trend, report)
	}
	if dashboard.Daily[0].Day != "2026-11-20" || dashboard.Daily[0].Accepted != 2 || dashboard.Daily[1].Completed != 1 {
		t.Fatalf("WIB date boundary misclassified: %+v", dashboard.Daily)
	}
	for i, want := range []int64{2, 1, 2} {
		if dashboard.Age[i].Count != want {
			t.Fatalf("age %s = %d, want %d", dashboard.Age[i].Key, dashboard.Age[i].Count, want)
		}
	}
	for _, bucket := range dashboard.Deadline {
		if bucket.Count != 1 {
			t.Fatalf("deadline bucket %s = %d, want 1", bucket.Key, bucket.Count)
		}
	}
}
