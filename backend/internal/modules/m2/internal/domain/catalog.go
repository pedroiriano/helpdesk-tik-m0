package domain

import (
	"helpdesk.local/m0/internal/modules/m2/api"
	"regexp"
	"strings"
	"unicode/utf8"
)

var code = regexp.MustCompile(`^[A-Z0-9_-]{1,64}$`)
var fieldKey = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}$`)

func ValidMaster(c, n string) bool {
	return code.MatchString(c) && strings.TrimSpace(n) != "" && utf8.RuneCountInString(n) <= 200
}
func ValidMode(mode string) bool {
	return mode == "PUBLIC_GUEST" || mode == "PUBLIC_AUTH" || mode == "ASN_AUTH" || mode == "STAFF_ONLY"
}
func ValidFields(fields []api.Field) bool {
	if fields == nil || len(fields) > 100 {
		return false
	}
	seen := map[string]bool{}
	for _, f := range fields {
		if f.Options == nil || !fieldKey.MatchString(f.Key) || seen[f.Key] || strings.TrimSpace(f.Label) == "" || utf8.RuneCountInString(f.Label) > 200 || len(f.Options) > 30 {
			return false
		}
		seen[f.Key] = true
		switch f.Kind {
		case "text", "number", "date":
			if len(f.Options) > 0 {
				return false
			}
		case "choice":
			if len(f.Options) == 0 {
				return false
			}
			values := map[string]bool{}
			for _, v := range f.Options {
				if strings.TrimSpace(v) == "" || len(v) > 200 || values[v] {
					return false
				}
				values[v] = true
			}
		default:
			return false
		}
	}
	return true
}

func ValidPolicy(in api.PolicyInput) bool {
	if in.AudienceOrgs == nil || in.UploadMax < 1 || in.UploadMax > 10485760 || len(in.AllowedMIME) < 1 || len(in.AllowedMIME) > 3 || len(in.AudienceOrgs) > 100 {
		return false
	}
	seen := map[string]bool{}
	for _, mime := range in.AllowedMIME {
		if seen[mime] || (mime != "image/png" && mime != "image/jpeg" && mime != "application/pdf") {
			return false
		}
		seen[mime] = true
	}
	return true
}

var routeCharRegex = regexp.MustCompile(`^[a-zA-Z0-9/_-]*$`)

func ValidNavigation(in api.NavigationWriteInput) bool {
	if !strings.HasPrefix(in.Route, "/") || strings.HasPrefix(in.Route, "//") {
		return false
	}
	if !routeCharRegex.MatchString(in.Route) {
		return false
	}
	if strings.Contains(in.Route, "..") {
		return false
	}
	if strings.TrimSpace(in.Label) == "" || utf8.RuneCountInString(in.Label) > 4000 {
		return false
	}
	if !ValidMode(in.Audience) {
		return false
	}
	if in.Position < 0 || in.ExpectedVersion < 1 {
		return false
	}
	return true
}
