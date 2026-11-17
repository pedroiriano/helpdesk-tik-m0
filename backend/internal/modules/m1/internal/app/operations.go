package app

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/database"
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m1/internal/domain"
	"helpdesk.local/m0/internal/platform/web"
)

// ConfigureMaintenance schedules a maintenance policy window (AC24).
func (s *Service) ConfigureMaintenance(ctx context.Context, c api.Credentials, in api.MaintenancePolicyInput, key string) (*api.MaintenancePolicy, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}

	if !s.hasPermission(actor, "system.maintenance") {
		return nil, web.Fail(403, "Izin system.maintenance diperlukan")
	}

	if in.OrgID == nil && in.OrganizationID != "" {
		in.OrgID = &in.OrganizationID
	}
	if in.Message == "" {
		in.Message = "Jendela pemeliharaan sistem aktif"
	}

	if err := domain.ValidateMaintenancePolicy(in); err != nil {
		return nil, err
	}

	policy, err := s.Store.InsertMaintenancePolicy(ctx, in)
	if err != nil {
		return nil, err
	}

	return policy, nil
}

func (s *Service) RequestSystemJob(ctx context.Context, c api.Credentials, in api.SystemJobInput, key string) (*api.SystemJob, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	in.Kind, in.Reason = strings.TrimSpace(in.Kind), strings.TrimSpace(in.Reason)
	if err := domain.ValidateSystemJob(in.Kind, actor.Role); err != nil {
		return nil, err
	}
	if in.ApprovedBy != nil {
		return nil, web.Fail(400, "Gunakan tindakan persetujuan terautentikasi")
	}
	if in.TargetID == "" {
		orgs := actor.Orgs("system.job")
		if len(orgs) == 1 {
			in.TargetID = orgs[0]
		}
	}
	if !web.UUID(in.TargetID) {
		return nil, web.Fail(400, "Organisasi target wajib diisi")
	}
	if !actor.Can("system.job", in.TargetID) {
		return nil, web.Fail(403, "Organisasi target di luar mandat pekerjaan")
	}
	if in.Reason == "" || len(in.Reason) > 500 {
		return nil, web.Fail(422, "Alasan pekerjaan wajib diisi, maksimal 500 karakter")
	}
	if len(key) < 16 || len(key) > 128 {
		return nil, web.Fail(400, "Idempotency-Key diperlukan (16–128 karakter)")
	}
	state := "REQUESTED"
	var receipt []byte
	switch in.Kind {
	case "HEALTH_REPORT":
		if !actor.Can("system.health", in.TargetID) {
			return nil, web.Fail(403, "Izin system.health diperlukan")
		}
		health, err := s.diagnostics(ctx)
		if err != nil {
			return nil, err
		}
		state = "SUCCEEDED"
		receipt, err = json.Marshal(health)
		if err != nil {
			return nil, err
		}
	case "PURGE_REQUEST":
		state = "DISABLED"
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "RequestSystemJob", Target: in.TargetID, Key: key, Scope: in.TargetID, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		job, err := s.Store.InsertSystemJob(ctx, tx, in.Kind, actor.ID, in.TargetID, state, in.Reason, receipt)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(202, job)
	})
	return systemJobResult(res, err)
}

func systemJobResult(res database.Result, err error) (*api.SystemJob, error) {
	if err != nil {
		return nil, err
	}
	var job api.SystemJob
	err = json.Unmarshal(res.Body, &job)
	return &job, err
}

func (s *Service) ReadSystemJob(ctx context.Context, c api.Credentials, id string) (*api.SystemJob, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if !web.UUID(id) {
		return nil, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	job, err := s.Store.GetSystemJob(ctx, id)
	if err != nil {
		return nil, err
	}
	scoped := actor.Can("system.job", job.TargetID) || actor.Can("operation.read", job.TargetID)
	ownDisabled := job.Kind == "PURGE_REQUEST" && job.State == "DISABLED" && actor.Role == "SUPER_ADMIN" && job.RequestedBy == actor.ID
	if !scoped && !ownDisabled {
		return nil, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	return job, nil
}

func (s *Service) ApproveSystemJob(ctx context.Context, c api.Credentials, id, key string, in api.ApproveSystemJobInput) (*api.SystemJob, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if !web.UUID(id) {
		return nil, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	job, err := s.Store.GetSystemJob(ctx, id)
	if err != nil {
		return nil, err
	}
	if !actor.Can("system.job", job.TargetID) || actor.ID == job.RequestedBy {
		return nil, web.Fail(403, "Persetujuan memerlukan petugas kedua dengan mandat organisasi yang sama")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || in.Reason == "" || len(in.Reason) > 500 {
		return nil, web.Fail(422, "Versi dan alasan persetujuan wajib diisi")
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "ApproveSystemJob", Target: id, Key: key, Scope: job.TargetID, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.ApproveSystemJob(ctx, tx, id, actor.ID, job.TargetID, in.ExpectedVersion)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
	return systemJobResult(res, err)
}

func (s *Service) ExecuteSystemJob(ctx context.Context, c api.Credentials, id, key string, in api.ExecuteSystemJobInput) (*api.SystemJob, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if !web.UUID(id) {
		return nil, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	job, err := s.Store.GetSystemJob(ctx, id)
	if err != nil {
		return nil, err
	}
	if !actor.Can("system.job", job.TargetID) {
		return nil, web.Fail(403, "Izin system.job pada organisasi sasaran diperlukan")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || in.Reason == "" || len(in.Reason) > 500 {
		return nil, web.Fail(422, "Versi dan alasan eksekusi wajib diisi")
	}
	replay, found, err := database.LookupIdempotency(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "ExecuteSystemJob", Target: id, Key: key, Scope: job.TargetID, Reason: in.Reason, Payload: in})
	if err != nil {
		return nil, err
	}
	if found {
		return systemJobResult(replay, nil)
	}
	if job.Kind != "BACKUP_MANIFEST" {
		return nil, web.Fail(422, "Hanya pekerjaan BACKUP_MANIFEST yang dapat dijalankan melalui runner")
	}
	if job.State != "APPROVED" || job.ApprovedBy == nil || *job.ApprovedBy == job.RequestedBy {
		return nil, web.Fail(409, "Pekerjaan harus berstatus APPROVED dari petugas kedua sebelum dijalankan")
	}
	if job.Version != in.ExpectedVersion {
		return nil, web.Fail(409, "Versi atau status pekerjaan berubah")
	}
	if s.BackupManifest.Execute == nil {
		return nil, web.Fail(503, "Runner manifest backup belum tersedia")
	}
	running, err := s.Store.ClaimSystemJobExecution(ctx, id, job.TargetID, in.ExpectedVersion)
	if err != nil {
		return nil, err
	}
	execCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	receipt, execErr := s.BackupManifest.Execute(execCtx, job.TargetID, job.ID, actor.ID, running.Version)
	cancel()
	finalState := "SUCCEEDED"
	if execErr != nil || len(receipt) == 0 {
		finalState = "FAILED"
		code := "EXECUTION_FAILED"
		if strings.TrimSpace(code) != "" {
			if we, ok := execErr.(*web.Error); ok {
				code = fmt.Sprintf("HTTP_%d", we.Status)
			}
		}
		receipt, _ = json.Marshal(map[string]any{
			"status":      "FAILED",
			"error_code":  code,
			"executed_by": actor.ID,
			"executed_at": time.Now().UTC(),
		})
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "ExecuteSystemJob", Target: id, Key: key, Scope: job.TargetID, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.FinishSystemJobExecution(ctx, tx, id, job.TargetID, running.Version, finalState, receipt)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
	return systemJobResult(res, err)
}

func (s *Service) ReadSystemJobArtifact(ctx context.Context, c api.Credentials, id string) (api.BackupManifestArtifact, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return api.BackupManifestArtifact{}, err
	}
	if !web.UUID(id) {
		return api.BackupManifestArtifact{}, web.Fail(404, "Pekerjaan sistem tidak ditemukan")
	}
	job, err := s.Store.GetSystemJob(ctx, id)
	if err != nil {
		return api.BackupManifestArtifact{}, err
	}
	if !actor.Can("system.job", job.TargetID) {
		return api.BackupManifestArtifact{}, web.Fail(403, "Izin system.job pada organisasi sasaran diperlukan")
	}
	if job.Kind != "BACKUP_MANIFEST" || job.State != "SUCCEEDED" || len(job.ExecutionReceipt) == 0 {
		return api.BackupManifestArtifact{}, web.Fail(409, "Artefak manifest hanya tersedia setelah pekerjaan SUCCEEDED")
	}
	if s.BackupManifest.ReadArtifact == nil {
		return api.BackupManifestArtifact{}, web.Fail(503, "Pembaca artefak manifest belum tersedia")
	}
	return s.BackupManifest.ReadArtifact(ctx, job.ID, job.ExecutionReceipt)
}

func (s *Service) diagnostics(ctx context.Context) (*api.RedactedHealth, error) {
	if s.Diagnostics == nil {
		return nil, web.Fail(503, "Probe diagnostik belum tersedia")
	}
	probe, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	health := s.Diagnostics(probe)
	return &health, nil
}

func (s *Service) ReadRedactedHealth(ctx context.Context, c api.Credentials) (*api.RedactedHealth, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if !s.hasPermission(actor, "system.health") {
		return nil, web.Fail(403, "Izin system.health diperlukan")
	}
	return s.diagnostics(ctx)
}

func (s *Service) RequestPurge(ctx context.Context, c api.Credentials, in api.PurgeRequestInput, key string) (*api.SystemJob, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if actor.Role != "SUPER_ADMIN" {
		return nil, web.Fail(403, "Hanya Super Admin dapat mencatat permohonan pemusnahan")
	}
	target := in.ObjectID
	if target == "" {
		target = in.TargetID
	}
	if !web.UUID(target) {
		return nil, web.Fail(400, "ID objek tidak valid")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.Reason == "" {
		in.Reason = "Permohonan pemusnahan data"
	}
	if len(in.Reason) > 500 {
		return nil, web.Fail(422, "Alasan maksimal 500 karakter")
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "RequestPurge", Target: target, Key: key, Scope: "purge-disabled", Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		job, err := s.Store.InsertSystemJob(ctx, tx, "PURGE_REQUEST", actor.ID, target, "DISABLED", in.Reason, nil)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(202, job)
	})
	return systemJobResult(res, err)
}

// hasPermission checks if an actor possesses a specific permission.
func (s *Service) hasPermission(actor api.Actor, perm string) bool {
	if actor.Role == "SUPER_ADMIN" {
		return true
	}
	for _, m := range actor.Memberships {
		if !m.OrganizationActive {
			continue
		}
		for _, p := range m.Permissions {
			if p == perm {
				return true
			}
		}
	}
	return false
}
