package store

import (
	"context"
	"encoding/hex"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) ListMedia(ctx context.Context, principalID string, isStaff bool, limit int, cursor string, onlyClean bool, search string, scopes ...api.Scope) ([]api.MediaItem, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	scope := api.ScopeValue(scopes)
	query := `SELECT id,version,principal_id,org_id,storage_key,status,visibility,mime,size_bytes,sha256,alt,caption,license,source,sanitized_from_id,approved_by,created_at,updated_at
 FROM knowledge.media WHERE ((visibility='PUBLIC' AND status='CLEAN') OR principal_id::text=$1 AND (org_id IS NULL OR org_id=ANY($7::uuid[])) OR org_id=ANY($2::uuid[]) OR EXISTS(SELECT ` + approvedMediaReference + ` WHERE ref.media_id=knowledge.media.id AND knowledge.media.status='CLEAN' AND c.state='PUBLISHED' AND c.audience=ANY($5::text[]) AND (c.audience='PUBLIC_GUEST' OR c.org_id IS NULL OR c.org_id=ANY($6::uuid[])))) AND (NOT $8::boolean OR status='CLEAN')
 AND ($9='' OR strpos(lower(concat_ws(' ',alt,caption)),lower($9))>0)
 AND ($3='' OR id>NULLIF($3,'')::uuid) ORDER BY id LIMIT $4`
	rows, err := s.pool.Query(ctx, query, scope.Principal, scope.MediaRead, cursor, limit+1, scope.Audiences(), scope.Orgs, scope.MediaWrite, onlyClean, search)

	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []api.MediaItem
	for rows.Next() {
		var it api.MediaItem
		var rawSHA []byte
		var sKey, mime, caption, source *string
		var sanID, appID *string
		if err := rows.Scan(&it.ID, &it.Version, &it.PrincipalID, &it.OrgID, &sKey, &it.Status, &it.Visibility, &mime, &it.SizeBytes, &rawSHA, &it.Alt, &caption, &it.License, &source, &sanID, &appID, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, nil, err
		}
		it.Owner = "M8"
		if sKey != nil {
			it.StorageKey = *sKey
		}
		if mime != nil {
			it.MIME = *mime
		}
		if caption != nil {
			it.Caption = *caption
		}
		if source != nil {
			it.Source = *source
		}
		it.SanitizedFromID = sanID
		it.ApprovedBy = appID
		it.SHA256 = hex.EncodeToString(rawSHA)
		it.DownloadPath = "/api/v1/media/" + it.ID + "/download"
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	var nextCursor *string
	if len(items) > limit {
		nextCursor = &items[limit-1].ID
		items = items[:limit]
	}
	return items, nextCursor, nil
}

func (s *Store) GetMedia(ctx context.Context, id string) (api.MediaItem, error) {
	query := `SELECT id, version, principal_id, org_id, storage_key, status, visibility, mime, size_bytes, sha256, alt, caption, license, source, sanitized_from_id, approved_by, created_at, updated_at
	          FROM knowledge.media WHERE id = $1`
	var it api.MediaItem
	var rawSHA []byte
	var sKey, mime, caption, source *string
	var sanID, appID *string
	err := s.pool.QueryRow(ctx, query, id).Scan(&it.ID, &it.Version, &it.PrincipalID, &it.OrgID, &sKey, &it.Status, &it.Visibility, &mime, &it.SizeBytes, &rawSHA, &it.Alt, &caption, &it.License, &source, &sanID, &appID, &it.CreatedAt, &it.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.MediaItem{}, web.Fail(404, "Media tidak ditemukan")
		}
		return api.MediaItem{}, err
	}
	it.Owner = "M8"
	if sKey != nil {
		it.StorageKey = *sKey
	}
	if mime != nil {
		it.MIME = *mime
	}
	if caption != nil {
		it.Caption = *caption
	}
	if source != nil {
		it.Source = *source
	}
	it.SanitizedFromID = sanID
	it.ApprovedBy = appID
	it.SHA256 = hex.EncodeToString(rawSHA)
	it.DownloadPath = "/api/v1/media/" + it.ID + "/download"
	return it, nil
}

func (s *Store) ListDrafts(ctx context.Context, principalID string, limit int, cursor string) ([]api.DraftItem, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	query := `SELECT id, version, form_version, title, description, updated_at, expires_at
	          FROM knowledge.drafts
	          WHERE principal_id = $1::uuid AND expires_at > now()
	            AND ($2 = '' OR id > $2::uuid)
	          ORDER BY id ASC LIMIT $3`
	rows, err := s.pool.Query(ctx, query, principalID, cursor, limit+1)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var items []api.DraftItem
	for rows.Next() {
		var it api.DraftItem
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

func (s *Store) GetDraft(ctx context.Context, id, principalID string) (api.DraftItem, error) {
	query := `SELECT id, version, form_version, title, description, updated_at, expires_at
	          FROM knowledge.drafts
	          WHERE id = $1 AND principal_id = $2::uuid AND expires_at > now()`
	var it api.DraftItem
	err := s.pool.QueryRow(ctx, query, id, principalID).Scan(&it.ID, &it.Version, &it.FormVersion, &it.Title, &it.Description, &it.UpdatedAt, &it.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.DraftItem{}, web.Fail(404, "Draft tidak ditemukan atau telah kedaluwarsa")
		}
		return api.DraftItem{}, err
	}
	return it, nil
}

func (s *Store) SaveDraft(ctx context.Context, id, principalID string, in api.DraftWriteInput, exp time.Time) (api.DraftItem, error) {
	var curVersion int64
	checkQuery := `SELECT version FROM knowledge.drafts WHERE id = $1`
	err := s.pool.QueryRow(ctx, checkQuery, id).Scan(&curVersion)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return api.DraftItem{}, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		// New draft insertion
		insertQuery := `INSERT INTO knowledge.drafts(id, version, principal_id, form_version, title, description, created_at, updated_at, expires_at)
		                VALUES($1, 1, $2, $3, $4, $5, now(), now(), $6)
		                RETURNING id, version, form_version, title, description, updated_at, expires_at`
		var out api.DraftItem
		err = s.pool.QueryRow(ctx, insertQuery, id, principalID, in.FormVersion, in.Title, in.Description, exp).Scan(&out.ID, &out.Version, &out.FormVersion, &out.Title, &out.Description, &out.UpdatedAt, &out.ExpiresAt)
		return out, err
	}

	// CAS Version Check: Version conflict detection
	if in.ExpectedVersion != curVersion {
		return api.DraftItem{}, web.Fail(409, "Versi draft telah berubah di tab atau jendela lain; muat ulang draft terbaru (AC19)")
	}

	updateQuery := `UPDATE knowledge.drafts
	                SET version = version + 1, form_version = $3, title = $4, description = $5, updated_at = now(), expires_at = $6
	                WHERE id = $1 AND version = $2 AND principal_id = $7::uuid
	                RETURNING id, version, form_version, title, description, updated_at, expires_at`
	var out api.DraftItem
	err = s.pool.QueryRow(ctx, updateQuery, id, in.ExpectedVersion, in.FormVersion, in.Title, in.Description, exp, principalID).Scan(&out.ID, &out.Version, &out.FormVersion, &out.Title, &out.Description, &out.UpdatedAt, &out.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.DraftItem{}, web.Fail(409, "Konflik versi draft atau hak akses tidak sesuai")
		}
		return api.DraftItem{}, err
	}
	return out, nil
}

func (s *Store) DeleteDraft(ctx context.Context, id, principalID string) error {
	res, err := s.pool.Exec(ctx, `DELETE FROM knowledge.drafts WHERE id = $1 AND principal_id = $2::uuid`, id, principalID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return web.Fail(404, "Draft tidak ditemukan")
	}
	return nil
}
