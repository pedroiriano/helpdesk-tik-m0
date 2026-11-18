// Package domain provides business rules, masking, and sanitization for M9.
package domain

import (
	"strings"

	"helpdesk.local/m0/internal/platform/web"
)

// ValidateTelegramBinding enforces AC21 scope rules.
func ValidateTelegramBinding(scopeOrgID string, actorKind string, actorOrgs []string, channel, verificationCode string) error {
	if channel != "SINK" {
		return web.Fail(400, "Channel pengiriman wajib bernilai SINK")
	}
	code := strings.TrimSpace(verificationCode)
	if code == "" || len(code) > 128 {
		return web.Fail(400, "Kode verifikasi tidak valid")
	}
	if !web.UUID(scopeOrgID) {
		return web.Fail(400, "Scope organisasi ID tidak valid")
	}

	// AC21: Publik dilarang mengikatkan diri ke organisasi internal staf
	if actorKind == "PUBLIC" || actorKind == "GUEST" {
		// Publik hanya boleh binding ke scope publik umum dirinya sendiri, bukan organisasi dinas/staf internal
		return web.Fail(400, "Tujuan tidak sah: Aktor publik dilarang mengikat notifikasi ke scope organisasi staf")
	}

	// Aktor staf wajib memiliki keanggotaan pada organisasi yang diminta
	if len(actorOrgs) > 0 {
		authorized := false
		for _, org := range actorOrgs {
			if org == scopeOrgID {
				authorized = true
				break
			}
		}
		if !authorized {
			return web.Fail(403, "Tujuan tidak sah: Aktor tidak memiliki wewenang pada organisasi sasaran")
		}
	} else if actorKind != "SUPER_ADMIN" && actorKind != "PLATFORM_ADMIN" {
		return web.Fail(403, "Aktor tidak terdaftar pada organisasi manapun")
	}

	return nil
}

// MaskSecret censors secret bot tokens and chat references for AC21.
func MaskSecret(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "TG-***"
	}
	if len(s) <= 6 {
		return "TG-***"
	}
	prefix := s[:3]
	suffix := s[len(s)-2:]
	return prefix + "****" + suffix
}

// SanitizeCSV prevents formula injection in spreadsheet software.
func SanitizeCSV(val string) string {
	trimmed := strings.TrimSpace(val)
	if len(trimmed) > 0 {
		c := trimmed[0]
		if c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r' {
			return "'" + trimmed
		}
	}
	return val
}

func ValidateChannelBinding(scopeOrgID string, actorKind string, actorOrgs []string, channel, verificationCode, chatRef string, productionTelegram bool) error {
	if channel == "SINK" {
		return ValidateTelegramBinding(scopeOrgID, actorKind, actorOrgs, channel, verificationCode)
	}
	if channel != "TELEGRAM" || !productionTelegram {
		return web.Fail(400, "Channel pengiriman tidak didukung atau belum diaktifkan")
	}
	code := strings.TrimSpace(verificationCode)
	chat := strings.TrimSpace(chatRef)
	if code == "" || len(code) > 128 || chat == "" || len(chat) > 64 || HasCRLF(chat) {
		return web.Fail(400, "Kode verifikasi atau referensi chat Telegram tidak valid")
	}
	return ValidateTelegramBinding(scopeOrgID, actorKind, actorOrgs, "SINK", code)
}

func HasCRLF(v string) bool {
	return strings.ContainsAny(v, "\r\n\x00")
}

func MaskEmail(addr string) string {
	parts := strings.SplitN(strings.TrimSpace(addr), "@", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "MAIL-***"
	}
	local := parts[0]
	prefix := local[:1]
	return prefix + "***@" + parts[1]
}

func SanitizeErrorCode(err error, secrets ...string) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	for _, s := range secrets {
		if len(s) >= 4 {
			msg = strings.ReplaceAll(msg, s, "[REDACTED]")
		}
	}
	msg = strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' {
			return ' '
		}
		return r
	}, msg)
	msg = strings.TrimSpace(msg)
	if len(msg) > 80 {
		msg = msg[:80]
	}
	if msg == "" {
		return "DELIVERY_ERROR"
	}
	return msg
}
