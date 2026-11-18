package app

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

func Credentials(r *http.Request) api.Credentials {
	return api.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: r.Method != "GET" && r.Method != "HEAD"}
}
func (s *Service) cookie(w http.ResponseWriter, name, value string, httpOnly bool, age int) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: httpOnly, Secure: strings.HasPrefix(s.Options.Origin, "https://"), SameSite: http.SameSiteStrictMode, MaxAge: age})
}

// Switching account contexts must not resurrect a previously used guest ticket on a shared browser.
// The tracking session remains owned and revocable by M3; this only removes browser cookies.
func (s *Service) clearTrackingCookies(w http.ResponseWriter) {
	s.cookie(w, "helpdesk_tracking", "", true, -1)
	s.cookie(w, "helpdesk_tracking_csrf", "", false, -1)
}
func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/auth/config", func(w http.ResponseWriter, r *http.Request) {
		cfg, token, err := s.IssueAuthChallenge(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		s.cookie(w, "helpdesk_login", token, true, 300)
		web.JSON(w, 200, cfg)
	})
	mux.HandleFunc("GET /api/v1/auth/bootstrap", func(w http.ResponseWriter, r *http.Request) {
		users, err := s.Subjects(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		nonce := make([]byte, 32)
		if _, err = rand.Read(nonce); err != nil {
			web.WriteError(w, err)
			return
		}
		token := hex.EncodeToString(nonce)
		s.cookie(w, "helpdesk_login", token, true, 300)
		web.JSON(w, 200, map[string]any{"mode": "SYNTHETIC_LAB", "csrf_token": token, "subjects": users})
	})
	mux.HandleFunc("GET /api/v1/auth/sso/login", func(w http.ResponseWriter, r *http.Request) {
		targetURL, sealedCookie, err := s.StartSSOLogin()
		if err != nil {
			web.WriteError(w, err)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "helpdesk_sso",
			Value:    sealedCookie,
			Path:     "/api/v1/auth/sso",
			HttpOnly: true,
			Secure:   strings.HasPrefix(s.Options.Origin, "https://"),
			SameSite: http.SameSiteLaxMode,
			MaxAge:   300,
		})
		http.Redirect(w, r, targetURL, http.StatusFound)
	})
	mux.HandleFunc("GET /api/v1/auth/sso/callback", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     "helpdesk_sso",
			Value:    "",
			Path:     "/api/v1/auth/sso",
			HttpOnly: true,
			Secure:   strings.HasPrefix(s.Options.Origin, "https://"),
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
		})
		q := r.URL.Query()
		dest, token, csrf, err := s.CompleteSSOCallback(r.Context(), web.Cookie(r, "helpdesk_sso"), q.Get("state"), q.Get("code"), q.Get("error"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		s.cookie(w, "helpdesk_session", token, true, 7200)
		s.cookie(w, "helpdesk_csrf", csrf, false, 7200)
		s.clearTrackingCookies(w)
		http.Redirect(w, r, strings.TrimRight(s.Options.Origin, "/")+dest, http.StatusSeeOther)
	})
	mux.HandleFunc("POST /api/v1/auth/sessions", func(w http.ResponseWriter, r *http.Request) {
		var in Login
		err := web.Decode(w, r, &in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		nonce := web.Cookie(r, "helpdesk_login")
		if r.Header.Get("X-CSRF-Token") != nonce {
			web.WriteError(w, web.Fail(403, "Verifikasi awal login gagal"))
			return
		}
		result, token, csrf, err := s.Login(r.Context(), in, nonce, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		s.cookie(w, "helpdesk_session", token, true, 7200)
		s.cookie(w, "helpdesk_csrf", csrf, false, 7200)
		s.clearTrackingCookies(w)
		web.JSON(w, result.Status, result.Body)
	})
	mux.HandleFunc("POST /api/v1/auth/register", func(w http.ResponseWriter, r *http.Request) {
		var in RegisterInput
		err := web.Decode(w, r, &in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		nonce := web.Cookie(r, "helpdesk_login")
		if !validNonce(nonce, in.CSRF) || r.Header.Get("X-CSRF-Token") != nonce {
			web.WriteError(w, web.Fail(403, "Verifikasi CSRF pendaftaran gagal"))
			return
		}
		result, token, csrf, err := s.RegisterUser(r.Context(), in, nonce, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		s.cookie(w, "helpdesk_session", token, true, 7200)
		s.cookie(w, "helpdesk_csrf", csrf, false, 7200)
		s.clearTrackingCookies(w)
		web.JSON(w, result.Status, result.Body)
	})
	mux.HandleFunc("GET /api/v1/auth/me", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Me(r.Context(), Credentials(r))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, v)
	})
	mux.HandleFunc("POST /api/v1/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		var in Reason
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := s.Logout(r.Context(), Credentials(r), in, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		s.cookie(w, "helpdesk_session", "", true, -1)
		s.cookie(w, "helpdesk_csrf", "", false, -1)
		s.cookie(w, "helpdesk_login", "", true, -1)
		s.clearTrackingCookies(w)
		web.JSON(w, result.Status, result.Body)
	})
	s.registerReportingDirectory(mux)
	s.registerRolePolicies(mux)
	for _, kind := range []string{"organizations", "divisions", "teams", "memberships"} {
		mux.HandleFunc("GET /api/v1/admin/"+kind, func(w http.ResponseWriter, r *http.Request) {
			page, err := web.Pagination(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			value, err := s.List(r.Context(), Credentials(r), kind, page)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, value)
		})
		save := func(w http.ResponseWriter, r *http.Request) {
			var in MasterInput
			if err := web.Decode(w, r, &in); err != nil {
				web.WriteError(w, err)
				return
			}
			value, err := s.Save(r.Context(), Credentials(r), kind, r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, value.Status, value.Body)
		}
		mux.HandleFunc("POST /api/v1/admin/"+kind, save)
		mux.HandleFunc("PUT /api/v1/admin/"+kind+"/{id}", save)
	}

	// M0-11: System Administration & Recovery
	mux.HandleFunc("GET /api/v1/maintenance/status", func(w http.ResponseWriter, r *http.Request) {
		res, err := s.PublicMaintenanceStatus(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, res)
	})
	mux.HandleFunc("GET /api/v1/admin/maintenance", func(w http.ResponseWriter, r *http.Request) {
		res, err := s.ListMaintenanceOverview(r.Context(), Credentials(r), r.URL.Query().Get("organization_id"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, res)
	})
	mux.HandleFunc("POST /api/v1/admin/maintenance", func(w http.ResponseWriter, r *http.Request) {
		var in api.MaintenancePolicyInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.ConfigureMaintenance(r.Context(), Credentials(r), in, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 201, res)
	})

	mux.HandleFunc("GET /api/v1/admin/subjects", func(w http.ResponseWriter, r *http.Request) {
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		qInc := strings.TrimSpace(r.URL.Query().Get("include_inactive"))
		includeInactive := qInc == "1" || qInc == "true"
		items, err := s.AdminSubjects(r.Context(), Credentials(r), includeInactive, p.Limit)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{"items": items, "next_cursor": nil, "as_of": time.Now().UTC().Format(time.RFC3339)})
	})
	saveSubject := func(w http.ResponseWriter, r *http.Request) {
		var in api.SubjectWriteInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.SaveSubject(r.Context(), Credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, res.Status, res.Body)
	}
	mux.HandleFunc("POST /api/v1/admin/subjects", saveSubject)
	mux.HandleFunc("PUT /api/v1/admin/subjects/{id}", saveSubject)

	mux.HandleFunc("GET /api/v1/staff/directory", func(w http.ResponseWriter, r *http.Request) {
		items, err := s.ListStaffDirectory(r.Context(), Credentials(r), r.URL.Query().Get("organization_id"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /api/v1/admin/operations", func(w http.ResponseWriter, r *http.Request) {
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		items, err := s.ListSystemJobs(r.Context(), Credentials(r), p.Limit)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{"items": items, "next_cursor": nil, "as_of": time.Now().UTC().Format(time.RFC3339)})
	})

	mux.HandleFunc("POST /api/v1/admin/operations", func(w http.ResponseWriter, r *http.Request) {
		var in api.SystemJobInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.RequestSystemJob(r.Context(), Credentials(r), in, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Location", "/api/v1/admin/operations/"+res.ID)
		web.JSON(w, 202, res)
	})

	mux.HandleFunc("GET /api/v1/admin/operations/{id}", func(w http.ResponseWriter, r *http.Request) {
		res, err := s.ReadSystemJob(r.Context(), Credentials(r), r.PathValue("id"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, res)
	})

	mux.HandleFunc("POST /api/v1/admin/operations/{id}/approve", func(w http.ResponseWriter, r *http.Request) {
		var in api.ApproveSystemJobInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.ApproveSystemJob(r.Context(), Credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, res)
	})

	mux.HandleFunc("POST /api/v1/admin/operations/{id}/execute", func(w http.ResponseWriter, r *http.Request) {
		var in api.ExecuteSystemJobInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.ExecuteSystemJob(r.Context(), Credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, res)
	})

	mux.HandleFunc("GET /api/v1/admin/operations/{id}/artifact", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		art, err := s.ReadSystemJobArtifact(r.Context(), Credentials(r), id)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="backup-manifest-`+id+`.json"`)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if art.SHA256 != "" {
			w.Header().Set("X-Manifest-SHA256", art.SHA256)
		}
		w.WriteHeader(200)
		_, _ = w.Write(art.Payload)
	})

	mux.HandleFunc("GET /api/v1/admin/health", func(w http.ResponseWriter, r *http.Request) {
		res, err := s.ReadRedactedHealth(r.Context(), Credentials(r))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, res)
	})

	mux.HandleFunc("POST /api/v1/admin/purge-requests", func(w http.ResponseWriter, r *http.Request) {
		var in api.PurgeRequestInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := s.RequestPurge(r.Context(), Credentials(r), in, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Location", "/api/v1/admin/operations/"+res.ID)
		web.JSON(w, 202, res)
	})
	// No redirect/return URL is accepted. Login navigation is fixed by the UI.
}
