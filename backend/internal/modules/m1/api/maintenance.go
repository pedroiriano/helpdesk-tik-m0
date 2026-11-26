package api

import (
	"context"
	"helpdesk.local/m0/internal/platform/web"
)

// CheckMaintenance gates interactive writes using organization IDs resolved by their owner.
func CheckMaintenance(ctx context.Context, port interface {
	ActiveMaintenance(context.Context, string) (*MaintenancePolicy, error)
}, create bool, organizations ...string) error {
	for _, org := range organizations {
		policy, err := port.ActiveMaintenance(ctx, org)
		if err != nil {
			return web.Fail(503, "Status pemeliharaan belum dapat diperiksa. Coba lagi.")
		}
		if policy != nil && (policy.Mode == "READ_ONLY" || (create && policy.Mode == "DRAIN")) {
			return web.Fail(503, policy.Message)
		}
	}
	return nil
}
