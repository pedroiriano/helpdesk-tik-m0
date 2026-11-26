package app

import (
	"context"
	"encoding/csv"
	"net/http"
	"slices"
	"strconv"
	"time"

	identity "helpdesk.local/m0/internal/modules/m1/api"
	intake "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/platform/web"
)

type TechnicalFactsReader func(context.Context, intake.TechnicalPerformanceScope) ([]intake.TechnicalFact, error)

func reportTeamScope(actor identity.Actor, org, team string, export bool) (intake.TechnicalPerformanceScope, error) {
	scope := intake.TechnicalPerformanceScope{OrganizationID: org}
	if actor.Kind != "STAFF" {
		return scope, web.Fail(403, "Laporan kinerja tersedia untuk petugas berizin")
	}
	self := actor.Role == "TECHNICIAN"
	if self {
		scope.SubjectID = actor.ID
	}
	permissions := []string{"report.read"}
	if self {
		permissions = []string{"ticket.read", "ticket.resolve"}
	}
	if export {
		permissions = append(permissions, "report.export")
	}
	scope.TeamIDs = []string{}
	for _, member := range actor.Memberships {
		if !member.OrganizationActive || member.OrganizationID != org {
			continue
		}
		if slices.ContainsFunc(permissions, func(p string) bool { return !slices.Contains(member.Permissions, p) }) {
			continue
		}
		if team != "" && (member.TeamID == nil || *member.TeamID == team) {
			scope.TeamIDs = []string{team}
			return scope, nil
		}
		if team == "" && member.TeamID == nil {
			scope.TeamIDs = nil
			return scope, nil
		}
		if team == "" && !slices.Contains(scope.TeamIDs, *member.TeamID) {
			scope.TeamIDs = append(scope.TeamIDs, *member.TeamID)
		}
	}
	if len(scope.TeamIDs) == 0 {
		return scope, web.Fail(403, "Organisasi atau tim di luar mandat laporan Anda")
	}
	return scope, nil
}

func summarizeTechnical(scope intake.TechnicalPerformanceScope, facts []intake.TechnicalFact) api.TechnicalPerformance {
	r := api.TechnicalPerformance{From: scope.From, To: scope.To, AsOf: time.Now().UTC(), Timezone: "Asia/Jakarta", Cohort: "ACTIVITY"}
	resolved := map[string]bool{}
	for _, fact := range facts {
		at := fact.At
		if r.Watermark == nil || r.Watermark.Before(at) {
			r.Watermark = &at
		}
		switch fact.Kind {
		case "RESOLVED":
			resolved[fact.TicketID] = true
			r.ResolutionAttempts++
			if fact.Due == nil || fact.Endpoint == nil {
				r.SLAUnmeasured++
				continue
			}
			r.SLAMeasured++
			if !fact.Endpoint.After(*fact.Due) {
				r.SLAMet++
			}
			if fact.Gross != nil && fact.Net != nil {
				r.GrossSeconds += *fact.Gross
				r.NetSeconds += *fact.Net
			}
		case "CONFIRMED":
			r.Confirmed++
		case "AUTO_CLOSED":
			r.AutoClosed++
		case "REOPENED":
			r.Reopened++
		case "WORK_LOG":
			r.WorkLogs++
			r.WorkSeconds += fact.Seconds
		}
	}
	r.ResolvedTickets = len(resolved)
	if r.SLAMeasured > 0 {
		pct := 100 * float64(r.SLAMet) / float64(r.SLAMeasured)
		r.SLAPercent = &pct
	}
	return r
}

func (h *Handler) RegisterTechnicalReports(m *http.ServeMux, source TechnicalFactsReader) {
	m.HandleFunc("GET /api/v1/reports/technical-teams", func(w http.ResponseWriter, r *http.Request) {
		if err := h.technicalTeams(w, r); err != nil {
			web.WriteError(w, err)
		}
	})
	for _, path := range []string{"/api/v1/reports/technical-performance", "/api/v1/reports/technical-performance.csv"} {
		m.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) {
			if err := h.technicalPerformance(w, r, source, r.URL.Path == "/api/v1/reports/technical-performance.csv"); err != nil {
				web.WriteError(w, err)
			}
		})
	}
}

func (h *Handler) technicalTeams(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	actor, err := h.Identity.Authenticate(ctx, identity.Credentials{Token: web.Cookie(r, "helpdesk_session")})
	if err != nil {
		return err
	}
	org := r.URL.Query().Get("organization_id")
	if !web.UUID(org) {
		return web.Fail(400, "Organisasi tidak valid")
	}
	scope, err := reportTeamScope(actor, org, "", false)
	if err != nil {
		return err
	}
	page, err := web.Pagination(r)
	if err != nil {
		return err
	}
	type teamOption struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	items := []teamOption{}
	// The roster directory is paged first. Continue until the visible page is full.
	upstream := web.Page{Limit: 100, Cursor: page.Cursor}
	for {
		teams, err := h.Identity.DispatchTeams(ctx, org, upstream)
		if err != nil {
			return err
		}
		for _, team := range teams {
			if scope.TeamIDs == nil || slices.Contains(scope.TeamIDs, team.ID) {
				items = append(items, teamOption{team.ID, team.Name})
			}
			if len(items) > page.Limit {
				break
			}
		}
		if len(items) > page.Limit || len(teams) <= upstream.Limit {
			break
		}
		upstream.Cursor = teams[len(teams)-1].ID
	}
	w.Header().Set("Cache-Control", "no-store")
	web.JSON(w, 200, web.List(items, page.Limit, func(item teamOption) string { return item.ID }))
	return nil
}

func (h *Handler) technicalPerformance(w http.ResponseWriter, r *http.Request, source TechnicalFactsReader, export bool) error {
	ctx := r.Context()
	actor, err := h.Identity.Authenticate(ctx, identity.Credentials{Token: web.Cookie(r, "helpdesk_session")})
	if err != nil {
		return err
	}
	query := r.URL.Query()
	org, team := query.Get("organization_id"), query.Get("team_id")
	if !web.UUID(org) || (team != "" && !web.UUID(team)) {
		return web.Fail(400, "Organisasi atau tim tidak valid")
	}
	scope, err := reportTeamScope(actor, org, team, false)
	if err != nil {
		return err
	}
	if export {
		granted, err := reportTeamScope(actor, org, team, true)
		if err != nil {
			return err
		}
		if granted.TeamIDs != nil && (scope.TeamIDs == nil || slices.ContainsFunc(scope.TeamIDs, func(id string) bool { return !slices.Contains(granted.TeamIDs, id) })) {
			return web.Fail(403, "Izin ekspor tidak mencakup seluruh tim dalam pilihan. Pilih satu tim yang diizinkan.")
		}
	}
	if team != "" {
		exists, err := h.Identity.ActiveTeamInOrg(ctx, team, org)
		if err != nil {
			return err
		}
		if !exists {
			return web.Fail(404, "Tim aktif tidak ditemukan pada organisasi ini")
		}
	}
	scope.From, err = time.Parse(time.RFC3339, query.Get("from"))
	if err != nil {
		return web.Fail(400, "Waktu mulai harus RFC3339")
	}
	scope.To, err = time.Parse(time.RFC3339, query.Get("to"))
	if err != nil {
		return web.Fail(400, "Waktu akhir harus RFC3339")
	}
	if !scope.To.After(scope.From) || scope.To.Sub(scope.From) > 366*24*time.Hour {
		return web.Fail(422, "Periode harus positif dan paling lama 366 hari")
	}
	facts, err := source(ctx, scope)
	if err != nil {
		return err
	}
	report := summarizeTechnical(scope, facts)
	w.Header().Set("Cache-Control", "no-store")
	if !export {
		web.JSON(w, 200, report)
		return nil
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="kinerja-teknisi.csv"`)
	writer := csv.NewWriter(w)
	percent, watermark := "", ""
	if report.SLAPercent != nil {
		percent = strconv.FormatFloat(*report.SLAPercent, 'f', 2, 64)
	}
	if report.Watermark != nil {
		watermark = report.Watermark.Format(time.RFC3339)
	}
	_ = writer.Write([]string{"from", "to", "timezone", "cohort", "organization_id", "team_id", "watermark", "resolved_tickets", "resolution_attempts", "confirmed", "auto_closed", "reopened", "work_logs", "work_seconds", "sla_met", "sla_measured", "sla_unmeasured", "sla_percent", "gross_seconds", "net_seconds"})
	_ = writer.Write([]string{report.From.Format(time.RFC3339), report.To.Format(time.RFC3339), report.Timezone, report.Cohort, org, team, watermark,
		strconv.Itoa(report.ResolvedTickets), strconv.Itoa(report.ResolutionAttempts), strconv.Itoa(report.Confirmed), strconv.Itoa(report.AutoClosed),
		strconv.Itoa(report.Reopened), strconv.Itoa(report.WorkLogs), strconv.FormatInt(report.WorkSeconds, 10), strconv.Itoa(report.SLAMet),
		strconv.Itoa(report.SLAMeasured), strconv.Itoa(report.SLAUnmeasured), percent, strconv.FormatInt(report.GrossSeconds, 10), strconv.FormatInt(report.NetSeconds, 10)})
	writer.Flush()
	return nil
}
