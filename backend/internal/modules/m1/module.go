// Package m1 is the composition boundary for identity. Business use cases follow in later slices.
package m1

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m1/internal/app"
	"helpdesk.local/m0/internal/modules/m1/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
	"net/http"
)

type Options = app.Options
type SSOOptions = app.SSOOptions
type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module { return &Module{pool: pool} }
func (m *Module) ID() string         { return "M1" }
func NewRuntime(pool *pgxpool.Pool, options Options) *Module {
	if options.Lab && !web.ValidLabOrigin(options.Origin) {
		options.Lab = false
	}
	return &Module{pool: pool, service: &app.Service{Store: store.Store{Pool: pool}, Options: options}}
}
func (m *Module) Port() api.Port              { return m.service }
func (m *Module) Register(mux *http.ServeMux) { m.service.Register(mux) }
func (m *Module) Source() *delivery.Source    { return delivery.New(m.pool, "M1") }

func (m *Module) SetDiagnostics(probe func(context.Context) api.RedactedHealth) {
	m.service.Diagnostics = probe
}

func (m *Module) SetBackupManifest(runner api.BackupManifestRunner) {
	m.service.BackupManifest = runner
}

func (m *Module) SetPurgeRunner(runner api.PurgeRunner) {
	m.service.Purge = runner
}

func (m *Module) ContactEmail(ctx context.Context, subjectID string) (string, bool, error) {
	return m.service.ContactEmail(ctx, subjectID)
}
