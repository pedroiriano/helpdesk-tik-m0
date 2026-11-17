package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

func Handler(ready func(context.Context) error, register ...func(*http.ServeMux)) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health/live", func(w http.ResponseWriter, r *http.Request) { write(w, 200, "live") })
	mux.HandleFunc("GET /livez", func(w http.ResponseWriter, r *http.Request) { write(w, 200, "live") })
	mux.HandleFunc("GET /api/v1/health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if ready(ctx) != nil {
			write(w, 503, "unavailable")
			return
		}
		write(w, 200, "ready")
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if ready(ctx) != nil {
			write(w, 503, "unavailable")
			return
		}
		write(w, 200, "ready")
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { write(w, 404, "not_found") })
	for _, add := range register {
		add(mux)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}
func write(w http.ResponseWriter, code int, status string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": status})
}
