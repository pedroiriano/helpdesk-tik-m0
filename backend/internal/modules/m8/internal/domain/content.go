package domain

import (
	"regexp"
	"strings"

	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/web"
)

var (
	slugRegex = regexp.MustCompile(`^[a-z0-9-]{1,100}$`)
	xssRegex  = regexp.MustCompile(`(?i)(<\s*(script|iframe|object|embed|applet|meta|link|style)\b|javascript:|vbscript:|data:text/html|on\w+\s*=)`)
)

func ValidateSlug(slug string) error {
	if !slugRegex.MatchString(slug) {
		return web.Fail(422, "Slug harus berupa huruf kecil, angka, dan tanda hubung (1-100 karakter)")
	}
	return nil
}

func ValidateAudience(audience string) error {
	switch audience {
	case "PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY":
		return nil
	default:
		return web.Fail(422, "Audience konten tidak valid")
	}
}

func SanitizeContentBody(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", web.Fail(422, "Isi konten tidak boleh kosong")
	}
	if len(trimmed) > 4000 {
		return "", web.Fail(422, "Isi konten melebihi batas 4000 karakter")
	}
	if xssRegex.MatchString(trimmed) {
		return "", web.Fail(422, "Konten memuat tag atau skrip berbahaya (XSS terdeteksi)")
	}
	return trimmed, nil
}

func ValidateContentWrite(in api.ContentWriteInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(400, "expected_version wajib >= 1")
	}
	if strings.TrimSpace(in.Title) == "" || len(in.Title) > 4000 {
		return web.Fail(422, "Judul konten wajib diisi dan maksimal 4000 karakter")
	}
	if err := ValidateSlug(in.Slug); err != nil {
		return err
	}
	if err := ValidateAudience(in.Audience); err != nil {
		return err
	}
	if _, err := SanitizeContentBody(in.Body); err != nil {
		return err
	}
	cat := strings.TrimSpace(in.CategoryLabel)
	if len(cat) > 80 || strings.ContainsAny(cat, "<>") {
		return web.Fail(422, "Kategori konten maksimal 80 karakter dan tidak boleh memuat tag HTML")
	}
	if in.SortOrder != nil && (*in.SortOrder < 0 || *in.SortOrder > 9999) {
		return web.Fail(422, "Urutan tampil konten harus antara 0 sampai 9999")
	}
	return nil
}

func ValidateTransition(currentState, action string) (string, error) {
	switch action {
	case "REVIEW":
		if currentState != "DRAFT" {
			return "", web.Fail(422, "Aksi REVIEW hanya diizinkan untuk konten berstatus DRAFT")
		}
		return "REVIEW", nil
	case "PUBLISH":
		if currentState != "REVIEW" && currentState != "DRAFT" {
			return "", web.Fail(422, "Aksi PUBLISH hanya diizinkan untuk konten berstatus REVIEW atau DRAFT")
		}
		return "PUBLISHED", nil
	case "ARCHIVE":
		if currentState != "PUBLISHED" {
			return "", web.Fail(422, "Aksi ARCHIVE hanya diizinkan untuk konten berstatus PUBLISHED")
		}
		return "ARCHIVED", nil
	case "RESTORE":
		if currentState != "ARCHIVED" {
			return "", web.Fail(422, "Aksi RESTORE hanya diizinkan untuk konten berstatus ARCHIVED")
		}
		return "DRAFT", nil
	default:
		return "", web.Fail(422, "Aksi transisi editorial tidak dikenal")
	}
}
