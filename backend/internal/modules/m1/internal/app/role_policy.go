package app

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m1/internal/domain"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type rolePolicy struct {
	Role        string   `json:"role"`
	Version     int64    `json:"version"`
	Permissions []string `json:"permissions"`
	Available   []string `json:"available"`
	Editable    bool     `json:"editable"`
}

type rolePolicyInput struct {
	ExpectedVersion int64    `json:"expected_version"`
	Permissions     []string `json:"permissions"`
	Reason          string   `json:"reason"`
}

const (
	labSuperAdminID = "20000000-0000-4000-8000-000000000017"
	labReportsOrgID = "10000000-0000-4000-8000-000000000001"
)

func editableRole(role string) bool {
	switch role {
	case "OPERATOR", "TECHNICIAN", "COORDINATOR", "LEADERSHIP", "ADMIN_OPD", "PLATFORM_ADMIN", "EDITOR", "PUBLISHER", "AUDITOR":
		return true
	}
	return false
}

func availableRolePermissions(role string) []string {
	permissions := append([]string{}, domain.RolePermissions[role]...)
	// The role matrix can delegate editorial duties between staff roles. Core
	// security, ticket access and administrative capabilities keep their role limits.
	if editableRole(role) {
		for _, p := range []string{"hero.write", "hero.publish", "content.read", "content.write", "content.publish", "media.read", "media.write", "media.reuse"} {
			if !slices.Contains(permissions, p) {
				permissions = append(permissions, p)
			}
		}
	}
	return permissions
}

func (s *Service) policy(ctx context.Context, role string) (rolePolicy, error) {
	available := availableRolePermissions(role)
	out := rolePolicy{Role: role, Permissions: append([]string{}, domain.RolePermissions[role]...), Available: available, Editable: editableRole(role)}
	if !out.Editable {
		return out, nil
	}
	err := s.Store.Pool.QueryRow(ctx, `SELECT version,permissions FROM identity.role_module_policies
		WHERE role_code=$1 ORDER BY version DESC LIMIT 1`, role).Scan(&out.Version, &out.Permissions)
	if err == pgx.ErrNoRows {
		return out, nil
	}
	if err == nil {
		out.Permissions = slices.DeleteFunc(out.Permissions, func(p string) bool { return !slices.Contains(available, p) })
	}
	return out, err
}

func (s *Service) applyRolePolicy(ctx context.Context, actor *api.Actor, labSession bool) error {
	policy, err := s.policy(ctx, actor.Role)
	if err != nil {
		return err
	}
	// The lab fixture has a dedicated read grant for the dashboard demonstration.
	labReports := s.Options.Lab && labSession &&
		actor.ID == labSuperAdminID && actor.Kind == "STAFF" && actor.Role == "SUPER_ADMIN"
	for i := range actor.Memberships {
		m := &actor.Memberships[i]
		labReportScope := labReports && m.OrganizationActive && m.TeamID == nil && m.OrganizationID == labReportsOrgID
		filtered := make([]string, 0, len(m.Permissions))
		for _, p := range m.Permissions {
			if slices.Contains(policy.Permissions, p) || (labReportScope && p == "report.read") {
				filtered = append(filtered, p)
			}
		}
		m.Permissions = filtered
	}
	return nil
}

func (s *Service) rolePolicyActor(r *http.Request) (api.Actor, error) {
	actor, err := s.Authenticate(r.Context(), Credentials(r))
	if err != nil {
		return api.Actor{}, err
	}
	if actor.Kind != "STAFF" || actor.Role != "SUPER_ADMIN" {
		return api.Actor{}, web.Fail(403, "Pengaturan peran dikelola Super Admin")
	}
	for _, m := range actor.Memberships {
		if m.OrganizationActive && slices.Contains(m.Permissions, "identity.role.manage") {
			return actor, nil
		}
	}
	return api.Actor{}, web.Fail(403, "Mandat pengaturan peran diperlukan")
}

func (s *Service) registerRolePolicies(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/admin/role-policies", func(w http.ResponseWriter, r *http.Request) {
		if _, err := s.rolePolicyActor(r); err != nil {
			web.WriteError(w, err)
			return
		}
		roles := make([]string, 0, len(domain.RolePermissions))
		for role := range domain.RolePermissions {
			if editableRole(role) || role == "SUPER_ADMIN" {
				roles = append(roles, role)
			}
		}
		slices.Sort(roles)
		items := make([]rolePolicy, 0, len(roles))
		for _, role := range roles {
			policy, err := s.policy(r.Context(), role)
			if err != nil {
				web.WriteError(w, err)
				return
			}
			items = append(items, policy)
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"items": items})
	})
	mux.HandleFunc("PUT /api/v1/admin/role-policies/{role}", func(w http.ResponseWriter, r *http.Request) {
		actor, err := s.rolePolicyActor(r)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		role := r.PathValue("role")
		if !editableRole(role) {
			web.WriteError(w, web.Fail(403, "Peran ini dilindungi"))
			return
		}
		var in rolePolicyInput
		if err := web.Decode(w, r, &in); err != nil {
			web.WriteError(w, err)
			return
		}
		in.Reason = strings.TrimSpace(in.Reason)
		if in.ExpectedVersion < 0 || in.Permissions == nil || len(in.Permissions) > 100 ||
			utf8.RuneCountInString(in.Reason) < 5 || len(in.Reason) > 1000 ||
			!domain.Subset(in.Permissions, availableRolePermissions(role)) {
			web.WriteError(w, web.Fail(422, "Izin harus dalam batas peran dan alasan wajib diisi"))
			return
		}
		slices.Sort(in.Permissions)
		in.Permissions = slices.Compact(in.Permissions)
		ctx := r.Context()
		result, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "SetRoleModulePolicy",
			Target: role, Scope: "ROLE:" + role, Key: r.Header.Get("Idempotency-Key"), Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
			if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "role-policy:"+role); err != nil {
				return database.Result{}, err
			}
			var version int64
			if err := tx.QueryRow(ctx, `SELECT coalesce(max(version),0) FROM identity.role_module_policies WHERE role_code=$1`, role).Scan(&version); err != nil {
				return database.Result{}, err
			}
			if version != in.ExpectedVersion {
				return database.Result{}, web.Fail(409, "Kebijakan berubah. Muat ulang sebelum menyimpan")
			}
			id := web.ID()
			if _, err := tx.Exec(ctx, `INSERT INTO identity.role_module_policies(id,role_code,version,permissions) VALUES($1,$2,$3,$4)`, id, role, version+1, in.Permissions); err != nil {
				return database.Result{}, err
			}
			return database.Response(200, map[string]any{"id": id, "version": version + 1})
		})
		if err != nil {
			web.WriteError(w, err)
			return
		}
		web.JSON(w, result.Status, result.Body)
	})
	mux.HandleFunc("GET /api/v1/admin/assignable-role/{role}", func(w http.ResponseWriter, r *http.Request) {
		actor, err := s.Authenticate(r.Context(), Credentials(r))
		if err != nil {
			web.WriteError(w, err)
			return
		}
		allowed := false
		for _, m := range actor.Memberships {
			if m.OrganizationActive && slices.Contains(m.Permissions, "identity.grant") {
				allowed = true
				break
			}
		}
		if !allowed {
			web.WriteError(w, web.Fail(403, "Mandat pengelolaan akun diperlukan"))
			return
		}
		role := r.PathValue("role")
		if _, ok := domain.RolePermissions[role]; !ok {
			web.WriteError(w, web.Fail(404, "Peran tidak ditemukan"))
			return
		}
		policy, err := s.policy(r.Context(), role)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"permissions": policy.Permissions})
	})
}
