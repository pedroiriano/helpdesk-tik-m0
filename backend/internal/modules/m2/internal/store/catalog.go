package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/platform/web"
)

type Store struct{ Pool *pgxpool.Pool }

func (s Store) CategoryOrganization(ctx context.Context, id string) (string, error) {
	var org string
	err := s.Pool.QueryRow(ctx, `SELECT owner_org_id::text FROM catalog.categories WHERE id=$1`, id).Scan(&org)
	if err == pgx.ErrNoRows {
		return org, web.Fail(404, "Kategori tidak ditemukan")
	}
	return org, err
}

const columns = `s.id::text,s.version,s.code,s.name,s.access_mode,s.owner_org_id::text,s.category_id::text,COALESCE((SELECT max(form_version) FROM catalog.service_forms f WHERE f.service_id=s.id),0),s.active`

// Scope and audience are SQL predicates BEFORE LIMIT, including direct detail reads.
const visible = `(($1 AND s.owner_org_id=ANY($2::uuid[])) OR (NOT $1 AND s.active AND (s.category_id IS NULL OR EXISTS(SELECT FROM catalog.categories c WHERE c.id=s.category_id AND c.active)) AND (s.access_mode='PUBLIC_GUEST' OR (s.access_mode='PUBLIC_AUTH' AND $3<>'GUEST') OR (s.access_mode IN ('ASN_AUTH','STAFF_ONLY') AND (($3='ASN' AND s.access_mode='ASN_AUTH') OR ($3='STAFF' AND s.access_mode='STAFF_ONLY')) AND (s.owner_org_id=ANY($4::uuid[]) OR EXISTS(SELECT FROM catalog.policies p WHERE p.service_id=s.id AND p.effective_at<=now() AND p.policy_version=(SELECT max(p2.policy_version) FROM catalog.policies p2 WHERE p2.service_id=s.id AND p2.effective_at<=now()) AND p.audience_org_ids && $4::uuid[]))))))`

func scanService(row pgx.Row) (api.Service, error) {
	var v api.Service
	err := row.Scan(&v.ID, &v.Version, &v.Code, &v.Name, &v.AccessMode, &v.OwnerOrgID, &v.CategoryID, &v.FormVersion, &v.Active)
	return v, err
}
func (s Store) Services(ctx context.Context, admin bool, writable []string, kind string, orgs []string, p web.Page) ([]api.Service, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+columns+` FROM catalog.services s WHERE `+visible+` AND ($5='' OR s.id::text>$5) ORDER BY s.id LIMIT $6`, admin, writable, kind, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Service{}
	for rows.Next() {
		v, e := scanService(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) Service(ctx context.Context, id string, admin bool, writable []string, kind string, orgs []string) (api.Service, error) {
	v, err := scanService(s.Pool.QueryRow(ctx, `SELECT `+columns+` FROM catalog.services s WHERE `+visible+` AND s.id=$5`, admin, writable, kind, orgs, id))
	if err == pgx.ErrNoRows {
		return v, web.Fail(404, "Layanan tidak ditemukan")
	}
	return v, err
}
func (s Store) Form(ctx context.Context, id string, version int64, serviceVersion int64) (api.Form, error) {
	var v api.Form
	var fields []byte
	err := s.Pool.QueryRow(ctx, `SELECT id::text,form_version,fields FROM catalog.service_forms WHERE service_id=$1 AND ($2::bigint=0 OR form_version=$2) ORDER BY form_version DESC LIMIT 1`, id, version).Scan(&v.ID, &v.FormVersion, &fields)
	if err == pgx.ErrNoRows {
		return v, web.Fail(404, "Versi formulir tidak ditemukan")
	}
	if err == nil {
		err = json.Unmarshal(fields, &v.Fields)
	}
	v.Version = serviceVersion
	return v, err
}
func (s Store) Policy(ctx context.Context, id string, serviceVersion int64) (api.Policy, error) {
	var v api.Policy
	err := s.Pool.QueryRow(ctx, `SELECT id::text,policy_version,upload_max_bytes,allowed_mime,audience_org_ids::text[] FROM catalog.policies WHERE service_id=$1 AND effective_at<=now() ORDER BY policy_version DESC LIMIT 1`, id).Scan(&v.ID, &v.PolicyVersion, &v.UploadMax, &v.AllowedMIME, &v.AudienceOrgs)
	v.Version = serviceVersion
	if err == pgx.ErrNoRows {
		return v, web.Fail(404, "Policy tidak ditemukan")
	}
	return v, err
}
func (s Store) Categories(ctx context.Context, orgs []string, p web.Page) ([]api.Category, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,code,name,owner_org_id::text,active FROM catalog.categories WHERE owner_org_id=ANY($1::uuid[]) AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Category{}
	for rows.Next() {
		var v api.Category
		if err = rows.Scan(&v.ID, &v.Version, &v.Code, &v.Name, &v.OwnerOrgID, &v.Active); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) SaveCategory(ctx context.Context, tx pgx.Tx, id string, create bool, in api.CategoryInput) (api.Category, error) {
	v := api.Category{ID: id, Version: 1, Code: in.Code, Name: in.Name, OwnerOrgID: in.OwnerOrgID, Active: in.Active}
	if create {
		_, err := tx.Exec(ctx, `INSERT INTO catalog.categories(id,code,name,owner_org_id,active) VALUES($1,$2,$3,$4,$5)`, id, in.Code, in.Name, in.OwnerOrgID, in.Active)
		return v, err
	}
	tag, err := tx.Exec(ctx, `UPDATE catalog.categories SET code=$1,name=$2,active=$3,version=version+1,updated_at=now() WHERE id=$4 AND owner_org_id=$5 AND version=$6`, in.Code, in.Name, in.Active, id, in.OwnerOrgID, in.ExpectedVersion)
	if err == nil && tag.RowsAffected() != 1 {
		err = web.Fail(409, "Kategori berubah atau tidak tersedia")
	}
	v.Version = in.ExpectedVersion + 1
	return v, err
}
func (s Store) SaveService(ctx context.Context, tx pgx.Tx, id string, create bool, in api.ServiceInput) (api.Service, error) {
	v := api.Service{ID: id, Version: 1, Code: in.Code, Name: in.Name, AccessMode: in.AccessMode, OwnerOrgID: in.OwnerOrgID, CategoryID: in.CategoryID, FormVersion: 1, Active: in.Active}
	if in.CategoryID != nil {
		var valid bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT FROM catalog.categories WHERE id=$1 AND owner_org_id=$2 AND active)`, *in.CategoryID, in.OwnerOrgID).Scan(&valid)
		if err != nil {
			return v, err
		}
		if !valid {
			return v, web.Fail(422, "Kategori harus aktif dan berada di OPD layanan")
		}
	}
	if create {
		_, err := tx.Exec(ctx, `INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id,active) VALUES($1,$2,$3,$4,$5,$6,$7)`, id, in.Code, in.Name, in.AccessMode, in.OwnerOrgID, in.CategoryID, in.Active)
		if err != nil {
			return v, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES($1,$2,1,'[]')`, web.ID(), id)
		if err != nil {
			return v, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES($1,$2,1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],$3,now())`, web.ID(), id, []string{in.OwnerOrgID})
		return v, err
	}
	tag, err := tx.Exec(ctx, `UPDATE catalog.services SET code=$1,name=$2,access_mode=$3,category_id=$4,active=$5,version=version+1,updated_at=now() WHERE id=$6 AND owner_org_id=$7 AND version=$8`, in.Code, in.Name, in.AccessMode, in.CategoryID, in.Active, id, in.OwnerOrgID, in.ExpectedVersion)
	if err == nil && tag.RowsAffected() != 1 {
		err = web.Fail(409, "Versi layanan berubah")
	}
	v.Version = in.ExpectedVersion + 1
	v.FormVersion = in.FormVersion
	return v, err
}
func (s Store) SaveForm(ctx context.Context, tx pgx.Tx, id string, in api.FormInput) (api.Form, error) {
	var version int64
	err := tx.QueryRow(ctx, `UPDATE catalog.services SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING version`, id, in.ExpectedVersion).Scan(&version)
	if err == pgx.ErrNoRows {
		return api.Form{}, web.Fail(409, "Versi layanan berubah")
	}
	if err != nil {
		return api.Form{}, err
	}
	var current int64
	err = tx.QueryRow(ctx, `SELECT COALESCE(max(form_version),0) FROM catalog.service_forms WHERE service_id=$1`, id).Scan(&current)
	if err != nil {
		return api.Form{}, err
	}
	if in.FormVersion != current+1 {
		return api.Form{}, web.Fail(409, "Form harus menggunakan versi berikutnya")
	}
	raw, _ := json.Marshal(in.Fields)
	formID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES($1,$2,$3,$4)`, formID, id, in.FormVersion, raw)
	return api.Form{ID: formID, Version: version, FormVersion: in.FormVersion, Fields: in.Fields}, err
}
func (s Store) SavePolicy(ctx context.Context, tx pgx.Tx, id string, in api.PolicyInput) (api.Policy, error) {
	var version int64
	err := tx.QueryRow(ctx, `UPDATE catalog.services SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING version`, id, in.ExpectedVersion).Scan(&version)
	if err == pgx.ErrNoRows {
		return api.Policy{}, web.Fail(409, "Versi layanan berubah")
	}
	if err != nil {
		return api.Policy{}, err
	}
	var current int64
	err = tx.QueryRow(ctx, `SELECT COALESCE(max(policy_version),0) FROM catalog.policies WHERE service_id=$1`, id).Scan(&current)
	if err != nil {
		return api.Policy{}, err
	}
	if in.PolicyVersion != current+1 {
		return api.Policy{}, web.Fail(409, "Policy harus menggunakan versi berikutnya")
	}
	policyID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES($1,$2,$3,$4,$5,$6,now())`, policyID, id, in.PolicyVersion, in.UploadMax, in.AllowedMIME, in.AudienceOrgs)
	return api.Policy{ID: policyID, Version: version, PolicyVersion: in.PolicyVersion, UploadMax: in.UploadMax, AllowedMIME: in.AllowedMIME, AudienceOrgs: in.AudienceOrgs}, err
}

func (s Store) ConfigureNavigation(ctx context.Context, in api.NavigationWriteInput) (api.Receipt, error) {
	id := web.ID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO catalog.portal_navigation(id, version, route, label, audience, position, feature_code, created_at, updated_at)
		VALUES($1, 1, $2, $3, $4, $5, 'PORTAL_NAV', now(), now())
	`, id, in.Route, in.Label, in.Audience, in.Position)
	if err != nil {
		return api.Receipt{}, err
	}
	return api.Receipt{ID: id, Version: 1}, nil
}

func (s Store) ListNavigation(ctx context.Context, audience string) ([]api.NavigationItem, error) {
	allowed := []string{"PUBLIC_GUEST"}
	switch audience {
	case "ASN_AUTH":
		allowed = []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH"}
	case "PUBLIC_AUTH":
		allowed = []string{"PUBLIC_GUEST", "PUBLIC_AUTH"}
	case "STAFF_ONLY":
		allowed = []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY"}
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id::text, version, route, label, audience, position, feature_code
		FROM catalog.portal_navigation
		WHERE audience = ANY($1)
		ORDER BY position ASC, id ASC
	`, allowed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]api.NavigationItem, 0)
	for rows.Next() {
		var it api.NavigationItem
		if err := rows.Scan(&it.ID, &it.Version, &it.Route, &it.Label, &it.Audience, &it.Position, &it.FeatureCode); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

func (s Store) SearchServices(ctx context.Context, query, kind string, orgs []string, limit int, after string) ([]api.SearchHit, error) {
	if limit <= 0 || limit > 101 {
		limit = 20
	}

	pattern := "%" + query + "%"
	rows, err := s.Pool.Query(ctx, `
		SELECT s.id::text, s.name, s.code
		FROM catalog.services s
		LEFT JOIN catalog.categories c ON c.id = s.category_id
		WHERE `+visible+`
		  AND (s.name ILIKE $5 OR s.code ILIKE $5 OR (c.name IS NOT NULL AND c.name ILIKE $5))
		AND (NULLIF($7,'')::uuid IS NULL OR s.id>NULLIF($7,'')::uuid)
		ORDER BY s.id ASC
		LIMIT $6
	`, false, []string{}, kind, orgs, pattern, limit, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := make([]api.SearchHit, 0)
	for rows.Next() {
		var id, name, code string
		if err := rows.Scan(&id, &name, &code); err != nil {
			return nil, err
		}
		hits = append(hits, api.SearchHit{
			ID:      id,
			Owner:   "M2",
			Kind:    "SERVICE",
			Title:   name,
			Snippet: "Kode Layanan: " + code,
		})
	}
	return hits, nil
}

func (s Store) ActiveCategories(ctx context.Context, org string) ([]api.Category, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,code,name,owner_org_id::text,active FROM catalog.categories WHERE owner_org_id=$1 AND active ORDER BY code,id`, org)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []api.Category{}
	for rows.Next() {
		var c api.Category
		if err := rows.Scan(&c.ID, &c.Version, &c.Code, &c.Name, &c.OwnerOrgID, &c.Active); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}
