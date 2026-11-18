package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

// ListActiveSubjects returns active subjects for identity grant administration when lab bootstrap is disabled.
func (s Store) ListActiveSubjects(ctx context.Context, includeLab bool, limit int) ([]api.Subject, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.Pool.Query(ctx, `SELECT id::text,display_name,kind,role_code
		FROM identity.subjects
		WHERE active AND ($1 OR NOT lab_fixture)
		ORDER BY kind,display_name,id
		LIMIT $2`, includeLab, limit)
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

// SubjectContactEmail returns the subject's normalized email when active and eligible for non-lab delivery.
func (s Store) SubjectContactEmail(ctx context.Context, subjectID string) (string, bool, error) {
	if !web.UUID(subjectID) {
		return "", false, nil
	}
	var email sql.NullString
	var eligible bool
	err := s.Pool.QueryRow(ctx, `SELECT nullif(lower(btrim(email)),''), (active AND (email_verified_at IS NOT NULL OR NOT lab_fixture))
		FROM identity.subjects WHERE id=$1`, subjectID).Scan(&email, &eligible)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if !email.Valid || email.String == "" || !eligible {
		return "", false, nil
	}
	return email.String, true, nil
}

// FindOrLinkSSOSubject resolves a verified OIDC identity strictly against existing active non-lab ASN/STAFF subjects.
func (s Store) FindOrLinkSSOSubject(ctx context.Context, tx pgx.Tx, issuer, sub, externalRef, email string, emailVerified bool) (api.Subject, error) {
	var u api.Subject
	err := tx.QueryRow(ctx, `SELECT id::text,display_name,kind,role_code
		FROM identity.subjects
		WHERE oidc_issuer=$1 AND oidc_subject=$2 AND active AND NOT lab_fixture AND kind IN ('ASN','STAFF')`,
		issuer, sub).Scan(&u.ID, &u.Name, &u.Kind, &u.Role)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return u, err
	}

	ext := strings.TrimSpace(externalRef)
	mailNorm := strings.ToLower(strings.TrimSpace(email))
	if !emailVerified {
		mailNorm = ""
	}
	if ext == "" && mailNorm == "" {
		return u, web.Fail(403, "Akun kedinasan belum terdaftar atau tidak memenuhi syarat SSO")
	}

	rows, err := tx.Query(ctx, `SELECT id::text,display_name,kind,role_code
		FROM identity.subjects
		WHERE active AND NOT lab_fixture AND kind IN ('ASN','STAFF') AND oidc_subject IS NULL
		  AND (($1<>'' AND external_ref=$1) OR ($2<>'' AND lower(btrim(email))=$2))
		ORDER BY id LIMIT 2`, ext, mailNorm)
	if err != nil {
		return u, err
	}
	matches := []api.Subject{}
	for rows.Next() {
		var cand api.Subject
		if err := rows.Scan(&cand.ID, &cand.Name, &cand.Kind, &cand.Role); err != nil {
			rows.Close()
			return u, err
		}
		matches = append(matches, cand)
	}
	if err := rows.Err(); err != nil {
		return u, err
	}
	rows.Close()
	if len(matches) == 0 {
		return u, web.Fail(403, "Akun kedinasan belum terdaftar di Helpdesk; hubungi Administrator OPD")
	}
	if len(matches) > 1 {
		return u, web.Fail(409, "Identitas SSO cocok dengan lebih dari satu akun")
	}
	u = matches[0]

	tag, err := tx.Exec(ctx, `UPDATE identity.subjects
		SET oidc_issuer=$1,oidc_subject=$2,auth_provider='OIDC',
		    email_verified_at=COALESCE(email_verified_at, CASE WHEN $4 THEN now() END),
		    version=version+1,updated_at=now()
		WHERE id=$3 AND active AND NOT lab_fixture AND oidc_subject IS NULL`,
		issuer, sub, u.ID, emailVerified)
	if err != nil {
		return u, err
	}
	if tag.RowsAffected() != 1 {
		return u, web.Fail(409, "Tautan identitas SSO berubah; silakan coba masuk kembali")
	}
	return u, nil
}
