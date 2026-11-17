// Package m6 is the composition boundary for sla.
package m6

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m6/api"
	"helpdesk.local/m0/internal/modules/m6/internal/app"
	"helpdesk.local/m0/internal/platform/delivery"
)

type Module struct {
	pool    *pgxpool.Pool
	service *app.Service
}

func New(pool *pgxpool.Pool) *Module {
	return &Module{
		pool:    pool,
		service: app.NewService(pool),
	}
}

func (m *Module) ID() string { return "M6" }

func (m *Module) Port() api.Port {
	return m.service
}

func (m *Module) Consumer() delivery.Consumer {
	return m.service
}

func (m *Module) Source() *delivery.Source {
	return delivery.New(m.pool, "M6")
}
