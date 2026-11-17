package api

import (
	"context"
	"fmt"
	"sort"
	"time"
	_ "time/tzdata"
)

type workingCalendar struct {
	location   *time.Location
	continuous bool
	days       [7]bool
	start, end time.Duration
	holidays   map[string]bool
}

func parseCalendar(in Calendar) (workingCalendar, error) {
	var cal workingCalendar
	if in.Zone != "Asia/Jakarta" || (in.Code != "CAL-1" && in.Code != "CAL-247") {
		return cal, fmt.Errorf("unsupported SLA calendar")
	}
	loc, err := time.LoadLocation(in.Zone)
	if err != nil {
		return cal, err
	}
	cal.location = loc
	cal.continuous = in.Code == "CAL-247"
	if cal.continuous {
		return cal, nil
	}
	for _, day := range in.WorkDays {
		if day < 0 || day > 6 {
			return cal, fmt.Errorf("invalid SLA work day")
		}
		cal.days[day] = true
	}
	if len(in.WorkDays) == 0 {
		return cal, fmt.Errorf("calendar has no working day")
	}
	start, err := time.Parse("15:04:05", in.WorkStart)
	if err != nil {
		return cal, err
	}
	end, err := time.Parse("15:04:05", in.WorkEnd)
	if err != nil {
		return cal, err
	}
	clock := func(t time.Time) time.Duration {
		return time.Duration(t.Hour())*time.Hour + time.Duration(t.Minute())*time.Minute + time.Duration(t.Second())*time.Second
	}
	cal.start, cal.end = clock(start), clock(end)
	if cal.end <= cal.start {
		return cal, fmt.Errorf("invalid SLA working interval")
	}
	cal.holidays = make(map[string]bool, len(in.Holidays))
	for _, day := range in.Holidays {
		if _, err := time.Parse("2006-01-02", day); err != nil {
			return cal, err
		}
		cal.holidays[day] = true
	}
	return cal, nil
}

func (c workingCalendar) window(t time.Time) (open, close, next time.Time, work bool) {
	t = t.In(c.location)
	day := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, c.location)
	return day.Add(c.start), day.Add(c.end), day.AddDate(0, 0, 1), c.days[day.Weekday()] && !c.holidays[day.Format("2006-01-02")]
}

func (c workingCalendar) advance(ctx context.Context, t time.Time, remaining time.Duration) (time.Time, error) {
	if err := ctx.Err(); err != nil {
		return time.Time{}, err
	}
	if c.continuous || remaining == 0 {
		return t.UTC().Add(remaining), nil
	}
	for days := 0; days < 3660; days++ {
		if err := ctx.Err(); err != nil {
			return time.Time{}, err
		}
		open, close, next, work := c.window(t)
		if work && t.Before(close) {
			if t.Before(open) {
				t = open
			}
			available := close.Sub(t)
			if available >= remaining {
				return t.Add(remaining).UTC(), nil
			}
			remaining -= available
		}
		t = next
	}
	return time.Time{}, fmt.Errorf("SLA calculation exceeds supported range")
}

func (c workingCalendar) work(ctx context.Context, start, end time.Time) (time.Duration, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if !end.After(start) {
		return 0, nil
	}
	if c.continuous {
		return end.Sub(start), nil
	}
	var total time.Duration
	for days := 0; start.Before(end); days++ {
		if days >= 3660 {
			return 0, fmt.Errorf("SLA calculation exceeds supported range")
		}
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		open, close, next, work := c.window(start)
		if work {
			a, b := open, close
			if start.After(a) {
				a = start
			}
			if end.Before(b) {
				b = end
			}
			if b.After(a) {
				total += b.Sub(a)
			}
		}
		start = next
	}
	return total, nil
}

func Evaluate(ctx context.Context, target Target, start, asOf time.Time, pauses []PauseInterval) (Calculation, int64, bool, error) {
	var result Calculation
	const limit = 366 * 24 * 60
	if start.IsZero() || target.ResponseMinutes < 1 || target.ResolutionMinutes < target.ResponseMinutes || target.ResolutionMinutes > limit {
		return result, 0, false, fmt.Errorf("invalid SLA target")
	}
	cal, err := parseCalendar(target.Calendar)
	if err != nil {
		return result, 0, false, err
	}
	response, err := cal.advance(ctx, start, time.Duration(target.ResponseMinutes)*time.Minute)
	if err != nil {
		return result, 0, false, err
	}
	due, err := cal.advance(ctx, start, time.Duration(target.ResolutionMinutes)*time.Minute)
	if err != nil {
		return result, 0, false, err
	}
	var pause time.Duration
	active := false
	for _, p := range MergePauses(pauses) {
		if !p.EndsAt.After(start) {
			continue
		}
		if !p.StartsAt.After(asOf) && p.EndsAt.After(asOf) {
			active = true
		}
		a, b := p.StartsAt, p.EndsAt
		if a.Before(start) {
			a = start
		}
		if b.After(asOf) {
			b = asOf
		}
		d, err := cal.work(ctx, a, b)
		if err != nil {
			return result, 0, false, err
		}
		pause += d
		if a.Before(due) && d > 0 {
			due, err = cal.advance(ctx, due, d)
			if err != nil {
				return result, 0, false, err
			}
		}
	}
	gross, err := cal.work(ctx, start, asOf)
	if err != nil {
		return result, 0, false, err
	}
	result = Calculation{Due: due, ResponseDue: response, Version: fmt.Sprintf("%s-v%d", target.Calendar.Code, target.Calendar.Version), CalendarVersion: target.Calendar.Version, WorkingMinutes: target.ResolutionMinutes}
	return result, int64(max(gross-pause, 0) / time.Second), active, nil
}

// MergePauses returns the union of valid half-open intervals.
func MergePauses(intervals []PauseInterval) []PauseInterval {
	valid := make([]PauseInterval, 0, len(intervals))
	for _, p := range intervals {
		if p.EndsAt.After(p.StartsAt) {
			valid = append(valid, p)
		}
	}
	sort.Slice(valid, func(i, j int) bool { return valid[i].StartsAt.Before(valid[j].StartsAt) })
	var merged []PauseInterval
	for _, p := range valid {
		if len(merged) == 0 || p.StartsAt.After(merged[len(merged)-1].EndsAt) {
			merged = append(merged, p)
		} else if p.EndsAt.After(merged[len(merged)-1].EndsAt) {
			merged[len(merged)-1].EndsAt = p.EndsAt
		}
	}
	return merged
}

// Elapsed returns wall-clock seconds within one episode, with approved pauses removed from net.
func Elapsed(start, end time.Time, pauses []PauseInterval) (gross, net int64) {
	if !end.After(start) {
		return 0, 0
	}
	elapsed := end.Sub(start)
	var paused time.Duration
	for _, p := range MergePauses(pauses) {
		a, b := p.StartsAt, p.EndsAt
		if a.Before(start) {
			a = start
		}
		if b.After(end) {
			b = end
		}
		if b.After(a) {
			paused += b.Sub(a)
		}
	}
	return int64(elapsed / time.Second), int64((elapsed - paused) / time.Second)
}
