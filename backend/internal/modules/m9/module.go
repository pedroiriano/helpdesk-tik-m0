// Package m9 is the composition boundary for notify_audit.
package m9

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	m1api "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m9/internal/app"
	"helpdesk.local/m0/internal/modules/m9/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
)

type DeliveryOptions = app.DeliveryOptions
type TechnicalFactsReader = app.TechnicalFactsReader
type DashboardPort = app.DashboardPort

type Module struct {
	pool               *pgxpool.Pool
	scope              func(context.Context, string, []string) ([]string, error)
	productionDelivery bool
	preferTelegram     bool
	service            *app.Service
	technicalFacts     TechnicalFactsReader
	dashboard          DashboardPort
}

func New(pool *pgxpool.Pool, scope func(context.Context, string, []string) ([]string, error)) *Module {
	st := store.Store{Pool: pool, CheckScope: scope}
	svc := app.NewService(st)
	return &Module{
		pool:    pool,
		scope:   scope,
		service: svc,
	}
}

func (m *Module) ID() string            { return "M9" }
func (m *Module) Service() *app.Service { return m.service }
func (m *Module) Consumer() delivery.Consumer {
	return store.Store{
		Pool:               m.pool,
		CheckScope:         m.scope,
		ProductionDelivery: m.productionDelivery,
		PreferTelegram:     m.preferTelegram,
	}
}
func (m *Module) SourceForM3() *delivery.Source {
	return delivery.NewForConsumer(m.pool, "M9", "M3")
}

func (m *Module) Register(mux *http.ServeMux, authPort m1api.Port, origin string) {
	h := app.NewHandler(m.service, authPort, origin)
	h.Dashboard = m.dashboard
	h.Register(mux)
	if m.technicalFacts != nil {
		h.RegisterTechnicalReports(mux, m.technicalFacts)
	}
}

func (m *Module) BindTechnicalFacts(reader TechnicalFactsReader) { m.technicalFacts = reader }

func (m *Module) BindDashboard(reader DashboardPort) { m.dashboard = reader }

func (m *Module) EnableLabSink(enabled bool) { m.service.Lab = enabled }

func (m *Module) ConfigureDelivery(opts DeliveryOptions) {
	m.service.Delivery = opts
	if opts.TelegramEnabled || opts.SMTPEnabled {
		m.productionDelivery = true
		m.preferTelegram = opts.TelegramEnabled
	}
}

func (m *Module) RunDispatcher(ctx context.Context) { m.service.RunDispatcher(ctx) }

func (m *Module) ProcessDeliveryBatch(ctx context.Context, limit int) (int, error) {
	return m.service.ProcessDeliveryBatch(ctx, limit)
}
