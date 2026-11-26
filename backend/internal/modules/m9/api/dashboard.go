package api

import "time"

type DashboardDay struct {
	Day       string `json:"day"`
	Accepted  int64  `json:"accepted"`
	Active    int64  `json:"active"`
	Completed int64  `json:"completed"`
}

type DashboardBucket struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

type DashboardAnalytics struct {
	EvaluatedAt time.Time         `json:"evaluated_at"`
	Daily       []DashboardDay    `json:"daily"`
	Age         []DashboardBucket `json:"age"`
	Deadline    []DashboardBucket `json:"deadline"`
}

type DashboardRow struct {
	ID         string     `json:"id"`
	Number     string     `json:"number"`
	Title      string     `json:"title"`
	State      string     `json:"state"`
	AcceptedAt time.Time  `json:"accepted_at"`
	DueAt      *time.Time `json:"due_at"`
	AgeSeconds *int64     `json:"age_seconds"`
	Deadline   string     `json:"deadline"`
}
