package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Store) CreateMedia(ctx context.Context, item api.MediaItem, sha []byte, in api.MediaUploadInput, key string) (database.Result, error) {
	return database.Mutate(ctx, s.pool, database.Mutation{Owner: "M8", Actor: item.PrincipalID, Command: "UploadMedia", Target: "new", Key: key, Scope: *item.OrgID, Reason: "Unggah media ke karantina privat", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		_, err := tx.Exec(ctx, `INSERT INTO knowledge.media(id,principal_id,org_id,storage_key,status,visibility,mime,size_bytes,sha256,alt,caption,license,source,hero_candidate) VALUES($1,$2,$3,$4,'PENDING','PRIVATE',$5,$6,$7,$8,$9,$10,$11,$12)`, item.ID, item.PrincipalID, item.OrgID, item.StorageKey, item.MIME, item.SizeBytes, sha, item.Alt, item.Caption, item.License, item.Source, in.HeroCandidate)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, item)
	})
}

func (s *Store) BindLegacyMedia(ctx context.Context, id, principal, org string) error {
	_, err := s.pool.Exec(ctx, `UPDATE knowledge.media SET org_id=$1,version=version+1,updated_at=now() WHERE id=$2 AND principal_id=$3 AND org_id IS NULL`, org, id, principal)
	return err
}

// A historical reference is not evidence of approval. Match the target's
// current scope and the consumed approval for this exact copy and reference.
const approvedMediaReference = `FROM knowledge.content_media_refs ref
 JOIN knowledge.content c ON c.id=ref.content_id
 JOIN knowledge.media_approvals a ON a.copy_id=ref.media_id AND a.target_id=c.id
 AND a.target_audience=c.audience AND a.org_id=c.org_id AND a.used_at IS NOT NULL AND a.revoked_at IS NULL`

func (s *Store) MediaVisibleInContent(ctx context.Context, id string, audiences []string, scope api.Scope) (bool, error) {
	var yes bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT `+approvedMediaReference+` WHERE ref.media_id=$1 AND c.state='PUBLISHED' AND c.audience=ANY($2::text[]) AND (c.audience='PUBLIC_GUEST' OR c.org_id IS NULL OR c.org_id=ANY($3::uuid[])))`, id, audiences, scope.Orgs).Scan(&yes)
	return yes, err
}

func (s *Store) ClaimUpload(ctx context.Context, id string, version int64, key string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE knowledge.media SET status='QUARANTINED',storage_key=$1,upload_lease_until=now()+interval '30 seconds',version=version+1,updated_at=now() WHERE id=$2 AND version=$3 AND (status='PENDING' OR (status='QUARANTINED' AND (upload_lease_until IS NULL OR upload_lease_until<now())))`, key, id, version)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return web.Fail(409, "Upload sedang diproses atau versi berubah")
	}
	return nil
}

func (s *Store) FinishUpload(ctx context.Context, id, key, status string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE knowledge.media SET status=$1,version=version+1,upload_lease_until=NULL,updated_at=now() WHERE id=$2 AND storage_key=$3 AND status='QUARANTINED' AND upload_lease_until>now()`, status, id, key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return web.Fail(409, "Lease upload berakhir; periksa ulang status media")
	}
	return nil
}

func (s *Store) BlobReferenced(ctx context.Context, key string) (bool, error) {
	var found bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM knowledge.media WHERE storage_key=$1)`, key).Scan(&found)
	return found, err
}
