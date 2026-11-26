package app

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/modules/m5/internal/store"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

const (
	available       = "AVAILABLE"
	unavailable     = "ABSENT"
	outsideSchedule = "OUTSIDE_SCHEDULE"
	inactive        = "INACTIVE"
	full            = "FULL"
	unconfigured    = "UNCONFIGURED"
	unknownLoad     = "UNKNOWN_LOAD"
)

func evaluateAvailability(at time.Time, roster api.ManagedRoster, eligible bool, load store.TechnicianLoad, current bool) api.Availability {
	result := api.Availability{AssessedAt: at}
	switch {
	case !eligible || !roster.Active:
		result.Status = inactive
	case load.Absent:
		result.Status = unavailable
	case at.Before(roster.AvailableFrom) || !at.Before(roster.AvailableUntil):
		result.Status = outsideSchedule
	case roster.Capacity == nil:
		result.Status = unconfigured
	case !current:
		result.Status = unknownLoad
	default:
		remaining := max(0, *roster.Capacity-load.Active)
		result.Remaining = &remaining
		result.Status = available
		if remaining == 0 {
			result.Status = full
		}
	}
	return result
}

func (s *Service) AbsentTechnicians(ctx context.Context, subjects []string) (map[string]bool, error) {
	return s.Store.AbsentTechnicians(ctx, subjects, time.Now().UTC())
}

func (s *Service) projectionCurrent(ctx context.Context) (bool, error) {
	if s.LoadSource == nil {
		return false, nil
	}
	state, err := s.LoadSource.Inspect(ctx)
	return err == nil && state.Pending == 0 && state.Dead == 0, err
}

func (s *Service) technicianEligible(ctx context.Context, subject, org, team string) (bool, error) {
	actor, err := s.Identity.Access(ctx, subject)
	var failure *web.Error
	if errors.As(err, &failure) && failure.Status == http.StatusNotFound {
		return false, nil
	}
	return err == nil && actor.Role == "TECHNICIAN" && actor.HasTeamMandate(org, team, "ticket.read", "ticket.resolve"), err
}

func (s *Service) assessRosters(ctx context.Context, items []api.ManagedRoster, org string, at time.Time) error {
	current, err := s.projectionCurrent(ctx)
	if err != nil {
		return err
	}
	subjects := make([]string, 0, len(items))
	for _, item := range items {
		subjects = append(subjects, item.SubjectID)
	}
	loads, err := s.Store.Loads(ctx, subjects, at)
	if err != nil {
		return err
	}
	for i := range items {
		item := &items[i]
		eligible, err := s.technicianEligible(ctx, item.SubjectID, org, item.TeamID)
		if err != nil {
			return err
		}
		assessment := evaluateAvailability(at, *item, eligible, loads[item.SubjectID], current)
		item.Availability = &assessment
	}
	return nil
}

func summarizeCapacity(items []api.ManagedRoster, at time.Time) api.CapacitySummary {
	bySubject := map[string]int{}
	for _, item := range items {
		if item.Availability.Status == inactive {
			continue
		}
		previous, seen := bySubject[item.SubjectID]
		if !seen {
			previous = -1
		}
		if item.Availability.Remaining != nil {
			previous = max(previous, *item.Availability.Remaining)
		} else if item.Availability.Status == unavailable {
			previous = max(previous, 0)
		}
		bySubject[item.SubjectID] = previous
	}
	result := api.CapacitySummary{Technicians: len(bySubject), AssessedAt: at}
	for _, slots := range bySubject {
		if slots >= 0 {
			result.Measured++
		}
		if slots > 0 {
			result.Available++
			result.Remaining += slots
		}
	}
	return result
}

func (s *Service) teamCapacity(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	actor, err := s.Identity.Authenticate(ctx, identity.Credentials{Token: web.Cookie(r, "helpdesk_session")})
	if err != nil {
		return err
	}
	org, teams := r.URL.Query().Get("organization_id"), r.URL.Query()["team_id"]
	skill := r.URL.Query().Get("skill")
	if !web.UUID(org) || len(teams) == 0 || len(teams) > 100 || (skill != "" && !skillCode.MatchString(skill)) {
		return web.Fail(422, "Gunakan organisasi dan 1–100 tim serta kode keahlian yang valid")
	}
	slices.Sort(teams)
	teams = slices.Compact(teams)
	for _, team := range teams {
		if !web.UUID(team) {
			return web.Fail(422, "Tim tidak valid")
		}
		if !actor.CanManageRoster(org, team) {
			return web.Fail(403, "Izin pengelolaan jadwal tim diperlukan")
		}
		active, err := s.Identity.ActiveTeamInOrg(ctx, team, org)
		if err != nil {
			return err
		}
		if !active {
			return web.Fail(404, "Tim aktif tidak ditemukan")
		}
	}
	at := time.Now().UTC()
	items, err := s.Store.AvailabilityRosters(ctx, teams, at, skill)
	if err != nil {
		return err
	}
	if err = s.assessRosters(ctx, items, org, at); err != nil {
		return err
	}
	w.Header().Set("Cache-Control", "no-store")
	web.JSON(w, 200, summarizeCapacity(items, at))
	return nil
}

func personalOrgs(actor identity.Actor) []string {
	orgs := []string{}
	if actor.Kind != "STAFF" || actor.Role != "TECHNICIAN" {
		return orgs
	}
	for _, mandate := range actor.Memberships {
		if mandate.OrganizationActive && slices.Contains(mandate.Permissions, "ticket.read") &&
			slices.Contains(mandate.Permissions, "ticket.resolve") && !slices.Contains(orgs, mandate.OrganizationID) {
			orgs = append(orgs, mandate.OrganizationID)
		}
	}
	return orgs
}

func (s *Service) personalAvailability(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	write := r.Method != http.MethodGet
	actor, err := s.Identity.Authenticate(ctx, identity.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: write})
	if err != nil {
		return err
	}
	orgs := personalOrgs(actor)
	if len(orgs) == 0 {
		return web.Fail(403, "Mandat teknisi aktif diperlukan")
	}
	w.Header().Set("Cache-Control", "no-store")
	if !write {
		page, err := web.Pagination(r)
		if err != nil {
			return err
		}
		if r.URL.Path == "/api/v1/technicians/me/rosters" {
			org := r.URL.Query().Get("organization_id")
			if !slices.Contains(orgs, org) {
				return web.Fail(403, "Jadwal tersedia untuk organisasi dalam mandat Anda")
			}
			names, err := s.personalTeams(ctx, actor, org)
			if err != nil {
				return err
			}
			teams := make([]string, 0, len(names))
			for id := range names {
				teams = append(teams, id)
			}
			items, err := s.Store.PersonalRosters(ctx, actor.ID, teams, page)
			if err != nil {
				return err
			}
			for i := range items {
				items[i].TeamName = names[items[i].TeamID]
			}
			if err = s.assessRosters(ctx, items, org, time.Now().UTC()); err != nil {
				return err
			}
			web.JSON(w, 200, web.List(items, page.Limit, func(item api.ManagedRoster) string { return item.ID }))
			return nil
		}
		items, err := s.Store.Absences(ctx, actor.ID, page)
		if err != nil {
			return err
		}
		web.JSON(w, 200, web.List(items, page.Limit, func(item api.Absence) string { return item.ID }))
		return nil
	}
	for _, org := range orgs {
		if err = identity.CheckMaintenance(ctx, s.Identity, false, org); err != nil {
			return err
		}
	}
	return s.mutateAbsence(w, r, actor.ID)
}

func (s *Service) personalTeams(ctx context.Context, actor identity.Actor, org string) (map[string]string, error) {
	names := map[string]string{}
	page := web.Page{Limit: 100}
	for {
		teams, err := s.Identity.DispatchTeams(ctx, org, page)
		if err != nil {
			return nil, err
		}
		for _, team := range teams {
			if actor.HasTeamMandate(org, team.ID, "ticket.read", "ticket.resolve") {
				names[team.ID] = team.Name
			}
		}
		if len(teams) <= page.Limit {
			return names, nil
		}
		page.Cursor = teams[len(teams)-1].ID
	}
}

func (s *Service) mutateAbsence(w http.ResponseWriter, r *http.Request, subject string) error {
	ctx := r.Context()
	key := r.Header.Get("Idempotency-Key")
	if len(key) < 16 || len(key) > 128 {
		return web.Fail(422, "Idempotency-Key wajib 16–128 karakter")
	}
	mutation := database.Mutation{Owner: "M5", Actor: subject, Command: "RecordTechnicianAbsence", Target: subject, Scope: subject, Key: key}
	var apply func(pgx.Tx) (database.Result, error)
	if r.Method == http.MethodPost && r.PathValue("absence_id") == "" {
		var in api.AbsenceInput
		if err := web.Decode(w, r, &in); err != nil {
			return err
		}
		in.Reason = strings.TrimSpace(in.Reason)
		if in.StartsAt.IsZero() || !in.EndsAt.After(in.StartsAt) || len(in.Reason) < 5 || len(in.Reason) > 2000 {
			return web.Fail(422, "Periode dan alasan ketidakhadiran wajib valid")
		}
		mutation.Reason, mutation.Payload = in.Reason, in
		apply = func(tx pgx.Tx) (database.Result, error) {
			item, err := store.WriteAbsence(ctx, tx, subject, web.ID(), in)
			if err != nil {
				return database.Result{}, err
			}
			return database.Response(201, item)
		}
	} else {
		var in struct {
			ExpectedVersion int64  `json:"expected_version"`
			Reason          string `json:"reason"`
		}
		if err := web.Decode(w, r, &in); err != nil {
			return err
		}
		in.Reason = strings.TrimSpace(in.Reason)
		id := r.PathValue("absence_id")
		if !web.UUID(id) || in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
			return web.Fail(422, "Versi dan alasan pembatalan wajib valid")
		}
		mutation.Command, mutation.Target, mutation.Reason, mutation.Payload = "CancelTechnicianAbsence", id, in.Reason, in
		apply = func(tx pgx.Tx) (database.Result, error) {
			item, err := store.CancelAbsence(ctx, tx, subject, id, in.ExpectedVersion)
			if err != nil {
				return database.Result{}, err
			}
			return database.Response(200, item)
		}
	}
	result, err := database.Mutate(ctx, s.Store.Pool, mutation, apply)
	if err != nil {
		return err
	}
	web.JSON(w, result.Status, result.Body)
	return nil
}
