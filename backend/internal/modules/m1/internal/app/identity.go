package app

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m1/internal/domain"
	"helpdesk.local/m0/internal/modules/m1/internal/store"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"net/mail"
	"slices"
	"strings"
	"time"
)

type Options struct {
	Lab    bool
	Key    []byte
	Origin string
}

type Service struct {
	Store          store.Store
	Options        Options
	Diagnostics    func(context.Context) api.RedactedHealth
	BackupManifest api.BackupManifestRunner
}

var LabIDs = []string{
	"20000000-0000-4000-8000-000000000001",
	"20000000-0000-4000-8000-000000000002",
	"20000000-0000-4000-8000-000000000003",
	"20000000-0000-4000-8000-000000000004",
	"20000000-0000-4000-8000-000000000005",
	"20000000-0000-4000-8000-000000000006",
	"20000000-0000-4000-8000-000000000007",
	"20000000-0000-4000-8000-000000000008",
	"20000000-0000-4000-8000-000000000009",
	"20000000-0000-4000-8000-000000000010",
	"20000000-0000-4000-8000-000000000011",
	"20000000-0000-4000-8000-000000000012",
	"20000000-0000-4000-8000-000000000013",
	"20000000-0000-4000-8000-000000000014",
	"20000000-0000-4000-8000-000000000015",
	"20000000-0000-4000-8000-000000000016",
	"20000000-0000-4000-8000-000000000017",
	"20000000-0000-4000-8000-000000000018",
}

func (s *Service) Authenticate(ctx context.Context, c api.Credentials) (api.Actor, error) {
	var zero api.Actor
	if !s.Options.Lab || len(c.Token) != 64 {
		return zero, web.Fail(401, "Silakan masuk melalui identitas lab")
	}
	if _, err := hex.DecodeString(c.Token); err != nil {
		return zero, web.Fail(401, "Sesi tidak valid")
	}
	session, err := s.Store.Session(ctx, domain.Digest(c.Token))
	if err != nil {
		return zero, err
	}
	if c.Write && !domain.EqualHash(c.CSRF, session.CSRF) {
		return zero, web.Fail(403, "Verifikasi CSRF gagal")
	}
	if err := s.applyRolePolicy(ctx, &session.Actor); err != nil {
		return zero, err
	}
	return session.Actor, nil
}

func (s *Service) OrganizationActive(ctx context.Context, id string) (bool, error) {
	return s.Store.OrganizationActive(ctx, id)
}

func (s *Service) Subject(ctx context.Context, id string) (api.Subject, error) {
	return s.Store.Subject(ctx, id)
}

func (s *Service) ActiveMaintenance(ctx context.Context, orgID string) (*api.MaintenancePolicy, error) {
	return s.Store.ActiveMaintenancePolicy(ctx, orgID)
}

func (s *Service) Subjects(ctx context.Context) ([]api.Subject, error) {
	if !s.Options.Lab {
		return nil, web.Fail(403, "Identitas lab dinonaktifkan")
	}
	out := []api.Subject{}
	for _, id := range LabIDs {
		u, err := s.Store.Subject(ctx, id)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, nil
}

type SessionView struct {
	ID              string    `json:"id"`
	Version         int64     `json:"version"`
	SubjectID       string    `json:"subject_id"`
	ExpiresAt       string    `json:"expires_at"`
	Permissions     []string  `json:"permissions"`
	OrganizationIDs []string  `json:"organization_ids"`
	Actor           api.Actor `json:"actor"`
	Mode            string    `json:"mode"`
}

func view(v store.Session) SessionView {
	permissions := []string{}
	for _, m := range v.Actor.Memberships {
		permissions = append(permissions, m.Permissions...)
	}
	mode := "PUBLIC_AUTH_LAB"
	for _, id := range LabIDs {
		if id == v.Actor.ID {
			mode = "SYNTHETIC_LAB"
			break
		}
	}
	return SessionView{v.ID, v.Version, v.Actor.ID, v.Expires.UTC().Format(time.RFC3339), permissions, v.Actor.Orgs(""), v.Actor, mode}
}

func (s *Service) Me(ctx context.Context, c api.Credentials) (SessionView, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return SessionView{}, err
	}
	v, err := s.Store.Session(ctx, domain.Digest(c.Token))
	if err != nil {
		return SessionView{}, err
	}
	v.Actor = actor
	return view(v), nil
}

type Login struct {
	SubjectID  string `json:"lab_subject_id"`
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
	CSRF       string `json:"csrf_token"`
}

type RegisterInput struct {
	NIK      string `json:"nik"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
	CSRF     string `json:"csrf_token"`
}

func (s *Service) RegisterUser(ctx context.Context, in RegisterInput, nonce, key string) (database.Result, string, string, error) {
	var zero database.Result
	if !s.Options.Lab || len(s.Options.Key) < 32 {
		return zero, "", "", web.Fail(403, "Pendaftaran hanya tersedia pada lab yang dikonfigurasi")
	}
	if !validNonce(nonce, in.CSRF) {
		return zero, "", "", web.Fail(403, "Verifikasi CSRF pendaftaran gagal")
	}
	in.NIK, in.Name, in.Email, in.Phone = strings.TrimSpace(in.NIK), strings.TrimSpace(in.Name), strings.ToLower(strings.TrimSpace(in.Email)), strings.TrimSpace(in.Phone)
	if len(in.NIK) != 16 || !digits(in.NIK) {
		return zero, "", "", web.Fail(422, "NIK harus tepat 16 digit angka")
	}
	if len(in.Name) < 3 || len(in.Name) > 200 {
		return zero, "", "", web.Fail(422, "Nama lengkap harus 3–200 karakter")
	}
	address, err := mail.ParseAddress(in.Email)
	if err != nil || address.Address != in.Email || len(in.Email) > 254 {
		return zero, "", "", web.Fail(422, "Alamat email tidak valid")
	}
	if len(in.Phone) < 10 || len(in.Phone) > 16 || !digits(strings.TrimPrefix(in.Phone, "+")) {
		return zero, "", "", web.Fail(422, "Nomor telepon tidak valid")
	}
	if len(in.Password) < 8 || len(in.Password) > 1024 {
		return zero, "", "", web.Fail(422, "Kata sandi harus 8–1024 byte")
	}
	id := derivedID(domain.Derive(s.Options.Key, "registration", nonce+"|"+key))
	payload := map[string]any{"nik": in.NIK, "name": in.Name, "email": in.Email, "phone": in.Phone, "credential_fingerprint": domain.Derive(s.Options.Key, "registration-password", in.Password)}
	token := domain.Derive(s.Options.Key, "session", nonce+"|"+key+"|"+id)
	csrf := domain.Derive(s.Options.Key, "csrf", token)
	sessionID := derivedID(token)
	result, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: "registration:" + domain.Derive(s.Options.Key, "registration-scope", nonce), Command: "RegisterPublicSubject", Target: id, Key: key, Scope: "PUBLIC_REGISTRATION_LAB", Reason: "Pendaftaran akun publik lab", Payload: payload}, func(tx pgx.Tx) (database.Result, error) {
		hash, err := domain.HashPassword(in.Password)
		if err != nil {
			return zero, err
		}
		if err = s.Store.CreatePublicSubject(ctx, tx, id, in.NIK, in.Name, in.Email, in.Phone, hash); err != nil {
			var pgerr *pgconn.PgError
			if errors.As(err, &pgerr) && pgerr.Code == "23505" {
				return zero, web.Fail(409, "Identifier akun telah terdaftar")
			}
			return zero, err
		}
		expires := time.Now().UTC().Add(2 * time.Hour)
		if err = s.Store.CreateSession(ctx, tx, sessionID, id, domain.Digest(token), domain.Digest(csrf), expires); err != nil {
			return zero, err
		}
		return database.Response(201, SessionView{ID: sessionID, Version: 1, SubjectID: id, ExpiresAt: expires.Format(time.RFC3339), Permissions: []string{}, OrganizationIDs: []string{}, Actor: api.Actor{ID: id, Name: in.Name, Role: "PUBLIC", Kind: "PUBLIC", Memberships: []api.Membership{}}, Mode: "PUBLIC_AUTH_LAB"})
	})
	if err != nil {
		return zero, "", "", err
	}
	if _, err = s.Authenticate(ctx, api.Credentials{Token: token}); err != nil {
		return zero, "", "", err
	}
	return result, token, csrf, nil
}

func validNonce(nonce, supplied string) bool {
	decoded, err := hex.DecodeString(nonce)
	return err == nil && len(decoded) == 32 && nonce == supplied
}

func digits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func derivedID(value string) string {
	h := hex.EncodeToString(domain.Digest(value)[:16])
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}

func (s *Service) Login(ctx context.Context, input Login, nonce, key string) (database.Result, string, string, error) {
	var zero database.Result
	if !s.Options.Lab || len(s.Options.Key) < 32 {
		return zero, "", "", web.Fail(403, "Login lab dinonaktifkan")
	}
	if !validNonce(nonce, input.CSRF) {
		return zero, "", "", web.Fail(403, "Verifikasi awal login gagal")
	}
	var user api.Subject
	var err error
	mode := "SYNTHETIC_LAB"
	if input.SubjectID != "" {
		allowed := false
		for _, id := range LabIDs {
			if id == input.SubjectID {
				allowed = true
				break
			}
		}
		if !allowed || input.Identifier != "" || input.Password != "" {
			return zero, "", "", web.Fail(401, "Identitas lab tidak diizinkan")
		}
		user, err = s.Store.LabSubject(ctx, input.SubjectID)
	} else {
		if strings.TrimSpace(input.Identifier) == "" || input.Password == "" || len(input.Identifier) > 254 || len(input.Password) > 1024 {
			return zero, "", "", web.Fail(401, "Identitas atau kata sandi tidak valid")
		}
		var encoded string
		user, encoded, err = s.Store.FindSubjectByIdentifier(ctx, strings.ToLower(strings.TrimSpace(input.Identifier)))
		if err == nil {
			valid, upgrade := domain.VerifyPassword(encoded, input.Password)
			if !valid {
				return zero, "", "", web.Fail(401, "Identitas atau kata sandi tidak valid")
			}
			if upgrade {
				improved, e := domain.HashPassword(input.Password)
				if e != nil {
					return zero, "", "", e
				}
				if e = s.Store.UpgradePassword(ctx, user.ID, encoded, improved); e != nil {
					return zero, "", "", e
				}
			}
		}
		mode = "PUBLIC_AUTH_LAB"
	}
	if err != nil {
		var failure *web.Error
		if errors.As(err, &failure) && failure.Status == 404 {
			return zero, "", "", web.Fail(401, "Identitas atau kata sandi tidak valid")
		}
		return zero, "", "", err
	}
	token := domain.Derive(s.Options.Key, "session", nonce+"|"+key+"|"+user.ID)
	csrf := domain.Derive(s.Options.Key, "csrf", token)
	id := derivedID(token)
	result, err := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: user.ID, Command: "CreateLabSession", Target: id, Key: key, Scope: mode, Reason: "Autentikasi akun lab", Payload: map[string]any{"subject_id": user.ID, "mode": mode, "credential_fingerprint": domain.Derive(s.Options.Key, "login-password", input.Password)}}, func(tx pgx.Tx) (database.Result, error) {
		expires := time.Now().UTC().Add(2 * time.Hour)
		if err = s.Store.CreateSession(ctx, tx, id, user.ID, domain.Digest(token), domain.Digest(csrf), expires); err != nil {
			return zero, err
		}
		return database.Response(201, SessionView{ID: id, Version: 1, SubjectID: user.ID, ExpiresAt: expires.Format(time.RFC3339), Permissions: []string{}, OrganizationIDs: []string{}, Actor: api.Actor{ID: user.ID, Name: user.Name, Role: user.Role, Kind: user.Kind, Memberships: []api.Membership{}}, Mode: mode})
	})
	if err != nil {
		return zero, "", "", err
	}
	if _, err = s.Authenticate(ctx, api.Credentials{Token: token}); err != nil {
		return zero, "", "", err
	}
	return result, token, csrf, nil
}

type Reason struct {
	ExpectedVersion int64  `json:"expected_version"`
	Reason          string `json:"reason"`
}

func (s *Service) Logout(ctx context.Context, c api.Credentials, input Reason, key string) (database.Result, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return database.Result{}, err
	}
	session, err := s.Store.Session(ctx, domain.Digest(c.Token))
	if err != nil {
		return database.Result{}, err
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: "RevokeSession", Target: session.ID, Key: key, Scope: "session", Reason: "Logout", Payload: input}, func(tx pgx.Tx) (database.Result, error) {
		e := s.Store.RevokeSession(ctx, tx, session.ID, input.ExpectedVersion)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, map[string]any{"id": session.ID, "version": session.Version + 1})
	})
}

type MasterInput = api.MasterInput

func (s *Service) List(ctx context.Context, c api.Credentials, kind string, p web.Page) (any, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	orgs := actor.Orgs("identity.grant")
	if (kind == "organizations" || kind == "divisions") && len(actor.Orgs("identity.organization.create")) > 0 {
		references, err := s.Store.ReportingReferenceIDs(ctx)
		if err != nil {
			return nil, err
		}
		orgs = append(orgs, references...)
	}
	if p.Organization != "" {
		if !slices.Contains(orgs, p.Organization) {
			return nil, web.Fail(404, "Scope organisasi tidak ditemukan")
		}
		orgs = []string{p.Organization}
	}
	if len(orgs) == 0 {
		return nil, web.Fail(403, "Master identitas tidak diizinkan")
	}
	switch kind {
	case "organizations":
		v, e := s.Store.Organizations(ctx, orgs, p)
		return web.List(v, p.Limit, func(v api.Organization) string { return v.ID }), e
	case "teams":
		v, e := s.Store.Teams(ctx, orgs, p)
		return web.List(v, p.Limit, func(v api.Team) string { return v.ID }), e
	case "divisions":
		v, e := s.Store.Divisions(ctx, orgs, p)
		return web.List(v, p.Limit, func(v api.Division) string { return v.ID }), e
	case "memberships":
		v, e := s.Store.Bindings(ctx, orgs, p)
		return web.List(v, p.Limit, func(v api.Binding) string { return v.ID }), e
	}
	return nil, web.Fail(404, "Master tidak ditemukan")
}

func (s *Service) Save(ctx context.Context, c api.Credentials, kind, id, key string, in MasterInput) (database.Result, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return database.Result{}, err
	}
	create := id == ""
	if !create && in.ExpectedVersion < 1 {
		return database.Result{}, web.Fail(422, "Expected version diperlukan")
	}
	if !create && !web.UUID(id) {
		return database.Result{}, web.Fail(404, "Objek tidak ditemukan")
	}
	if create {
		id = web.ID()
	}
	org := in.OrganizationID
	canManage := func(org string) (bool, error) {
		if actor.Can("identity.grant", org) {
			return true, nil
		}
		if (kind == "organizations" || kind == "divisions") && web.UUID(org) && len(actor.Orgs("identity.organization.create")) > 0 {
			return s.Store.IsReportingReference(ctx, org)
		}
		return false, nil
	}
	if kind == "organizations" {
		org = id
		if create {
			if len(actor.Orgs("identity.organization.create")) == 0 {
				return database.Result{}, web.Fail(403, "Pembuatan organisasi tidak diizinkan")
			}
		} else {
			ok, err := canManage(org)
			if err != nil {
				return database.Result{}, err
			}
			if !ok {
				return database.Result{}, web.Fail(404, "Organisasi tidak ditemukan")
			}
		}
	} else {
		ok, err := canManage(org)
		if err != nil {
			return database.Result{}, err
		}
		if !web.UUID(org) || !ok {
			return database.Result{}, web.Fail(404, "Scope organisasi tidak ditemukan")
		}
	}
	if kind != "memberships" && !domain.Text(in.Name, 200) {
		return database.Result{}, web.Fail(422, "Nama diperlukan (maksimum 200 karakter)")
	}
	if kind == "organizations" && (len(in.Code) < 1 || len(in.Code) > 64 || strings.ContainsAny(in.Code, " /\\")) {
		return database.Result{}, web.Fail(422, "Kode organisasi tidak valid")
	}
	var expires time.Time
	if kind == "teams" && !create {
		existing, e := s.Store.TeamOrganization(ctx, id)
		if e != nil {
			return database.Result{}, e
		}
		if existing != org {
			return database.Result{}, web.Fail(404, "Tim tidak ditemukan")
		}
	}
	if kind == "memberships" {
		if in.Permissions == nil || !web.UUID(in.SubjectID) || len(in.Permissions) > 100 || !domain.Text(in.Reason, 4000) {
			return database.Result{}, web.Fail(422, "Subject, izin dan alasan diperlukan")
		}
		expires, err = time.Parse(time.RFC3339, in.ExpiresAt)
		if err != nil || !expires.After(time.Now()) || expires.After(time.Now().AddDate(2, 0, 0)) {
			return database.Result{}, web.Fail(422, "Masa berlaku harus di masa depan dan maksimal dua tahun")
		}
		user, e := s.Store.Subject(ctx, in.SubjectID)
		if e != nil {
			return database.Result{}, e
		}
		ceiling := []string{}
		for _, m := range actor.Memberships {
			if m.OrganizationID == org {
				ceiling = append(ceiling, m.GrantCeiling...)
			}
		}
		policy, err := s.policy(ctx, user.Role)
		if err != nil {
			return database.Result{}, err
		}
		if !domain.Subset(in.Permissions, ceiling) || !domain.Subset(in.Permissions, policy.Permissions) {
			return database.Result{}, web.Fail(403, "Izin melebihi grant ceiling atau peran subject")
		}
		if !create {
			existing, e := s.Store.Binding(ctx, id)
			if e != nil {
				return database.Result{}, e
			}
			if existing.OrganizationID != org || existing.SubjectID != in.SubjectID {
				return database.Result{}, web.Fail(404, "Membership tidak ditemukan")
			}
		}
	}
	status := 200
	if in.Reason == "" {
		in.Reason = "Master identitas"
	}
	if create {
		status = 201
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M1", Actor: actor.ID, Command: map[string]map[bool]string{"organizations": {true: "CreateOrganization", false: "UpdateOrganization"}, "divisions": {true: "CreateDivision", false: "UpdateDivision"}, "teams": {true: "CreateTeam", false: "UpdateTeam"}, "memberships": {true: "GrantMembership", false: "UpdateMembership"}}[kind][create], Target: map[bool]string{true: "new", false: id}[create], Key: key, Scope: org, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		inherited := api.Membership{}
		for _, m := range actor.Memberships {
			for _, p := range m.Permissions {
				if p == "identity.organization.create" {
					inherited = m
				}
			}
		}
		version, e := s.Store.SaveMaster(ctx, tx, kind, id, org, actor.ID, create, in, expires, inherited)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(status, map[string]any{"id": id, "version": version})
	})
}

// DecodeReplay is used by transport to return stored public responses unchanged.
func DecodeReplay(raw json.RawMessage) json.RawMessage { return raw }

func (s *Service) Access(ctx context.Context, id string) (api.Actor, error) {
	u, err := s.Store.Subject(ctx, id)
	if err != nil {
		return api.Actor{}, err
	}
	memberships, err := s.Store.Memberships(ctx, id)
	if err != nil {
		return api.Actor{}, err
	}
	a := api.Actor{ID: u.ID, Name: u.Name, Kind: u.Kind, Role: u.Role, Memberships: memberships}
	if err := s.applyRolePolicy(ctx, &a); err != nil {
		return api.Actor{}, err
	}
	return a, nil
}

func (s *Service) ActiveTeamInOrg(ctx context.Context, team, org string) (bool, error) {
	return s.Store.ActiveTeamInOrg(ctx, team, org)
}
