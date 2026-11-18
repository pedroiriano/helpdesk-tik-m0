package bootstrap

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"helpdesk.local/m0/internal/modules/m1"
	m1api "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m2"
	"helpdesk.local/m0/internal/modules/m3"
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m4"
	"helpdesk.local/m0/internal/modules/m5"
	"helpdesk.local/m0/internal/modules/m6"
	"helpdesk.local/m0/internal/modules/m7"
	m7api "helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/modules/m8"
	m8api "helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/modules/m9"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/httpserver"
	"helpdesk.local/m0/internal/platform/web"
)

func Application(pools database.Pools, options m1.Options) http.Handler {
	return NewApplication(pools, options).Handler
}

type Runtime struct {
	Handler            http.Handler
	Bindings           []delivery.Binding
	Sources            []*delivery.Source
	Consumer           delivery.Consumer
	Intake             *m3.Module
	SLA                *m6.Module
	Escalation         *m7.Module
	Knowledge          *m8.Module
	Notify             *m9.Module
	schedulerHeartbeat *atomic.Int64
}

func NewApplication(pools database.Pools, options m1.Options) *Runtime {
	identity := m1.NewRuntime(pools[0], options)
	catalog := m2.NewRuntime(pools[1], identity.Port())
	root := os.Getenv("HELPDESK_UPLOAD_ROOT")
	if root == "" {
		root = "/private/uploads"
	}
	scanner := os.Getenv("HELPDESK_SCANNER")
	if scanner == "" {
		scanner = "scanner:3310"
	}
	assignment := m5.NewRuntime(pools[4], identity.Port())
	slaMod := m6.New(pools[5])
	classifyMod := m4.New(pools[3])
	intake := m3.NewRuntime(pools[2], identity.Port(), catalog.Port(), classifyMod.Port(), assignment.Port(), slaMod.Port(), options.Key, options.Origin, root, scanner)
	escalationMod := m7.New(pools[6])
	knowledgeMod := m8.NewRuntime(pools[7], root, scanner)
	// One shared-volume collector checks references through each owner public boundary.
	intake.Service().LabLifecycle = options.Lab
	intake.Service().SharedBlobReferences = knowledgeMod.BlobReferenced
	notifyMod := m9.New(pools[8], intake.ReportScope)
	notifyMod.EnableLabSink(options.Lab && web.ValidLabOrigin(options.Origin))
	notifyMod.ConfigureDelivery(deliveryOptionsFromEnv(identity.ContactEmail))

	bindings := []delivery.Binding{
		{Source: identity.Source(), Consumer: notifyMod.Consumer()},
		{Source: catalog.Source(), Consumer: notifyMod.Consumer()},
		{Source: intake.Source(), Consumer: notifyMod.Consumer()},
		{Source: intake.SourceForM5(), Consumer: assignment.Consumer()},
		{Source: assignment.Source(), Consumer: notifyMod.Consumer()},
		{Source: intake.SourceForM6(), Consumer: slaMod.Consumer()},
		{Source: intake.SourceForM7(), Consumer: escalationMod.Consumer()},
		{Source: notifyMod.SourceForM3(), Consumer: intake.Consumer()},
		{Source: classifyMod.Source(), Consumer: notifyMod.Consumer()},
		{Source: slaMod.Source(), Consumer: notifyMod.Consumer()},
		{Source: escalationMod.Source(), Consumer: notifyMod.Consumer()},
		{Source: knowledgeMod.Source(), Consumer: notifyMod.Consumer()},
	}

	heartbeat := &atomic.Int64{}
	identity.SetDiagnostics(diagnostics(pools, bindings, root, scanner, heartbeat))
	identity.SetBackupManifest(backupManifestRunner(pools, root))
	identity.SetPurgeRunner(m1api.PurgeRunner{
		Preflight: intake.PreflightRetentionPurge,
		Execute:   intake.ExecuteRetentionPurge,
	})

	adapter := &intakeMediaAdapter{intake: intake}
	knowledgeRegister := func(mux *http.ServeMux) {
		knowledgeMod.Register(mux, adapter, identity.Port(), options.Origin)
	}

	notifyRegister := func(mux *http.ServeMux) {
		notifyMod.Register(mux, identity.Port(), options.Origin)
		escalationMod.RegisterScheduler(mux, intake.Service().AuthorizeScheduler)
		escalationMod.RegisterSchedulerListing(mux, intake.Service().AuthorizeScheduler, intake.Service().AuthorizeSchedulerBatch)
		registerRuleRoutes(mux, identity.Port(), "/api/v1/admin/classification-rules", classifyMod)
		registerRuleRoutes(mux, identity.Port(), "/api/v1/admin/routing-rules", assignment)
		registerRuleRoutes(mux, identity.Port(), "/api/v1/admin/sla-rules", slaMod)
		registerRuleRoutes(mux, identity.Port(), "/api/v1/admin/escalation-rules", escalationMod)
	}

	searchRegister := func(mux *http.ServeMux) {
		mux.HandleFunc("GET /api/v1/search", func(w http.ResponseWriter, r *http.Request) {
			owner := r.URL.Query().Get("owner")
			if owner != "M2" && owner != "M3" && owner != "M8" {
				web.WriteError(w, web.Fail(400, "Parameter owner wajib M2, M3, atau M8"))
				return
			}
			q := strings.TrimSpace(r.URL.Query().Get("q"))
			if len(q) < 2 {
				web.WriteError(w, web.Fail(400, "Parameter pencarian q minimal 2 karakter"))
				return
			}
			p, err := web.Pagination(r)
			if err != nil {
				web.WriteError(w, err)
				return
			}

			tok := web.Cookie(r, "helpdesk_session")
			csrf := r.Header.Get("X-CSRF-Token")
			var actorID, actorRole string
			actorKind := "GUEST"
			var isStaff bool
			var userOrgs []string
			var knowledgeScope m8api.Scope
			if tok != "" {
				sess, err := identity.Port().Authenticate(r.Context(), m1api.Credentials{Token: tok, CSRF: csrf})
				if err != nil {
					web.WriteError(w, err)
					return
				}
				if err == nil {
					actorID = sess.ID
					knowledgeScope = knowledgeAccess(sess)
					actorKind = sess.Kind
					actorRole = sess.Role
					userOrgs = sess.Orgs("ticket.read")
					for _, m := range sess.Memberships {
						if !m.OrganizationActive {
							continue
						}
						for _, perm := range m.Permissions {
							if perm == "ticket.read" || perm == "ticket.verify" || perm == "ticket.dispatch" || perm == "ticket.resolve" {
								isStaff = true
							}
						}
					}

					if sess.Kind == "STAFF" || sess.Kind == "OPERATOR" {
						isStaff = true
					}
				}
			}

			aud := "PUBLIC_GUEST"
			if isStaff {
				aud = "STAFF_ONLY"
			} else if actorKind == "ASN" {
				aud = "ASN_AUTH"
			} else if actorKind == "PUBLIC" {
				aud = "PUBLIC_AUTH"
			}

			type SearchHitOutput struct {
				ID      string `json:"id"`
				Owner   string `json:"owner"`
				Kind    string `json:"kind"`
				Title   string `json:"title"`
				Snippet string `json:"snippet"`
			}
			var hits []SearchHitOutput

			switch owner {
			case "M2":
				res, err := catalog.SearchServices(r.Context(), q, actorKind, knowledgeScope.Orgs, p.Limit)
				if err != nil {
					web.WriteError(w, err)
					return
				}
				for _, h := range res {
					hits = append(hits, SearchHitOutput{
						ID:      h.ID,
						Owner:   h.Owner,
						Kind:    h.Kind,
						Title:   h.Title,
						Snippet: h.Snippet,
					})
				}
			case "M3":
				cap := r.Header.Get("X-Guest-Capability")
				isGuest := false
				var capHash []byte
				if cap != "" {
					h := sha256.Sum256([]byte(cap))
					capHash = h[:]
					isGuest = true
				}
				if !isGuest && actorID == "" {
					hits = []SearchHitOutput{}
				} else {
					res, err := intake.SearchTickets(r.Context(), actorID, isGuest, capHash, userOrgs, q, p.Limit, actorRole)
					if err != nil {
						web.WriteError(w, err)
						return
					}
					for _, h := range res {
						hits = append(hits, SearchHitOutput{
							ID:      h.ID,
							Owner:   h.Owner,
							Kind:    h.Kind,
							Title:   h.Title,
							Snippet: h.Snippet,
						})
					}
				}
			case "M8":
				res, err := knowledgeMod.SearchArticles(r.Context(), q, aud, isStaff, p.Limit, knowledgeScope)
				if err != nil {
					web.WriteError(w, err)
					return
				}
				for _, h := range res {
					hits = append(hits, SearchHitOutput{
						ID:      h.ID,
						Owner:   h.Owner,
						Kind:    h.Kind,
						Title:   h.Title,
						Snippet: h.Snippet,
					})
				}
			}

			if hits == nil {
				hits = []SearchHitOutput{}
			}
			web.JSON(w, 200, map[string]any{
				"items":       hits,
				"next_cursor": nil,
				"as_of":       time.Now().UTC(),
			})
		})
	}

	baseHandler := httpserver.Handler(pools.Ready, identity.Register, catalog.Register, intake.Register, knowledgeRegister, searchRegister, notifyRegister)
	maintenanceHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			p := r.URL.Path
			if !strings.HasPrefix(p, "/api/v1/auth/") && p != "/api/v1/admin/maintenance" {
				pol, err := identity.Port().ActiveMaintenance(r.Context(), "")
				if err == nil && pol != nil {
					if pol.Mode == "READ_ONLY" {
						web.WriteError(w, web.Fail(503, fmt.Sprintf("Sistem sedang dalam mode pemeliharaan (READ_ONLY): %s", pol.Message)))
						return
					}
					if pol.Mode == "DRAIN" && (p == "/api/v1/tickets" && r.Method == "POST") {
						web.WriteError(w, web.Fail(503, fmt.Sprintf("Sistem sedang dalam mode pengosongan (DRAIN): %s", pol.Message)))
						return
					}
				}
			}
		}
		baseHandler.ServeHTTP(w, r)
	})

	return &Runtime{
		schedulerHeartbeat: heartbeat,
		Handler:            web.Guard(maintenanceHandler, options.Origin),
		Bindings:           bindings,
		Sources:            []*delivery.Source{identity.Source(), catalog.Source(), intake.Source(), classifyMod.Source(), assignment.Source(), slaMod.Source(), escalationMod.Source(), knowledgeMod.Source()},
		Consumer:           notifyMod.Consumer(),
		Intake:             intake,
		SLA:                slaMod,
		Escalation:         escalationMod,
		Knowledge:          knowledgeMod,
		Notify:             notifyMod,
	}
}

type intakeMediaAdapter struct {
	intake *m3.Module
}

func (a *intakeMediaAdapter) ListMediaM3(ctx context.Context, token, csrf, capability string, limit int, cursor string, onlyClean bool, search, tracking string) ([]m8api.MediaItem, *string, error) {
	items, next, err := a.intake.ListMediaM3(ctx, token, csrf, capability, limit, cursor, onlyClean, search, tracking)
	if err != nil {
		return nil, nil, err
	}
	out := make([]m8api.MediaItem, len(items))
	for i, it := range items {
		out[i] = m8api.MediaItem{
			ID:              it.ID,
			Version:         it.Version,
			Owner:           it.Owner,
			PrincipalID:     it.PrincipalID,
			OrgID:           it.OrgID,
			StorageKey:      it.StorageKey,
			Status:          it.Status,
			Visibility:      it.Visibility,
			MIME:            it.MIME,
			SizeBytes:       it.SizeBytes,
			SHA256:          it.SHA256,
			Alt:             it.Alt,
			Caption:         it.Caption,
			License:         it.License,
			Source:          it.Source,
			SanitizedFromID: it.SanitizedFromID,
			ApprovedBy:      it.ApprovedBy,
			CreatedAt:       it.CreatedAt,
			UpdatedAt:       it.UpdatedAt,
			DownloadPath:    it.DownloadPath,
		}
	}
	return out, next, nil
}

func (a *intakeMediaAdapter) GetMediaM3(ctx context.Context, token, csrf, capability, id, tracking string) (m8api.MediaItem, error) {
	it, err := a.intake.GetMediaM3(ctx, token, csrf, capability, id, tracking)
	if err != nil {
		return m8api.MediaItem{}, err
	}
	return m8api.MediaItem{
		ID:              it.ID,
		Version:         it.Version,
		Owner:           it.Owner,
		PrincipalID:     it.PrincipalID,
		OrgID:           it.OrgID,
		StorageKey:      it.StorageKey,
		Status:          it.Status,
		Visibility:      it.Visibility,
		MIME:            it.MIME,
		SizeBytes:       it.SizeBytes,
		SHA256:          it.SHA256,
		Alt:             it.Alt,
		Caption:         it.Caption,
		License:         it.License,
		Source:          it.Source,
		SanitizedFromID: it.SanitizedFromID,
		ApprovedBy:      it.ApprovedBy,
		CreatedAt:       it.CreatedAt,
		UpdatedAt:       it.UpdatedAt,
		DownloadPath:    it.DownloadPath,
	}, nil
}

func (a *intakeMediaAdapter) ListDrafts(ctx context.Context, token, csrf, capability string, limit int, cursor string) ([]m8api.DraftItem, *string, error) {
	items, next, err := a.intake.ListDrafts(ctx, token, csrf, capability, limit, cursor)
	if err != nil {
		return nil, nil, err
	}
	out := make([]m8api.DraftItem, len(items))
	for i, it := range items {
		out[i] = m8api.DraftItem{
			ID:          it.ID,
			Version:     it.Version,
			FormVersion: it.FormVersion,
			Title:       it.Title,
			Description: it.Description,
			UpdatedAt:   it.UpdatedAt,
			ExpiresAt:   it.ExpiresAt,
		}
	}
	return out, next, nil
}

func (a *intakeMediaAdapter) GetDraft(ctx context.Context, token, csrf, capability, id string) (m8api.DraftItem, error) {
	it, err := a.intake.GetDraft(ctx, token, csrf, capability, id)
	if err != nil {
		return m8api.DraftItem{}, err
	}
	return m8api.DraftItem{
		ID:          it.ID,
		Version:     it.Version,
		FormVersion: it.FormVersion,
		Title:       it.Title,
		Description: it.Description,
		UpdatedAt:   it.UpdatedAt,
		ExpiresAt:   it.ExpiresAt,
	}, nil
}

func (a *intakeMediaAdapter) SaveDraft(ctx context.Context, token, csrf, capability, id string, in m8api.DraftWriteInput) (m8api.DraftItem, error) {
	m3in := m3api.DraftWriteInput{
		ExpectedVersion: in.ExpectedVersion,
		FormVersion:     in.FormVersion,
		Title:           in.Title,
		Description:     in.Description,
		Answers:         in.Answers,
		ExpiresAt:       in.ExpiresAt,
	}
	it, err := a.intake.SaveDraft(ctx, token, csrf, capability, id, m3in)
	if err != nil {
		return m8api.DraftItem{}, err
	}
	return m8api.DraftItem{
		ID:          it.ID,
		Version:     it.Version,
		FormVersion: it.FormVersion,
		Title:       it.Title,
		Description: it.Description,
		Answers:     it.Answers,
		UpdatedAt:   it.UpdatedAt,
		ExpiresAt:   it.ExpiresAt,
	}, nil
}

func (a *intakeMediaAdapter) DeleteDraft(ctx context.Context, token, csrf, capability, id string) error {
	return a.intake.DeleteDraft(ctx, token, csrf, capability, id)
}

func (a *intakeMediaAdapter) ReadBlob(storageKey string) ([]byte, error) {
	return a.intake.ReadBlob(storageKey)
}

func (r *Runtime) Run(ctx context.Context) {
	go delivery.RunBindings(ctx, r.Bindings)
	go r.Intake.RunFiles(ctx)
	go r.RunScheduler(ctx)
	go r.Notify.RunDispatcher(ctx)
}

func (r *Runtime) RunScheduler(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, err := r.Escalation.Service().RunDueAutoClose(ctx, time.Now().UTC(), func(ctx context.Context, ticketID, attemptID string, expectedVersion int64, now time.Time) error {
				stale, err := r.Intake.Service().ScheduledAutoClose(ctx, ticketID, attemptID, expectedVersion, now)
				if stale {
					return m7api.ErrStaleJob
				}
				return err
			})
			if err == nil {
				r.schedulerHeartbeat.Store(time.Now().UTC().UnixNano())
			} else if ctx.Err() == nil {
				slog.Warn("auto-close scheduler unavailable")
			}
		}
	}
}

func readSecretValue(path, envFallback string) string {
	if raw, err := os.ReadFile(path); err == nil {
		if trimmed := strings.TrimSpace(string(raw)); trimmed != "" {
			return trimmed
		}
	}
	return strings.TrimSpace(os.Getenv(envFallback))
}

func deliveryOptionsFromEnv(contactEmail func(context.Context, string) (string, bool, error)) m9.DeliveryOptions {
	smtpPort, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("HELPDESK_SMTP_PORT")))
	if smtpPort <= 0 {
		smtpPort = 587
	}
	return m9.DeliveryOptions{
		TelegramEnabled:  os.Getenv("HELPDESK_NOTIFY_TELEGRAM_ENABLED") == "1",
		TelegramBotToken: readSecretValue("/run/secrets/telegram_bot_token", "HELPDESK_TELEGRAM_BOT_TOKEN"),
		TelegramAPIBase:  strings.TrimSpace(os.Getenv("HELPDESK_TELEGRAM_API_BASE")),
		SMTPEnabled:      os.Getenv("HELPDESK_NOTIFY_SMTP_ENABLED") == "1",
		SMTPHost:         strings.TrimSpace(os.Getenv("HELPDESK_SMTP_HOST")),
		SMTPPort:         smtpPort,
		SMTPFrom:         strings.TrimSpace(os.Getenv("HELPDESK_SMTP_FROM")),
		SMTPUser:         strings.TrimSpace(os.Getenv("HELPDESK_SMTP_USER")),
		SMTPPass:         readSecretValue("/run/secrets/smtp_password", "HELPDESK_SMTP_PASSWORD"),
		SMTPUseTLS:       os.Getenv("HELPDESK_SMTP_TLS") != "0",
		ContactEmail:     contactEmail,
	}
}

func LabOptions() (m1.Options, error) {
	origin := strings.TrimSpace(os.Getenv("HELPDESK_PUBLIC_ORIGIN"))
	if origin == "" {
		origin = "http://127.0.0.1:18090"
	}
	if !web.ValidOrigin(origin) {
		return m1.Options{}, fmt.Errorf("invalid public origin")
	}
	key, keyErr := os.ReadFile("/run/secrets/session_key")
	options := m1.Options{
		Origin:       origin,
		Lab:          os.Getenv("HELPDESK_LAB_AUTH") == "1",
		PublicAuth:   os.Getenv("HELPDESK_PUBLIC_AUTH") == "1",
		PurgeEnabled: os.Getenv("HELPDESK_PURGE_ENABLED") == "1",
		SSO: m1.SSOOptions{
			Enabled:       os.Getenv("HELPDESK_SSO_ENABLED") == "1",
			ProviderLabel: strings.TrimSpace(os.Getenv("HELPDESK_SSO_PROVIDER_LABEL")),
			Issuer:        strings.TrimSpace(os.Getenv("HELPDESK_SSO_ISSUER")),
			ClientID:      strings.TrimSpace(os.Getenv("HELPDESK_SSO_CLIENT_ID")),
			ClientSecret:  readSecretValue("/run/secrets/sso_client_secret", "HELPDESK_SSO_CLIENT_SECRET"),
			AuthURL:       strings.TrimSpace(os.Getenv("HELPDESK_SSO_AUTH_URL")),
			TokenURL:      strings.TrimSpace(os.Getenv("HELPDESK_SSO_TOKEN_URL")),
			JWKSURL:       strings.TrimSpace(os.Getenv("HELPDESK_SSO_JWKS_URL")),
			RedirectURL:   strings.TrimSpace(os.Getenv("HELPDESK_SSO_REDIRECT_URI")),
		},
	}
	if keyErr == nil && len(key) >= 32 {
		options.Key = key
	} else if options.Lab || options.PublicAuth || options.SSO.Enabled {
		return options, fmt.Errorf("session_key secret unavailable or shorter than 32 bytes")
	}
	if options.Lab && !web.ValidLabOrigin(origin) {
		return options, fmt.Errorf("lab login requires loopback origin")
	}
	return options, nil
}

func knowledgeAccess(a m1api.Actor) m8api.Scope {
	return m8api.Scope{Kind: a.Kind, Principal: a.ID, Orgs: a.Orgs(""), Read: a.Orgs("content.read"), Write: a.Orgs("content.write"), Publish: a.Orgs("content.publish"), MediaRead: a.Orgs("media.read"), MediaWrite: a.Orgs("media.write"), Reuse: a.Orgs("media.reuse")}
}
