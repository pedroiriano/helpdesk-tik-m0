// Package m7 is the composition boundary for escalation.
package m7

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m7/internal/app"
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

func (m *Module) ID() string { return "M7" }

func (m *Module) Service() *app.Service {
	return m.service
}

func (m *Module) Consumer() delivery.Consumer {
	return m.service
}

func (m *Module) Source() *delivery.Source {
	return delivery.New(m.pool, "M7")
}
