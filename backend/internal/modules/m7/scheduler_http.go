package m7

import (
	"context"
	"net/http"
	"strings"

	"helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (m *Module) RegisterScheduler(mux *http.ServeMux, authorize func(context.Context, string, string, string, bool) (string, error)) {
	const path = "/api/v1/tickets/{id}/scheduler-jobs/{job}"
	allowed := func(r *http.Request) (string, error) {
		if !web.UUID(r.PathValue("id")) || !web.UUID(r.PathValue("job")) {
			return "", web.Fail(404, "Job scheduler tidak ditemukan")
		}
		return authorize(r.Context(), r.PathValue("id"), web.Cookie(r, "helpdesk_session"), r.Header.Get("X-CSRF-Token"), r.Method == "POST")
	}
	mux.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) {
		if _, err := allowed(r); err != nil {
			web.WriteError(w, err)
			return
		}
		result, err := m.service.Store.JobStatus(r.Context(), r.PathValue("id"), r.PathValue("job"))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 200, result)
	})
	mux.HandleFunc("POST "+path+"/replay", func(w http.ResponseWriter, r *http.Request) {
		actor, err := allowed(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		var in api.ReplayRequest
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		in.Reason = strings.TrimSpace(in.Reason)
		key := r.Header.Get("Idempotency-Key")
		if len(key) < 16 || len(key) > 128 || in.ExpectedVersion < 1 || in.Reason == "" || len(in.Reason) > 500 {
			web.WriteError(w, web.Fail(422, "Key, versi job, dan alasan replay wajib diisi"))
			return
		}
		result, err := m.service.Store.Replay(r.Context(), r.PathValue("id"), r.PathValue("job"), actor, key, in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, 202, result)
	})
}
