package store

import (
	"context"
	"errors"
	"fmt"

	"helpdesk.local/m0/internal/modules/m6/api"
)

const calendarFields = `c.id::text,c.code,c.calendar_version,c.timezone,c.work_days,c.work_start::text,c.work_end::text,
    ARRAY(SELECT to_char(h.holiday,'YYYY-MM-DD') FROM sla.holidays h WHERE h.calendar_id=c.id ORDER BY h.holiday)`

func (s Store) Policy(ctx context.Context, service string, version int64, lab bool) (api.PolicySnapshot, error) {
	snapshot := api.PolicySnapshot{ServiceID: service, Version: version, Targets: make(map[string]api.Target)}
	rows, err := s.Pool.Query(ctx, `SELECT t.priority,t.stage,t.target_minutes,`+calendarFields+
		` FROM sla.targets t JOIN sla.calendars c ON c.id=t.calendar_id WHERE t.service_id=$1 AND t.policy_version=$2 ORDER BY t.priority,t.stage`, service, version)
	if err != nil {
		return snapshot, err
	}
	defer rows.Close()
	for rows.Next() {
		var priority, stage string
		var minutes int
		var c api.Calendar
		if err = rows.Scan(&priority, &stage, &minutes, &c.ID, &c.Code, &c.Version, &c.Zone, &c.WorkDays, &c.WorkStart, &c.WorkEnd, &c.Holidays); err != nil {
			return snapshot, err
		}
		target := snapshot.Targets[priority]
		if target.Calendar.ID != "" && target.Calendar.ID != c.ID {
			return snapshot, fmt.Errorf("inconsistent stage calendars")
		}
		target.Calendar = c
		switch stage {
		case "RESPONSE":
			if target.ResponseMinutes != 0 {
				return snapshot, fmt.Errorf("duplicate response SLA target")
			}
			target.ResponseMinutes = minutes
		case "RESOLUTION":
			if target.ResolutionMinutes != 0 {
				return snapshot, fmt.Errorf("duplicate resolution SLA target")
			}
			target.ResolutionMinutes = minutes
		default:
			return snapshot, fmt.Errorf("unknown SLA target stage")
		}
		snapshot.Targets[priority] = target
	}
	if err = rows.Err(); err != nil {
		return snapshot, err
	}
	rows.Close()
	if len(snapshot.Targets) == 0 && lab {
		var c api.Calendar
		err = s.Pool.QueryRow(ctx, `SELECT `+calendarFields+` FROM sla.calendars c WHERE c.code='CAL-1' AND c.calendar_version=1`).
			Scan(&c.ID, &c.Code, &c.Version, &c.Zone, &c.WorkDays, &c.WorkStart, &c.WorkEnd, &c.Holidays)
		if err != nil {
			return snapshot, err
		}
		snapshot.SyntheticDefault = true
		for priority, minutes := range map[string][2]int{"LOW": {120, 1440}, "NORMAL": {60, 480}, "HIGH": {30, 240}, "CRITICAL": {15, 120}} {
			snapshot.Targets[priority] = api.Target{Calendar: c, ResponseMinutes: minutes[0], ResolutionMinutes: minutes[1]}
		}
	}
	if len(snapshot.Targets) == 0 {
		return snapshot, errors.New("SLA policy unavailable")
	}
	for _, priority := range []string{"LOW", "NORMAL", "HIGH", "CRITICAL"} {
		target := snapshot.Targets[priority]
		if target.ResponseMinutes < 1 || target.ResolutionMinutes < target.ResponseMinutes {
			return snapshot, errors.New("incomplete SLA policy")
		}
	}
	return snapshot, nil
}
