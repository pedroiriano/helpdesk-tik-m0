package app

import (
	"encoding/json"
	"helpdesk.local/m0/internal/modules/m1/api"
	tickets "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func creds(r *http.Request) Credentials {
	return Credentials{Identity: api.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token")}, Capability: r.Header.Get("X-Guest-Capability"), Tracking: web.Cookie(r, "helpdesk_tracking"), CSRF: r.Header.Get("X-CSRF-Token"), Bootstrap: web.Cookie(r, "helpdesk_login")}
}
func (s *Service) cookie(w http.ResponseWriter, name, value string, httpOnly bool, age int) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: httpOnly, Secure: strings.HasPrefix(s.Origin, "https://"), SameSite: http.SameSiteStrictMode, MaxAge: age})
}
func reply(w http.ResponseWriter, v any, e error) {
	if e != nil {
		web.WriteError(w, e)
		return
	}
	web.JSON(w, 200, v)
}
func receipt(w http.ResponseWriter, v database.Result, e error) {
	if e != nil {
		web.WriteError(w, e)
		return
	}
	web.JSON(w, v.Status, v.Body)
}
func (s *Service) Register(m *http.ServeMux) {
	m.HandleFunc("POST /api/v1/tickets", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.Create
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Create(r.Context(), creds(r), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets", func(w http.ResponseWriter, r *http.Request) {
		p, e := web.Pagination(r)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.List(r.Context(), creds(r), p)
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}", func(w http.ResponseWriter, r *http.Request) {
		v, _, _, e := s.Read(r.Context(), creds(r), r.PathValue("id"))
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/history", func(w http.ResponseWriter, r *http.Request) {
		_, scope, _, e := s.Read(r.Context(), creds(r), r.PathValue("id"))
		if e != nil {
			web.WriteError(w, e)
			return
		}
		p, e := web.Pagination(r, "version_asc")
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Store.Histories(r.Context(), r.PathValue("id"), scope.Internal, p)
		reply(w, web.List(v, p.Limit, func(v tickets.History) string { return v.ID }), e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		_, scope, _, e := s.Read(r.Context(), creds(r), r.PathValue("id"))
		if e != nil {
			web.WriteError(w, e)
			return
		}
		p, e := web.Pagination(r, "created_asc")
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Store.Comments(r.Context(), r.PathValue("id"), scope.Internal, p)
		reply(w, web.List(v, p.Limit, func(v tickets.Comment) string { return v.ID }), e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.CommentInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Comment(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/verification-categories", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.VerificationCategories(r.Context(), creds(r), r.PathValue("id"))
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/dispatch-proposal", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.DispatchProposal(r.Context(), creds(r), r.PathValue("id"), r.URL.Query().Get("tier"), r.URL.Query().Get("mode") == "reassign")
		reply(w, v, e)
	})
	s.registerRouting(m)
	m.HandleFunc("GET /api/v1/reporting/services/{id}/categories", func(w http.ResponseWriter, r *http.Request) {
		if !web.UUID(r.PathValue("id")) {
			web.WriteError(w, web.Fail(404, "Layanan tidak tersedia"))
			return
		}
		snap, err := s.Catalog.Snapshot(r.Context(), creds(r).Identity, r.PathValue("id"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		categories, err := s.Catalog.VerificationCategories(r.Context(), snap.Service.OwnerOrgID)
		items := make([]map[string]string, 0, len(categories))
		for _, category := range categories {
			items = append(items, map[string]string{"id": category.ID, "name": category.Name})
		}
		w.Header().Set("Cache-Control", "no-store")
		reply(w, map[string]any{"items": items, "suggested_id": snap.Service.CategoryID}, err)
	})
	verifyHandler := func(w http.ResponseWriter, r *http.Request) {
		var in tickets.VerificationInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Verify(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	}
	m.HandleFunc("POST /api/v1/tickets/{id}/verify", verifyHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/triage", verifyHandler)
	dispatchHandler := func(w http.ResponseWriter, r *http.Request) {
		var in tickets.DispatchInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Dispatch(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	}
	m.HandleFunc("POST /api/v1/tickets/{id}/dispatch", dispatchHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/assign", dispatchHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/reassign", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.DispatchInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := s.Reassign(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, result, err)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/reject", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.RejectInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Reject(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	resolveHandler := func(w http.ResponseWriter, r *http.Request) {
		var in tickets.ResolutionInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Resolve(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	}
	m.HandleFunc("POST /api/v1/tickets/{id}/resolution-attempts", resolveHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/resolve", resolveHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/transitions/resolve", resolveHandler)
	m.HandleFunc("POST /api/v1/tickets/{id}/transitions", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.LifecycleInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := s.Transition(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, result, err)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/resolution-attempts", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.ListResolutionAttempts(r.Context(), creds(r), r.PathValue("id"))
		reply(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/confirmation", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.ConfirmationInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Confirm(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/close", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.ConfirmationInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		in.Decision = "ACCEPT"
		v, e := s.Confirm(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/sla", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.GetSLA(r.Context(), creds(r), r.PathValue("id"))
		reply(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/vendor-cases", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.VendorCaseInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.RecordVendorCase(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/pauses", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.PauseInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.ApprovePause(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/handoffs", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.HandoffInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.RequestHandoff(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/handoffs/{handoff_id}", func(w http.ResponseWriter, r *http.Request) {
		offer, err := s.ReadHandoffOffer(r.Context(), creds(r), r.PathValue("id"), r.PathValue("handoff_id"))
		w.Header().Set("Cache-Control", "no-store")
		reply(w, offer, err)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/handoffs/{handoff_id}/accept", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.AcceptHandoffInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.AcceptHandoff(r.Context(), creds(r), r.PathValue("id"), r.PathValue("handoff_id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/escalations", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.EscalateInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.RequestEscalation(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		var op struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(v.Body, &op) == nil && op.ID != "" {
			w.Header().Set("Location", "/api/v1/operations/"+op.ID)
		}
		receipt(w, v, nil)
	})
	m.HandleFunc("GET /api/v1/operations/{id}", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.ReadOperation(r.Context(), creds(r), r.PathValue("id"))
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/operator/queue/verification", func(w http.ResponseWriter, r *http.Request) {
		p, e := web.Pagination(r)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.QueueVerification(r.Context(), creds(r), p)
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/operator/queue/dispatch", func(w http.ResponseWriter, r *http.Request) {
		p, e := web.Pagination(r)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.QueueDispatch(r.Context(), creds(r), p)
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/technician/queue/my-tasks", func(w http.ResponseWriter, r *http.Request) {
		p, e := web.Pagination(r)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.QueueMyTasks(r.Context(), creds(r), p)
		reply(w, v, e)
	})
	m.HandleFunc("GET /api/v1/technicians", func(w http.ResponseWriter, r *http.Request) {
		teamID := r.URL.Query().Get("team_id")
		v, e := s.ListTechnicians(r.Context(), creds(r), teamID)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		web.JSON(w, 200, map[string]any{"items": v})
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/attachments", func(w http.ResponseWriter, r *http.Request) {
		_, scope, _, e := s.Read(r.Context(), creds(r), r.PathValue("id"))
		if e != nil {
			web.WriteError(w, e)
			return
		}
		p, e := web.Pagination(r)
		if e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Store.Files(r.Context(), r.PathValue("id"), scope.Internal, p)
		reply(w, web.List(v, p.Limit, func(v tickets.Attachment) string { return v.ID }), e)
	})
	m.HandleFunc("POST /api/v1/tickets/{id}/attachments", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/octet-stream" {
			web.WriteError(w, web.Fail(400, "Gunakan byte stream application/octet-stream"))
			return
		}
		version, e := strconv.ParseInt(r.Header.Get("X-Expected-Version"), 10, 64)
		if e != nil {
			web.WriteError(w, web.Fail(422, "Versi diperlukan"))
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 10485760)
		filename, err := url.PathUnescape(r.Header.Get("X-Filename"))
		if err != nil {
			web.WriteError(w, web.Fail(422, "Nama file tidak valid"))
			return
		}
		v, e := s.Upload(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), filename, r.Header.Get("X-File-Mime"), r.Header.Get("X-Attachment-Audience"), version, r.Body)
		receipt(w, v, e)
	})
	m.HandleFunc("GET /api/v1/tickets/{id}/attachments/{attachment_id}/download", func(w http.ResponseWriter, r *http.Request) {
		if !web.UUID(r.PathValue("attachment_id")) {
			web.WriteError(w, web.Fail(404, "Lampiran tidak ditemukan"))
			return
		}
		data, name, kind, e := s.Download(r.Context(), creds(r), r.PathValue("id"), r.PathValue("attachment_id"))
		if e != nil {
			web.WriteError(w, e)
			return
		}
		w.Header().Set("Content-Type", kind)
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.WriteHeader(200)
		_, _ = w.Write(data)
	})
	m.HandleFunc("POST /api/v1/guest/tracking-session", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			CSRF string `json:"csrf_token"`
		}
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		c := creds(r)
		if in.CSRF != c.CSRF {
			web.WriteError(w, web.Fail(403, "CSRF pelacakan tidak valid"))
			return
		}
		v, token, csrf, e := s.Exchange(r.Context(), c, r.Header.Get("Idempotency-Key"))
		if e != nil {
			web.WriteError(w, e)
			return
		}
		s.cookie(w, "helpdesk_tracking", token, true, 1800)
		s.cookie(w, "helpdesk_tracking_csrf", csrf, false, 1800)
		receipt(w, v, nil)
	})
	m.HandleFunc("GET /api/v1/guest/tracking-session", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.Tracking(r.Context(), creds(r))
		if e != nil {
			s.cookie(w, "helpdesk_tracking", "", true, -1)
			s.cookie(w, "helpdesk_tracking_csrf", "", false, -1)
		}
		reply(w, v, e)
	})
	end := func(revoke bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				Version int64  `json:"expected_version"`
				Reason  string `json:"reason"`
			}
			if e := web.Decode(w, r, &in); e != nil {
				web.WriteError(w, e)
				return
			}
			if in.Version != 1 {
				web.WriteError(w, web.Fail(409, "Versi pelacakan tidak valid"))
				return
			}
			v, e := s.EndTracking(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), revoke)
			if e == nil {
				s.cookie(w, "helpdesk_tracking", "", true, -1)
				s.cookie(w, "helpdesk_tracking_csrf", "", false, -1)
			}
			receipt(w, v, e)
		}
	}
	m.HandleFunc("POST /api/v1/guest/tracking-session/logout", end(false))
	m.HandleFunc("POST /api/v1/tickets/{id}/capability/revoke", end(true))

	// M0-11: Ticket Archiving & Restoration
	m.HandleFunc("POST /api/v1/tickets/{id}/archive", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.ArchiveInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.Archive(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})

	m.HandleFunc("POST /api/v1/tickets/{id}/restore-archive", func(w http.ResponseWriter, r *http.Request) {
		var in tickets.RestoreArchiveInput
		if e := web.Decode(w, r, &in); e != nil {
			web.WriteError(w, e)
			return
		}
		v, e := s.RestoreArchive(r.Context(), creds(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		receipt(w, v, e)
	})
}
