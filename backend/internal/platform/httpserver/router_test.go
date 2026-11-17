package httpserver

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealth(t *testing.T) {
	for _, tc := range []struct {
		path, method string
		fail         bool
		code         int
	}{
		{"/api/v1/health/live", "GET", true, 200},
		{"/livez", "GET", true, 200},
		{"/api/v1/health/ready", "GET", false, 200},
		{"/readyz", "GET", false, 200},
		{"/api/v1/health/ready", "GET", true, 503},
		{"/readyz", "GET", true, 503},
		{"/api/v1/admin/tickets", "GET", false, 404},
		{"/api/v1/health/ready", "POST", false, 404},
	} {
		h := Handler(func(ctx context.Context) error {
			if _, ok := ctx.Deadline(); !ok {
				t.Fatal("missing deadline")
			}
			if tc.fail {
				return errors.New("secret database failure")
			}
			return nil
		})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
		if w.Code != tc.code {
			t.Fatalf("%s %s: got %d", tc.method, tc.path, w.Code)
		}
		if strings.Contains(w.Body.String(), "secret") {
			t.Fatal("error disclosure")
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("health cached")
		}
	}
}
