package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

// InsertMaintenancePolicy records a new maintenance policy in identity.maintenance_policies.
func (s Store) InsertMaintenancePolicy(ctx context.Context, in api.MaintenancePolicyInput) (*api.MaintenancePolicy, error) {
	id := web.ID()
	now := time.Now().UTC()

	var orgVal any = nil
	if in.OrgID != nil && *in.OrgID != "" {
		orgVal = *in.OrgID
	}

	if in.Mode == "NORMAL" {
		// When mode is NORMAL, terminate any active maintenance windows
		if orgVal != nil {
			_, err := s.Pool.Exec(ctx, `
				UPDATE identity.maintenance_policies
				SET ends_at = now(), updated_at = now()
				WHERE ends_at > now() AND (org_id IS NULL OR org_id = $1)
			`, orgVal)
			if err != nil {
				return nil, err
			}
		} else {
			_, err := s.Pool.Exec(ctx, `
				UPDATE identity.maintenance_policies
				SET ends_at = now(), updated_at = now()
				WHERE ends_at > now()
			`)
			if err != nil {
				return nil, err
			}
		}
		return &api.MaintenancePolicy{
			ID:        id,
			Version:   1,
			OrgID:     in.OrgID,
			Mode:      in.Mode,
			StartsAt:  in.StartsAt,
			EndsAt:    in.EndsAt,
			Message:   in.Message,
			CreatedAt: now,
			UpdatedAt: now,
		}, nil
	}

	_, err := s.Pool.Exec(ctx, `
		INSERT INTO identity.maintenance_policies (id, version, org_id, mode, starts_at, ends_at, message, created_at, updated_at)
		VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $7)
	`, id, orgVal, in.Mode, in.StartsAt, in.EndsAt, in.Message, now)
	if err != nil {
		return nil, err
	}

	return &api.MaintenancePolicy{
		ID:        id,
		Version:   1,
		OrgID:     in.OrgID,
		Mode:      in.Mode,
		StartsAt:  in.StartsAt,
		EndsAt:    in.EndsAt,
		Message:   in.Message,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// ActiveMaintenancePolicy checks if there is any active maintenance window for the given org (or global).
func (s Store) ActiveMaintenancePolicy(ctx context.Context, orgID string) (*api.MaintenancePolicy, error) {
	var p api.MaintenancePolicy
	var orgNull sql.NullString

	query := `
		SELECT id, version, org_id::text, mode, starts_at, ends_at, message, created_at, updated_at
		FROM identity.maintenance_policies
		WHERE now() >= starts_at AND now() <= ends_at
	`
	args := []any{}
	if orgID != "" && web.UUID(orgID) {
		query += ` AND (org_id IS NULL OR org_id = $1)`
		args = append(args, orgID)
	}
	query += ` ORDER BY created_at DESC LIMIT 1`

	err := s.Pool.QueryRow(ctx, query, args...).Scan(
		&p.ID, &p.Version, &orgNull, &p.Mode, &p.StartsAt, &p.EndsAt, &p.Message, &p.CreatedAt, &p.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	if orgNull.Valid {
		val := orgNull.String
		p.OrgID = &val
	}
	return &p, nil
}

const systemJobColumns = `id::text,version,kind,requested_by::text,target_id::text,
 CASE WHEN state='SUCCEEDED' AND execution_receipt IS NULL THEN 'PENDING' ELSE state END,
 reason,CASE WHEN approved_at IS NOT NULL THEN approved_by::text END,approved_at,execution_receipt,created_at,updated_at`

func scanSystemJob(row pgx.Row) (*api.SystemJob, error) {
	var job api.SystemJob
	err := row.Scan(&job.ID, &job.Version, &job.Kind, &job.RequestedBy, &job.TargetID, &job.State, &job.Reason, &job.ApprovedBy, &job.ApprovedAt, &job.ExecutionReceipt, &job.CreatedAt, &job.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	return &job, err
}

func (s Store) InsertSystemJob(ctx context.Context, tx pgx.Tx, kind, actor, target, state, reason string, receipt []byte) (*api.SystemJob, error) {
	return scanSystemJob(tx.QueryRow(ctx, `INSERT INTO identity.system_operation_requests
  (id,kind,requested_by,target_id,state,reason,execution_receipt)
  VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING `+systemJobColumns, web.ID(), kind, actor, target, state, reason, receipt))
}

func (s Store) GetSystemJob(ctx context.Context, id string) (*api.SystemJob, error) {
	return scanSystemJob(s.Pool.QueryRow(ctx, `SELECT `+systemJobColumns+` FROM identity.system_operation_requests WHERE id=$1`, id))
}

func (s Store) ListSystemJobs(ctx context.Context, orgs []string, actorID string, superAdmin bool, limit int) ([]api.SystemJob, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+systemJobColumns+` FROM identity.system_operation_requests
		WHERE target_id=ANY($1::uuid[]) OR ($2 AND kind='PURGE_REQUEST')
		ORDER BY created_at DESC, id DESC LIMIT $3`, orgs, superAdmin, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.SystemJob{}
	for rows.Next() {
		job, err := scanSystemJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *job)
	}
	return out, rows.Err()
}

func (s Store) ApproveSystemJob(ctx context.Context, tx pgx.Tx, id, actor, target string, version int64, allowPurge bool) (*api.SystemJob, error) {
	job, err := scanSystemJob(tx.QueryRow(ctx, `UPDATE identity.system_operation_requests
  SET state='APPROVED',approved_by=$2,approved_at=now(),version=version+1,updated_at=now()
  WHERE id=$1 AND version=$3 AND target_id=$4 AND requested_by<>$2 AND (kind='BACKUP_MANIFEST' OR ($5 AND kind='PURGE_REQUEST'))
    AND state='REQUESTED' AND approved_by IS NULL RETURNING `+systemJobColumns, id, actor, version, target, allowPurge))
	if e, ok := err.(*web.Error); ok && e.Status == 404 {
		return nil, web.Fail(409, "Versi atau status pekerjaan berubah")
	}
	return job, err
}

func (s Store) ClaimSystemJobExecution(ctx context.Context, id, target string, version int64, allowPurge bool) (*api.SystemJob, error) {
	job, err := scanSystemJob(s.Pool.QueryRow(ctx, `UPDATE identity.system_operation_requests
  SET state='RUNNING',version=version+1,updated_at=now()
  WHERE id=$1 AND version=$2 AND target_id=$3 AND (kind='BACKUP_MANIFEST' OR ($4 AND kind='PURGE_REQUEST'))
    AND state='APPROVED' AND approved_by IS NOT NULL AND approved_by<>requested_by RETURNING `+systemJobColumns, id, version, target, allowPurge))
	if e, ok := err.(*web.Error); ok && e.Status == 404 {
		return nil, web.Fail(409, "Versi atau status pekerjaan berubah")
	}
	return job, err
}

func (s Store) FinishSystemJobExecution(ctx context.Context, tx pgx.Tx, id, target string, version int64, state string, receipt []byte, allowPurge bool) (*api.SystemJob, error) {
	job, err := scanSystemJob(tx.QueryRow(ctx, `UPDATE identity.system_operation_requests
  SET state=$4,execution_receipt=$5,version=version+1,updated_at=now()
  WHERE id=$1 AND version=$2 AND target_id=$3 AND (kind='BACKUP_MANIFEST' OR ($6 AND kind='PURGE_REQUEST')) AND state='RUNNING'
  RETURNING `+systemJobColumns, id, version, target, state, receipt, allowPurge))
	if e, ok := err.(*web.Error); ok && e.Status == 404 {
		return nil, web.Fail(409, "Versi atau status pekerjaan berubah")
	}
	return job, err
}
