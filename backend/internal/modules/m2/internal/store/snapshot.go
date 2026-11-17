package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m2/api"
)

func (s Store) Snapshot(ctx context.Context, id, kind string, orgs []string) (v api.Snapshot, err error) {
	tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return v, err
	}
	defer tx.Rollback(ctx)
	v.Service, err = scanService(tx.QueryRow(ctx, `SELECT `+columns+` FROM catalog.services s WHERE `+visible+` AND s.id=$5`, false, []string{}, kind, orgs, id))
	if err != nil {
		return v, err
	}
	var fields []byte
	err = tx.QueryRow(ctx, `SELECT id::text,form_version,fields FROM catalog.service_forms WHERE service_id=$1 ORDER BY form_version DESC LIMIT 1`, id).Scan(&v.Form.ID, &v.Form.FormVersion, &fields)
	if err != nil {
		return v, err
	}
	if err = json.Unmarshal(fields, &v.Form.Fields); err != nil {
		return v, err
	}
	v.Form.Version = v.Service.Version
	err = tx.QueryRow(ctx, `SELECT id::text,policy_version,upload_max_bytes,allowed_mime,audience_org_ids::text[] FROM catalog.policies WHERE service_id=$1 AND effective_at<=now() ORDER BY policy_version DESC LIMIT 1`, id).Scan(&v.Policy.ID, &v.Policy.PolicyVersion, &v.Policy.UploadMax, &v.Policy.AllowedMIME, &v.Policy.AudienceOrgs)
	if err != nil {
		return v, err
	}
	v.Policy.Version = v.Service.Version
	err = tx.Commit(ctx)
	return v, err
}
