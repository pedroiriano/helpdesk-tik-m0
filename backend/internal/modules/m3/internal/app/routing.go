package app

import (
	"net/http"

	identity "helpdesk.local/m0/internal/modules/m1/api"
	assignment "helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) registerRouting(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/tickets/{id}/handoff-targets", func(w http.ResponseWriter, r *http.Request) {
		ticket, scope, actor, err := s.authorized(r.Context(), creds(r), r.PathValue("id"), false)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if !scope.Internal || !actor.Can("ticket.handoff", ticket.OwnerOrg) {
			web.WriteError(w, web.Fail(403, "Mandat pelimpahan diperlukan"))
			return
		}
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		items, err := s.Identity.HandoffTargets(r.Context(), ticket.OwnerOrg, p.Organization, p)
		reply(w, web.List(items, p.Limit, func(v identity.DirectoryEntry) string { return v.ID }), err)
	})
	handler := func(w http.ResponseWriter, r *http.Request) {
		c := creds(r).Identity
		c.Write = r.Method == http.MethodPut
		actor, err := s.Identity.Authenticate(r.Context(), c)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		service, err := s.Catalog.AdminService(r.Context(), c, r.PathValue("id"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		tier := r.PathValue("tier")
		category := r.URL.Query().Get("category_id")
		if category != "" {
			items, err := s.Catalog.VerificationCategories(r.Context(), service.OwnerOrgID)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			valid := false
			for _, item := range items {
				if item.ID == category {
					valid = true
					break
				}
			}
			if !valid {
				web.WriteError(w, web.Fail(422, "Pilih kategori aktif milik organisasi layanan"))
				return
			}
		}
		if r.Method == http.MethodGet {
			rule, err := s.Assignment.ReadRouting(r.Context(), actor, service.OwnerOrgID, service.ID, tier, category)
			reply(w, rule, err)
			return
		}
		var in assignment.RoutingInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := s.Assignment.WriteRouting(r.Context(), actor, service.OwnerOrgID, service.ID, tier, category, r.Header.Get("Idempotency-Key"), in)
		receipt(w, result, err)
	}
	m.HandleFunc("GET /api/v1/admin/services/{id}/routing/{tier}", handler)
	m.HandleFunc("PUT /api/v1/admin/services/{id}/routing/{tier}", handler)
}
