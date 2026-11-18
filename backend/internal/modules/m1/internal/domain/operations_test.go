package domain

import (
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m1/api"
)

func TestValidateMaintenancePolicy(t *testing.T) {
	now := time.Now().UTC()

	// Kasus 1: Mode tidak valid
	err := ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:     "INVALID_MODE",
		StartsAt: now,
		EndsAt:   now.Add(time.Hour),
		Message:  "Pemeliharaan",
	})
	if err == nil {
		t.Fatal("Expected error for invalid mode")
	}

	// Kasus 2: ends_at <= starts_at
	err = ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:     "READ_ONLY",
		StartsAt: now,
		EndsAt:   now.Add(-time.Hour),
		Message:  "Pemeliharaan",
	})
	if err == nil {
		t.Fatal("Expected error for ends_at <= starts_at")
	}

	// Kasus 3: Pesan kosong
	err = ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:     "READ_ONLY",
		StartsAt: now,
		EndsAt:   now.Add(time.Hour),
		Message:  "",
	})
	if err == nil {
		t.Fatal("Expected error for empty message")
	}

	// Kasus 4: Sah
	err = ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:         "READ_ONLY",
		ScheduleKind: "SCHEDULED",
		DisplayMode:  "FULL_SCREEN",
		StartsAt:     now,
		EndsAt:       now.Add(time.Hour),
		Message:      "Pemeliharaan server berkala",
	})
	if err != nil {
		t.Fatalf("Expected nil error for valid input, got %v", err)
	}

	// Kasus 5: ScheduleKind dan DisplayMode tidak valid
	if err := ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:         "READ_ONLY",
		ScheduleKind: "RANDOM",
		StartsAt:     now,
		EndsAt:       now.Add(time.Hour),
		Message:      "Pemeliharaan",
	}); err == nil {
		t.Fatal("Expected error for invalid schedule_kind")
	}
	if err := ValidateMaintenancePolicy(api.MaintenancePolicyInput{
		Mode:        "READ_ONLY",
		DisplayMode: "POPUP",
		StartsAt:    now,
		EndsAt:      now.Add(time.Hour),
		Message:     "Pemeliharaan",
	}); err == nil {
		t.Fatal("Expected error for invalid display_mode")
	}
}

func TestValidateSystemJob(t *testing.T) {
	// Kasus 1: Kind di luar allowlist ditolak (AC24)
	err := ValidateSystemJob("SHELL_EXEC", "SUPER_ADMIN")
	if err == nil {
		t.Fatal("AC24 Violation: Expected error for unallowlisted job kind SHELL_EXEC")
	}

	err = ValidateSystemJob("SQL_CONSOLE", "SUPER_ADMIN")
	if err == nil {
		t.Fatal("AC24 Violation: Expected error for unallowlisted job kind SQL_CONSOLE")
	}

	// Kasus 2: Non-Super Admin meminta PURGE_REQUEST ditolak (AC22)
	for _, role := range []string{"COORDINATOR", "ADMIN_OPD", "PLATFORM_ADMIN", "OPERATOR", "PUBLIC", "ASN"} {
		err := ValidateSystemJob("PURGE_REQUEST", role)
		if err == nil {
			t.Fatalf("AC22 Violation: Expected error for non-super admin role %s requesting purge", role)
		}
	}

	// Kasus 3: Super Admin meminta PURGE_REQUEST diterima
	err = ValidateSystemJob("PURGE_REQUEST", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("Expected nil error for SUPER_ADMIN purge request, got %v", err)
	}

	// Kasus 4: BACKUP_MANIFEST dan HEALTH_REPORT diterima
	if err := ValidateSystemJob("BACKUP_MANIFEST", "PLATFORM_ADMIN"); err != nil {
		t.Fatalf("Expected nil error for BACKUP_MANIFEST, got %v", err)
	}
	if err := ValidateSystemJob("HEALTH_REPORT", "AUDITOR"); err != nil {
		t.Fatalf("Expected nil error for HEALTH_REPORT, got %v", err)
	}
}

func TestIsMaintenanceWindowActive(t *testing.T) {
	now := time.Now().UTC()
	start := now.Add(-time.Hour)
	end := now.Add(time.Hour)

	if !IsMaintenanceWindowActive(start, end, now) {
		t.Fatal("Expected window to be active")
	}

	futureStart := now.Add(time.Hour)
	futureEnd := now.Add(2 * time.Hour)
	if IsMaintenanceWindowActive(futureStart, futureEnd, now) {
		t.Fatal("Expected future window to be inactive")
	}

	pastStart := now.Add(-2 * time.Hour)
	pastEnd := now.Add(-time.Hour)
	if IsMaintenanceWindowActive(pastStart, pastEnd, now) {
		t.Fatal("Expected past window to be inactive")
	}
}
