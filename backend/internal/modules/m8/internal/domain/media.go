package domain

import (
	"fmt"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

var AllowedMIMEs = map[string]bool{
	"image/png":       true,
	"image/jpeg":      true,
	"application/pdf": true,
}

func ValidateMediaUpload(in api.MediaUploadInput) error {
	if !AllowedMIMEs[in.MIME] {
		return web.Fail(422, fmt.Sprintf("MIME %s tidak diizinkan; gunakan image/png, image/jpeg, atau application/pdf", in.MIME))
	}
	if in.SizeBytes < 1 || in.SizeBytes > 10485760 {
		return web.Fail(422, "Ukuran berkas wajib antara 1 byte hingga 10 MB")
	}
	if len(in.Alt) == 0 {
		return web.Fail(422, "Teks alternatif (alt) wajib diisi")
	}
	if len(in.License) == 0 {
		return web.Fail(422, "Informasi lisensi wajib diisi")
	}
	if len(in.SHA256) != 64 {
		return web.Fail(422, "SHA256 digest berkas tidak valid")
	}
	return nil
}

func ValidateDraft(in api.DraftWriteInput) (time.Time, error) {
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
