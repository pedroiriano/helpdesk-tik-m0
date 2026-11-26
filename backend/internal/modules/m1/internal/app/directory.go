package app

import (
	"context"
	"net/http"
	"strings"

	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) ReportingContext(ctx context.Context, org, division string, verified bool) (api.ReportingContext, error) {
	if !web.UUID(org) || (division != "" && !web.UUID(division)) {
		return api.ReportingContext{}, web.Fail(422, "Perangkat daerah atau bidang tidak valid")
	}
	return s.Store.ReportingContext(ctx, org, division, verified)
}

func (s *Service) RoutingDestination(ctx context.Context, team, org string) (string, error) {
	return s.Store.RoutingDestination(ctx, team, org)
}

func (s *Service) HandoffTargets(ctx context.Context, from, to string, page web.Page) ([]api.DirectoryEntry, error) {
	return s.Store.HandoffTargets(ctx, from, to, page)
}

func (s *Service) registerReportingDirectory(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/reporting/directory", func(w http.ResponseWriter, r *http.Request) {
		p, err := web.Pagination(r)
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if err == nil && len(query) > 120 {
			err = web.Fail(400, "Pencarian maksimal 120 byte")
		}
		if err != nil {
			web.WriteError(w, err)
			return
		}
		authenticated := r.URL.Query().Get("mode") == "asn"
		var orgs []string
		if authenticated {
			actor, err := s.Authenticate(r.Context(), Credentials(r))
			if err != nil {
				web.WriteError(w, err)
				return
			}
			if actor.Kind != "ASN" {
				web.WriteError(w, web.Fail(403, "Pemilihan berdasarkan mandat hanya untuk akun ASN"))
				return
			}
			orgs = actor.Orgs("ticket.create")
		}
		rows, err := s.Store.ReportingDirectory(r.Context(), orgs, authenticated, query, p)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, web.List(rows, p.Limit, func(entry api.DirectoryEntry) string { return entry.ID }))
	})
}

func (s *Service) registerRosterTeams(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/staff/roster-teams", func(w http.ResponseWriter, r *http.Request) {
		if err := s.rosterTeams(w, r); err != nil {
			web.WriteError(w, err)
		}
	})
}

func (s *Service) rosterTeams(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	actor, err := s.Authenticate(ctx, Credentials(r))
	if err != nil {
		return err
	}
	page, err := web.Pagination(r)
	if err != nil {
		return err
	}
	org := r.URL.Query().Get("organization_id")
	if !web.UUID(org) {
		return web.Fail(422, "Organisasi tidak valid")
	}
	ids := []string{}
	if actor.CanManageRoster(org, "") {
		ids = nil
	} else {
		for _, member := range actor.Memberships {
			if member.TeamID != nil && actor.CanManageRoster(org, *member.TeamID) {
				ids = append(ids, *member.TeamID)
			}
		}
		if len(ids) == 0 {
			return web.Fail(403, "Izin pengelolaan jadwal diperlukan")
		}
	}
	rows, err := s.Store.RosterTeams(ctx, org, ids, page)
	if err != nil {
		return err
	}
	w.Header().Set("Cache-Control", "no-store")
	web.JSON(w, 200, web.List(rows, page.Limit, func(item api.RosterTeam) string { return item.ID }))
	return nil
}

func (s *Service) DispatchTeams(ctx context.Context, org string, page web.Page) ([]api.DirectoryEntry, error) {
	if !web.UUID(org) {
		return nil, web.Fail(422, "Organisasi tidak valid")
	}
	// The handoff directory also lists teams for a known target organization.
	return s.Store.HandoffTargets(ctx, "00000000-0000-4000-8000-000000000000", org, page)
}
