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
	if in.OrgID != nil && *in.OrgID != "" {
		if web.UUID(*in.OrgID) && !actor.Can("system.maintenance", *in.OrgID) {
			return nil, web.Fail(403, "Organisasi target di luar mandat system.maintenance")
		}
	} else if actor.Role != "SUPER_ADMIN" && actor.Role != "PLATFORM_ADMIN" {
		orgs := actor.Orgs("system.maintenance")
		if len(orgs) == 1 {
			in.OrgID = &orgs[0]
		} else {
			return nil, web.Fail(403, "Pemeliharaan global memerlukan kewenangan Platform Admin atau Super Admin; tentukan organisasi target")
		}
	}
	if in.Message == "" {
		in.Message = "Jendela pemeliharaan sistem aktif"
	}
	if strings.TrimSpace(in.ScheduleKind) == "" {
		if in.Mode != "NORMAL" && in.StartsAt.After(time.Now().UTC().Add(2*time.Minute)) {
			in.ScheduleKind = "SCHEDULED"
		} else {
			in.ScheduleKind = "UNSCHEDULED"
		}
	} else {
		in.ScheduleKind = strings.TrimSpace(in.ScheduleKind)
	}
	if strings.TrimSpace(in.DisplayMode) == "" {
		in.DisplayMode = "BANNER"
	} else {
		in.DisplayMode = strings.TrimSpace(in.DisplayMode)
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

// PublicMaintenanceStatus exposes safe maintenance status and upcoming windows for public views.
func (s *Service) PublicMaintenanceStatus(ctx context.Context) (api.PublicMaintenanceStatus, error) {
	active, upcoming, _, err := s.Store.MaintenanceOverview(ctx, "", 1)
	if err != nil {
		return api.PublicMaintenanceStatus{}, err
	}
	return api.PublicMaintenanceStatus{
		Active:     active,
		Upcoming:   upcoming,
		ObservedAt: time.Now().UTC(),
	}, nil
}

// ListMaintenanceOverview returns active, upcoming, and recent windows scoped for system.maintenance admins.
func (s *Service) ListMaintenanceOverview(ctx context.Context, c api.Credentials, orgID string) (api.AdminMaintenanceOverview, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return api.AdminMaintenanceOverview{}, err
	}
	if !s.hasPermission(actor, "system.maintenance") && !s.hasPermission(actor, "system.health") {
		return api.AdminMaintenanceOverview{}, web.Fail(403, "Izin system.maintenance atau system.health diperlukan")
	}
	scopeOrg := strings.TrimSpace(orgID)
	if scopeOrg != "" {
		if !web.UUID(scopeOrg) {
			return api.AdminMaintenanceOverview{}, web.Fail(400, "ID organisasi tidak valid")
		}
		if !actor.Can("system.maintenance", scopeOrg) && !actor.Can("system.health", scopeOrg) {
			return api.AdminMaintenanceOverview{}, web.Fail(403, "Organisasi di luar mandat system.maintenance")
		}
	} else if actor.Role != "SUPER_ADMIN" && actor.Role != "PLATFORM_ADMIN" {
		orgs := actor.Orgs("system.maintenance")
		if len(orgs) == 0 {
			orgs = actor.Orgs("system.health")
		}
		if len(orgs) > 0 {
			scopeOrg = orgs[0]
		}
	}
	active, upcoming, recent, err := s.Store.MaintenanceOverview(ctx, scopeOrg, 15)
	if err != nil {
		return api.AdminMaintenanceOverview{}, err
	}
	return api.AdminMaintenanceOverview{
		Active:     active,
		Upcoming:   upcoming,
		Recent:     recent,
		ObservedAt: time.Now().UTC(),
	}, nil
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
		if !s.Options.PurgeEnabled {
			state = "DISABLED"
		} else {
			if s.Purge.Preflight == nil {
				return nil, web.Fail(503, "Runner pemusnahan retensi belum tersedia")
			}
			if err := s.Purge.Preflight(ctx, in.TargetID); err != nil {
				return nil, err
			}
			state = "REQUESTED"
		}
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

func (s *Service) ListSystemJobs(ctx context.Context, c api.Credentials, limit int) ([]api.SystemJob, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	seen := map[string]bool{}
	orgs := []string{}
	for _, perm := range []string{"system.job", "operation.read"} {
		for _, org := range actor.Orgs(perm) {
			if !seen[org] {
				seen[org] = true
				orgs = append(orgs, org)
			}
		}
	}
	if len(orgs) == 0 && actor.Role != "SUPER_ADMIN" {
		return nil, web.Fail(403, "Izin pekerjaan sistem diperlukan")
	}
	return s.Store.ListSystemJobs(ctx, orgs, actor.ID, actor.Role == "SUPER_ADMIN", limit)
}

func (s *Service) ListStaffDirectory(ctx context.Context, c api.Credentials, orgID string) ([]api.Subject, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if actor.Kind != "STAFF" {
		return nil, web.Fail(403, "Hanya petugas internal yang dapat melihat direktori staf")
	}
	if !web.UUID(orgID) {
		return nil, web.Fail(400, "organization_id wajib UUID valid")
	}
	if !actor.Can("ticket.read", orgID) && !actor.Can("ticket.vendor", orgID) && !actor.Can("ticket.dispatch", orgID) {
		return nil, web.Fail(403, "Organisasi di luar mandat staf")
	}
	return s.Store.StaffInOrg(ctx, orgID)
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
	ownPurge := job.Kind == "PURGE_REQUEST" && actor.Role == "SUPER_ADMIN"
	if !scoped && !ownPurge {
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
	if job.Kind == "PURGE_REQUEST" {
		if !s.Options.PurgeEnabled || actor.Role != "SUPER_ADMIN" || actor.ID == job.RequestedBy {
			return nil, web.Fail(403, "Persetujuan pemusnahan memerlukan Super Admin kedua (DEC-M07)")
		}
	} else if !actor.Can("system.job", job.TargetID) || actor.ID == job.RequestedBy {
		return nil, web.Fail(403, "Persetujuan memerlukan petugas kedua dengan mandat organisasi yang sama")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.ExpectedVersion < 1 || in.Reason == "" || len(in.Reason) > 500 {
		return nil, web.Fail(422, "Versi dan alasan persetujuan wajib diisi")
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "ApproveSystemJob", Target: id, Key: key, Scope: job.TargetID, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.ApproveSystemJob(ctx, tx, id, actor.ID, job.TargetID, in.ExpectedVersion, s.Options.PurgeEnabled)
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
	if job.Kind == "PURGE_REQUEST" {
		if !s.Options.PurgeEnabled || actor.Role != "SUPER_ADMIN" {
			return nil, web.Fail(403, "Eksekusi pemusnahan hanya untuk Super Admin saat DEC-M07 aktif")
		}
	} else if !actor.Can("system.job", job.TargetID) {
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
	if job.Kind != "BACKUP_MANIFEST" && (job.Kind != "PURGE_REQUEST" || !s.Options.PurgeEnabled) {
		return nil, web.Fail(422, "Jenis pekerjaan ini tidak dapat dijalankan melalui runner")
	}
	if job.State != "APPROVED" || job.ApprovedBy == nil || *job.ApprovedBy == job.RequestedBy {
		return nil, web.Fail(409, "Pekerjaan harus berstatus APPROVED dari petugas kedua sebelum dijalankan")
	}
	if job.Version != in.ExpectedVersion {
		return nil, web.Fail(409, "Versi atau status pekerjaan berubah")
	}
	if job.Kind == "BACKUP_MANIFEST" && s.BackupManifest.Execute == nil {
		return nil, web.Fail(503, "Runner manifest backup belum tersedia")
	}
	if job.Kind == "PURGE_REQUEST" && (s.Purge.Execute == nil || s.Purge.Preflight == nil) {
		return nil, web.Fail(503, "Runner pemusnahan retensi belum tersedia")
	}
	running, err := s.Store.ClaimSystemJobExecution(ctx, id, job.TargetID, in.ExpectedVersion, s.Options.PurgeEnabled)
	if err != nil {
		return nil, err
	}
	execCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	var receipt []byte
	var execErr error
	if job.Kind == "PURGE_REQUEST" {
		receipt, execErr = s.Purge.Execute(execCtx, job.TargetID, actor.ID, in.Reason)
	} else {
		receipt, execErr = s.BackupManifest.Execute(execCtx, job.TargetID, job.ID, actor.ID, running.Version)
	}
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
		updated, err := s.Store.FinishSystemJobExecution(ctx, tx, id, job.TargetID, running.Version, finalState, receipt, s.Options.PurgeEnabled)
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
	state := "DISABLED"
	scope := "purge-disabled"
	if s.Options.PurgeEnabled {
		if s.Purge.Preflight == nil {
			return nil, web.Fail(503, "Runner pemusnahan retensi belum tersedia")
		}
		if err := s.Purge.Preflight(ctx, target); err != nil {
			return nil, err
		}
		state = "REQUESTED"
		scope = "purge-retention"
	}
	res, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "RequestPurge", Target: target, Key: key, Scope: scope, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		job, err := s.Store.InsertSystemJob(ctx, tx, "PURGE_REQUEST", actor.ID, target, state, in.Reason, nil)
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
