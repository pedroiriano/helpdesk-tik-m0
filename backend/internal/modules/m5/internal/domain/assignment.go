package domain

import (
	"helpdesk.local/m0/internal/platform/web"
)

func ValidateLevel(level string) (string, error) {
	if level == "" {
		return "L1", nil
	}
	if level != "L1" && level != "L2" {
		return "", web.Fail(422, "Tingkat teknisi harus L1 atau L2")
	}
	return level, nil
}
