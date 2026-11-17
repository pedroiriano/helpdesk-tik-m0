package bootstrap

import (
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/modules/m2"
	"helpdesk.local/m0/internal/modules/m3"
	"helpdesk.local/m0/internal/modules/m4"
	"helpdesk.local/m0/internal/modules/m5"
	"helpdesk.local/m0/internal/modules/m6"
	"helpdesk.local/m0/internal/modules/m7"
	"helpdesk.local/m0/internal/modules/m8"
	"helpdesk.local/m0/internal/modules/m9"
	"helpdesk.local/m0/internal/platform/database"
)

type Module interface{ ID() string }

func Compose(pools database.Pools) []Module {
	return []Module{m1.New(pools[0]), m2.New(pools[1]), m3.New(pools[2]), m4.New(pools[3]), m5.New(pools[4]), m6.New(pools[5]), m7.New(pools[6]), m8.New(pools[7]), m9.New(pools[8], nil)}
}
