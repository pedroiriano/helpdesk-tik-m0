package app

import (
	"context"
	"net/http"
	"strings"
	"time"

	identity "helpdesk.local/m0/internal/modules/m1/api"
	intake "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/modules/m9/internal/store"
	"helpdesk.local/m0/internal/platform/web"
)

type DashboardPort interface {
	DashboardPaused(context.Context, string, []string, time.Time) (map[string]bool, error)
	DashboardTickets(context.Context, identity.Actor, []string, string, web.Page) ([]intake.DashboardTicket, error)
}

func (h *Handler) dashboardScope(r *http.Request, permissions ...string) (identity.Actor, api.ReportQuery, error) {
	q := api.ReportQuery{}
	if h.Identity == nil || h.Dashboard == nil {
		return identity.Actor{}, q, web.Fail(503, "Data dasbor belum tersedia")
	}
	actor, err := h.Identity.Authenticate(r.Context(), identity.Credentials{Token: web.Cookie(r, "helpdesk_session")})
	if err != nil {
		return actor, q, err
	}
	params := r.URL.Query()
	q.OrganizationID = strings.ToLower(params.Get("organization_id"))
	if !web.UUID(q.OrganizationID) {
		return actor, q, web.Fail(400, "Perangkat daerah tidak valid")
	}
	if !actor.HasTeamMandate(q.OrganizationID, "", permissions...) {
		return actor, q, web.Fail(403, "Akses dasbor untuk perangkat daerah ini tidak tersedia")
	}
	var fromErr, toErr error
	q.From, fromErr = time.Parse(time.RFC3339Nano, params.Get("from"))
	q.To, toErr = time.Parse(time.RFC3339Nano, params.Get("to"))
	if fromErr != nil || toErr != nil {
		return actor, q, web.Fail(400, "Gunakan waktu mulai dan akhir RFC 3339")
	}
	q.From, q.To = q.From.UTC(), q.To.UTC()
	if !q.To.After(q.From) || q.To.Sub(q.From) > 31*24*time.Hour {
		return actor, q, web.Fail(422, "Periode dasbor harus positif dan paling lama 31 hari")
	}
	return actor, q, nil
}

func (h *Handler) dashboardReport(w http.ResponseWriter, r *http.Request) error {
	_, q, err := h.dashboardScope(r, "report.read")
	if err != nil {
		return err
	}
	report, err := h.Service.store.DashboardReport(r.Context(), q, h.Dashboard.DashboardPaused)
	if err != nil {
		return err
	}
	w.Header().Set("Cache-Control", "no-store")
	web.JSON(w, 200, report)
	return nil
}

func (h *Handler) dashboardTickets(w http.ResponseWriter, r *http.Request) error {
	actor, q, err := h.dashboardScope(r, "report.read", "ticket.read")
	if err != nil {
		return err
	}
	page, err := web.Pagination(r)
	if err != nil {
		return err
	}
	params := r.URL.Query()
	day, segment, search := params.Get("day"), params.Get("segment"), strings.TrimSpace(params.Get("q"))
	if day != "" {
		if _, err := time.Parse(time.DateOnly, day); err != nil {
			return web.Fail(400, "Tanggal penerimaan harus YYYY-MM-DD")
		}
	}
	if !store.DashboardSegmentValid(segment) || len(search) > 120 || strings.ContainsRune(search, 0) {
		return web.Fail(400, "Filter segmen atau kata kunci tidak valid")
	}
	rows, ids, err := h.Service.store.DashboardSelection(r.Context(), q, day, segment, h.Dashboard.DashboardPaused)
	if err != nil {
		return err
	}
	items := make([]api.DashboardRow, 0)
	if len(ids) > 0 {
		details, err := h.Dashboard.DashboardTickets(r.Context(), actor, ids, search, page)
		if err != nil {
			return err
		}
		for _, detail := range details {
			row := rows[detail.ID]
			row.Number, row.Title = detail.Number, detail.Title
			items = append(items, row)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	web.JSON(w, 200, web.List(items, page.Limit, func(row api.DashboardRow) string { return row.ID }))
	return nil
}
