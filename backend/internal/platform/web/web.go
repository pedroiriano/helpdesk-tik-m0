// Package web contains transport primitives only, never business authorization.
package web

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

type Error struct {
	Status  int
	Message string
}
type correlationKey struct{}

func CorrelationID(ctx context.Context) string {
	if id, ok := ctx.Value(correlationKey{}).(string); ok {
		return id
	}
	return ID()
}

func (e *Error) Error() string              { return e.Message }
func Fail(status int, message string) error { return &Error{status, message} }
func ID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("secure randomness unavailable")
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	h := hex.EncodeToString(b)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}

var uuid = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func UUID(s string) bool { return uuid.MatchString(s) }
func Cookie(r *http.Request, name string) string {
	c, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return c.Value
}
func Decode(w http.ResponseWriter, r *http.Request, v any) error {
	if r.Header.Get("Content-Type") != "application/json" {
		return Fail(400, "Gunakan application/json")
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 65536))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return Fail(400, "Format permintaan tidak valid")
	}
	if d.Decode(&struct{}{}) != io.EOF {
		return Fail(400, "Satu objek JSON diperlukan")
	}
	return nil
}
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func WriteError(w http.ResponseWriter, err error) {
	log.Printf("web.WriteError: %v", err)
	status, message := 503, "Layanan sementara tidak tersedia"
	var e *Error
	var pg *pgconn.PgError
	if errors.As(err, &e) {
		status, message = e.Status, e.Message
	} else if errors.As(err, &pg) {
		switch pg.Code {
		case "23505":
			status, message = 409, "Data atau versi sudah digunakan"
		case "23503", "23514", "22P02":
			status, message = 422, "Referensi atau nilai tidak valid"
		}
	}
	if status == 401 {
		http.SetCookie(w, &http.Cookie{Name: "helpdesk_session", Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
		http.SetCookie(w, &http.Cookie{Name: "helpdesk_csrf", Value: "", Path: "/", SameSite: http.SameSiteStrictMode, MaxAge: -1})
	}
	codes := map[int]string{400: "INVALID_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_FAILED", 429: "RATE_LIMITED", 503: "DEPENDENCY_UNAVAILABLE"}
	correlation := w.Header().Get("X-Correlation-ID")
	if !UUID(correlation) {
		correlation = ID()
	}
	JSON(w, status, map[string]any{"code": codes[status], "message": message, "correlation_id": correlation, "details": []any{}})
}

type Page struct {
	Limit        int
	Cursor       string
	Organization string
}

func Pagination(r *http.Request, sorts ...string) (Page, error) {
	p := Page{Limit: 20, Cursor: r.URL.Query().Get("cursor")}
	p.Organization = strings.ToLower(r.URL.Query().Get("organization_id"))
	if p.Organization != "" && !UUID(p.Organization) {
		return p, Fail(400, "Filter organisasi tidak valid")
	}
	if s := r.URL.Query().Get("limit"); s != "" {
		n, e := strconv.Atoi(s)
		if e != nil || n < 1 || n > 100 {
			return p, Fail(400, "Limit harus 1–100")
		}
		p.Limit = n
	}
	p.Cursor = strings.ToLower(p.Cursor)
	if p.Cursor != "" && !UUID(p.Cursor) {
		return p, Fail(400, "Cursor tidak valid")
	}
	allowed := "id_asc"
	if len(sorts) == 1 {
		allowed = sorts[0]
	}
	if s := r.URL.Query().Get("sort"); s != "" && s != allowed {
		return p, Fail(400, "Sort yang tersedia adalah "+allowed)
	}
	return p, nil
}
func List[T any](items []T, limit int, id func(T) string) map[string]any {
	var cursor any
	if len(items) > limit {
		items = items[:limit]
		cursor = id(items[len(items)-1])
	}
	if items == nil {
		items = []T{}
	}
	return map[string]any{"items": items, "next_cursor": cursor, "as_of": time.Now().UTC().Format(time.RFC3339)}
}
