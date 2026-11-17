package app

import (
	m1 "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
	"net/http"
)

func (h *Handler) scope(r *http.Request) api.Scope {
	if h.Identity == nil {
		return api.Scope{}
	}
	a, err := h.Identity.Authenticate(r.Context(), m1.Credentials{Token: web.Cookie(r, "helpdesk_session"), CSRF: r.Header.Get("X-CSRF-Token"), Write: r.Method != "GET" && r.Method != "HEAD"})
	if err != nil {
		return api.Scope{}
	}
	return Access(a)
}

func Access(a m1.Actor) api.Scope {
	s := api.Scope{Kind: a.Kind, Principal: a.ID, Orgs: a.Orgs(""), Read: a.Orgs("content.read"), Write: a.Orgs("content.write"), Publish: a.Orgs("content.publish"), MediaRead: a.Orgs("media.read"), MediaWrite: a.Orgs("media.write"), Reuse: a.Orgs("media.reuse"), HeroWrite: a.Orgs("hero.write"), HeroPublish: a.Orgs("hero.publish")}
	return s
}

func selectOrg(requested *string, allowed []string) (*string, error) {
	if requested == nil && len(allowed) == 1 {
		v := allowed[0]
		return &v, nil
	}
	if requested == nil || !api.Contains(allowed, *requested) {
		return nil, web.Fail(403, "Pilih organisasi sesuai mandat aktif")
	}
	v := *requested
	return &v, nil
}
