package app

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	m1 "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
)

var builtinHeroAssets = map[string]bool{
	"hero-01-bantuan-tik-terpadu-tanpa-teks.png":   true,
	"hero-02-tiket-layanan-tanpa-teks.png":         true,
	"hero-03-dukungan-kinerja-tanpa-teks.png":      true,
	"hero-04-layanan-terintegrasi-tanpa-teks.png":  true,
	"hero-05-pusat-panduan-mandiri-tanpa-teks.png": true,
}

func (h *Handler) heroActor(r *http.Request) (m1.Actor, error) {
	if h.Identity == nil {
		return m1.Actor{}, web.Fail(401, "Sesi petugas diperlukan")
	}
	a, err := h.Identity.Authenticate(r.Context(), m1.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: r.Method != http.MethodGet})
	if err != nil {
		return m1.Actor{}, err
	}
	if a.Kind != "STAFF" || (!a.Can("hero.write", api.HeroOrganization) && !a.Can("hero.publish", api.HeroOrganization)) {
		return m1.Actor{}, web.Fail(403, "Mandat pengelolaan Banner Hero diperlukan")
	}
	return a, nil
}

func validHero(in *api.HeroChange, publish bool) bool {
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 0 || utf8.RuneCountInString(in.Reason) < 5 || len(in.Reason) > 1000 {
		return false
	}
	if publish {
		return len(in.Banners) == 0
	}
	if len(in.Banners) != 5 {
		return false
	}
	for i := range in.Banners {
		b := &in.Banners[i]
		b.Title = strings.TrimSpace(b.Title)
		b.Alt = strings.TrimSpace(b.Alt)
		if b.Title == "" || b.Alt == "" || utf8.RuneCountInString(b.Title) > 100 || utf8.RuneCountInString(b.Alt) > 200 {
			return false
		}
		if b.MediaID == "" && !builtinHeroAssets[b.Asset] {
			return false
		}
		if b.MediaID != "" && (b.Asset != "" || !web.UUID(b.MediaID)) {
			return false
		}
	}
	return true
}

func (h *Handler) registerHero(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/portal/hero", func(w http.ResponseWriter, r *http.Request) {
		state, err := h.Service.Store.Hero(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if state.Published == nil {
			state.Published = []api.HeroBanner{}
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"version": state.PublishedVersion, "banners": state.Published})
	})
	mux.HandleFunc("GET /api/v1/portal/hero/media/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		version, err := strconv.ParseInt(r.URL.Query().Get("v"), 10, 64)
		if err != nil || version < 1 || !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Gambar banner tidak ditemukan"))
			return
		}
		key, mime, err := h.Service.Store.PublishedHeroMedia(r.Context(), id, version)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		body, err := h.Service.Files.Read(key)
		if err != nil {
			web.WriteError(w, web.Fail(404, "Gambar banner tidak tersedia"))
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", mime)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(body)
	})
	mux.HandleFunc("GET /api/v1/admin/hero", func(w http.ResponseWriter, r *http.Request) {
		if _, err := h.heroActor(r); err != nil {
			web.WriteError(w, err)
			return
		}
		state, err := h.Service.Store.Hero(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if state.Draft == nil {
			state.Draft = []api.HeroBanner{}
		}
		if state.Published == nil {
			state.Published = []api.HeroBanner{}
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, state)
	})
	mux.HandleFunc("GET /api/v1/admin/hero/media", func(w http.ResponseWriter, r *http.Request) {
		if _, err := h.heroActor(r); err != nil {
			web.WriteError(w, err)
			return
		}
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		items, err := h.Service.Store.HeroCandidates(r.Context(), p)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, web.List(items, p.Limit, func(m api.DirectoryMedia) string { return m.ID }))
	})
	write := func(publish bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			a, err := h.heroActor(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			permission := "hero.write"
			if publish {
				permission = "hero.publish"
			}
			if !a.Can(permission, api.HeroOrganization) {
				web.WriteError(w, web.Fail(403, "Tindakan banner tidak diizinkan"))
				return
			}
			var in api.HeroChange
			if err := web.Decode(w, r, &in); err != nil {
				web.WriteError(w, err)
				return
			}
			if !validHero(&in, publish) {
				web.WriteError(w, web.Fail(422, "Lima banner, gambar, judul, teks alternatif dan alasan harus valid"))
				return
			}
			out, err := h.Service.Store.ChangeHero(r.Context(), a.ID, in, publish, r.Header.Get("Idempotency-Key"))
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, out.Status, out.Body)
		}
	}
	mux.HandleFunc("PUT /api/v1/admin/hero", write(false))
	mux.HandleFunc("POST /api/v1/admin/hero/publish", write(true))
}
