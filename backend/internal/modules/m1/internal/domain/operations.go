package domain

import (
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/web"
)

// Allowlisted operational job kinds (AC24).
var AllowlistedJobKinds = map[string]bool{
	"BACKUP_MANIFEST": true,
	"HEALTH_REPORT":   true,
	"PURGE_REQUEST":   true,
}

// ValidateMaintenancePolicy verifies maintenance window parameters.
func ValidateMaintenancePolicy(in api.MaintenancePolicyInput) error {
	mode := strings.TrimSpace(in.Mode)
	if mode != "NORMAL" && mode != "READ_ONLY" && mode != "DRAIN" {
		return web.Fail(400, "Mode pemeliharaan harus bernilai NORMAL, READ_ONLY atau DRAIN")
	}
	schedule := strings.TrimSpace(in.ScheduleKind)
	if schedule != "" && schedule != "SCHEDULED" && schedule != "UNSCHEDULED" {
		return web.Fail(400, "Jenis jadwal pemeliharaan harus bernilai SCHEDULED atau UNSCHEDULED")
	}
	display := strings.TrimSpace(in.DisplayMode)
	if display != "" && display != "BANNER" && display != "FULL_SCREEN" {
		return web.Fail(400, "Mode tampilan pemeliharaan harus bernilai BANNER atau FULL_SCREEN")
	}
	if in.StartsAt.IsZero() || in.EndsAt.IsZero() {
		return web.Fail(400, "Waktu mulai dan selesai wajib diisi")
	}
	if !in.EndsAt.After(in.StartsAt) {
		return web.Fail(400, "Waktu selesai harus setelah waktu mulai")
	}
	if strings.TrimSpace(in.Message) == "" {
		return web.Fail(400, "Pesan pemeliharaan wajib diisi")
	}
	if in.OrgID != nil && *in.OrgID != "" && !web.UUID(*in.OrgID) {
		return web.Fail(400, "ID organisasi tidak valid")
	}
	if in.TargetID != "" && !web.UUID(in.TargetID) {
		return web.Fail(400, "ID target jendela pemeliharaan tidak valid")
	}
	return nil
}

// ValidateSystemJob verifies job kind against allowlist and checks role authorization (AC22, AC24).
func ValidateSystemJob(kind string, actorRole string) error {
	trimmedKind := strings.TrimSpace(kind)
	if !AllowlistedJobKinds[trimmedKind] {
		return web.Fail(400, "Jenis pekerjaan sistem tidak diizinkan: runner hanya menerima jenis terdaftar")
	}

	// AC22: Non Super Admin dilarang keras meminta purge
	if trimmedKind == "PURGE_REQUEST" {
		if actorRole != "SUPER_ADMIN" {
			return web.Fail(403, "Otorisasi ditolak: Hanya Super Admin yang berwenang mengajukan pemusnahan data")
		}
	}

	return nil
}

// IsMaintenanceWindowActive checks if the given time falls within maintenance start and end.
func IsMaintenanceWindowActive(startsAt, endsAt, now time.Time) bool {
	return (now.Equal(startsAt) || now.After(startsAt)) && (now.Before(endsAt) || now.Equal(endsAt))
}
