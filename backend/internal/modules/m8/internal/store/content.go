package store

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
)

func allowedAudiencesFor(audience string, isStaff bool) []string {
	if isStaff {
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY"}
	}
	switch audience {
	case "ASN_AUTH":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH"}
	case "PUBLIC_AUTH":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH"}
	case "STAFF_ONLY":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY"}
	default: // PUBLIC_GUEST / ANONYMOUS
		return []string{"PUBLIC_GUEST"}
	}
}

func (s *Store) InsertContent(ctx context.Context, item api.ContentItem, body string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		INSERT INTO knowledge.content(id, version, kind, slug, title, audience, state, org_id, principal_id, created_at, updated_at)
		VALUES($1, 1, $2, $3, $4, $5, 'DRAFT', $6, $7, $8, $8)
	`, item.ID, item.Kind, item.Slug, item.Title, item.Audience, item.OrgID, item.PrincipalID, now)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			return web.Fail(409, "Slug konten sudah digunakan")
		}
		return err
	}

	revID := web.ID()
	_, err = tx.Exec(ctx, `
		INSERT INTO knowledge.revisions(id, version, content_id, revision, sanitized_body, author_id, created_at, updated_at)
		VALUES($1, 1, $2, 1, $3, $4, $5, $5)
	`, revID, item.ID, body, item.PrincipalID, now)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Store) GetContent(ctx context.Context, idOrSlug string, viewerAudience string, isStaff bool, scopes ...api.Scope) (api.ContentItem, error) {
	var item api.ContentItem
	var orgID *string

	err := s.pool.QueryRow(ctx, `
		SELECT c.id::text, c.version, c.kind, c.slug, c.title, c.audience, c.state, c.org_id::text, c.principal_id::text, c.created_at, c.updated_at,
		       COALESCE(r.revision, 1), COALESCE(r.sanitized_body, '')
		FROM knowledge.content c
		LEFT JOIN LATERAL (
			SELECT revision, sanitized_body
			FROM knowledge.revisions rev
			WHERE rev.content_id = c.id
			ORDER BY revision DESC
			LIMIT 1
		) r ON true
		WHERE (c.id::text = $1 OR c.slug = $1)
	`, idOrSlug).Scan(
		&item.ID, &item.Version, &item.Kind, &item.Slug, &item.Title, &item.Audience, &item.State, &orgID, &item.PrincipalID,
		&item.CreatedAt, &item.UpdatedAt, &item.LatestRevision, &item.Body,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.ContentItem{}, web.Fail(404, "Konten tidak ditemukan")
		}
		return api.ContentItem{}, err
	}
	item.OrgID = orgID

	if !api.ScopeValue(scopes).ReadContent(item, allowedAudiencesFor(viewerAudience, isStaff)) {
		return api.ContentItem{}, web.Fail(404, "Konten tidak ditemukan")
	}

	return item, nil
}

func (s *Store) ListContent(ctx context.Context, kind string, viewerAudience string, isStaff bool, limit int, cursor, search string, scopes ...api.Scope) ([]api.ContentItem, *string, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := `
		SELECT c.id::text, c.version, c.kind, c.slug, c.title, c.audience, c.state, c.org_id::text, c.principal_id::text, c.created_at, c.updated_at,
		       COALESCE(r.revision, 1), COALESCE(r.sanitized_body, '')
		FROM knowledge.content c
		LEFT JOIN LATERAL (
			SELECT revision, sanitized_body
			FROM knowledge.revisions rev
			WHERE rev.content_id = c.id
			ORDER BY revision DESC
			LIMIT 1
		) r ON true
		WHERE c.kind = $1
	`
	scope := api.ScopeValue(scopes)
	query += ` AND ((c.state='PUBLISHED' AND c.audience=ANY($2::text[]) AND (c.audience='PUBLIC_GUEST' OR c.org_id IS NULL OR c.org_id=ANY($3::uuid[]))) OR c.org_id=ANY($4::uuid[]) OR (c.org_id IS NULL AND c.principal_id::text=$5 AND cardinality($4::uuid[])>0))`
	args := []any{kind, scope.Audiences(), scope.Orgs, scope.Read, scope.Principal}
	argIdx := 6

	if cursor != "" {
		query += fmt.Sprintf(" AND c.id::text > $%d", argIdx)
		args = append(args, cursor)
		argIdx++
	}

	if search != "" {
		query += fmt.Sprintf(" AND (strpos(lower(c.title), lower($%d))>0 OR strpos(lower(c.slug), lower($%d))>0)", argIdx, argIdx)
		args = append(args, search)
	}

	query += fmt.Sprintf(" ORDER BY c.id ASC LIMIT %d", limit+1)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	items := make([]api.ContentItem, 0)
	for rows.Next() {
		var item api.ContentItem
		var orgID *string
		if err := rows.Scan(
			&item.ID, &item.Version, &item.Kind, &item.Slug, &item.Title, &item.Audience, &item.State, &orgID, &item.PrincipalID,
			&item.CreatedAt, &item.UpdatedAt, &item.LatestRevision, &item.Body,
		); err != nil {
			return nil, nil, err
		}
		item.OrgID = orgID
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	var nextCursor *string
	if len(items) > limit {
		items = items[:limit]
		c := items[len(items)-1].ID
		nextCursor = &c
	}

	return items, nextCursor, nil
}

func (s *Store) UpdateContent(ctx context.Context, id string, in api.ContentWriteInput, authorID string, scopes ...api.Scope) (api.ContentItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return api.ContentItem{}, err
	}
	defer tx.Rollback(ctx)

	var curVersion int64
	var kind, curState string
	var org *string
	scope := api.ScopeValue(scopes)
	err = tx.QueryRow(ctx, `SELECT version, kind, state, org_id::text FROM knowledge.content WHERE id = $1 AND (org_id=ANY($2::uuid[]) OR (org_id IS NULL AND principal_id::text=$3 AND cardinality($2::uuid[])>0)) FOR UPDATE`, id, scope.Write, scope.Principal).Scan(&curVersion, &kind, &curState, &org)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.ContentItem{}, web.Fail(404, "Konten tidak ditemukan")
		}
		return api.ContentItem{}, err
	}

	if curState == "PUBLISHED" && (org == nil || in.OrgID == nil || !api.Contains(scope.Publish, *org) || !api.Contains(scope.Publish, *in.OrgID)) {
		return api.ContentItem{}, web.Fail(403, "Perubahan konten terbit memerlukan mandat penerbit pada organisasi asal dan tujuan")
	}
	if curVersion != in.ExpectedVersion {
		return api.ContentItem{}, web.Fail(409, "Versi konten telah berubah (konflik versi)")
	}

	now := time.Now().UTC()
	var newVersion int64
	var updatedTime time.Time
	err = tx.QueryRow(ctx, `
		UPDATE knowledge.content
		SET title = $1, slug = $2, audience = $3, org_id = $4, version = version + 1, updated_at = $5
		WHERE id = $6
		RETURNING version, updated_at
	`, in.Title, in.Slug, in.Audience, in.OrgID, now, id).Scan(&newVersion, &updatedTime)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			return api.ContentItem{}, web.Fail(409, "Slug konten sudah digunakan")
		}
		return api.ContentItem{}, err
	}

	var nextRev int
	err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(revision), 0) + 1 FROM knowledge.revisions WHERE content_id = $1`, id).Scan(&nextRev)
	if err != nil {
		return api.ContentItem{}, err
	}

	revID := web.ID()
	_, err = tx.Exec(ctx, `
		INSERT INTO knowledge.revisions(id, version, content_id, revision, sanitized_body, author_id, created_at, updated_at)
		VALUES($1, 1, $2, $3, $4, $5, $6, $6)
	`, revID, id, nextRev, in.Body, authorID, now)
	if err != nil {
		return api.ContentItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return api.ContentItem{}, err
	}

	return api.ContentItem{
		ID:             id,
		Version:        newVersion,
		Kind:           kind,
		Slug:           in.Slug,
		Title:          in.Title,
		Body:           in.Body,
		Audience:       in.Audience,
		State:          curState,
		OrgID:          in.OrgID,
		UpdatedAt:      updatedTime,
		LatestRevision: nextRev,
	}, nil
}

func (s *Store) TransitionContent(ctx context.Context, id string, expectedVersion int64, nextState, reason, actorID string, scopes ...api.Scope) (api.ContentItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return api.ContentItem{}, err
	}
	defer tx.Rollback(ctx)

	var curVersion int64
	var kind, slug, title, audience, curState string
	var orgID *string
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT version, kind, slug, title, audience, state, org_id::text, created_at
		FROM knowledge.content
		WHERE id = $1 AND (org_id=ANY($2::uuid[]) OR (org_id IS NULL AND principal_id::text=$3 AND cardinality($2::uuid[])>0))
		FOR UPDATE
	`, id, api.ScopeValue(scopes).Write, api.ScopeValue(scopes).Principal).Scan(&curVersion, &kind, &slug, &title, &audience, &curState, &orgID, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.ContentItem{}, web.Fail(404, "Konten tidak ditemukan")
		}
		return api.ContentItem{}, err
	}

	if curVersion != expectedVersion {
		return api.ContentItem{}, web.Fail(409, "Versi konten telah berubah (konflik versi)")
	}

	now := time.Now().UTC()
	var newVersion int64
	var updatedTime time.Time
	err = tx.QueryRow(ctx, `
		UPDATE knowledge.content
		SET state = $1, version = version + 1, updated_at = $2
		WHERE id = $3
		RETURNING version, updated_at
	`, nextState, now, id).Scan(&newVersion, &updatedTime)
	if err != nil {
		return api.ContentItem{}, err
	}

	var latestRevID string
	var latestRevNum int
	var body string
	err = tx.QueryRow(ctx, `
		SELECT id::text, revision, sanitized_body
		FROM knowledge.revisions
		WHERE content_id = $1
		ORDER BY revision DESC
		LIMIT 1
	`, id).Scan(&latestRevID, &latestRevNum, &body)
	if err != nil {
		return api.ContentItem{}, err
	}

	if nextState == "PUBLISHED" {
		payloadObj := map[string]string{
			"revision_id": latestRevID,
			"audience":    audience,
		}
		payloadBytes, err := json.Marshal(payloadObj)
		if err != nil {
			return api.ContentItem{}, err
		}

		sum := sha256.Sum256(payloadBytes)
		eventID := web.ID()
		corrID := web.ID()

		_, err = tx.Exec(ctx, `
			INSERT INTO knowledge.outbox(event_id, event_type, schema_version, aggregate_id, aggregate_version, occurred_at, correlation_id, payload, digest)
			VALUES($1, 'ContentPublished', 1, $2, $3, $4, $5, $6, $7)
		`, eventID, id, newVersion, now, corrID, payloadBytes, sum[:])
		if err != nil {
			return api.ContentItem{}, err
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO knowledge.outbox_delivery(event_id, consumer_id, state, attempts)
			VALUES($1, 'M9', 'PENDING', 0)
		`, eventID)
		if err != nil {
			return api.ContentItem{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return api.ContentItem{}, err
	}

	return api.ContentItem{
		ID:             id,
		Version:        newVersion,
		Kind:           kind,
		Slug:           slug,
		Title:          title,
		Body:           body,
		Audience:       audience,
		State:          nextState,
		OrgID:          orgID,
		CreatedAt:      createdAt,
		UpdatedAt:      updatedTime,
		LatestRevision: latestRevNum,
	}, nil
}

func (s *Store) SearchArticles(ctx context.Context, query string, audience string, isStaff bool, limit int, scopes ...api.Scope) ([]api.SearchHit, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	pattern := "%" + query + "%"
	allowed := api.ScopeValue(scopes).Audiences()

	rows, err := s.pool.Query(ctx, `
		SELECT c.id::text, c.kind, c.title, r.sanitized_body
		FROM knowledge.content c
		JOIN LATERAL (
			SELECT sanitized_body
			FROM knowledge.revisions rev
			WHERE rev.content_id = c.id
			ORDER BY revision DESC
			LIMIT 1
		) r ON true
		WHERE c.state = 'PUBLISHED'
		  AND c.audience = ANY($1)
 AND (c.audience='PUBLIC_GUEST' OR c.org_id IS NULL OR c.org_id=ANY($4::uuid[]))
		  AND (c.title ILIKE $2 OR r.sanitized_body ILIKE $2)
		ORDER BY c.id ASC
		LIMIT $3
	`, allowed, pattern, limit, api.ScopeValue(scopes).Orgs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := make([]api.SearchHit, 0)
	for rows.Next() {
		var id, kind, title, fullBody string
		if err := rows.Scan(&id, &kind, &title, &fullBody); err != nil {
			return nil, err
		}
		snippet := fullBody
		if len(snippet) > 200 {
			snippet = snippet[:200] + "..."
		}
		hits = append(hits, api.SearchHit{
			ID:      id,
			Owner:   "M8",
			Kind:    kind,
			Title:   title,
			Snippet: snippet,
		})
	}
	return hits, nil
}
