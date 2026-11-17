package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (s Store) ReportingReferenceIDs(ctx context.Context) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text FROM identity.organizations WHERE reporting_reference`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

func (s Store) IsReportingReference(ctx context.Context, id string) (bool, error) {
	var yes bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM identity.organizations WHERE id=$1 AND reporting_reference)`, id).Scan(&yes)
	return yes, err
}

func (s Store) Divisions(ctx context.Context, orgs []string, p web.Page) ([]api.Division, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,organization_id::text,name,active
		FROM identity.divisions WHERE organization_id=ANY($1::uuid[]) AND ($2='' OR id::text>$2)
		ORDER BY id LIMIT $3`, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Division{}
	for rows.Next() {
		var v api.Division
		if err = rows.Scan(&v.ID, &v.Version, &v.OrganizationID, &v.Name, &v.Active); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func saveDivision(ctx context.Context, tx pgx.Tx, id, org string, create bool, in api.MasterInput) (int64, error) {
	if create {
		tag, err := tx.Exec(ctx, `INSERT INTO identity.divisions(id,organization_id,name,active)
			SELECT $1,id,$3,$4 FROM identity.organizations WHERE id=$2 AND active`, id, org, in.Name, in.Active)
		if err == nil && tag.RowsAffected() == 0 {
			err = web.Fail(422, "Perangkat daerah atau unit kerja tidak aktif")
		}
		return 1, err
	}
	var version int64
	err := tx.QueryRow(ctx, `UPDATE identity.divisions SET name=$1,active=$2,version=version+1,updated_at=now()
		WHERE id=$3 AND organization_id=$4 AND version=$5 RETURNING version`, in.Name, in.Active, id, org, in.ExpectedVersion).Scan(&version)
	if err == pgx.ErrNoRows {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT FROM identity.divisions WHERE id=$1 AND organization_id=$2)`, id, org).Scan(&exists); err != nil {
			return 0, err
		}
		if !exists {
			return 0, web.Fail(404, "Bidang tidak ditemukan")
		}
		return 0, web.Fail(409, "Versi bidang berubah")
	}
	return version, err
}

func (s Store) ReportingDirectory(ctx context.Context, orgs []string, authenticated bool, query string, p web.Page) ([]api.DirectoryEntry, error) {
	var rows pgx.Rows
	var err error
	if p.Organization == "" {
		rows, err = s.Pool.Query(ctx, `SELECT id::text,name FROM identity.organizations
			WHERE active AND (($1 AND id=ANY($2::uuid[])) OR (NOT $1 AND reporting_visible))
			AND ($3='' OR id::text>$3) AND strpos(lower(name),lower($4))>0
			ORDER BY id LIMIT $5`, authenticated, orgs, p.Cursor, query, p.Limit+1)
	} else {
		rows, err = s.Pool.Query(ctx, `SELECT d.id::text,d.name FROM identity.divisions d
			JOIN identity.organizations o ON o.id=d.organization_id
			WHERE d.active AND o.active AND o.id=$6
			AND (($1 AND o.id=ANY($2::uuid[])) OR (NOT $1 AND o.reporting_visible))
			AND ($3='' OR d.id::text>$3) AND strpos(lower(d.name),lower($4))>0
			ORDER BY d.id LIMIT $5`, authenticated, orgs, p.Cursor, query, p.Limit+1, p.Organization)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.DirectoryEntry{}
	for rows.Next() {
		var entry api.DirectoryEntry
		if err := rows.Scan(&entry.ID, &entry.Name); err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

func (s Store) ReportingContext(ctx context.Context, org, division string, verified bool) (api.ReportingContext, error) {
	result := api.ReportingContext{Verified: verified}
	var divisionName *string
	err := s.Pool.QueryRow(ctx, `SELECT o.id::text,o.name,d.name FROM identity.organizations o
		LEFT JOIN identity.divisions d ON d.organization_id=o.id AND d.id::text=$2 AND d.active
		WHERE o.id=$1 AND o.active AND ($3 OR o.reporting_visible) AND ($2='' OR d.id IS NOT NULL)`,
		org, division, verified).Scan(&result.Organization.ID, &result.Organization.Name, &divisionName)
	if err == pgx.ErrNoRows {
		return result, web.Fail(422, "Pilih perangkat daerah dan bidang aktif yang sesuai")
	}
	if err == nil && divisionName != nil {
		result.Division = &api.DirectoryEntry{ID: division, Name: *divisionName}
	}
	return result, err
}

func (s Store) RoutingDestination(ctx context.Context, team, org string) (string, error) {
	var name string
	err := s.Pool.QueryRow(ctx, `SELECT concat_ws(' — ',o.name,d.name,t.name) FROM identity.teams t
		JOIN identity.organizations o ON o.id=t.org_id LEFT JOIN identity.divisions d ON d.id=t.division_id AND d.active
		WHERE t.id=$1 AND o.id=$2 AND t.active AND o.active`, team, org).Scan(&name)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return name, err
}

func (s Store) HandoffTargets(ctx context.Context, from, to string, p web.Page) ([]api.DirectoryEntry, error) {
	var rows pgx.Rows
	var err error
	if to == "" {
		rows, err = s.Pool.Query(ctx, `SELECT o.id::text,o.name FROM identity.organizations o
			WHERE o.active AND o.id <> $1 AND ($2='' OR o.id::text>$2)
			AND EXISTS(SELECT FROM identity.teams t WHERE t.org_id=o.id AND t.active)
			ORDER BY o.id LIMIT $3`, from, p.Cursor, p.Limit+1)
	} else {
		rows, err = s.Pool.Query(ctx, `SELECT t.id::text,t.name FROM identity.teams t
			JOIN identity.organizations o ON o.id=t.org_id WHERE o.active AND t.active AND o.id<>$1
			AND o.id=$2 AND ($3='' OR t.id::text>$3) ORDER BY t.id LIMIT $4`, from, to, p.Cursor, p.Limit+1)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.DirectoryEntry{}
	for rows.Next() {
		var item api.DirectoryEntry
		if err := rows.Scan(&item.ID, &item.Name); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
