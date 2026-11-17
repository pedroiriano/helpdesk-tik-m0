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
