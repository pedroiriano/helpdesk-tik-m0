package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

type Store struct{ Pool *pgxpool.Pool }

func (s Store) TeamOrganization(ctx context.Context, id string) (string, error) {
	var org string
	err := s.Pool.QueryRow(ctx, `SELECT org_id::text FROM identity.teams WHERE id=$1`, id).Scan(&org)
	if err == pgx.ErrNoRows {
		return org, web.Fail(404, "Tim tidak ditemukan")
	}
	return org, err
}

type Session struct {
	ID           string
	Version      int64
	Expires      time.Time
	CSRF         []byte
	Actor        api.Actor
	LabFixture   bool
	AuthProvider string
}

func (s Store) Session(ctx context.Context, hash []byte) (Session, error) {
	var v Session
	err := s.Pool.QueryRow(ctx, `SELECT x.id::text,x.version,x.expires_at,x.csrf_hash,u.id::text,u.display_name,u.kind,u.role_code,u.lab_fixture,u.auth_provider FROM identity.sessions x JOIN identity.subjects u ON u.id=x.subject_id WHERE x.token_hash=$1 AND x.revoked_at IS NULL AND x.expires_at>now() AND u.active`, hash).Scan(&v.ID, &v.Version, &v.Expires, &v.CSRF, &v.Actor.ID, &v.Actor.Name, &v.Actor.Kind, &v.Actor.Role, &v.LabFixture, &v.AuthProvider)
	if err == pgx.ErrNoRows {
		return v, web.Fail(401, "Sesi tidak tersedia atau sudah berakhir")
	}
	if err != nil {
		return v, err
	}
	v.Actor.Memberships, err = s.Memberships(ctx, v.Actor.ID)
	return v, err
}
func (s Store) Memberships(ctx context.Context, id string) ([]api.Membership, error) {
	rows, err := s.Pool.Query(ctx, `SELECT m.id::text,m.org_id::text,m.team_id::text,m.permissions,m.grant_ceiling,o.active FROM identity.memberships m JOIN identity.organizations o ON o.id=m.org_id LEFT JOIN identity.teams t ON t.id=m.team_id WHERE m.subject_id=$1 AND m.revoked_at IS NULL AND m.valid_until>now() AND (m.team_id IS NULL OR (t.active AND t.org_id=m.org_id)) ORDER BY m.id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Membership{}
	for rows.Next() {
		var m api.Membership
		if err = rows.Scan(&m.ID, &m.OrganizationID, &m.TeamID, &m.Permissions, &m.GrantCeiling, &m.OrganizationActive); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (s Store) Subject(ctx context.Context, id string) (api.Subject, error) {
	var u api.Subject
	err := s.Pool.QueryRow(ctx, `SELECT id::text,display_name,kind,role_code FROM identity.subjects WHERE id=$1 AND active`, id).Scan(&u.ID, &u.Name, &u.Kind, &u.Role)
	if err == pgx.ErrNoRows {
		return u, web.Fail(404, "Identitas tidak ditemukan")
	}
	return u, err
}

func (s Store) FindSubjectByIdentifier(ctx context.Context, identifier string) (api.Subject, string, error) {
	var u api.Subject
	var hash string
	err := s.Pool.QueryRow(ctx, `SELECT id::text,display_name,kind,role_code,COALESCE(password_hash,'') FROM identity.subjects WHERE (external_ref=$1 OR lower(btrim(email))=$1) AND active AND NOT lab_fixture`, identifier).Scan(&u.ID, &u.Name, &u.Kind, &u.Role, &hash)
	if err == pgx.ErrNoRows {
		return u, "", web.Fail(404, "Akun tidak ditemukan")
	}
	return u, hash, err
}

func (s Store) CreatePublicSubject(ctx context.Context, tx pgx.Tx, id, nik, name, email, phone, passwordHash string) error {
	_, err := tx.Exec(ctx, `INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,email,phone,password_hash,lab_fixture,active) VALUES($1,'PUBLIC',$2,$3,'PUBLIC',$4,$5,$6,false,true)`, id, nik, name, email, phone, passwordHash)
	if err != nil {
		return err
	}
	membershipID := web.ID()
	_, err = tx.Exec(ctx, `INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES($1,$2,'10000000-0000-4000-8000-000000000001','{}','{}',now()+interval '5 years')`, membershipID, id)
	return err
}
func (s Store) OrganizationActive(ctx context.Context, id string) (bool, error) {
	if !web.UUID(id) {
		return false, nil
	}
	var yes bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM identity.organizations WHERE id=$1 AND active)`, id).Scan(&yes)
	return yes, err
}
func (s Store) Organizations(ctx context.Context, orgs []string, p web.Page) ([]api.Organization, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,code,name,active,reporting_visible FROM identity.organizations WHERE id=ANY($1::uuid[]) AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Organization{}
	for rows.Next() {
		var v api.Organization
		if err = rows.Scan(&v.ID, &v.Version, &v.Code, &v.Name, &v.Active, &v.ReportingVisible); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) Teams(ctx context.Context, orgs []string, p web.Page) ([]api.Team, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,org_id::text,name,active,division_id::text FROM identity.teams WHERE org_id=ANY($1::uuid[]) AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Team{}
	for rows.Next() {
		var v api.Team
		if err = rows.Scan(&v.ID, &v.Version, &v.OrganizationID, &v.Name, &v.Active, &v.DivisionID); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) Bindings(ctx context.Context, orgs []string, p web.Page) ([]api.Binding, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,version,subject_id::text,org_id::text,team_id::text,permissions,to_char(valid_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),revoked_at IS NOT NULL FROM identity.memberships WHERE org_id=ANY($1::uuid[]) AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, orgs, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Binding{}
	for rows.Next() {
		var v api.Binding
		if err = rows.Scan(&v.ID, &v.Version, &v.SubjectID, &v.OrganizationID, &v.TeamID, &v.Permissions, &v.ExpiresAt, &v.Revoked); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s Store) Binding(ctx context.Context, id string) (api.Binding, error) {
	var v api.Binding
	err := s.Pool.QueryRow(ctx, `SELECT id::text,version,subject_id::text,org_id::text,team_id::text,permissions,to_char(valid_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),revoked_at IS NOT NULL FROM identity.memberships WHERE id=$1`, id).Scan(&v.ID, &v.Version, &v.SubjectID, &v.OrganizationID, &v.TeamID, &v.Permissions, &v.ExpiresAt, &v.Revoked)
	if err == pgx.ErrNoRows {
		return v, web.Fail(404, "Membership tidak ditemukan")
	}
	return v, err
}

func (s Store) CreateSession(ctx context.Context, tx pgx.Tx, id, subject string, hash, csrf []byte, expires time.Time) error {
	_, err := tx.Exec(ctx, `INSERT INTO identity.sessions(id,subject_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,$5)`, id, subject, hash, csrf, expires)
	return err
}
func (s Store) RevokeSession(ctx context.Context, tx pgx.Tx, id string, version int64) error {
	tag, err := tx.Exec(ctx, `UPDATE identity.sessions SET revoked_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND version=$2 AND revoked_at IS NULL`, id, version)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return web.Fail(409, "Versi sesi berubah")
	}
	return nil
}
func (s Store) SaveMaster(ctx context.Context, tx pgx.Tx, kind, id, org, actorID string, create bool, in api.MasterInput, expires time.Time, inherited api.Membership) (int64, error) {
	var tagRows int64
	var err error
	switch kind {
	case "organizations":
		if create {
			_, err = tx.Exec(ctx, `INSERT INTO identity.organizations(id,code,name,active,reporting_visible) VALUES($1,$2,$3,$4,coalesce($5,false))`, id, in.Code, in.Name, in.Active, in.ReportingVisible)
			if err == nil {
				m := inherited
				_, err = tx.Exec(ctx, `INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES($1,$2,$3,$4,$5,now()+interval '1 year')`, web.ID(), actorID, id, m.Permissions, m.GrantCeiling)
			}
			tagRows = 1
		} else {
			tag, e := tx.Exec(ctx, `UPDATE identity.organizations SET code=$1,name=$2,active=$3,reporting_visible=coalesce($6,reporting_visible),version=version+1,updated_at=now() WHERE id=$4 AND version=$5`, in.Code, in.Name, in.Active, id, in.ExpectedVersion, in.ReportingVisible)
			err = e
			tagRows = tag.RowsAffected()
		}
	case "divisions":
		return saveDivision(ctx, tx, id, org, create, in)
	case "teams":
		var active bool
		err = tx.QueryRow(ctx, `SELECT active FROM identity.organizations WHERE id=$1`, org).Scan(&active)
		if err != nil {
			return 0, err
		}
		if !active {
			return 0, web.Fail(422, "Organisasi nonaktif")
		}
		if in.DivisionID != nil && *in.DivisionID != "" {
			var valid bool
			if !web.UUID(*in.DivisionID) {
				return 0, web.Fail(422, "Bidang tim tidak valid")
			}
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT FROM identity.divisions WHERE id=$1 AND organization_id=$2 AND active)`, *in.DivisionID, org).Scan(&valid); err != nil {
				return 0, err
			}
			if !valid {
				return 0, web.Fail(422, "Pilih bidang aktif pada organisasi tim")
			}
		}
		if create {
			_, err = tx.Exec(ctx, `INSERT INTO identity.teams(id,org_id,name,active,division_id) VALUES($1,$2,$3,$4,nullif($5::text,'')::uuid)`, id, org, in.Name, in.Active, in.DivisionID)
			tagRows = 1
		} else {
			tag, e := tx.Exec(ctx, `UPDATE identity.teams SET name=$1,active=$2,division_id=CASE WHEN $6::text IS NULL THEN division_id ELSE nullif($6,'')::uuid END,version=version+1,updated_at=now() WHERE id=$3 AND org_id=$4 AND version=$5`, in.Name, in.Active, id, org, in.ExpectedVersion, in.DivisionID)
			err = e
			tagRows = tag.RowsAffected()
		}
	case "memberships":
		if in.TeamID != nil {
			if !web.UUID(*in.TeamID) {
				return 0, web.Fail(422, "Tim tidak valid")
			}
			var valid bool
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT FROM identity.teams WHERE id=$1 AND org_id=$2 AND active)`, *in.TeamID, org).Scan(&valid)
			if err != nil {
				return 0, err
			}
			if !valid {
				return 0, web.Fail(422, "Tim tidak berada pada organisasi yang sama")
			}
		}
		if create {
			_, err = tx.Exec(ctx, `INSERT INTO identity.memberships(id,subject_id,org_id,team_id,permissions,grant_ceiling,valid_until,revoked_at) VALUES($1,$2,$3,$4,$5,'{}',$6,CASE WHEN $7 THEN now() END)`, id, in.SubjectID, org, in.TeamID, in.Permissions, expires, in.Revoked)
			tagRows = 1
		} else {
			tag, e := tx.Exec(ctx, `UPDATE identity.memberships SET team_id=$1,permissions=$2,valid_until=$3,revoked_at=CASE WHEN $4 THEN now() END,version=version+1,updated_at=now() WHERE id=$5 AND org_id=$6 AND subject_id=$7 AND version=$8`, in.TeamID, in.Permissions, expires, in.Revoked, id, org, in.SubjectID, in.ExpectedVersion)
			err = e
			tagRows = tag.RowsAffected()
		}
	default:
		return 0, web.Fail(404, "Master tidak ditemukan")
	}
	if err != nil {
		return 0, err
	}
	if tagRows != 1 {
		return 0, web.Fail(409, "Versi berubah; muat ulang data sebelum menyimpan")
	}
	version := int64(1)
	if !create {
		version = in.ExpectedVersion + 1
	}
	return version, nil
}

func (s Store) LabSubject(ctx context.Context, id string) (api.Subject, error) {
	var u api.Subject
	err := s.Pool.QueryRow(ctx, `SELECT id::text,display_name,kind,role_code FROM identity.subjects WHERE id=$1 AND active AND lab_fixture`, id).Scan(&u.ID, &u.Name, &u.Kind, &u.Role)
	if err == pgx.ErrNoRows {
		return u, web.Fail(401, "Identitas lab tidak aktif")
	}
	return u, err
}
func (s Store) UpgradePassword(ctx context.Context, id, old, improved string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE identity.subjects SET password_hash=$1,version=version+1,updated_at=now() WHERE id=$2 AND password_hash=$3 AND active`, improved, id, old)
	return err
}

func (s Store) ActiveTeamInOrg(ctx context.Context, team, org string) (bool, error) {
	var active bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM identity.teams t JOIN identity.organizations o ON o.id=t.org_id
		WHERE t.id=$1 AND o.id=$2 AND t.active AND o.active)`, team, org).Scan(&active)
	return active, err
}

func (s Store) StaffInOrg(ctx context.Context, org string) ([]api.Subject, error) {
	rows, err := s.Pool.Query(ctx, `SELECT s.id::text,s.display_name,s.kind,s.role_code
		FROM identity.subjects s
		WHERE s.kind='STAFF' AND s.active AND EXISTS (
			SELECT 1 FROM identity.memberships m
			JOIN identity.organizations o ON o.id=m.org_id
			WHERE m.subject_id=s.id AND o.active AND m.org_id=$1
			  AND m.revoked_at IS NULL AND m.valid_until>now()
			  AND ('ticket.read'=ANY(m.permissions) OR 'ticket.resolve'=ANY(m.permissions) OR 'ticket.vendor'=ANY(m.permissions))
		)
		ORDER BY s.display_name,s.id`, org)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.Subject{}
	for rows.Next() {
		var u api.Subject
		if err := rows.Scan(&u.ID, &u.Name, &u.Kind, &u.Role); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
