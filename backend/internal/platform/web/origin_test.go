package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOriginAndBodyGuards(t *testing.T) {
	h := Guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }), "http://127.0.0.1:18080")
	for _, tc := range []struct {
		method, host, origin string
		want                 int
	}{{"GET", "127.0.0.1:18080", "", 204}, {"POST", "127.0.0.1:18080", "http://127.0.0.1:18080", 204}, {"POST", "127.0.0.1:18080", "https://evil.invalid", 403}, {"POST", "127.0.0.1:18080", "", 403}, {"GET", "evil.invalid", "", 403}} {
		r := httptest.NewRequest(tc.method, "http://"+tc.host+"/api/v1/auth/me", nil)
		if tc.origin != "" {
			r.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatal(tc, w.Code)
		}
	}
	if ValidOrigin("http://evil.invalid") || ValidOrigin("https://valid.invalid/path") || !ValidOrigin("https://valid.invalid") {
		t.Fatal("origin config bypass")
	}
	for _, body := range []string{`{"known":"x","role":"SUPER_ADMIN"}`, `{"known":"x"}{}`, `{"known":3}`} {
		var v struct {
			Known string `json:"known"`
		}
		r := httptest.NewRequest("POST", "http://127.0.0.1/", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if Decode(httptest.NewRecorder(), r, &v) == nil {
			t.Fatal("invalid request accepted")
		}
	}
}
