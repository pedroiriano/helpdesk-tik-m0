// Package m4 is the composition boundary for classification. Business use cases follow in later slices.
package m4

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/modules/m4/api"
	"helpdesk.local/m0/internal/modules/m4/internal/domain"
)

type Module struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Module { return &Module{pool: pool} }
func (m *Module) ID() string         { return "M4" }

func (m *Module) Port() api.Port { return domain.Baseline{} }
