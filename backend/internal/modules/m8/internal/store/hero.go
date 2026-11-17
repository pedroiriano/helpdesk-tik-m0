package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

const heroCandidate = `org_id=$1 AND hero_candidate AND status='CLEAN'
	AND mime IN ('image/png','image/jpeg') AND sanitized_from_id IS NULL
	AND NOT EXISTS(SELECT 1 FROM knowledge.media_approvals WHERE copy_id=knowledge.media.id)`

func (s *Store) Hero(ctx context.Context) (api.HeroState, error) {
	out := api.HeroState{}
	err := s.pool.QueryRow(ctx, `SELECT version,published_version,draft,published FROM knowledge.hero_publication WHERE id=$1`, api.HeroID).
		Scan(&out.Version, &out.PublishedVersion, &out.Draft, &out.Published)
	if err == pgx.ErrNoRows {
		err = nil
	}
	return out, err
}

func (s *Store) HeroCandidates(ctx context.Context, p web.Page) ([]api.DirectoryMedia, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,alt FROM knowledge.media WHERE `+heroCandidate+
		` AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, api.HeroOrganization, p.Cursor, p.Limit+1)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, pgx.RowToStructByPos[api.DirectoryMedia])
	return out, err
}

func (s *Store) ChangeHero(ctx context.Context, actor string, in api.HeroChange, publish bool, key string) (database.Result, error) {
	command := "SaveHeroDraft"
	if publish {
		command = "PublishHero"
	}
	return database.Mutate(ctx, s.pool, database.Mutation{Owner: "M8", Actor: actor, Command: command, Target: api.HeroID, Scope: api.HeroOrganization, Reason: in.Reason, Key: key, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "portal-hero"); err != nil {
			return database.Result{}, err
		}
		var current api.HeroState
		err := tx.QueryRow(ctx, `SELECT version,draft FROM knowledge.hero_publication WHERE id=$1`, api.HeroID).Scan(&current.Version, &current.Draft)
		if err != nil && err != pgx.ErrNoRows {
			return database.Result{}, err
		}
		if in.ExpectedVersion != current.Version {
			return database.Result{}, web.Fail(409, "Versi banner berubah. Muat ulang sebelum melanjutkan")
		}
		banners := in.Banners
		if publish {
			if current.Version == 0 {
				return database.Result{}, web.Fail(422, "Simpan draf banner terlebih dahulu")
			}
			banners = current.Draft
		}
		for _, banner := range banners {
			if banner.MediaID == "" {
				continue
			}
			var id string
			err := tx.QueryRow(ctx, `SELECT id::text FROM knowledge.media WHERE `+heroCandidate+` AND id=$2 FOR SHARE`, api.HeroOrganization, banner.MediaID).Scan(&id)
			if err == pgx.ErrNoRows {
				return database.Result{}, web.Fail(422, "Gambar banner harus berasal dari media editorial Hero berstatus bersih")
			}
			if err != nil {
				return database.Result{}, err
			}
		}
		next := current.Version + 1
		if publish {
			_, err = tx.Exec(ctx, `UPDATE knowledge.hero_publication SET published=draft,published_version=$2,version=$2,updated_at=now() WHERE id=$1`, api.HeroID, next)
		} else {
			_, err = tx.Exec(ctx, `INSERT INTO knowledge.hero_publication(id,version,draft) VALUES($1,$2,$3)
				ON CONFLICT(id) DO UPDATE SET version=$2,draft=$3,updated_at=now()`, api.HeroID, next, banners)
		}
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{"id": api.HeroID, "version": next})
	})
}

func (s *Store) PublishedHeroMedia(ctx context.Context, id string, version int64) (string, string, error) {
	var key, mime string
	err := s.pool.QueryRow(ctx, `SELECT storage_key,mime FROM knowledge.media WHERE `+heroCandidate+`
	AND id=$2 AND EXISTS(SELECT 1 FROM knowledge.hero_publication p CROSS JOIN LATERAL jsonb_array_elements(p.published) b
		WHERE p.id=$3 AND p.published_version=$4 AND b->>'media_id'=$2::text)`, api.HeroOrganization, id, api.HeroID, version).Scan(&key, &mime)
	if err == pgx.ErrNoRows {
		return "", "", web.Fail(404, "Gambar banner tidak ditemukan")
	}
	return key, mime, err
}
