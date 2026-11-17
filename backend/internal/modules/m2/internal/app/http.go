package app

import (
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/platform/web"
	"net/http"
	"strconv"
)

func credentials(r *http.Request) identity.Credentials {
	return identity.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: r.Method != "GET" && r.Method != "HEAD"}
}
func (s *Service) Register(mux *http.ServeMux) {
	for _, admin := range []bool{false, true} {
		prefix := "/api/v1/catalog/services"
		if admin {
			prefix = "/api/v1/admin/services"
		}
		mux.HandleFunc("GET "+prefix, func(w http.ResponseWriter, r *http.Request) {
			p, err := web.Pagination(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			v, err := s.List(r.Context(), credentials(r), admin, p)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, v)
		})
		mux.HandleFunc("GET "+prefix+"/{id}", func(w http.ResponseWriter, r *http.Request) {
			v, err := s.Read(r.Context(), credentials(r), r.PathValue("id"), admin)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, v)
		})
		mux.HandleFunc("GET "+prefix+"/{id}/policy", func(w http.ResponseWriter, r *http.Request) {
			v, err := s.Policy(r.Context(), credentials(r), r.PathValue("id"), admin)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, v)
		})
		mux.HandleFunc("GET "+prefix+"/{id}/form", func(w http.ResponseWriter, r *http.Request) {
			var version int64
			var err error
			if q := r.URL.Query().Get("version"); q != "" {
				version, err = strconv.ParseInt(q, 10, 64)
				if err != nil || version < 1 {
					web.WriteError(w, web.Fail(400, "Versi formulir tidak valid"))
					return
				}
			}
			form, e := s.Form(r.Context(), credentials(r), r.PathValue("id"), version, admin)
			if e != nil {
				web.WriteError(w, e)
				return
			}
			web.JSON(w, 200, form)
		})
	}
	saveService := func(w http.ResponseWriter, r *http.Request) {
		var in api.ServiceInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		v, err := s.SaveService(r.Context(), credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, v.Status, v.Body)
	}
	mux.HandleFunc("POST /api/v1/admin/services", saveService)
	mux.HandleFunc("PUT /api/v1/admin/services/{id}", saveService)
	mux.HandleFunc("GET /api/v1/admin/categories", func(w http.ResponseWriter, r *http.Request) {
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		v, err := s.Categories(r.Context(), credentials(r), p)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, v)
	})
	saveCategory := func(w http.ResponseWriter, r *http.Request) {
		var in api.CategoryInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		v, err := s.SaveCategory(r.Context(), credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, v.Status, v.Body)
	}
	mux.HandleFunc("POST /api/v1/admin/categories", saveCategory)
	mux.HandleFunc("PUT /api/v1/admin/categories/{id}", saveCategory)
	mux.HandleFunc("PUT /api/v1/admin/services/{id}/form", func(w http.ResponseWriter, r *http.Request) {
		var in api.FormInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		v, err := s.SaveForm(r.Context(), credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, v.Status, v.Body)
	})
	mux.HandleFunc("PUT /api/v1/admin/services/{id}/policy", func(w http.ResponseWriter, r *http.Request) {
		var in api.PolicyInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		v, err := s.SavePolicy(r.Context(), credentials(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, v.Status, v.Body)
	})

	mux.HandleFunc("POST /api/v1/admin/navigation", func(w http.ResponseWriter, r *http.Request) {
		var in api.NavigationWriteInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		receipt, err := s.ConfigureNavigation(r.Context(), credentials(r), in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 201, receipt)
	})

	mux.HandleFunc("GET /api/v1/catalog/navigation", func(w http.ResponseWriter, r *http.Request) {
		aud := "PUBLIC_GUEST"
		if c := credentials(r); c.Token != "" && s.Identity != nil {
			actor, err := s.Identity.Authenticate(r.Context(), c)
			if err == nil {
				switch actor.Kind {
				case "ASN":
					aud = "ASN_AUTH"
				case "PUBLIC":
					aud = "PUBLIC_AUTH"
				case "STAFF", "OPERATOR":
					aud = "STAFF_ONLY"
				}
			}
		}
		items, err := s.ListNavigation(r.Context(), aud)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{
			"items": items,
		})
	})
}
