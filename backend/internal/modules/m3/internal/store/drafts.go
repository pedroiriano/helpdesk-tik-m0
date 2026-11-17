package store

import (
	"context"
	"encoding/hex"
	"errors"
	"github.com/jackc/pgx/v5"
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

func (s Store) ListDrafts(ctx context.Context, principalID string, limit int, cursor string) ([]m3api.DraftItem, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	query := `SELECT id, version, form_version, title, description, updated_at, expires_at
	          FROM intake.drafts
	          WHERE principal_id = $1::uuid AND expires_at > now()
	            AND ($2 = '' OR id > $2::uuid)
	          ORDER BY id ASC LIMIT $3`
	rows, err := s.Pool.Query(ctx, query, principalID, cursor, limit+1)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []m3api.DraftItem
	for rows.Next() {
		var it m3api.DraftItem
		if err := rows.Scan(&it.ID, &it.Version, &it.FormVersion, &it.Title, &it.Description, &it.UpdatedAt, &it.ExpiresAt); err != nil {
			return nil, nil, err
		}
		items = append(items, it)
	}
	var nextCursor *string
	if len(items) > limit {
		nextCursor = &items[limit-1].ID
		items = items[:limit]
	}
	return items, nextCursor, nil
}

func (s Store) GetDraft(ctx context.Context, id, principalID string) (m3api.DraftItem, error) {
	query := `SELECT id, version, form_version, title, description, updated_at, expires_at
	          FROM intake.drafts
	          WHERE id = $1 AND principal_id = $2::uuid AND expires_at > now()`
	var it m3api.DraftItem
	err := s.Pool.QueryRow(ctx, query, id, principalID).Scan(&it.ID, &it.Version, &it.FormVersion, &it.Title, &it.Description, &it.UpdatedAt, &it.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return m3api.DraftItem{}, web.Fail(404, "Draft tiket tidak ditemukan atau telah kedaluwarsa")
		}
		return m3api.DraftItem{}, err
	}
	return it, nil
}

func (s Store) SaveDraft(ctx context.Context, id, principalID string, in m3api.DraftWriteInput, exp time.Time) (m3api.DraftItem, error) {
	var curVersion int64
	checkQuery := `SELECT version FROM intake.drafts WHERE id = $1`
	err := s.Pool.QueryRow(ctx, checkQuery, id).Scan(&curVersion)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return m3api.DraftItem{}, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		// Insert new draft
		insertQuery := `INSERT INTO intake.drafts(id, version, principal_id, form_version, title, description, created_at, updated_at, expires_at)
		                VALUES($1, 1, $2, $3, $4, $5, now(), now(), $6)
		                RETURNING id, version, form_version, title, description, updated_at, expires_at`
		var out m3api.DraftItem
		err = s.Pool.QueryRow(ctx, insertQuery, id, principalID, in.FormVersion, in.Title, in.Description, exp).Scan(&out.ID, &out.Version, &out.FormVersion, &out.Title, &out.Description, &out.UpdatedAt, &out.ExpiresAt)
		return out, err
	}

	// CAS Version Check: Version collision detection
	if in.ExpectedVersion != curVersion {
		return m3api.DraftItem{}, web.Fail(409, "Versi draft tiket telah berubah di tab atau jendela lain; muat ulang draft terbaru (AC19)")
	}

	updateQuery := `UPDATE intake.drafts
	                SET version = version + 1, form_version = $3, title = $4, description = $5, updated_at = now(), expires_at = $6
	                WHERE id = $1 AND version = $2 AND principal_id = $7::uuid
	                RETURNING id, version, form_version, title, description, updated_at, expires_at`
	var out m3api.DraftItem
	err = s.Pool.QueryRow(ctx, updateQuery, id, in.ExpectedVersion, in.FormVersion, in.Title, in.Description, exp, principalID).Scan(&out.ID, &out.Version, &out.FormVersion, &out.Title, &out.Description, &out.UpdatedAt, &out.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return m3api.DraftItem{}, web.Fail(409, "Konflik versi draft tiket atau hak akses tidak sesuai")
		}
		return m3api.DraftItem{}, err
	}
	return out, nil
}

func (s Store) DeleteDraft(ctx context.Context, id, principalID string) error {
	res, err := s.Pool.Exec(ctx, `DELETE FROM intake.drafts WHERE id = $1 AND principal_id = $2::uuid`, id, principalID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return web.Fail(404, "Draft tiket tidak ditemukan")
	}
	return nil
}

func (s Store) ListMediaM3(ctx context.Context, principalID string, isStaff bool, limit int, cursor string, onlyClean bool, search string, scopes ...Scope) ([]m3api.MediaItem, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if len(scopes) != 1 {
		return nil, nil, web.Fail(401, "Scope media diperlukan")
	}
	scope := scopes[0]
	query := `SELECT a.id,a.version,a.principal_id,a.storage_key,a.status,a.visibility,a.mime,a.size_bytes,a.sha256,a.alt,a.license,a.display_name,a.created_at,a.updated_at,t.service_owner_org_id::text FROM intake.attachments a JOIN intake.tickets t ON t.id=a.ticket_id WHERE ` + visible + ` AND (a.audience='REQUESTER' OR ($7 AND t.service_owner_org_id=ANY($3::uuid[]))) AND (NOT $8::boolean OR a.status='CLEAN')
 AND ($9='' OR strpos(lower(concat_ws(' ',a.alt,a.display_name)),lower($9))>0)
 AND ($5='' OR a.id>NULLIF($5,'')::uuid) ORDER BY a.id LIMIT $6`
	rows, err := s.Pool.Query(ctx, query, scope.ID, scope.TicketID, scope.Orgs, scope.Role, cursor, limit+1, scope.Internal, onlyClean, search)

	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []m3api.MediaItem
	for rows.Next() {
		var it m3api.MediaItem
		var rawSHA []byte
		var sKey, mime, alt, lic, dName *string
		if err := rows.Scan(&it.ID, &it.Version, &it.PrincipalID, &sKey, &it.Status, &it.Visibility, &mime, &it.SizeBytes, &rawSHA, &alt, &lic, &dName, &it.CreatedAt, &it.UpdatedAt, &it.OrgID); err != nil {
			return nil, nil, err
		}
		it.Owner = "M3"
		if sKey != nil {
			it.StorageKey = *sKey
		}
		if mime != nil {
			it.MIME = *mime
		}
		if alt != nil {
			it.Alt = *alt
		}
		if lic != nil {
			it.License = *lic
		}
		if dName != nil {
			it.Caption = *dName
		}
		it.SHA256 = hex.EncodeToString(rawSHA)
		it.DownloadPath = "/api/v1/media/" + it.ID + "/download"
		items = append(items, it)
	}
	var nextCursor *string
	if len(items) > limit {
		nextCursor = &items[limit-1].ID
		items = items[:limit]
	}
	return items, nextCursor, nil
}

func (s Store) GetMediaM3(ctx context.Context, id string, scopes ...Scope) (m3api.MediaItem, error) {
	if len(scopes) != 1 {
		return m3api.MediaItem{}, web.Fail(401, "Scope media diperlukan")
	}
	scope := scopes[0]
	query := `SELECT a.id,a.version,a.principal_id,a.storage_key,a.status,a.visibility,a.mime,a.size_bytes,a.sha256,a.alt,a.license,a.display_name,a.created_at,a.updated_at,t.service_owner_org_id::text FROM intake.attachments a JOIN intake.tickets t ON t.id=a.ticket_id WHERE a.id=$5 AND ` + visible + ` AND (a.audience='REQUESTER' OR ($6 AND t.service_owner_org_id=ANY($3::uuid[])))`

	var it m3api.MediaItem
	var rawSHA []byte
	var sKey, mime, alt, lic, dName *string
	err := s.Pool.QueryRow(ctx, query, scope.ID, scope.TicketID, scope.Orgs, scope.Role, id, scope.Internal).Scan(&it.ID, &it.Version, &it.PrincipalID, &sKey, &it.Status, &it.Visibility, &mime, &it.SizeBytes, &rawSHA, &alt, &lic, &dName, &it.CreatedAt, &it.UpdatedAt, &it.OrgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return m3api.MediaItem{}, web.Fail(404, "Lampiran tiket tidak ditemukan")
		}
		return m3api.MediaItem{}, err
	}
	it.Owner = "M3"
	if sKey != nil {
		it.StorageKey = *sKey
	}
	if mime != nil {
		it.MIME = *mime
	}
	if alt != nil {
		it.Alt = *alt
	}
	if lic != nil {
		it.License = *lic
	}
	if dName != nil {
		it.Caption = *dName
	}
	it.SHA256 = hex.EncodeToString(rawSHA)
	it.DownloadPath = "/api/v1/media/" + it.ID + "/download"
	return it, nil
}
