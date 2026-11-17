package web

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func ValidOrigin(origin string) bool {
	u, e := url.Parse(origin)
	if e != nil || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return false
	}
	return u.Scheme == "https" || (u.Scheme == "http" && u.Hostname() == "127.0.0.1")
}
func ValidLabOrigin(origin string) bool {
	if !ValidOrigin(origin) {
		return false
	}
	u, _ := url.Parse(origin)
	return u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost" || u.Hostname() == "::1"
}
func Guard(next http.Handler, origin string) http.Handler {
	parsed, _ := url.Parse(origin)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		ctx = context.WithValue(ctx, correlationKey{}, ID())
		w.Header().Set("X-Correlation-ID", CorrelationID(ctx))
		defer cancel()
		r = r.WithContext(ctx)
		// Health remains compatible with internal container probes; auth never trusts forwarded role/IP headers.
		if !strings.HasPrefix(r.URL.Path, "/api/v1/health/") {
			host := r.Host
			if value, _, err := net.SplitHostPort(host); err == nil {
				host = value
			}
			if !strings.EqualFold(host, parsed.Hostname()) {
				WriteError(w, Fail(403, "Host tidak diizinkan"))
				return
			}
			requestOrigin := r.Header.Get("Origin")
			write := r.Method != "GET" && r.Method != "HEAD"
			if (write && requestOrigin != origin) || (requestOrigin != "" && requestOrigin != origin) {
				WriteError(w, Fail(403, "Origin tidak diizinkan"))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
