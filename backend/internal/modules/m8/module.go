// Package m8 is the composition boundary for knowledge.
package m8

import (
	"context"
	"helpdesk.local/m0/internal/platform/web"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/modules/m8/internal/app"
	"helpdesk.local/m0/internal/modules/m8/internal/store"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module {
	st := store.New(pool)
	svc := app.NewService(st, blob.Files{})
	return &Module{pool: pool, service: svc}
}

func NewRuntime(pool *pgxpool.Pool, root, scanner string) *Module {
	st := store.New(pool)
	files := blob.Files{Root: root, Scanner: scanner}
	svc := app.NewService(st, files)
	return &Module{
		pool:    pool,
		service: svc,
	}
}

func (m *Module) ID() string               { return "M8" }
func (m *Module) Service() *app.Service    { return m.service }
func (m *Module) Source() *delivery.Source { return delivery.New(m.pool, "M8") }

func (m *Module) SearchArticles(ctx context.Context, query string, audience string, isStaff bool, limit int, after string, scopes ...api.Scope) ([]api.SearchHit, error) {
	return m.service.SearchArticles(ctx, query, audience, isStaff, limit, after, scopes...)
}

func (m *Module) Register(mux *http.ServeMux, intake app.IntakeMediaPort, identity app.IdentityPort, origin string) {
	h := app.NewHandler(m.service, intake, identity, origin)
	h.Register(mux)
}

// BlobReferenced exposes only an infrastructure reference check for the shared private volume.
func (m *Module) BlobReferenced(ctx context.Context, key string) (bool, error) {
	return m.service.Store.BlobReferenced(ctx, key)
}

func (m *Module) SearchMedia(ctx context.Context, q string, p web.Page, scope api.Scope) ([]api.MediaItem, *string, error) {
	return m.service.ListMedia(ctx, scope.Principal, false, p.Limit, p.Cursor, true, q, scope)
}
