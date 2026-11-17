package domain

import (
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

func ValidateDraft(in m3api.DraftWriteInput) (time.Time, error) {
	if in.FormVersion < 1 {
		return time.Time{}, web.Fail(422, "form_version wajib >= 1")
	}
	if len(in.Title) == 0 {
		return time.Time{}, web.Fail(422, "Judul draft wajib diisi")
	}
	if len(in.Description) == 0 {
		return time.Time{}, web.Fail(422, "Deskripsi/jawaban draft wajib diisi")
	}
	exp := time.Now().Add(7 * 24 * time.Hour)
	if in.ExpiresAt != nil && !in.ExpiresAt.IsZero() {
		if in.ExpiresAt.Before(time.Now()) {
			return time.Time{}, web.Fail(422, "Waktu kedaluwarsa draft wajib di masa depan")
		}
		exp = *in.ExpiresAt
	}
	return exp, nil
}
