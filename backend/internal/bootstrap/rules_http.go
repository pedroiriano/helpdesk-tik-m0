package bootstrap

import (
	"context"
	"net/http"
	"strings"

	m1 "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type ruleModule interface {
	ListRules(context.Context) ([]web.RuleView, error)
	ConfigureRule(context.Context, string, string, web.RuleWrite) (database.Result, error)
}

func sessionTokenFromRequest(r *http.Request) string {
	token := web.Cookie(r, "helpdesk_session")
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		token = strings.TrimPrefix(h, "Bearer ")
	}
	return token
}

func registerRuleRoutes(mux *http.ServeMux, idPort m1.Port, path string, mod ruleModule) {
	mux.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) {
		actor, err := idPort.Authenticate(r.Context(), m1.Credentials{Token: sessionTokenFromRequest(r)})
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if actor.Kind != "STAFF" || len(actor.Orgs("rules.write")) == 0 {
			web.WriteError(w, web.Fail(403, "Izin pengelolaan aturan (rules.write) diperlukan"))
			return
		}
		items, err := mod.ListRules(r.Context())
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST "+path, func(w http.ResponseWriter, r *http.Request) {
		actor, err := idPort.Authenticate(r.Context(), m1.Credentials{
			Token: sessionTokenFromRequest(r),
			CSRF:  r.Header.Get("X-CSRF-Token"),
			Write: true,
		})
		if err != nil {
			web.WriteError(w, err)
			return
		}
		if actor.Kind != "STAFF" || len(actor.Orgs("rules.write")) == 0 {
			web.WriteError(w, web.Fail(403, "Izin perubahan aturan (rules.write) diperlukan"))
			return
		}
		key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
		if len(key) < 16 || len(key) > 128 {
			web.WriteError(w, web.Fail(422, "Header Idempotency-Key 16-128 karakter wajib diisi"))
			return
		}
		var in web.RuleWrite
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		res, err := mod.ConfigureRule(r.Context(), actor.ID, key, in)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, res.Status, res.Body)
	})
}
