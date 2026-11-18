package app

import (
	"context"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	m1api "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
)

type IntakeMediaPort interface {
	ListMediaM3(ctx context.Context, token, csrf, capability string, limit int, cursor string, onlyClean bool, search, tracking string) ([]api.MediaItem, *string, error)
	GetMediaM3(ctx context.Context, token, csrf, capability, id, tracking string) (api.MediaItem, error)
	ListDrafts(ctx context.Context, token, csrf, capability string, limit int, cursor string) ([]api.DraftItem, *string, error)
	GetDraft(ctx context.Context, token, csrf, capability, id string) (api.DraftItem, error)
	SaveDraft(ctx context.Context, token, csrf, capability, id string, in api.DraftWriteInput) (api.DraftItem, error)
	DeleteDraft(ctx context.Context, token, csrf, capability, id string) error
	ReadBlob(storageKey string) ([]byte, error)
}

type IdentityPort interface {
	Authenticate(ctx context.Context, c m1api.Credentials) (m1api.Actor, error)
	Access(context.Context, string) (m1api.Actor, error)
}

type Handler struct {
	Service  *Service
	Intake   IntakeMediaPort
	Identity IdentityPort
	Origin   string
}

func NewHandler(svc *Service, intake IntakeMediaPort, identity IdentityPort, origin string) *Handler {
	return &Handler{
		Service:  svc,
		Intake:   intake,
		Identity: identity,
		Origin:   origin,
	}
}

func (h *Handler) actorSession(r *http.Request) (actorID, actorKind string, isStaff bool, perms []string) {
	tok := web.Cookie(r, "helpdesk_session")
	csrf := r.Header.Get("X-CSRF-Token")
	if tok != "" && h.Identity != nil {
		sess, err := h.Identity.Authenticate(r.Context(), m1api.Credentials{Token: tok, CSRF: csrf, Write: r.Method != "GET" && r.Method != "HEAD"})
		if err == nil {
			isStaff = false
			allPerms := []string{}
			for _, m := range sess.Memberships {
				if !m.OrganizationActive {
					continue
				}
				for _, p := range m.Permissions {
					allPerms = append(allPerms, p)
					if p == "ticket.verify" || p == "ticket.resolve" || p == "ticket.dispatch" || p == "content.write" || p == "content.publish" {
						isStaff = true
					}
				}
			}
			return sess.ID, sess.Kind, isStaff, allPerms
		}
	}

	return "ANONYMOUS", "ANONYMOUS", false, nil
}

func (h *Handler) actor(r *http.Request) (actorID string, isStaff bool, perms []string) {
	id, _, staff, p := h.actorSession(r)
	return id, staff, p
}

func determineAudience(actorKind string, isStaff bool) string {
	if isStaff {
		return "STAFF_ONLY"
	}
	switch actorKind {
	case "ASN":
		return "ASN_AUTH"
	case "PUBLIC":
		return "PUBLIC_AUTH"
	case "STAFF", "OPERATOR":
		return "STAFF_ONLY"
	default:
		return "PUBLIC_GUEST"
	}
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
	h.registerHero(m)
	handle := func(pattern string, fn http.HandlerFunc) {
		m.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if token := web.Cookie(r, "helpdesk_session"); token != "" {
				if h.Identity == nil {
					web.WriteError(w, web.Fail(401, "Identitas tidak tersedia"))
					return
				}
				if _, err := h.Identity.Authenticate(r.Context(), m1api.Credentials{Token: token, CSRF: r.Header.Get("X-CSRF-Token"), Write: r.Method != "GET" && r.Method != "HEAD"}); err != nil {
					web.WriteError(w, err)
					return
				}
			}
			fn(w, r)
		})
	}

	handle("GET /api/v1/media", func(w http.ResponseWriter, r *http.Request) {
		owner := r.URL.Query().Get("owner")
		status := r.URL.Query().Get("status")
		search := strings.TrimSpace(r.URL.Query().Get("q"))
		if (status != "" && status != "CLEAN") || utf8.RuneCountInString(search) > 100 {
			web.WriteError(w, web.Fail(400, "Filter media tidak valid"))
			return
		}
		onlyClean := status == "CLEAN"
		w.Header().Set("Cache-Control", "no-store")
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}

		tok := web.Cookie(r, "helpdesk_session")
		csrf := r.Header.Get("X-CSRF-Token")
		cap := r.Header.Get("X-Guest-Capability")

		if owner == "M3" {
			if h.Intake == nil {
				web.WriteError(w, web.Fail(503, "Intake service tidak tersedia"))
				return
			}
			items, next, err := h.Intake.ListMediaM3(r.Context(), tok, csrf, cap, p.Limit, p.Cursor, onlyClean, search, web.Cookie(r, "helpdesk_tracking"))
			if err != nil {
				web.WriteError(w, err)
				return
			}
			if items == nil {
				items = []api.MediaItem{}
			}
			resp := map[string]any{
				"items":       items,
				"next_cursor": next,
				"as_of":       time.Now().UTC().Format(time.RFC3339),
			}
			web.JSON(w, 200, resp)
			return
		}

		actorID, isStaff, _ := h.actor(r)
		items, next, err := h.Service.ListMedia(r.Context(), actorID, isStaff, p.Limit, p.Cursor, onlyClean, search, h.scope(r))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if items == nil {
			items = []api.MediaItem{}
		}
		resp := map[string]any{
			"items":       items,
			"next_cursor": next,
			"as_of":       time.Now().UTC().Format(time.RFC3339),
		}
		web.JSON(w, 200, resp)
	})

	handle("POST /api/v1/media", func(w http.ResponseWriter, r *http.Request) {
		actorID, _, _ := h.actor(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi sesi diperlukan untuk unggahan editorial"))
			return
		}
		var in api.MediaUploadInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		scope := h.scope(r)
		var err error
		in.OrgID, err = selectOrg(in.OrgID, scope.MediaWrite)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if in.HeroCandidate && (*in.OrgID != api.HeroOrganization || !api.Contains(scope.HeroWrite, *in.OrgID)) {
			web.WriteError(w, web.Fail(403, "Mandat editorial Banner Hero diperlukan"))
			return
		}
		item, err := h.Service.UploadMedia(r.Context(), actorID, in, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 201, item)
	})

	handle("PUT /api/v1/media/{id}/content", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		scope := h.scope(r)
		if scope.Principal == "" {
			web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
			return
		}
		existing, err := h.Service.GetMedia(r.Context(), id)
		if err == nil && existing.OrgID == nil && existing.PrincipalID == scope.Principal && len(scope.MediaWrite) == 1 {
			if err = h.Service.Store.BindLegacyMedia(r.Context(), id, scope.Principal, scope.MediaWrite[0]); err == nil {
				existing, err = h.Service.GetMedia(r.Context(), id)
			}
		}
		if err != nil || !scope.WriteMedia(existing) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 10485760)
		item, err := h.Service.StoreQuarantineBlob(r.Context(), id, r.Body)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, item)
	})

	downloadBlobHandler := func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}

		// Try M8 first
		item, err := h.Service.GetMedia(r.Context(), id)
		if err == nil {
			if !h.scope(r).ReadMedia(item) {
				// Published content references use the same live audience scope.
				visible, err := h.Service.Store.MediaVisibleInContent(r.Context(), id, h.scope(r).Audiences(), h.scope(r))
				if err != nil || !visible {
					web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
					return
				}
			}

			data, item, err := h.Service.DownloadCleanBlob(r.Context(), id)
			if err != nil {
				web.WriteError(w, err)
				return
			}

			w.Header().Set("Content-Type", item.MIME)
			w.Header().Set("Content-Length", strconv.Itoa(len(data)))
			w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": id}))
			w.WriteHeader(200)
			_, _ = w.Write(data)
			return
		}

		// Try M3 fallback
		if h.Intake != nil {
			tok := web.Cookie(r, "helpdesk_session")
			csrf := r.Header.Get("X-CSRF-Token")
			cap := r.Header.Get("X-Guest-Capability")
			m3Item, m3Err := h.Intake.GetMediaM3(r.Context(), tok, csrf, cap, id, web.Cookie(r, "helpdesk_tracking"))
			if m3Err == nil {
				if m3Item.Status != "CLEAN" {
					web.WriteError(w, web.Fail(403, "Berkas belum berstatus CLEAN atau berada di karantina"))
					return
				}
				blobData, readErr := h.Intake.ReadBlob(m3Item.StorageKey)
				if readErr == nil {
					w.Header().Set("Content-Type", m3Item.MIME)
					w.Header().Set("Content-Length", strconv.Itoa(len(blobData)))
					w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": id}))
					w.WriteHeader(200)
					_, _ = w.Write(blobData)
					return
				}
			}
		}

		web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
	}

	handle("GET /api/v1/media/{id}/content", downloadBlobHandler)
	handle("GET /api/v1/media/{id}/download", downloadBlobHandler)

	handle("POST /api/v1/media/{id}/reuse", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		actorID, _, perms := h.actor(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
			return
		}
		if !h.hasPerm(perms, "media.reuse") {
			web.WriteError(w, web.Fail(403, "Izin media.reuse diperlukan"))
			return
		}

		var in api.ReuseMediaInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}

		// Find source item from M8 or M3
		var sourceItem api.MediaItem
		var found bool

		itemM8, errM8 := h.Service.GetMedia(r.Context(), id)
		if errM8 == nil {
			if !h.scope(r).ReadMedia(itemM8) {
				web.WriteError(w, web.Fail(404, "Media sumber tidak ditemukan"))
				return
			}
			sourceItem = itemM8
			found = true
		} else if h.Intake != nil {
			tok := web.Cookie(r, "helpdesk_session")
			csrf := r.Header.Get("X-CSRF-Token")
			cap := r.Header.Get("X-Guest-Capability")
			itemM3, errM3 := h.Intake.GetMediaM3(r.Context(), tok, csrf, cap, id, web.Cookie(r, "helpdesk_tracking"))
			if errM3 == nil {
				sourceItem = itemM3
				found = true
			}
		}

		if !found {
			web.WriteError(w, web.Fail(404, "Media sumber tidak ditemukan"))
			return
		}

		if in.ApprovalID == nil || !web.UUID(*in.ApprovalID) {
			web.WriteError(w, web.Fail(403, "Approval server diperlukan"))
			return
		}
		approver, org, err := h.Service.Store.ApprovalAuthority(r.Context(), *in.ApprovalID)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		live, err := h.Identity.Access(r.Context(), approver)
		authorizedReviewer := live.Can("content.publish", org)
		if sourceItem.Owner == "M3" {
			authorizedReviewer = live.Can("ticket.read", org) && live.Can("media.reuse", org)
		}
		if err != nil || !authorizedReviewer {
			web.WriteError(w, web.Fail(403, "Mandat pemberi approval tidak lagi aktif"))
			return
		}
		result, err := h.Service.ReuseMedia(r.Context(), actorID, sourceItem, in, h.scope(r), r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, result.Status, result.Body)
	})

	handle("GET /api/v1/media/approvals", func(w http.ResponseWriter, r *http.Request) {
		scope := h.scope(r)
		orgs := append([]string{}, scope.Publish...)
		for _, o := range scope.Reuse {
			if !api.Contains(orgs, o) {
				orgs = append(orgs, o)
			}
		}
		if len(orgs) == 0 {
			web.WriteError(w, web.Fail(403, "Izin penerbit atau reuse media diperlukan"))
			return
		}
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		items, err := h.Service.Store.ListApprovals(r.Context(), orgs, p.Limit)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{"items": items})
	})

	handle("POST /api/v1/media/{id}/approvals", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		scope := h.scope(r)
		if len(scope.Publish) == 0 && len(scope.Reuse) == 0 {
			web.WriteError(w, web.Fail(403, "Izin penerbit diperlukan"))
			return
		}
		var in api.MediaApprovalInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		source, err := h.Service.GetMedia(r.Context(), id)
		if err == nil && !scope.ReadMedia(source) {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		if err != nil && h.Intake != nil {
			source, err = h.Intake.GetMediaM3(r.Context(), web.Cookie(r, "helpdesk_session"), r.Header.Get("X-CSRF-Token"), r.Header.Get("X-Guest-Capability"), id, web.Cookie(r, "helpdesk_tracking"))
		}
		if err != nil {
			web.WriteError(w, web.Fail(404, "Media tidak ditemukan"))
			return
		}
		if source.Owner == "M3" {
			actor, authErr := h.Identity.Authenticate(r.Context(), m1api.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: true})
			if authErr != nil || source.OrgID == nil || !actor.Can("ticket.read", *source.OrgID) || !actor.Can("media.reuse", *source.OrgID) {
				web.WriteError(w, web.Fail(403, "Mandat sumber tiket dan media.reuse satu organisasi diperlukan"))
				return
			}
			scope.Publish = []string{*source.OrgID}
		} else if len(scope.Publish) == 0 {
			web.WriteError(w, web.Fail(403, "Izin penerbit diperlukan"))
			return
		}
		result, err := h.Service.ApproveMedia(r.Context(), source, in, scope, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, result.Status, result.Body)
	})

	handle("POST /api/v1/media/approvals/{id}/revoke", func(w http.ResponseWriter, r *http.Request) {
		scope := h.scope(r)
		if len(scope.Publish) == 0 {
			web.WriteError(w, web.Fail(403, "Izin penerbit diperlukan"))
			return
		}
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Approval tidak ditemukan"))
			return
		}
		var in struct {
			ExpectedVersion int64  `json:"expected_version"`
			Reason          string `json:"reason"`
		}
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		if in.ExpectedVersion < 1 || len(in.Reason) < 5 || len(in.Reason) > 2000 {
			web.WriteError(w, web.Fail(422, "Versi dan alasan pencabutan wajib valid"))
			return
		}
		result, err := h.Service.Store.RevokeApproval(r.Context(), id, scope, in.ExpectedVersion, in.Reason, r.Header.Get("Idempotency-Key"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, result.Status, result.Body)
	})

	handle("GET /api/v1/drafts", func(w http.ResponseWriter, r *http.Request) {
		owner := r.URL.Query().Get("owner")
		p, err := web.Pagination(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		tok := web.Cookie(r, "helpdesk_session")
		csrf := r.Header.Get("X-CSRF-Token")
		cap := r.Header.Get("X-Guest-Capability")

		if owner == "M8" {
			actorID, _, _ := h.actor(r)
			if actorID == "ANONYMOUS" {
				web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
				return
			}
			items, next, err := h.Service.ListDrafts(r.Context(), actorID, p.Limit, p.Cursor)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, map[string]any{"items": items, "next_cursor": next, "as_of": time.Now().UTC().Format(time.RFC3339)})
			return
		}

		// Default to M3 ticket drafts
		if h.Intake == nil {
			web.WriteError(w, web.Fail(503, "Intake service tidak tersedia"))
			return
		}
		items, next, err := h.Intake.ListDrafts(r.Context(), tok, csrf, cap, p.Limit, p.Cursor)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, map[string]any{"items": items, "next_cursor": next, "as_of": time.Now().UTC().Format(time.RFC3339)})
	})

	handle("GET /api/v1/drafts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Draft tidak ditemukan"))
			return
		}
		tok := web.Cookie(r, "helpdesk_session")
		csrf := r.Header.Get("X-CSRF-Token")
		cap := r.Header.Get("X-Guest-Capability")

		if h.Intake != nil {
			item, err := h.Intake.GetDraft(r.Context(), tok, csrf, cap, id)
			if err == nil {
				web.JSON(w, 200, item)
				return
			}
		}

		actorID, _, _ := h.actor(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
			return
		}
		item, err := h.Service.GetDraft(r.Context(), id, actorID)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, item)
	})

	handle("PUT /api/v1/drafts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Draft tidak ditemukan"))
			return
		}
		owner := r.URL.Query().Get("owner")
		var in api.DraftWriteInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}

		tok := web.Cookie(r, "helpdesk_session")
		csrf := r.Header.Get("X-CSRF-Token")
		cap := r.Header.Get("X-Guest-Capability")

		if owner == "M8" {
			actorID, _, _ := h.actor(r)
			if actorID == "ANONYMOUS" {
				web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
				return
			}
			item, err := h.Service.SaveDraft(r.Context(), id, actorID, in)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, item)
			return
		}

		// Default to M3 ticket drafts
		if h.Intake == nil {
			web.WriteError(w, web.Fail(503, "Intake service tidak tersedia"))
			return
		}
		item, err := h.Intake.SaveDraft(r.Context(), tok, csrf, cap, id, in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, item)
	})

	handle("DELETE /api/v1/drafts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !web.UUID(id) {
			web.WriteError(w, web.Fail(404, "Draft tidak ditemukan"))
			return
		}
		tok := web.Cookie(r, "helpdesk_session")
		csrf := r.Header.Get("X-CSRF-Token")
		cap := r.Header.Get("X-Guest-Capability")

		if h.Intake != nil {
			err := h.Intake.DeleteDraft(r.Context(), tok, csrf, cap, id)
			if err == nil {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		actorID, _, _ := h.actor(r)
		if actorID == "ANONYMOUS" {
			web.WriteError(w, web.Fail(401, "Autentikasi diperlukan"))
			return
		}
		err := h.Service.DeleteDraft(r.Context(), id, actorID)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	registerContentEndpoints := func(basePath, kind string) {
		readScope := func(r *http.Request) (api.Scope, error) {
			scope := h.scope(r)
			switch r.URL.Query().Get("view") {
			case "":
			case "published":
				scope.Read = nil
			default:
				return scope, web.Fail(400, "Tampilan editorial tidak valid")
			}
			return scope, nil
		}
		handle("GET "+basePath, func(w http.ResponseWriter, r *http.Request) {
			p, err := web.Pagination(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			_, actorKind, isStaff, perms := h.actorSession(r)
			canStaffView := isStaff && (h.hasPerm(perms, "content.read") || h.hasPerm(perms, "content.write"))
			aud := determineAudience(actorKind, canStaffView)

			scope, err := readScope(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			query := strings.TrimSpace(r.URL.Query().Get("q"))
			if utf8.RuneCountInString(query) > 100 {
				web.WriteError(w, web.Fail(400, "Pencarian maksimal 100 karakter"))
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			items, next, err := h.Service.ListContent(r.Context(), kind, aud, canStaffView, p.Limit, p.Cursor, query, scope)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, map[string]any{
				"items":       items,
				"next_cursor": next,
				"as_of":       time.Now().UTC(),
			})
		})

		handle("GET "+basePath+"/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := r.PathValue("id")
			_, actorKind, isStaff, perms := h.actorSession(r)
			canStaffView := isStaff && (h.hasPerm(perms, "content.read") || h.hasPerm(perms, "content.write"))
			aud := determineAudience(actorKind, canStaffView)

			scope, err := readScope(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			item, err := h.Service.GetContent(r.Context(), id, aud, canStaffView, scope)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			if item.Kind != kind {
				web.WriteError(w, web.Fail(404, "Konten tidak ditemukan"))
				return
			}
			web.JSON(w, 200, item)
		})

		handle("POST "+basePath, func(w http.ResponseWriter, r *http.Request) {
			actorID, _, _, perms := h.actorSession(r)
			if !h.hasPerm(perms, "content.write") {
				web.WriteError(w, web.Fail(403, "Izin content.write diperlukan"))
				return
			}
			var in api.ContentWriteInput
			if err := web.Decode(w, r, &in); err != nil {
				web.WriteError(w, err)
				return
			}
			scope := h.scope(r)
			var err error
			in.OrgID, err = selectOrg(in.OrgID, scope.Write)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			item, err := h.Service.CreateContent(r.Context(), actorID, kind, in)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 201, item)
		})

		handle("PUT "+basePath+"/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := r.PathValue("id")
			actorID, _, _, perms := h.actorSession(r)
			if !h.hasPerm(perms, "content.write") {
				web.WriteError(w, web.Fail(403, "Izin content.write diperlukan"))
				return
			}
			var in api.ContentWriteInput
			if err := web.Decode(w, r, &in); err != nil {
				web.WriteError(w, err)
				return
			}
			scope := h.scope(r)
			current, err := h.Service.GetContent(r.Context(), id, "STAFF_ONLY", true, scope)
			if err != nil || !scope.WriteContent(current, false) {
				web.WriteError(w, web.Fail(404, "Konten tidak ditemukan"))
				return
			}
			if in.OrgID == nil {
				in.OrgID = current.OrgID
			}
			if in.OrgID != nil && !api.Contains(scope.Write, *in.OrgID) {
				web.WriteError(w, web.Fail(403, "Organisasi tujuan tidak diizinkan"))
				return
			}
			item, err := h.Service.UpdateContent(r.Context(), id, in, actorID, scope)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, item)
		})

		handle("POST "+basePath+"/{id}/transitions", func(w http.ResponseWriter, r *http.Request) {
			id := r.PathValue("id")
			actorID, _, _, perms := h.actorSession(r)
			var in api.EditorialTransitionInput
			if err := web.Decode(w, r, &in); err != nil {
				web.WriteError(w, err)
				return
			}
			if in.Action == "PUBLISH" || in.Action == "ARCHIVE" || in.Action == "RESTORE" {
				if !h.hasPerm(perms, "content.publish") {
					web.WriteError(w, web.Fail(403, "Izin content.publish diperlukan untuk mengubah status publikasi konten"))
					return
				}
			} else {
				if !h.hasPerm(perms, "content.write") {
					web.WriteError(w, web.Fail(403, "Izin content.write diperlukan"))
					return
				}
			}
			item, err := h.Service.TransitionContent(r.Context(), id, in, actorID, h.hasPerm(perms, "content.publish"), h.scope(r))
			if err != nil {
				web.WriteError(w, err)
				return
			}
			web.JSON(w, 200, item)
		})
	}

	registerContentEndpoints("/api/v1/knowledge/articles", "ARTICLE")
	registerContentEndpoints("/api/v1/portal/pages", "PAGE")
	registerContentEndpoints("/api/v1/knowledge/faqs", "FAQ")
}

func allowedAudience(kind string, staff bool) []string {
	if staff || kind == "STAFF" {
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY"}
	}
	if kind == "ASN" {
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH"}
	}
	if kind == "PUBLIC" {
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH"}
	}
	return []string{"PUBLIC_GUEST"}
}
