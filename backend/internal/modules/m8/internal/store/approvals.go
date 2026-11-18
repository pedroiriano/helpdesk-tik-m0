package store

import (
	"context"
	"encoding/hex"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

func (s *Store) ApprovalAuthority(ctx context.Context, id string) (string, string, error) {
	var actor, org string
	err := s.pool.QueryRow(ctx, `SELECT approved_by::text,org_id::text FROM knowledge.media_approvals WHERE id=$1 AND revoked_at IS NULL AND expires_at>now()`, id).Scan(&actor, &org)
	if err == pgx.ErrNoRows {
		return "", "", web.Fail(404, "Approval tidak tersedia")
	}
	return actor, org, err
}

func (s *Store) ListApprovals(ctx context.Context, orgs []string, limit int) ([]api.MediaApprovalRecord, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := s.pool.Query(ctx, `SELECT id::text,version,source_id::text,source_owner,copy_id::text,target_id::text,target_audience,org_id::text,approved_by::text,reason,expires_at,used_at,revoked_at,created_at
		FROM knowledge.media_approvals
		WHERE org_id=ANY($1::uuid[])
		ORDER BY created_at DESC, id DESC LIMIT $2`, orgs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.MediaApprovalRecord{}
	for rows.Next() {
		var r api.MediaApprovalRecord
		if err := rows.Scan(&r.ID, &r.Version, &r.SourceID, &r.SourceOwner, &r.CopyID, &r.TargetID, &r.TargetAudience, &r.OrganizationID, &r.ApprovedBy, &r.Reason, &r.ExpiresAt, &r.UsedAt, &r.RevokedAt, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) RevokeApproval(ctx context.Context, id string, scope api.Scope, version int64, reason, key string) (database.Result, error) {
	return database.Mutate(ctx, s.pool, database.Mutation{Owner: "M8", Actor: scope.Principal, Command: "RevokeMediaApproval", Target: id, Key: key, Scope: "KNOWLEDGE", Reason: reason, Payload: map[string]any{"expected_version": version, "reason": reason}}, func(tx pgx.Tx) (database.Result, error) {
		tag, err := tx.Exec(ctx, `UPDATE knowledge.media_approvals SET revoked_at=now(),version=version+1 WHERE id=$1 AND version=$2 AND used_at IS NULL AND revoked_at IS NULL AND org_id=ANY($3::uuid[])`, id, version, scope.Publish)
		if err != nil {
			return database.Result{}, err
		}
		if tag.RowsAffected() != 1 {
			return database.Result{}, web.Fail(409, "Approval telah berubah, terpakai atau di luar mandat")
		}
		return database.Response(200, map[string]any{"id": id, "version": version + 1})
	})
}

func (s *Store) ApproveMedia(ctx context.Context, source api.MediaItem, in api.MediaApprovalInput, scope api.Scope, key string) (database.Result, error) {
	return database.Mutate(ctx, s.pool, database.Mutation{Owner: "M8", Actor: scope.Principal, Command: "ApproveSanitizedMedia", Target: source.ID, Key: key, Scope: "KNOWLEDGE", Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		if source.Owner == "M8" {
			var version int64
			var hash string
			var state string
			err := tx.QueryRow(ctx, `SELECT version,encode(sha256,'hex'),status FROM knowledge.media WHERE id=$1 FOR SHARE`, source.ID).Scan(&version, &hash, &state)
			if err != nil {
				return database.Result{}, err
			}
			if version != source.Version || hash != source.SHA256 || state != "CLEAN" {
				return database.Result{}, web.Fail(409, "Versi sumber berubah")
			}
		}
		var copy api.MediaItem
		var sha []byte
		err := tx.QueryRow(ctx, `SELECT id::text,version,principal_id::text,org_id::text,status,visibility,sha256 FROM knowledge.media WHERE id=$1 FOR UPDATE`, in.SanitizedCopyID).Scan(&copy.ID, &copy.Version, &copy.PrincipalID, &copy.OrgID, &copy.Status, &copy.Visibility, &sha)
		if err == pgx.ErrNoRows {
			return database.Result{}, web.Fail(404, "Salinan tidak ditemukan")
		}
		if err != nil {
			return database.Result{}, err
		}
		copy.SHA256 = hex.EncodeToString(sha)
		var targetOrg string
		var audience, state string
		err = tx.QueryRow(ctx, `SELECT org_id::text,audience,state FROM knowledge.content WHERE id=$1 AND org_id=ANY($2::uuid[]) FOR SHARE`, in.TargetID, scope.Publish).Scan(&targetOrg, &audience, &state)
		if err == pgx.ErrNoRows {
			return database.Result{}, web.Fail(404, "Tujuan publikasi tidak ditemukan")
		}
		if err != nil {
			return database.Result{}, err
		}
		if (source.OrgID != nil && source.Visibility == "PRIVATE" && *source.OrgID != targetOrg) || copy.Status != "CLEAN" || copy.Visibility != "PRIVATE" || copy.OrgID == nil || *copy.OrgID != targetOrg || copy.ID == source.ID || copy.SHA256 == source.SHA256 || copy.PrincipalID == scope.Principal || audience != in.TargetAudience || state == "ARCHIVED" {
			return database.Result{}, web.Fail(422, "Salinan harus terpisah, bersih, satu organisasi dan ditinjau penerbit lain")
		}
		id := web.ID()
		expires := time.Now().UTC().Add(24 * time.Hour)
		_, err = tx.Exec(ctx, `INSERT INTO knowledge.media_approvals(id,source_id,source_owner,source_version,source_sha,copy_id,copy_version,copy_sha,target_id,target_audience,org_id,approved_by,reason,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, id, source.ID, source.Owner, source.Version, source.SHA256, copy.ID, copy.Version, copy.SHA256, in.TargetID, in.TargetAudience, targetOrg, scope.Principal, in.Reason, expires)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, map[string]any{"id": id, "version": 1, "source_id": source.ID, "sanitized_copy_id": copy.ID, "expires_at": expires})
	})
}

func (s *Store) PublishMedia(ctx context.Context, source api.MediaItem, in api.ReuseMediaInput, scope api.Scope, key string) (database.Result, error) {
	return database.Mutate(ctx, s.pool, database.Mutation{Owner: "M8", Actor: scope.Principal, Command: "ReuseSanitizedMedia", Target: source.ID, Key: key, Scope: "KNOWLEDGE", Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		if source.Owner == "M8" {
			var version int64
			var hash string
			var state string
			err := tx.QueryRow(ctx, `SELECT version,encode(sha256,'hex'),status FROM knowledge.media WHERE id=$1 FOR SHARE`, source.ID).Scan(&version, &hash, &state)
			if err != nil {
				return database.Result{}, err
			}
			if version != source.Version || hash != source.SHA256 || state != "CLEAN" {
				return database.Result{}, web.Fail(409, "Versi sumber berubah")
			}
		}
		var copyVersion, sourceVersion int64
		var sourceID, owner, sourceSHA, copyID, copySHA, target, audience, org string
		var used *time.Time
		err := tx.QueryRow(ctx, `SELECT source_id::text,source_owner,source_version,source_sha,copy_id::text,copy_version,copy_sha,target_id::text,target_audience,org_id::text,used_at FROM knowledge.media_approvals WHERE id=$1 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`, *in.ApprovalID).Scan(&sourceID, &owner, &sourceVersion, &sourceSHA, &copyID, &copyVersion, &copySHA, &target, &audience, &org, &used)
		if err == pgx.ErrNoRows {
			return database.Result{}, web.Fail(404, "Approval tidak tersedia")
		}
		if err != nil {
			return database.Result{}, err
		}
		if used != nil || sourceID != source.ID || owner != source.Owner || sourceVersion != source.Version || sourceSHA != source.SHA256 || copyID != *in.SanitizedCopyID || target != in.TargetID || audience != in.TargetAudience || !api.Contains(scope.Reuse, org) {
			return database.Result{}, web.Fail(409, "Approval berubah, terpakai atau tidak sesuai sumber/tujuan")
		}
		var currentAudience, state string
		err = tx.QueryRow(ctx, `SELECT audience,state FROM knowledge.content WHERE id=$1 AND org_id=$2 FOR SHARE`, target, org).Scan(&currentAudience, &state)
		if err == pgx.ErrNoRows {
			return database.Result{}, web.Fail(404, "Tujuan tidak ditemukan")
		}
		if err != nil {
			return database.Result{}, err
		}
		if currentAudience != audience || state == "ARCHIVED" {
			return database.Result{}, web.Fail(409, "Tujuan publikasi berubah")
		}
		visibility := "PRIVATE"

		tag, err := tx.Exec(ctx, `UPDATE knowledge.media SET visibility=$1,sanitized_from_id=$2,approved_by=(SELECT approved_by FROM knowledge.media_approvals WHERE id=$3),version=version+1,updated_at=now() WHERE id=$4 AND version=$5 AND status='CLEAN' AND visibility='PRIVATE' AND org_id=$6 AND encode(sha256,'hex')=$7`, visibility, source.ID, *in.ApprovalID, copyID, copyVersion, org, copySHA)
		if err != nil {
			return database.Result{}, err
		}
		if tag.RowsAffected() != 1 {
			return database.Result{}, web.Fail(409, "Versi salinan berubah")
		}
		_, err = tx.Exec(ctx, `INSERT INTO knowledge.content_media_refs(id,content_id,media_id) VALUES($1,$2,$3) ON CONFLICT(content_id,media_id) DO NOTHING`, web.ID(), target, copyID)
		if err != nil {
			return database.Result{}, err
		}
		_, err = tx.Exec(ctx, `UPDATE knowledge.media_approvals SET used_at=now() WHERE id=$1`, *in.ApprovalID)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{"id": copyID, "version": copyVersion + 1, "approval_id": *in.ApprovalID})
	})
}
