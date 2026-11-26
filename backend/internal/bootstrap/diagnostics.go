package bootstrap

import (
	"bytes"
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func diagnostics(pools database.Pools, bindings []delivery.Binding, root, scanner string, worker *atomic.Int64) func(context.Context) identity.RedactedHealth {
	slots := make(chan struct{}, 2)
	return func(ctx context.Context) identity.RedactedHealth {
		now := time.Now().UTC()
		result := identity.RedactedHealth{Status: "DEGRADED", Modules: make(map[string]string), Scanner: "UNAVAILABLE", Storage: "UNAVAILABLE", Worker: "UNAVAILABLE", ObservedAt: now}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			result.Status = "BUSY"
			return result
		}
		type probe struct {
			key, state   string
			signatureAge *int64
		}
		outcomes := make(chan probe, len(pools)+2)
		files := blob.Files{Root: root, Scanner: scanner}
		for i := range pools {
			go func(i int) {
				state := "HEALTHY"
				if pools.ProbeOwner(ctx, i) != nil {
					state = "UNAVAILABLE"
				}
				outcomes <- probe{key: fmt.Sprintf("M%d", i+1), state: state}
			}(i)
		}
		go func() {
			state := "UNAVAILABLE"
			if decision, err := files.Scan(ctx, []byte("Helpdesk diagnostics fixture")); err == nil && decision == "CLEAN" {
				state = "HEALTHY"
			}
			var age *int64
			if state == "HEALTHY" {
				if seconds, err := files.SignatureAge(ctx, now); err == nil {
					age = &seconds
				}
			}
			outcomes <- probe{key: "scanner", state: state, signatureAge: age}
		}()
		go func() {
			state := "UNAVAILABLE"
			key := web.ID()
			fixture := []byte("Helpdesk storage probe")
			if _, _, err := files.Put(ctx, key, bytes.NewReader(fixture), int64(len(fixture))); err == nil {
				payload, readErr := files.Read(key)
				removeErr := files.Remove(key)
				if readErr == nil && removeErr == nil && bytes.Equal(payload, fixture) {
					state = "HEALTHY"
				}
			}
			outcomes <- probe{key: "storage", state: state}
		}()
		var queue sync.WaitGroup
		pending := make(chan delivery.Backlog, len(bindings))
		for _, binding := range bindings {
			queue.Add(1)
			go func() {
				defer queue.Done()
				stats, err := binding.Source.Inspect(ctx)
				if err == nil {
					pending <- stats
				}
			}()
		}
		go func() { queue.Wait(); close(pending) }()
		healthy := true
		for range len(pools) + 2 {
			var p probe
			select {
			case p = <-outcomes:
			case <-ctx.Done():
				healthy = false
				continue
			}
			switch p.key {
			case "scanner":
				result.Scanner = p.state
				result.ScannerSignatureAge = p.signatureAge
			case "storage":
				result.Storage = p.state
			default:
				result.Modules[p.key] = p.state
			}
			healthy = healthy && p.state == "HEALTHY"
		}
		for i := range pools {
			name := fmt.Sprintf("M%d", i+1)
			if result.Modules[name] == "" {
				result.Modules[name] = "UNAVAILABLE"
			}
		}
		ticks := worker.Load()
		if ticks > 0 && now.Sub(time.Unix(0, ticks)) < 60*time.Second {
			result.Worker = "HEALTHY"
		}
		var count, dead, age int64
		seen := 0
		for stats := range pending {
			seen++
			count += stats.Pending
			dead += stats.Dead
			if stats.Oldest != nil {
				age = max(age, int64(now.Sub(*stats.Oldest)/time.Second))
			}
		}
		if seen == len(bindings) {
			result.OutboxLag, result.DeadLetters, result.OldestDeliverySeconds = &count, &dead, &age
		}
		if healthy && seen == len(bindings) && dead == 0 && age <= 60 && result.Worker == "HEALTHY" {
			result.Status = "HEALTHY"
		}
		return result
	}
}
