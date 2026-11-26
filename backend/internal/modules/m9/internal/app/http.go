package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	m1api "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/platform/web"
)

type IdentityPort interface {
	Authenticate(ctx context.Context, c m1api.Credentials) (m1api.Actor, error)
	ActiveTeamInOrg(context.Context, string, string) (bool, error)
	DispatchTeams(context.Context, string, web.Page) ([]m1api.DirectoryEntry, error)
}

type Handler struct {
	Service   *Service
	Identity  IdentityPort
	Origin    string
	Dashboard DashboardPort
}

func NewHandler(svc *Service, identity IdentityPort, origin string) *Handler {
	return &Handler{
		Service:  svc,
		Identity: identity,
		Origin:   origin,
	}
}

func (h *Handler) actorSession(r *http.Request, required ...string) (actorID, actorKind string, actorOrgs []string, perms []string) {
	tok := web.Cookie(r, "helpdesk_session")
	csrf := r.Header.Get("X-CSRF-Token")
	if tok != "" && h.Identity != nil {
		sess, err := h.Identity.Authenticate(r.Context(), m1api.Credentials{Token: tok, CSRF: csrf, Write: r.Method != "GET" && r.Method != "HEAD"})
		if err == nil {
			allPerms := []string{}
			orgs := []string{}
			for _, m := range sess.Memberships {
				if !m.OrganizationActive {
					continue
				}
				if m.TeamID != nil && len(required) > 0 && (required[0] == "report.read" || required[0] == "report.export") {
					// The original report endpoints aggregate a whole organization.
					continue
				}
				allowedOrg := len(required) == 0
				for _, permission := range m.Permissions {
					if len(required) > 0 && permission == required[0] {
						allowedOrg = true
					}
				}
				if allowedOrg && m.OrganizationID != "" {
					orgs = append(orgs, m.OrganizationID)
				}
				for _, p := range m.Permissions {
					allPerms = append(allPerms, p)
				}
			}
			if sess.Kind == "PUBLIC" || sess.Role == "PUBLIC" {
				allPerms = append(allPerms, "notification.read", "notification.binding")
			}
			if sess.Kind == "ASN" || sess.Role == "ASN" {
				allPerms = append(allPerms, "notification.read", "notification.binding")
			}
			return sess.ID, sess.Kind, orgs, allPerms
		}
	}
	return "ANONYMOUS", "ANONYMOUS", nil, nil
}

func (h *Handler) hasPerm(perms []string, want string) bool {
	for _, p := range perms {
		if p == want {
			return true
		}
	}
	return false
}

func (h *Handler) Register(m *http.ServeMux) {
	// GET /api/v1/notifications
	m.HandleFunc("GET /api/v1/notifications", func(w http.ResponseWriter, r *http.Request) {
		actorID, _, _, perms := h.actorSession(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "notification.read") {
			web.WriteError(w, web.Fail(403, "Izin notification.read diperlukan"))
			return
		}

		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		items, next, err := h.Service.ListNotifications(r.Context(), actorID, p.Limit, p.Cursor)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, map[string]any{
			"items":       items,
			"next_cursor": next,
			"as_of":       time.Now().UTC().Format(time.RFC3339),
		})
	})

	// POST /api/v1/notifications/{id}/read
	m.HandleFunc("POST /api/v1/notifications/{id}/read", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Notifikasi tidak ditemukan"))
			return
		}

		actorID, _, _, perms := h.actorSession(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "notification.read") {
			web.WriteError(w, web.Fail(403, "Izin notification.read diperlukan"))
			return
		}

		var in api.VersionedReason
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		if in.ExpectedVersion < 1 {
			web.WriteError(w, web.Fail(400, "expected_version minimal 1"))
			return
		}

		receipt, err := h.Service.MarkNotificationRead(r.Context(), id, actorID, in.ExpectedVersion, in.Reason)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, receipt)
	})

	m.HandleFunc("POST /api/v1/notifications/sink-challenges", func(w http.ResponseWriter, r *http.Request) {
		actor, kind, orgs, perms := h.actorSession(r, "notification.binding")
		if actor == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "notification.binding") {
			web.WriteError(w, web.Fail(403, "Izin notification.binding diperlukan"))
			return
		}
		var in api.SinkChallengeInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := h.Service.IssueSinkChallenge(r.Context(), actor, kind, orgs, in.ScopeOrgID)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 201, result)
	})
	// POST /api/v1/notifications/telegram-bindings
	m.HandleFunc("POST /api/v1/notifications/telegram-bindings", func(w http.ResponseWriter, r *http.Request) {
		actorID, actorKind, actorOrgs, perms := h.actorSession(r, "notification.binding")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "notification.binding") {
			web.WriteError(w, web.Fail(403, "Izin notification.binding diperlukan"))
			return
		}

		var in api.TelegramBindingInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		if in.ExpectedVersion < 1 {
			web.WriteError(w, web.Fail(400, "expected_version minimal 1"))
			return
		}

		receipt, err := h.Service.VerifyTelegramBinding(r.Context(), actorID, actorKind, actorOrgs, in)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 201, receipt)
	})

	// POST /api/v1/notifications/telegram-bindings/{id}/revoke
	m.HandleFunc("POST /api/v1/notifications/telegram-bindings/{id}/revoke", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Telegram binding tidak ditemukan"))
			return
		}

		actorID, _, orgs, perms := h.actorSession(r, "notification.binding")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "notification.binding") {
			web.WriteError(w, web.Fail(403, "Izin notification.binding diperlukan"))
			return
		}

		var in api.VersionedReason
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		if in.ExpectedVersion < 1 {
			web.WriteError(w, web.Fail(400, "expected_version minimal 1"))
			return
		}

		receipt, err := h.Service.RevokeTelegramBinding(r.Context(), id, actorID, orgs, in.ExpectedVersion, in.Reason)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, receipt)
	})

	// GET /api/v1/reports
	m.HandleFunc("GET /api/v1/reports", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("view") == "dashboard" {
			if err := h.dashboardReport(w, r); err != nil {
				web.WriteError(w, err)
			}
			return
		}
		actorID, _, actorOrgs, perms := h.actorSession(r, "report.read")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		// Dynamic Revocation Gate (AC23)
		if !h.hasPerm(perms, "report.read") {
			web.WriteError(w, web.Fail(403, "Izin report.read diperlukan"))
			return
		}

		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")
		orgID := r.URL.Query().Get("organization_id")

		if fromStr == "" || toStr == "" || orgID == "" {
			web.WriteError(w, web.Fail(400, "Parameter from, to, dan organization_id wajib diisi"))
			return
		}
		if !web.UUID(orgID) {
			web.WriteError(w, web.Fail(400, "organization_id tidak valid"))
			return
		}

		fromTime, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			web.WriteError(w, web.Fail(400, "Format parameter from tidak valid (wajib RFC3339 UTC)"))
			return
		}
		toTime, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			web.WriteError(w, web.Fail(400, "Format parameter to tidak valid (wajib RFC3339 UTC)"))
			return
		}

		// Validasi scope: jika bukan auditor/leadership/super admin, cek org
		{
			authorized := false
			for _, o := range actorOrgs {
				if o == orgID {
					authorized = true
					break
				}
			}
			if !authorized {
				web.WriteError(w, web.Fail(403, "Organisasi di luar wewenang aktor"))
				return
			}
		}

		report, err := h.Service.ReadScopedReport(r.Context(), fromTime, toTime, orgID)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, report)
	})

	m.HandleFunc("GET /api/v1/reports/dashboard-tickets", func(w http.ResponseWriter, r *http.Request) {
		if err := h.dashboardTickets(w, r); err != nil {
			web.WriteError(w, err)
		}
	})

	// POST /api/v1/reports/exports
	m.HandleFunc("POST /api/v1/reports/exports", func(w http.ResponseWriter, r *http.Request) {
		actorID, _, actorOrgs, perms := h.actorSession(r, "report.export")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		// Dynamic Revocation Gate (AC23)
		if !h.hasPerm(perms, "report.export") {
			web.WriteError(w, web.Fail(403, "Izin report.export diperlukan"))
			return
		}

		var in api.ReportQuery
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}

		if in.Timezone != "Asia/Jakarta" {
			web.WriteError(w, web.Fail(400, "Timezone wajib Asia/Jakarta"))
			return
		}
		if in.Format != "CSV" && in.Format != "JSON" {
			web.WriteError(w, web.Fail(400, "Format ekspor wajib CSV atau JSON"))
			return
		}
		if in.Cohort != "ACCEPTED" && in.Cohort != "RESOLVED" && in.Cohort != "OPEN" {
			web.WriteError(w, web.Fail(400, "Cohort wajib ACCEPTED, RESOLVED, atau OPEN"))
			return
		}
		if !web.UUID(in.OrganizationID) {
			web.WriteError(w, web.Fail(400, "organization_id tidak valid"))
			return
		}

		{
			authorized := false
			for _, o := range actorOrgs {
				if o == in.OrganizationID {
					authorized = true
					break
				}
			}
			if !authorized {
				web.WriteError(w, web.Fail(403, "Organisasi di luar wewenang aktor"))
				return
			}
		}

		op, err := h.Service.RequestReportExport(r.Context(), actorID, in.OrganizationID, in)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		w.Header().Set("Location", fmt.Sprintf("/api/v1/reports/exports/%s", op.ID))
		web.JSON(w, 202, op)
	})

	// GET /api/v1/reports/exports/{id}
	m.HandleFunc("GET /api/v1/reports/exports/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Export job tidak ditemukan"))
			return
		}

		actorID, _, actorOrgs, perms := h.actorSession(r, "report.export")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "report.export") {
			web.WriteError(w, web.Fail(403, "Izin report.export diperlukan"))
			return
		}

		op, err := h.Service.ReadReportExport(r.Context(), id, actorID, actorOrgs)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, op)
	})

	// GET /api/v1/reports/exports/{id}/download
	m.HandleFunc("GET /api/v1/reports/exports/{id}/download", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Export job tidak ditemukan"))
			return
		}

		actorID, _, actorOrgs, perms := h.actorSession(r, "report.export")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		// Dynamic Revocation Gate (AC23)
		if !h.hasPerm(perms, "report.export") {
			web.WriteError(w, web.Fail(403, "Izin report.export diperlukan"))
			return
		}

		dl, err := h.Service.DownloadReportExport(r.Context(), id, actorID, actorOrgs)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, dl)
	})

	// GET /api/v1/reports/exports/{id}/file
	m.HandleFunc("GET /api/v1/reports/exports/{id}/file", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Export job tidak ditemukan"))
			return
		}

		actorID, _, actorOrgs, perms := h.actorSession(r, "report.export")
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		// Dynamic Revocation Gate (AC23): Cek izin live
		if !h.hasPerm(perms, "report.export") {
			web.WriteError(w, web.Fail(403, "Izin report.export diperlukan"))
			return
		}

		payload, format, err := h.Service.ExportFile(r.Context(), id, actorID, actorOrgs)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		mediaType, extension := "text/csv; charset=utf-8", "csv"
		if format == "JSON" {
			mediaType, extension = "application/json", "json"
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", mediaType)
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="report-export-%s.%s"`, id, extension))
		w.WriteHeader(200)
		_, _ = w.Write(payload)
	})

	// GET /api/v1/admin/delivery-jobs
	m.HandleFunc("GET /api/v1/admin/delivery-jobs", func(w http.ResponseWriter, r *http.Request) {
		actorID, actorKind, _, perms := h.actorSession(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if actorKind != "STAFF" || (!h.hasPerm(perms, "system.job") && !h.hasPerm(perms, "operation.read")) {
			web.WriteError(w, web.Fail(403, "Izin staf operation.read atau system.job diperlukan"))
			return
		}
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		stateFilter := r.URL.Query().Get("state")
		items, err := h.Service.ListDeliveryJobs(r.Context(), stateFilter, p.Limit)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"items": items, "next_cursor": nil, "as_of": time.Now().UTC().Format(time.RFC3339)})
	})

	// POST /api/v1/admin/delivery-jobs/{id}/replay
	m.HandleFunc("POST /api/v1/admin/delivery-jobs/{id}/replay", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Job pengiriman tidak ditemukan"))
			return
		}
		actorID, actorKind, _, perms := h.actorSession(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if actorKind != "STAFF" || (!h.hasPerm(perms, "system.job") && !h.hasPerm(perms, "operation.read")) {
			web.WriteError(w, web.Fail(403, "Izin staf operation.read atau system.job diperlukan"))
			return
		}
		idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
		if len(idemKey) < 16 || len(idemKey) > 128 {
			web.WriteError(w, web.Fail(400, "Idempotency-Key diperlukan (16–128 karakter)"))
			return
		}
		var in api.VersionedReason
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		rec, err := h.Service.ReplayDeliveryJob(r.Context(), id, actorID, in.Reason, in.ExpectedVersion)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, rec)
	})

	// GET /api/v1/audit
	m.HandleFunc("GET /api/v1/audit", func(w http.ResponseWriter, r *http.Request) {
		actorID, _, _, perms := h.actorSession(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "audit.read") {
			web.WriteError(w, web.Fail(403, "Izin audit.read diperlukan"))
			return
		}

		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		items, next, err := h.Service.ListAudit(r.Context(), p.Limit, p.Cursor)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		web.JSON(w, 200, map[string]any{
			"items":       items,
			"next_cursor": next,
			"as_of":       time.Now().UTC().Format(time.RFC3339),
		})
	})
}
