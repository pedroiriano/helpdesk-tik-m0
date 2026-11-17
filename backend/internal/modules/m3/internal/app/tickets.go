package app

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	catalog "helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/domain"
	"helpdesk.local/m0/internal/modules/m3/internal/store"
	classify "helpdesk.local/m0/internal/modules/m4/api"
	assignment "helpdesk.local/m0/internal/modules/m5/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"slices"
	"strconv"
	"strings"
	"time"
)

type Credentials struct {
	Identity                              identity.Credentials
	Capability, Tracking, CSRF, Bootstrap string
}
type Service struct {
	Store                store.Store
	Identity             identity.Port
	Catalog              catalog.Port
	Classifier           classify.Port
	Assignment           assignment.Port
	Calendar             sla.Port
	Key                  []byte
	Origin               string
	Now                  func() time.Time
	LabLifecycle         bool
	Files                FilePort
	SharedBlobReferences func(context.Context, string) (bool, error)
	UploadSlots          chan struct{}
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}
func (s *Service) actor(ctx context.Context, c Credentials, write bool) (identity.Actor, store.Scope, error) {
	if c.Identity.Token != "" {
		c.Identity.Write = write
		a, e := s.Identity.Authenticate(ctx, c.Identity)
		return a, store.Scope{ID: a.ID, Orgs: a.Orgs("ticket.read"), Role: a.Role, Internal: a.Kind == "STAFF" && len(a.Orgs("ticket.read")) > 0}, e
	}
	if c.Tracking != "" {
		v, e := s.Store.Track(ctx, domain.Hash(c.Tracking))
		if e != nil {
			return identity.Actor{}, store.Scope{}, e
		}
		if write && !store.ValidCSRF(domain.Hash(c.CSRF), v.CSRF) {
			return identity.Actor{}, store.Scope{}, web.Fail(403, "CSRF pelacakan tidak valid")
		}
		return identity.Actor{ID: v.CapabilityID, Kind: "GUEST", Role: "GUEST"}, store.Scope{ID: v.CapabilityID, TicketID: v.View.TicketID, Orgs: []string{}, Role: "GUEST", Permissions: v.Scopes}, nil
	}
	return identity.Actor{}, store.Scope{}, web.Fail(401, "Silakan masuk atau gunakan kunci pelacakan")
}
func (s *Service) Create(ctx context.Context, c Credentials, key string, in api.Create) (database.Result, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	for k, v := range in.Answers {
		in.Answers[k] = strings.TrimSpace(v)
	}
	if !web.UUID(in.ServiceID) {
		return database.Result{}, web.Fail(422, "Layanan tidak valid")
	}
	var actor identity.Actor
	var capHash []byte
	var org *string
	actorScope := ""
	kind := ""
	if c.Identity.Token != "" {
		c.Identity.Write = true
		var e error
		actor, e = s.Identity.Authenticate(ctx, c.Identity)
		if e != nil {
			return database.Result{}, e
		}
		if actor.Role != "PUBLIC" && actor.Role != "ASN" {
			return database.Result{}, web.Fail(403, "Peran ini tidak mempunyai izin membuat tiket")
		}
		kind = actor.Kind
		actorScope = actor.ID
	} else {
		if len(s.Key) < 32 {
			return database.Result{}, web.Fail(503, "Kunci sesi pelacakan belum dikonfigurasi")
		}
		if !domain.Secret(c.Capability) || !domain.Secret(c.Bootstrap) || c.CSRF != c.Bootstrap {
			return database.Result{}, web.Fail(403, "Capability dan verifikasi awal tamu diperlukan")
		}
		capHash = domain.Hash(c.Capability)
		if e := s.Store.ReplayBinding(ctx, capHash); e != nil {
			return database.Result{}, e
		}
		actorScope = "guest:" + stringHex(capHash)
		actor = identity.Actor{ID: web.ID(), Kind: "GUEST"}
		kind = "GUEST"
	}
	previous, found, e := s.Store.Receipt(ctx, actorScope, key, in)
	if e != nil {
		return database.Result{}, e
	}
	if found {
		var receipt struct {
			ID string `json:"id"`
		}
		if e = json.Unmarshal(previous.Body, &receipt); e != nil {
			return database.Result{}, e
		}
		scope := store.Scope{ID: actor.ID, Orgs: actor.Orgs("ticket.read"), Role: actor.Role}
		if capHash != nil {
			_, bound, err := s.Store.Capability(ctx, capHash)
			if err != nil {
				return database.Result{}, err
			}
			scope.TicketID = bound
		}
		if _, e = s.Store.Read(ctx, scope, receipt.ID); e != nil {
			return database.Result{}, e
		}
		return previous, nil
	}
	snap, e := s.Catalog.Snapshot(ctx, identity.Credentials{Token: c.Identity.Token}, in.ServiceID)
	if e != nil {
		return database.Result{}, e
	}
	if e = domain.Validate(&in, snap); e != nil {
		return database.Result{}, e
	}
	if kind == "ASN" {
		for _, m := range actor.Memberships {
			if m.OrganizationActive && actor.Can("ticket.create", m.OrganizationID) {
				v := m.OrganizationID
				org = &v
				if v == snap.Service.OwnerOrgID {
					break
				}
			}
		}
		if org == nil {
			return database.Result{}, web.Fail(403, "Membership ASN diperlukan")
		}
	}
	var reporting *identity.ReportingContext
	if in.ReportingDivisionID != "" && in.ReportingOrgID == "" {
		return database.Result{}, web.Fail(422, "Pilih perangkat daerah sebelum memilih bidang")
	}
	if in.ReportingOrgID != "" {
		if kind != "ASN" && kind != "GUEST" {
			return database.Result{}, web.Fail(403, "Konteks instansi hanya untuk pelaporan ASN")
		}
		if kind == "ASN" {
			if !actor.Can("ticket.create", in.ReportingOrgID) {
				return database.Result{}, web.Fail(403, "Perangkat daerah di luar mandat akun")
			}
			if snap.Service.AccessMode == "ASN_AUTH" && in.ReportingOrgID != snap.Service.OwnerOrgID && !slices.Contains(snap.Policy.AudienceOrgs, in.ReportingOrgID) {
				return database.Result{}, web.Fail(403, "Layanan tidak tersedia bagi perangkat daerah yang dipilih")
			}
			org = &in.ReportingOrgID
		}
		resolved, err := s.Identity.ReportingContext(ctx, in.ReportingOrgID, in.ReportingDivisionID, kind == "ASN")
		if err != nil {
			return database.Result{}, err
		}
		reporting = &resolved
	}
	proposal, e := s.Classifier.Propose(ctx, in.Title+" "+in.Description)
	if e != nil {
		return database.Result{}, e
	}
	categories, err := s.Catalog.VerificationCategories(ctx, snap.Service.OwnerOrgID)
	if err != nil {
		return database.Result{}, err
	}
	var reportedCategory *identity.DirectoryEntry
	categoryCode := proposal.Category
	if proposal.Category == "NETWORK" {
		categoryCode = "CAT-CONNECTIVITY"
	}
	if proposal.Category == "DEVICE" {
		categoryCode = "CAT-ENDPOINT"
	}
	if proposal.Category == "APPLICATION" {
		categoryCode = "CAT-APP-OPD"
	}
	var fallbackCategory *string
	for _, category := range categories {
		if category.ID == in.ReportedCategoryID {
			reportedCategory = &identity.DirectoryEntry{ID: category.ID, Name: category.Name}
		}
		if categoryCode != "" && category.Code == categoryCode {
			id := category.ID
			proposal.CategoryID = &id
		}
		if (proposal.Category == "NETWORK" || proposal.Category == "DEVICE") && category.Code == "CAT-INFRA" ||
			proposal.Category == "APPLICATION" && category.Code == "CAT-APTIKA" {
			id := category.ID
			fallbackCategory = &id
		}
	}
	if proposal.CategoryID == nil {
		proposal.CategoryID = fallbackCategory
	}
	if in.ReportedCategoryID != "" && reportedCategory == nil {
		return database.Result{}, web.Fail(422, "Kategori tidak aktif atau di luar layanan")
	}
	if proposal.CategoryID == nil && proposal.Category != "MANUAL" {
		proposal.Explanation += ". Kategori kanonis aktif belum tersedia; tinjau manual."
	}
	now := s.now()
	policy, e := s.Calendar.Policy(ctx, in.ServiceID, in.PolicyVersion, s.LabLifecycle)
	if e != nil {
		return database.Result{}, web.Fail(503, "Kebijakan SLA layanan belum tersedia")
	}
	calc, e := s.Calendar.Targets(ctx, policy, "NORMAL", now)
	if e != nil {
		return database.Result{}, e
	}
	// Revalidate mutable authorities immediately before entering the owner transaction; no row lock spans a port call.
	current, e := s.Catalog.Snapshot(ctx, identity.Credentials{Token: c.Identity.Token}, in.ServiceID)
	if e != nil {
		return database.Result{}, e
	}
	if current.Service.Version != snap.Service.Version || current.Form.FormVersion != snap.Form.FormVersion || current.Policy.PolicyVersion != snap.Policy.PolicyVersion {
		return database.Result{}, web.Fail(409, "Layanan berubah sebelum commit; tinjau formulir terbaru")
	}
	if c.Identity.Token != "" {
		fresh, err := s.Identity.Authenticate(ctx, identity.Credentials{Token: c.Identity.Token, CSRF: c.Identity.CSRF, Write: true})
		if err != nil {
			return database.Result{}, err
		}
		if fresh.ID != actor.ID || fresh.Role != actor.Role || fresh.Kind != actor.Kind || (kind == "ASN" && (org == nil || !fresh.Can("ticket.create", *org))) {
			return database.Result{}, web.Fail(403, "Mandat pemohon berubah sebelum commit")
		}
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: actorScope, Command: "CreateTicket", Target: "new", Key: key, Scope: snap.Service.OwnerOrgID, Reason: "Pembuatan tiket", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		v, e := s.Store.Create(ctx, tx, in, snap, proposal, calc, policy, web.ID(), actor.ID, kind, org, capHash, now, reporting, reportedCategory)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(201, map[string]any{"id": v.ID, "version": v.Version})
	})
}
func (s *Service) Read(ctx context.Context, c Credentials, id string) (api.Ticket, store.Scope, identity.Actor, error) {
	ticket, scope, actor, err := s.authorized(ctx, c, id, false)
	if err == nil && s.LabLifecycle && ticket.State == "CLOSED" && ticket.ArchivedAt == nil && canReopen(ticket, scope, actor) {
		ticket.ReopenUntil, err = s.Store.ReopenUntil(ctx, ticket, labReopenWindow)
	}
	return ticket, scope, actor, err
}
func (s *Service) authorized(ctx context.Context, c Credentials, id string, write bool) (api.Ticket, store.Scope, identity.Actor, error) {
	a, scope, e := s.actor(ctx, c, write)
	if e != nil {
		return api.Ticket{}, scope, a, e
	}
	if !web.UUID(id) {
		return api.Ticket{}, scope, a, web.Fail(404, "Tiket tidak ditemukan")
	}
	v, e := s.Store.Read(ctx, scope, id)
	if e == nil && scope.Internal {
		scope.Internal, e = s.Store.InternalAllowed(ctx, scope, id)
	}
	return v, scope, a, e
}
func (s *Service) List(ctx context.Context, c Credentials, p web.Page) (any, error) {
	_, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	v, e := s.Store.List(ctx, scope, p)
	return web.List(v, p.Limit, func(v api.Ticket) string { return v.ID }), e
}
func (s *Service) Comment(ctx context.Context, c Credentials, id, key string, in api.CommentInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !writeAllowed(a, scope, v, "ticket.comment") {
		return database.Result{}, web.Fail(403, "Komentar tidak diizinkan")
	}
	in.Body = strings.TrimSpace(in.Body)
	if !domain.Text(in.Body, 4000) || in.ExpectedVersion < 1 || (in.Visibility != "REQUESTER" && in.Visibility != "INTERNAL") {
		return database.Result{}, web.Fail(422, "Komentar/visibility/versi tidak valid")
	}
	if in.Visibility == "INTERNAL" && !scope.Internal {
		return database.Result{}, web.Fail(403, "Catatan internal hanya untuk petugas berizin")
	}
	var humanResponseAt *time.Time
	if scope.Internal && a.Kind == "STAFF" && in.Visibility == "REQUESTER" && v.State != "CLOSED" && v.State != "CANCELLED" {
		now := s.now()
		humanResponseAt = &now
	}
	isRequester := requesterAllowed(a, scope, v)
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "AddComment", Target: id, Key: key, Scope: v.OwnerOrg, Reason: "Komentar tiket", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		v, e := s.Store.Comment(ctx, tx, id, a.ID, in, isRequester, humanResponseAt)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(201, v)
	})
}
func (s *Service) Verify(ctx context.Context, c Credentials, id, key string, in api.VerificationInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.verify", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin verifikasi tiket diperlukan")
	}
	categoryChanged := v.Classification.CategoryID == nil || in.CategoryID != *v.Classification.CategoryID || in.Priority != v.Classification.Priority
	if e = domain.ValidateVerification(&in, categoryChanged); e != nil {
		return database.Result{}, e
	}
	if receipt, found, err := s.Store.MutationReceipt(ctx, a.ID, "VerifyTicket", id, key, in); err != nil || found {
		return receipt, err
	}
	if v.Verification != "PENDING" || v.State != "OPEN" {
		return database.Result{}, web.Fail(409, "Tiket sudah diverifikasi atau status berubah")
	}
	categories, err := s.Catalog.VerificationCategories(ctx, v.OwnerOrg)
	if err != nil {
		return database.Result{}, err
	}
	var categoryName string
	for _, category := range categories {
		if category.ID == in.CategoryID {
			categoryName = category.Name
			break
		}
	}
	if categoryName == "" {
		return database.Result{}, web.Fail(422, "Pilih kategori aktif pada organisasi pemilik tiket")
	}
	if v.Classification.RuleVersion > 0 && in.ClassifierVersion != v.Classification.RuleVersion {
		return database.Result{}, web.Fail(409, "Versi usulan klasifikasi berubah")
	}
	now := s.now()
	calc, err := s.episodeTargets(ctx, v, in.Priority, episodeStart(v))
	if err != nil {
		return database.Result{}, err
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "VerifyTicket", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, e := s.Store.Verify(ctx, tx, v, a.ID, in, categoryChanged, categoryName, now, calc)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, updated)
	})
}
func (s *Service) Dispatch(ctx context.Context, c Credentials, id, key string, in api.DispatchInput) (database.Result, error) {
	return s.assign(ctx, c, id, key, in, false)
}
func (s *Service) Reassign(ctx context.Context, c Credentials, id, key string, in api.DispatchInput) (database.Result, error) {
	return s.assign(ctx, c, id, key, in, true)
}
func (s *Service) assign(ctx context.Context, c Credentials, id, key string, in api.DispatchInput, reassign bool) (database.Result, error) {
	command := "DispatchTicket"
	if reassign {
		command = "ReassignTicket"
	}
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.dispatch", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin penugasan tiket diperlukan")
	}
	if e = domain.ValidateDispatch(&in); e != nil {
		return database.Result{}, e
	}
	if receipt, found, err := s.Store.MutationReceipt(ctx, a.ID, command, id, key, in); err != nil || found {
		return receipt, err
	}
	if e = dispatchState(v, in.ExpectedVersion, reassign); e != nil {
		return database.Result{}, e
	}
	proposal, e := s.Assignment.Propose(ctx, id, v.Version, v.ServiceID, v.OwnerOrg, in.Tier, verifiedCategory(v))
	if e != nil {
		return database.Result{}, e
	}
	if in.ProposalDigest != "" && (in.ProposalVersion != v.Version || in.ProposalDigest != proposal.Digest) {
		return database.Result{}, web.Fail(409, "Saran penugasan berubah. Muat ulang rekomendasi.")
	}
	if proposal.Status != "RECOMMENDED" {
		return database.Result{}, web.Fail(422, proposal.Explanation)
	}
	valid := false
	for _, c := range proposal.Candidates {
		if c.Roster.SubjectID == in.AssigneeID && c.Roster.TeamID == in.TeamID {
			valid = true
			break
		}
	}
	if !valid {
		return database.Result{}, web.Fail(422, "Teknisi tidak memenuhi routing, tier, skill atau roster aktif")
	}
	if len(strings.TrimSpace(in.Reason)) < 5 {
		return database.Result{}, web.Fail(422, "Alasan disposisi minimal 5 karakter")
	}
	fresh, _, err := s.actor(ctx, c, true)
	if err != nil {
		return database.Result{}, err
	}
	if fresh.ID != a.ID || !fresh.Can("ticket.dispatch", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Mandat penugasan berubah")
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: command, Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, e := s.Store.Dispatch(ctx, tx, v, a.ID, in, proposal, command)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, updated)
	})
}
func dispatchState(v api.Ticket, version int64, reassign bool) error {
	if v.Verification != "VERIFIED" {
		return web.Fail(409, "TICKET_NOT_VERIFIED: Tiket belum diverifikasi")
	}
	eligible := v.State == "TRIAGED" || v.State == "OPEN"
	if reassign {
		eligible = v.State == "ASSIGNED" || v.State == "IN_PROGRESS"
	}
	if v.ArchivedAt != nil || !eligible || v.Version != version {
		return web.Fail(409, "Tiket berubah atau tidak dalam antrean disposisi")
	}
	return nil
}
func (s *Service) DispatchProposal(ctx context.Context, c Credentials, id, tier string, reassign bool) (assignment.Proposal, error) {
	v, scope, actor, err := s.authorized(ctx, c, id, false)
	if err != nil {
		return assignment.Proposal{}, err
	}
	if !scope.Internal || !actor.Can("ticket.dispatch", v.OwnerOrg) {
		return assignment.Proposal{}, web.Fail(403, "Izin disposisi diperlukan")
	}
	if err := dispatchState(v, v.Version, reassign); err != nil {
		return assignment.Proposal{}, err
	}
	proposal, err := s.Assignment.Propose(ctx, v.ID, v.Version, v.ServiceID, v.OwnerOrg, tier, verifiedCategory(v))
	if err == nil && proposal.Status == "HANDOFF" && !actor.Can("ticket.handoff", v.OwnerOrg) {
		proposal.Explanation += " Hubungi Koordinator untuk mengajukan pelimpahan."
	}
	return proposal, err
}

func verifiedCategory(v api.Ticket) string {
	if v.Verification == "VERIFIED" && v.ClassificationDecision != nil {
		return v.ClassificationDecision.CategoryID
	}
	return ""
}
func (s *Service) VerificationCategories(ctx context.Context, c Credentials, id string) (any, error) {
	v, scope, actor, err := s.authorized(ctx, c, id, false)
	if err != nil {
		return nil, err
	}
	if !scope.Internal || !actor.Can("ticket.verify", v.OwnerOrg) {
		return nil, web.Fail(403, "Izin verifikasi diperlukan")
	}
	return s.Catalog.VerificationCategories(ctx, v.OwnerOrg)
}
func (s *Service) Reject(ctx context.Context, c Credentials, id, key string, in api.RejectInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.verify", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin verifikasi tiket diperlukan")
	}
	reason, e := domain.ValidateReject(&in)
	if e != nil {
		return database.Result{}, e
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "RejectTicket", Target: id, Key: key, Scope: v.OwnerOrg, Reason: reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, e := s.Store.Reject(ctx, tx, id, v.OwnerOrg, a.ID, reason, in.ExpectedVersion)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, map[string]any{"id": updated.ID, "version": updated.Version})
	})
}
func (s *Service) QueueVerification(ctx context.Context, c Credentials, p web.Page) (any, error) {
	a, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	scope.Orgs = a.Orgs("ticket.verify")
	if !scope.Internal || len(scope.Orgs) == 0 {
		return nil, web.Fail(403, "Izin antrean verifikasi diperlukan")
	}
	v, e := s.Store.QueueVerification(ctx, scope, p)
	return web.List(v, p.Limit, func(v api.Ticket) string { return v.ID }), e
}
func (s *Service) QueueDispatch(ctx context.Context, c Credentials, p web.Page) (any, error) {
	a, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	scope.Orgs = a.Orgs("ticket.dispatch")
	if !scope.Internal || len(scope.Orgs) == 0 {
		return nil, web.Fail(403, "Izin antrean penugasan diperlukan")
	}
	v, e := s.Store.QueueDispatch(ctx, scope, p)
	return web.List(v, p.Limit, func(v api.Ticket) string { return v.ID }), e
}
func (s *Service) QueueMyTasks(ctx context.Context, c Credentials, p web.Page) (any, error) {
	a, scope, e := s.actor(ctx, c, false)
	if e != nil {
		return nil, e
	}
	if !scope.Internal || a.Role != "TECHNICIAN" {
		return nil, web.Fail(403, "Antrean tugas hanya untuk teknisi aktif")
	}
	v, e := s.Store.QueueMyTasks(ctx, scope, p)
	return web.List(v, p.Limit, func(v api.Ticket) string { return v.ID }), e
}
func (s *Service) ListTechnicians(ctx context.Context, c Credentials, teamID string) (any, error) {
	actor, _, err := s.actor(ctx, c, false)
	if err != nil {
		return nil, err
	}
	orgs := actor.Orgs("ticket.dispatch")
	if len(orgs) == 0 {
		return nil, web.Fail(403, "Izin disposisi diperlukan")
	}
	if !web.UUID(teamID) {
		return nil, web.Fail(422, "Pilih tim aktif atau gunakan rekomendasi pada detail tiket")
	}
	allowed := false
	for _, org := range orgs {
		active, e := s.Identity.ActiveTeamInOrg(ctx, teamID, org)
		if e != nil {
			return nil, e
		}
		if active {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, web.Fail(404, "Tim tidak tersedia")
	}
	return s.Assignment.ListTechnicians(ctx, teamID)
}
func (s *Service) Exchange(ctx context.Context, c Credentials, key string) (database.Result, string, string, error) {
	if len(s.Key) < 32 {
		return database.Result{}, "", "", web.Fail(503, "Kunci sesi pelacakan belum dikonfigurasi")
	}
	if !domain.Secret(c.Capability) || !domain.Secret(c.Bootstrap) || c.CSRF != c.Bootstrap {
		return database.Result{}, "", "", web.Fail(403, "Verifikasi awal pelacakan diperlukan")
	}
	cid, ticket, e := s.Store.Capability(ctx, domain.Hash(c.Capability))
	if e != nil {
		return database.Result{}, "", "", e
	}
	token := domain.Derive(s.Key, "tracking", c.Capability+"|"+key)
	csrf := domain.Derive(s.Key, "tracking-csrf", token)
	// Expired/revoked deterministic replay cannot create a fresh validity window.
	result, e := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: cid, Command: "ExchangeGuestCapability", Target: ticket, Key: key, Scope: ticket, Reason: "Pelacakan tiket", Payload: map[string]string{"capability_id": cid}}, func(tx pgx.Tx) (database.Result, error) {
		v, e := s.Store.Exchange(ctx, tx, cid, web.ID(), domain.Hash(token), domain.Hash(csrf))
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(201, v)
	})
	if e == nil {
		_, e = s.Store.Track(ctx, domain.Hash(token))
	}
	return result, token, csrf, e
}
func (s *Service) Tracking(ctx context.Context, c Credentials) (api.Tracking, error) {
	v, e := s.Store.Track(ctx, domain.Hash(c.Tracking))
	return v.View, e
}
func (s *Service) EndTracking(ctx context.Context, c Credentials, id, key string, revoke bool) (database.Result, error) {
	_, scope, e := s.actor(ctx, c, true)
	if e != nil {
		return database.Result{}, e
	}
	if scope.TicketID == "" || (revoke && id != scope.TicketID) {
		return database.Result{}, web.Fail(404, "Pelacakan tidak ditemukan")
	}
	v, e := s.Store.Track(ctx, domain.Hash(c.Tracking))
	if e != nil {
		return database.Result{}, e
	}
	cmd, target := "LogoutTrackingSession", v.View.ID
	if revoke {
		cmd, target = "RevokeGuestCapability", v.CapabilityID
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: v.CapabilityID, Command: cmd, Target: target, Key: key, Scope: scope.TicketID, Reason: "Pencabutan pelacakan", Payload: map[string]string{"target": target}}, func(tx pgx.Tx) (database.Result, error) {
		e := s.Store.EndTrack(ctx, tx, target, revoke)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(200, map[string]any{"id": target, "version": 1})
	})
}
func stringHex(v []byte) string {
	const h = "0123456789abcdef"
	b := make([]byte, len(v)*2)
	for i, x := range v {
		b[i*2] = h[x>>4]
		b[i*2+1] = h[x&15]
	}
	return string(b)
}

func writeAllowed(a identity.Actor, scope store.Scope, ticket api.Ticket, permission string) bool {
	switch a.Role {
	case "PUBLIC":
		return a.ID == ticket.RequesterID
	case "ASN":
		return a.ID == ticket.RequesterID && ticket.RequesterOrg != nil && a.Can(permission, *ticket.RequesterOrg)
	case "GUEST":
		for _, p := range scope.Permissions {
			if p == permission {
				return scope.TicketID == ticket.ID
			}
		}
		return false
	default:
		return scope.Internal && a.Can(permission, ticket.OwnerOrg)
	}
}

func requesterAllowed(a identity.Actor, scope store.Scope, ticket api.Ticket) bool {
	if a.Role == "PUBLIC" || a.Role == "ASN" {
		return a.ID == ticket.RequesterID
	}
	if a.Role == "GUEST" {
		return scope.TicketID == ticket.ID
	}
	return false
}

func technicianAllowed(a identity.Actor, scope store.Scope, ticket api.Ticket) bool {
	if !scope.Internal {
		return false
	}
	return ticket.AssigneeID != nil && *ticket.AssigneeID == a.ID && a.Can("ticket.resolve", ticket.OwnerOrg)
}

func (s *Service) Resolve(ctx context.Context, c Credentials, id, key string, in api.ResolutionInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !technicianAllowed(a, scope, v) {
		return database.Result{}, web.Fail(403, "Hanya teknisi yang ditugaskan atau petugas berwenang yang dapat menyelesaikan tiket")
	}
	if e = domain.ValidateResolution(&in); e != nil {
		return database.Result{}, e
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "ResolveTicket", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Summary, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, attemptID, err := s.Store.Resolve(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{
			"id":                updated.ID,
			"version":           updated.Version,
			"active_attempt_id": attemptID,
			"state":             updated.State,
		})
	})
}

func (s *Service) Confirm(ctx context.Context, c Credentials, id, key string, in api.ConfirmationInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !requesterAllowed(a, scope, v) || !writeAllowed(a, scope, v, "ticket.confirm") {
		return database.Result{}, web.Fail(403, "Hanya pemohon tiket yang dapat memberikan konfirmasi")
	}
	if e = domain.ValidateConfirmation(&in); e != nil {
		return database.Result{}, e
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "ConfirmResolution", Target: id, Key: key, Scope: v.OwnerOrg, Reason: "Konfirmasi: " + in.Decision, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.Confirm(ctx, tx, id, a.ID, in, s.now())
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{
			"id":       updated.ID,
			"version":  updated.Version,
			"state":    updated.State,
			"decision": in.Decision,
		})
	})
}

func (s *Service) AutoClose(ctx context.Context, id string, in api.AutoCloseInput, now time.Time) (database.Result, error) {
	if e := domain.ValidateAutoClose(&in); e != nil {
		return database.Result{}, e
	}
	if now.IsZero() {
		now = s.now()
	}
	// Stable job intent survives a committed result whose acknowledgment was lost.
	key := "auto-close:" + in.AttemptID + ":" + strconv.FormatInt(in.ExpectedVersion, 10)
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: "00000000-0000-4000-8000-000000000000", Command: "AutoCloseTicket", Target: id, Key: key, Scope: "INTERNAL_JOB", Reason: "Tutup otomatis sesuai bukti pemberitahuan", Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.AutoClose(ctx, tx, id, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, map[string]any{"id": updated.ID, "version": updated.Version, "state": updated.State})
	})
}

func (s *Service) ListResolutionAttempts(ctx context.Context, c Credentials, id string) (any, error) {
	_, _, _, e := s.authorized(ctx, c, id, false)
	if e != nil {
		return nil, e
	}
	items, err := s.Store.ListResolutionAttempts(ctx, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"items": items}, nil
}

func episodeStart(ticket api.Ticket) time.Time {
	if ticket.EpisodeStartedAt != nil {
		return *ticket.EpisodeStartedAt
	}
	return ticket.Accepted
}

func (s *Service) episodeTargets(ctx context.Context, ticket api.Ticket, priority string, start time.Time) (*sla.Calculation, error) {
	if ticket.SLAPolicy == nil {
		return nil, nil
	}
	calc, err := s.Calendar.Targets(ctx, *ticket.SLAPolicy, priority, start)
	return &calc, err
}

func (s *Service) GetSLA(ctx context.Context, c Credentials, id string) (any, error) {
	v, _, _, err := s.authorized(ctx, c, id, false)
	if err != nil {
		return nil, err
	}
	return store.ReadClock(ctx, s.Store.Pool, v, s.now())
}

func (s *Service) RecordVendorCase(ctx context.Context, c Credentials, id, key string, in api.VendorCaseInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || (!a.Can("ticket.vendor", v.OwnerOrg) && !technicianAllowed(a, scope, v)) {
		return database.Result{}, web.Fail(403, "Izin koordinasi vendor diperlukan")
	}
	now := s.now()
	if e = domain.ValidateVendorCase(&in, now); e != nil {
		return database.Result{}, e
	}
	if s.Identity != nil {
		sub, err := s.Identity.Access(ctx, in.InternalPICID)
		if err != nil || sub.Kind != "STAFF" || !sub.Can("ticket.read", v.OwnerOrg) {
			return database.Result{}, web.Fail(422, "PIC internal harus merupakan staf aktif terdaftar")
		}
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "RecordVendorCase", Target: id, Key: key, Scope: v.OwnerOrg, Reason: "Vendor: " + in.ExternalReference, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, caseID, err := s.Store.RecordVendorCase(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, map[string]any{
			"id":                 caseID,
			"version":            updated.Version,
			"ticket_id":          updated.ID,
			"external_reference": in.ExternalReference,
		})
	})
}

func (s *Service) ApprovePause(ctx context.Context, c Credentials, id, key string, in api.PauseInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.pause", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin koordinator untuk jeda penanganan diperlukan")
	}
	if in.PolicyVersion == 0 {
		in.PolicyVersion = v.PolicyVersion
	}
	if in.PolicyVersion != v.PolicyVersion {
		return database.Result{}, web.Fail(409, "Versi kebijakan jeda berbeda dari snapshot tiket")
	}
	now := s.now()
	if e = domain.ValidatePause(&in, now); e != nil {
		return database.Result{}, e
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "ApprovePause", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, pauseID, err := s.Store.ApprovePause(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, map[string]any{
			"id":        pauseID,
			"version":   updated.Version,
			"ticket_id": updated.ID,
			"until":     in.Until,
		})
	})
}

func (s *Service) RequestHandoff(ctx context.Context, c Credentials, id, key string, in api.HandoffInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.handoff", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin transfer handoff antar-OPD diperlukan")
	}
	if e = domain.ValidateHandoff(&in, v.OwnerOrg); e != nil {
		return database.Result{}, e
	}
	active, err := s.Identity.ActiveTeamInOrg(ctx, in.TargetTeamID, in.TargetOrgID)
	if err != nil {
		return database.Result{}, err
	}
	if !active {
		return database.Result{}, web.Fail(422, "Tim tujuan harus aktif pada OPD tujuan")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "RequestHandoff", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, handoffID, err := s.Store.RequestHandoff(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(201, map[string]any{
			"id":             handoffID,
			"handoff_id":     handoffID,
			"version":        updated.Version,
			"ticket_id":      updated.ID,
			"target_org_id":  in.TargetOrgID,
			"target_team_id": in.TargetTeamID,
		})
	})
}

func (s *Service) ReadHandoffOffer(ctx context.Context, c Credentials, ticket, id string) (api.HandoffOffer, error) {
	actor, scope, err := s.actor(ctx, c, false)
	if err != nil {
		return api.HandoffOffer{}, err
	}
	if !scope.Internal || !web.UUID(ticket) || !web.UUID(id) {
		return api.HandoffOffer{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	return s.Store.ReadHandoffOffer(ctx, ticket, id, actor.Orgs("ticket.handoff.accept"))
}

func (s *Service) AcceptHandoff(ctx context.Context, c Credentials, id, handoffID, key string, in api.AcceptHandoffInput) (database.Result, error) {
	a, scope, e := s.actor(ctx, c, true)
	if e != nil {
		return database.Result{}, e
	}
	var acceptOrgs []string
	for _, org := range a.Orgs("ticket.handoff.accept") {
		if a.Can("ticket.read", org) {
			acceptOrgs = append(acceptOrgs, org)
		}
	}
	if !scope.Internal || len(acceptOrgs) == 0 {
		return database.Result{}, web.Fail(403, "Izin penerimaan handoff diperlukan")
	}
	if !web.UUID(id) || !web.UUID(handoffID) {
		return database.Result{}, web.Fail(404, "Permohonan handoff tidak ditemukan")
	}
	if e = domain.ValidateAcceptHandoff(&in); e != nil {
		return database.Result{}, e
	}
	intent := struct {
		HandoffID string `json:"handoff_id"`
		api.AcceptHandoffInput
	}{handoffID, in}
	authorizeReceipt := func(receipt database.Result) (database.Result, error) {
		visible, err := s.Store.HandoffReceiptVisible(ctx, id, handoffID, a.ID, key, acceptOrgs)
		if err != nil {
			return database.Result{}, err
		}
		if !visible {
			return database.Result{}, web.Fail(404, "Receipt handoff tidak ditemukan pada mandat saat ini")
		}
		return receipt, nil
	}
	receipt, found, err := s.Store.MutationReceipt(ctx, a.ID, "AcceptHandoff", id, key, intent)
	var conflict *web.Error
	if errors.As(err, &conflict) && conflict.Status == 409 {
		// Previous releases digested the version and reason without the handoff ID.
		if previous, ok, legacyErr := s.Store.MutationReceipt(ctx, a.ID, "AcceptHandoff", id, key, in); legacyErr == nil && ok {
			return authorizeReceipt(previous)
		}
	}
	if err != nil {
		return database.Result{}, err
	}
	if found {
		return authorizeReceipt(receipt)
	}
	offer, err := s.Store.ReadHandoffOffer(ctx, id, handoffID, acceptOrgs)
	if err != nil {
		return database.Result{}, err
	}
	active, err := s.Identity.ActiveTeamInOrg(ctx, offer.TargetTeamID, offer.TargetOrgID)
	if err != nil {
		return database.Result{}, err
	}
	if !active {
		return database.Result{}, web.Fail(409, "Tim tujuan sudah tidak aktif pada OPD tujuan")
	}
	now := s.now()
	receipt, err = database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "AcceptHandoff", Target: id, Key: key, Scope: handoffID, Reason: in.Reason, Payload: intent,
	}, func(tx pgx.Tx) (database.Result, error) {
		updated, err := s.Store.AcceptHandoff(ctx, tx, id, handoffID, a.ID, acceptOrgs, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, updated)
	})
	if err != nil {
		return database.Result{}, err
	}
	return authorizeReceipt(receipt)
}

func (s *Service) RequestEscalation(ctx context.Context, c Credentials, id, key string, in api.EscalateInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || (!a.Can("ticket.escalate", v.OwnerOrg) && !technicianAllowed(a, scope, v)) {
		return database.Result{}, web.Fail(403, "Izin eskalasi tiket diperlukan")
	}
	if e = domain.ValidateEscalate(&in); e != nil {
		return database.Result{}, e
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner: "M3", Actor: a.ID, Command: "RequestEscalation", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in,
	}, func(tx pgx.Tx) (database.Result, error) {
		op, err := s.Store.RequestEscalation(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(202, op)
	})
}

func (s *Service) ReadOperation(ctx context.Context, c Credentials, opID string) (api.Operation, error) {
	if !web.UUID(opID) {
		return api.Operation{}, web.Fail(404, "Operasi tidak ditemukan")
	}
	op, err := s.Store.ReadOperation(ctx, opID)
	if err != nil {
		return api.Operation{}, err
	}
	ticket, scope, actor, err := s.authorized(ctx, c, op.TicketID, false)
	if err != nil {
		return api.Operation{}, err
	}
	if !scope.Internal || (op.PrincipalID != actor.ID && !actor.Can("operation.read", ticket.OwnerOrg)) {
		return api.Operation{}, web.Fail(404, "Operasi tidak ditemukan")
	}
	return op, nil
}

// Archive archives a ticket if it is in terminal state (CLOSED or CANCELLED) (AC22).
func (s *Service) Archive(ctx context.Context, c Credentials, id, key string, in api.ArchiveInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.archive", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin ticket.archive diperlukan")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "ArchiveTicket", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		res, err := s.Store.Archive(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, res)
	})
}

// RestoreArchive restores an archived ticket (AC22).
func (s *Service) RestoreArchive(ctx context.Context, c Credentials, id, key string, in api.RestoreArchiveInput) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !scope.Internal || !a.Can("ticket.archive", v.OwnerOrg) {
		return database.Result{}, web.Fail(403, "Izin ticket.archive diperlukan")
	}
	now := s.now()
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "RestoreTicketArchive", Target: id, Key: key, Scope: v.OwnerOrg, Reason: in.Reason, Payload: in}, func(tx pgx.Tx) (database.Result, error) {
		res, err := s.Store.RestoreArchive(ctx, tx, id, a.ID, in, now)
		if err != nil {
			return database.Result{}, err
		}
		return database.Response(200, res)
	})
}
