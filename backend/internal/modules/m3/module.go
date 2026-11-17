// Package m3 is the composition boundary for intake.
package m3

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	catalog "helpdesk.local/m0/internal/modules/m2/api"
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/app"
	"helpdesk.local/m0/internal/modules/m3/internal/store"
	classify "helpdesk.local/m0/internal/modules/m4/api"
	assignment "helpdesk.local/m0/internal/modules/m5/api"
	sla "helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module { return &Module{pool: pool} }
func (m *Module) ID() string         { return "M3" }

func NewRuntime(pool *pgxpool.Pool, identity identity.Port, catalog catalog.Port, classifier classify.Port, assignment assignment.Port, calendar sla.Port, key []byte, origin, root, scanner string) *Module {
	return &Module{
		pool: pool,
		service: &app.Service{
			Store:       store.Store{Pool: pool},
			Identity:    identity,
			Catalog:     catalog,
			Classifier:  classifier,
			Assignment:  assignment,
			Calendar:    calendar,
			Key:         key,
			Origin:      origin,
			Files:       blob.Files{Root: root, Scanner: scanner},
			UploadSlots: make(chan struct{}, 2),
		},
	}
}

func (m *Module) Register(mux *http.ServeMux)         { m.service.Register(mux) }
func (m *Module) Source() *delivery.Source            { return delivery.New(m.pool, "M3") }
func (m *Module) SourceForM5() *delivery.Source       { return delivery.NewForConsumer(m.pool, "M3", "M5") }
func (m *Module) SourceForM6() *delivery.Source       { return delivery.NewForConsumer(m.pool, "M3", "M6") }
func (m *Module) SourceForM7() *delivery.Source       { return delivery.NewForConsumer(m.pool, "M3", "M7") }
func (m *Module) Consumer() delivery.Consumer         { return m.service }
func (m *Module) Service() *app.Service               { return m.service }
func (m *Module) RunFiles(ctx context.Context)        { m.service.RunFiles(ctx) }
func (m *Module) ScanOne(ctx context.Context) error   { return m.service.ScanOne(ctx) }
func (m *Module) Reconcile(ctx context.Context) error { return m.service.Reconcile(ctx) }

func (m *Module) ListMediaM3(ctx context.Context, token, csrf, capability string, limit int, cursor string, onlyClean bool, search, tracking string) ([]m3api.MediaItem, *string, error) {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
		Tracking:   tracking,
	}
	return m.service.ListMediaM3(ctx, c, limit, cursor, onlyClean, search)
}

func (m *Module) GetMediaM3(ctx context.Context, token, csrf, capability, id string, tracking ...string) (m3api.MediaItem, error) {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
	}
	if len(tracking) == 1 {
		c.Tracking = tracking[0]
	}
	return m.service.GetMediaM3(ctx, c, id)
}

func (m *Module) ListDrafts(ctx context.Context, token, csrf, capability string, limit int, cursor string) ([]m3api.DraftItem, *string, error) {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
	}
	return m.service.ListDrafts(ctx, c, limit, cursor)
}

func (m *Module) GetDraft(ctx context.Context, token, csrf, capability, id string) (m3api.DraftItem, error) {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
	}
	return m.service.GetDraft(ctx, c, id)
}

func (m *Module) SaveDraft(ctx context.Context, token, csrf, capability, id string, in m3api.DraftWriteInput) (m3api.DraftItem, error) {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
	}
	return m.service.SaveDraft(ctx, c, id, in)
}

func (m *Module) DeleteDraft(ctx context.Context, token, csrf, capability, id string) error {
	c := app.Credentials{
		Identity:   identity.Credentials{Token: token, CSRF: csrf},
		Capability: capability,
		CSRF:       csrf,
	}
	return m.service.DeleteDraft(ctx, c, id)
}

func (m *Module) ReadBlob(storageKey string) ([]byte, error) {
	return m.service.Files.Read(storageKey)
}

func (m *Module) SearchTickets(ctx context.Context, actorID string, isGuest bool, guestCapHash []byte, orgIDs []string, query string, limit int, roles ...string) ([]m3api.SearchHit, error) {
	return m.service.Store.SearchTickets(ctx, actorID, isGuest, guestCapHash, orgIDs, query, limit, roles...)
}

// ReportScope returns only current M3-owned references within the requested organization.
func (m *Module) ReportScope(ctx context.Context, org string, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := m.service.Store.Pool.Query(ctx, `SELECT id::text FROM intake.tickets WHERE service_owner_org_id=$1 AND id=ANY($2::uuid[])`, org, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	owned := make([]string, 0, len(ids))
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		owned = append(owned, id)
	}
	return owned, rows.Err()
}
