package m7

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

var validJobStates = map[string]bool{
	"": true, "PENDING": true, "LEASED": true, "ACKED": true, "DEAD_LETTER": true,
}

func (m *Module) RegisterSchedulerListing(
	mux *http.ServeMux,
	authorize func(context.Context, string, string, string, bool) (string, error),
	authorizeBatch func(context.Context, string, []string) ([]string, error),
) {
	mux.HandleFunc("GET /api/v1/tickets/{id}/scheduler-jobs", func(w http.ResponseWriter, r *http.Request) {
		ticketID := r.PathValue("id")
		if !web.UUID(ticketID) {
			web.WriteError(w, web.Fail(404, "Job scheduler tidak ditemukan"))
			return
		}
		token := sessionToken(r)
		if _, err := authorize(r.Context(), ticketID, token, "", false); err != nil {
			web.WriteError(w, err)
			return
		}
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		items, err := m.service.Store.ListTicketJobs(r.Context(), ticketID, limit)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /api/v1/admin/scheduler-jobs", func(w http.ResponseWriter, r *http.Request) {
		state := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
		if !validJobStates[state] {
			web.WriteError(w, web.Fail(400, "Filter state job scheduler tidak valid"))
			return
		}
		token := sessionToken(r)
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if limit <= 0 || limit > 100 {
			limit = 50
		}
		// Check system.job credential via empty batch first so unauthenticated/forbidden requests fail immediately.
		if _, err := authorizeBatch(r.Context(), token, nil); err != nil {
			web.WriteError(w, err)
			return
		}
		jobs, err := m.service.Store.ListJobs(r.Context(), state, 200)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		seen := make(map[string]bool)
		ticketIDs := make([]string, 0, len(jobs))
		for _, job := range jobs {
			if !seen[job.TicketID] {
				seen[job.TicketID] = true
				ticketIDs = append(ticketIDs, job.TicketID)
			}
		}
		allowedList, err := authorizeBatch(r.Context(), token, ticketIDs)
		if err != nil {
			web.WriteError(w, err)
			return
		}
		allowed := make(map[string]bool, len(allowedList))
		for _, id := range allowedList {
			allowed[id] = true
		}
		filtered := make([]api.TicketJobView, 0, limit)
		for _, job := range jobs {
			if allowed[job.TicketID] {
				filtered = append(filtered, job)
				if len(filtered) >= limit {
					break
				}
			}
		}
		w.Header().Set("Cache-Control", "no-store")
		web.JSON(w, 200, map[string]any{"items": filtered})
	})
}

func (m *Module) ListRules(ctx context.Context) ([]web.RuleView, error) {
	return m.service.Store.ListRules(ctx)
}

func (m *Module) ConfigureRule(ctx context.Context, actorID, key string, in web.RuleWrite) (database.Result, error) {
	return m.service.Store.ConfigureRule(ctx, actorID, key, in)
}

func sessionToken(r *http.Request) string {
	token := web.Cookie(r, "helpdesk_session")
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		token = strings.TrimPrefix(h, "Bearer ")
	}
	return token
}
