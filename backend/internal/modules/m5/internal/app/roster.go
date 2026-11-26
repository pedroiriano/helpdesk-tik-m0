package app

import (
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

func (s *Service) RegisterRoster(mux *http.ServeMux) {
	for pattern, handler := range map[string]func(http.ResponseWriter, *http.Request) error{
		"GET /api/v1/admin/technical-capacity":                     s.teamCapacity,
		"GET /api/v1/technicians/me/rosters":                       s.personalAvailability,
		"GET /api/v1/technicians/me/absences":                      s.personalAvailability,
		"POST /api/v1/technicians/me/absences":                     s.personalAvailability,
		"POST /api/v1/technicians/me/absences/{absence_id}/cancel": s.personalAvailability,
	} {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if err := handler(w, r); err != nil {
				web.WriteError(w, err)
			}
		})
	}
	const route = "/api/v1/admin/teams/{id}/rosters"
	for _, method := range []string{"GET", "POST", "PUT"} {
		path := route
		if method == "PUT" {
			path += "/{roster_id}"
		}
		mux.HandleFunc(method+" "+path, func(w http.ResponseWriter, r *http.Request) {
			if err := s.roster(w, r); err != nil {
				web.WriteError(w, err)
			}
		})
	}
}

func (s *Service) roster(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	write := r.Method != "GET"
	actor, err := s.Identity.Authenticate(ctx, identity.Credentials{
		Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: write,
	})
	if err != nil {
		return err
	}
	org, team := r.URL.Query().Get("organization_id"), r.PathValue("id")
	if !web.UUID(org) || !web.UUID(team) {
		return web.Fail(422, "Perangkat daerah dan tim wajib valid")
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
	if !write {
		page, err := web.Pagination(r)
		if err != nil {
			return err
		}
		items, err := s.Store.ManagedRosters(ctx, team, page)
		if err != nil {
			return err
		}
		if err := s.assessRosters(ctx, items, org, time.Now().UTC()); err != nil {
			return err
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, web.List(items, page.Limit, func(v api.ManagedRoster) string { return v.ID }))
		return nil
	}
	if err := identity.CheckMaintenance(ctx, s.Identity, false, org); err != nil {
		return err
	}
	var in api.RosterInput
	if err := web.Decode(w, r, &in); err != nil {
		return err
	}
	id := r.PathValue("roster_id")
	in.Reason = strings.TrimSpace(in.Reason)
	if (r.Method == "PUT" && (!web.UUID(id) || in.ExpectedVersion < 1)) ||
		(r.Method == "POST" && in.ExpectedVersion != 0) || !web.UUID(in.SubjectID) ||
		(in.Capacity != nil && (*in.Capacity < 1 || *in.Capacity > 100)) || in.AvailableFrom.IsZero() || !in.AvailableUntil.After(in.AvailableFrom) ||
		len(in.Reason) < 5 || len(in.Reason) > 2000 || len(in.Skills) == 0 || len(in.Skills) > 20 {
		return web.Fail(422, "Teknisi, periode, keahlian, versi dan alasan wajib valid")
	}
	slices.Sort(in.Skills)
	for i, skill := range in.Skills {
		if !skillCode.MatchString(skill) || (i > 0 && in.Skills[i-1] == skill) {
			return web.Fail(422, "Kode keahlian tidak valid atau berulang")
		}
	}
	if in.Active {
		technician, err := s.Identity.Access(ctx, in.SubjectID)
		if err != nil {
			return err
		}
		if technician.Role != "TECHNICIAN" || !technician.HasTeamMandate(org, team, "ticket.read", "ticket.resolve") {
			return web.Fail(422, "Teknisi harus memiliki mandat aktif pada tim tujuan")
		}
	}
	key := r.Header.Get("Idempotency-Key")
	if len(key) < 16 || len(key) > 128 {
		return web.Fail(422, "Idempotency-Key wajib 16–128 karakter")
	}
	status, target := 200, id
	if r.Method == "POST" {
		id, status, target = web.ID(), 201, team
	}
	result, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M5", Actor: actor.ID, Command: "WriteRoster", Target: target, Key: key,
		Scope: org, Reason: in.Reason, Payload: struct {
			Team  string
			Input api.RosterInput
		}{team, in},
	}, func(tx pgx.Tx) (database.Result, error) {
		v, err := store.WriteRoster(ctx, tx, team, id, in)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(status, v)
	})
	if err != nil {
		return err
	}
	web.JSON(w, result.Status, result.Body)
	return nil
}
