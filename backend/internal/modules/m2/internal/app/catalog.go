package app

import (
	"context"
	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/modules/m2/internal/domain"
	"helpdesk.local/m0/internal/modules/m2/internal/store"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type Service struct {
	Store    store.Store
	Identity identity.Port
}

func (s *Service) actor(ctx context.Context, c identity.Credentials, required bool) (identity.Actor, error) {
	if c.Token == "" && !required {
		return identity.Actor{Kind: "GUEST", Memberships: []identity.Membership{}}, nil
	}
	return s.Identity.Authenticate(ctx, c)
}
func (s *Service) List(ctx context.Context, c identity.Credentials, admin bool, p web.Page) (any, error) {
	actor, err := s.actor(ctx, c, admin)
	if err != nil {
		return nil, err
	}
	orgs := actor.Orgs("catalog.write")
	if admin && len(orgs) == 0 {
		return nil, web.Fail(403, "Master katalog tidak diizinkan")
	}
	v, err := s.Store.Services(ctx, admin, orgs, actor.Kind, actor.Orgs(""), p)
	if err != nil {
		return nil, err
	}
	return web.List(v, p.Limit, func(v api.Service) string { return v.ID }), nil
}
func (s *Service) Read(ctx context.Context, c identity.Credentials, id string, admin bool) (api.Service, error) {
	if !web.UUID(id) {
		return api.Service{}, web.Fail(404, "Layanan tidak ditemukan")
	}
	actor, err := s.actor(ctx, c, admin)
	if err != nil {
		return api.Service{}, err
	}
	return s.Store.Service(ctx, id, admin, actor.Orgs("catalog.write"), actor.Kind, actor.Orgs(""))
}
func (s *Service) Form(ctx context.Context, c identity.Credentials, id string, version int64, admin bool) (api.Form, error) {
	v, err := s.Read(ctx, c, id, admin)
	if err != nil {
		return api.Form{}, err
	}
	return s.Store.Form(ctx, id, version, v.Version)
}
func (s *Service) Policy(ctx context.Context, c identity.Credentials, id string, admin bool) (api.Policy, error) {
	v, err := s.Read(ctx, c, id, admin)
	if err != nil {
		return api.Policy{}, err
	}
	return s.Store.Policy(ctx, id, v.Version)
}
func (s *Service) Categories(ctx context.Context, c identity.Credentials, p web.Page) (any, error) {
	actor, err := s.actor(ctx, c, true)
	if err != nil {
		return nil, err
	}
	orgs := actor.Orgs("catalog.write")
	if p.Organization != "" {
		if !actor.Can("catalog.write", p.Organization) {
			return nil, web.Fail(404, "Scope kategori tidak ditemukan")
		}
		orgs = []string{p.Organization}
	}
	if len(orgs) == 0 {
		return nil, web.Fail(403, "Kategori tidak diizinkan")
	}
	v, err := s.Store.Categories(ctx, orgs, p)
	return web.List(v, p.Limit, func(v api.Category) string { return v.ID }), err
}
func (s *Service) writable(ctx context.Context, c identity.Credentials, org string) (identity.Actor, error) {
	c.Write = true
	actor, err := s.actor(ctx, c, true)
	if err != nil {
		return actor, err
	}
	if !web.UUID(org) || !actor.Can("catalog.write", org) {
		return actor, web.Fail(404, "Scope katalog tidak ditemukan")
	}
	active, err := s.Identity.OrganizationActive(ctx, org)
	if err != nil {
		return actor, err
	}
	if !active {
		return actor, web.Fail(422, "Organisasi nonaktif")
	}
	return actor, nil
}
func (s *Service) SaveService(ctx context.Context, c identity.Credentials, id, key string, in api.ServiceInput) (database.Result, error) {
	actor, err := s.writable(ctx, c, in.OwnerOrgID)
	if err != nil {
		return database.Result{}, err
	}
	create := id == ""
	if !create && in.ExpectedVersion < 1 {
		return database.Result{}, web.Fail(422, "Expected version diperlukan")
	}
	cmd, target, status := "UpdateService", id, 200
	if create {
		cmd, target, status = "CreateService", "new", 201
		id = web.ID()
		if in.FormVersion != 1 {
			return database.Result{}, web.Fail(422, "Layanan baru memakai form versi 1")
		}
	} else {
		old, e := s.Read(ctx, c, id, true)
		if e != nil {
			return database.Result{}, e
		}
		if old.OwnerOrgID != in.OwnerOrgID {
			return database.Result{}, web.Fail(404, "Layanan tidak ditemukan")
		}
		if in.FormVersion != old.FormVersion {
			return database.Result{}, web.Fail(409, "Gunakan operasi versi formulir")
		}
	}
	if !domain.ValidMaster(in.Code, in.Name) || !domain.ValidMode(in.AccessMode) || (in.CategoryID != nil && !web.UUID(*in.CategoryID)) {
		return database.Result{}, web.Fail(422, "Kode, nama, kategori atau access_mode tidak valid")
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M2", Actor: actor.ID, Command: cmd, Target: target, Key: key, Scope: in.OwnerOrgID, Reason: "Master layanan", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		v, e := s.Store.SaveService(ctx, tx, id, create, in)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(status, v)
	})
}
func (s *Service) SaveCategory(ctx context.Context, c identity.Credentials, id, key string, in api.CategoryInput) (database.Result, error) {
	actor, err := s.writable(ctx, c, in.OwnerOrgID)
	if err != nil {
		return database.Result{}, err
	}
	if !domain.ValidMaster(in.Code, in.Name) {
		return database.Result{}, web.Fail(422, "Kode atau nama kategori tidak valid")
	}
	create := id == ""
	if !create {
		if !web.UUID(id) {
			return database.Result{}, web.Fail(404, "Kategori tidak ditemukan")
		}
		existing, e := s.Store.CategoryOrganization(ctx, id)
		if e != nil {
			return database.Result{}, e
		}
		if existing != in.OwnerOrgID {
			return database.Result{}, web.Fail(404, "Kategori tidak ditemukan")
		}
		if in.ExpectedVersion < 1 {
			return database.Result{}, web.Fail(422, "Expected version diperlukan")
		}
	}
	cmd, target, status := "UpdateCategory", id, 200
	if create {
		cmd, target, status = "CreateCategory", "new", 201
		id = web.ID()
	} else if !web.UUID(id) {
		return database.Result{}, web.Fail(404, "Kategori tidak ditemukan")
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M2", Actor: actor.ID, Command: cmd, Target: target, Key: key, Scope: in.OwnerOrgID, Reason: "Master kategori", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		v, e := s.Store.SaveCategory(ctx, tx, id, create, in)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(status, v)
	})
}
func (s *Service) SaveForm(ctx context.Context, c identity.Credentials, id, key string, in api.FormInput) (database.Result, error) {
	v, err := s.Read(ctx, c, id, true)
	if err != nil {
		return database.Result{}, err
	}
	actor, err := s.writable(ctx, c, v.OwnerOrgID)
	if err != nil {
		return database.Result{}, err
	}
	if !domain.ValidFields(in.Fields) {
		return database.Result{}, web.Fail(422, "Field formulir tidak valid atau key duplikat")
	}
	if in.Fields == nil {
		in.Fields = []api.Field{}
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M2", Actor: actor.ID, Command: "UpdateServiceForm", Target: id, Key: key, Scope: v.OwnerOrgID, Reason: "Versi formulir", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		form, e := s.Store.SaveForm(ctx, tx, id, in)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, form)
	})
}
func (s *Service) SavePolicy(ctx context.Context, c identity.Credentials, id, key string, in api.PolicyInput) (database.Result, error) {
	v, err := s.Read(ctx, c, id, true)
	if err != nil {
		return database.Result{}, err
	}
	actor, err := s.writable(ctx, c, v.OwnerOrgID)
	if err != nil {
		return database.Result{}, err
	}
	if !domain.ValidPolicy(in) {
		return database.Result{}, web.Fail(422, "Batas unggah, MIME atau audience tidak valid")
	}
	for _, org := range in.AudienceOrgs {
		ok, e := s.Identity.OrganizationActive(ctx, org)
		if e != nil {
			return database.Result{}, e
		}
		if !ok {
			return database.Result{}, web.Fail(422, "Audience organisasi tidak aktif")
		}
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M2", Actor: actor.ID, Command: "UpdateServicePolicy", Target: id, Key: key, Scope: v.OwnerOrgID, Reason: "Versi policy", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		policy, e := s.Store.SavePolicy(ctx, tx, id, in)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, policy)
	})
}

func (s *Service) ConfigureNavigation(ctx context.Context, c identity.Credentials, in api.NavigationWriteInput) (api.Receipt, error) {
	if s.Identity == nil {
		return api.Receipt{}, web.Fail(503, "Layanan identitas tidak tersedia")
	}
	actor, err := s.Identity.Authenticate(ctx, c)
	if err != nil {
		return api.Receipt{}, err
	}
	hasWrite := false
	for _, m := range actor.Memberships {
		for _, p := range m.Permissions {
			if p == "catalog.write" {
				hasWrite = true
				break
			}
		}
	}
	if !hasWrite {
		return api.Receipt{}, web.Fail(403, "Izin catalog.write diperlukan untuk mengonfigurasi navigasi")
	}

	if !domain.ValidNavigation(in) {
		return api.Receipt{}, web.Fail(422, "Parameter navigasi portal tidak valid (rute aman wajib diawali /)")
	}

	return s.Store.ConfigureNavigation(ctx, in)
}

func (s *Service) ListNavigation(ctx context.Context, audience string) ([]api.NavigationItem, error) {
	return s.Store.ListNavigation(ctx, audience)
}

func (s *Service) SearchServices(ctx context.Context, query, kind string, orgs []string, limit int) ([]api.SearchHit, error) {
	return s.Store.SearchServices(ctx, query, kind, orgs, limit)
}
