package api

import "time"

type TechnicalPerformance struct {
	From               time.Time  `json:"from"`
	To                 time.Time  `json:"to"`
	AsOf               time.Time  `json:"as_of"`
	Watermark          *time.Time `json:"watermark"`
	Timezone           string     `json:"timezone"`
	Cohort             string     `json:"cohort"`
	ResolvedTickets    int        `json:"resolved_tickets"`
	ResolutionAttempts int        `json:"resolution_attempts"`
	Confirmed          int        `json:"confirmed"`
	AutoClosed         int        `json:"auto_closed"`
	Reopened           int        `json:"reopened"`
	WorkLogs           int        `json:"work_logs"`
	WorkSeconds        int64      `json:"work_seconds"`
	SLAMet             int        `json:"sla_met"`
	SLAMeasured        int        `json:"sla_measured"`
	SLAUnmeasured      int        `json:"sla_unmeasured"`
	SLAPercent         *float64   `json:"sla_percent"`
	GrossSeconds       int64      `json:"gross_seconds"`
	NetSeconds         int64      `json:"net_seconds"`
}
