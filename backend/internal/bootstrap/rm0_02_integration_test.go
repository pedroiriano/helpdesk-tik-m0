package bootstrap

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestRM002Integration(t *testing.T) {
	if os.Getenv("HELPDESK_RM002_TEST") != "1" {
		t.Skip("NOT_RUN: isolated PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe database target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Second)
	defer cancel()
	secrets := t.TempDir()
	for i := 1; i <= 9; i++ {
		if err := os.WriteFile(filepath.Join(secrets, fmt.Sprintf("m%d", i)), []byte(password), 0600); err != nil {
			t.Fatal(err)
		}
	}
	pools, err := database.Open(ctx, host, secrets)
	if err != nil {
		t.Fatal(err)
	}
	defer pools.Close()
	cfg, err := pgx.ParseConfig("user=postgres dbname=helpdesk sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	cfg.Host, cfg.Password = host, password
	faultDB, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer faultDB.Close(ctx)
	t.Setenv("HELPDESK_UPLOAD_ROOT", t.TempDir())
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	options := m1.Options{Lab: true, Key: []byte("synthetic-rm002-key-not-production-secret"), Origin: base}
	runtime := NewApplication(pools, options)
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()
	newClient := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 15 * time.Second}}
	}
	public, operator, coordinator, tech, other, asn := newClient(), newClient(), newClient(), newClient(), newClient(), newClient()
	public.login(1)
	operator.login(4)
	coordinator.login(11)
	tech.login(9)
	other.login(12)
	asn.login(3)
	admin := newClient()
	admin.login(5)
	const svc = "30000000-0000-4000-8000-000000000001"
	const team = "50000000-0000-4000-8000-000000000001"
	const technician = "20000000-0000-4000-8000-000000000009"
	const category = "40000000-0000-4000-8000-000000000010"
	const org = "10000000-0000-4000-8000-000000000001"
	queryCount := func(owner int, query string, args ...any) int {
		t.Helper()
		var count int
		if err := pools[owner].QueryRow(ctx, query, args...).Scan(&count); err != nil {
			t.Fatal(err)
		}
		return count
	}
	exec := func(owner int, query string, args ...any) {
		t.Helper()
		if _, err := pools[owner].Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	create := func(c testClient) string {
		return c.request("POST", "/tickets", map[string]any{
			"service_id": svc, "service_version": 1, "form_version": 1, "policy_version": 1,
			"title": "WiFi jaringan lab", "description": "Gangguan sintetis RM0-02", "answers": map[string]string{"ringkasan": "WiFi terputus"},
		}, 201, "", nil)["id"].(string)
	}
	verify := func(id string, version int) map[string]any {
		return operator.request("POST", "/tickets/"+id+"/verify", map[string]any{
			"expected_version": version, "category_id": category, "priority": "HIGH",
			"classifier_version": 2, "reason": "Dampak operasional sintetis diperiksa",
		}, 200, "", nil)
	}
	dispatchBody := func(version int, digest string) map[string]any {
		return map[string]any{"expected_version": version, "team_id": team, "assignee_id": technician,
			"proposal_version": version, "proposal_digest": digest, "reason": "Penugasan tiket sintetis", "tier": "L1"}
	}
	assertState := func(v map[string]any, state string) {
		t.Helper()
		if v["state"] != state {
			t.Fatalf("state = %v, want %s", v["state"], state)
		}
	}
	transition := func(c testClient, id, action string, version int, status int) map[string]any {
		return c.request("POST", "/tickets/"+id+"/transitions", map[string]any{
			"action": action, "expected_version": version, "reason": "Bukti tindakan sintetis",
		}, status, "", nil)
	}

	t.Run("catalog-audience-and-snapshot", func(t *testing.T) {
		valid := queryCount(1, `SELECT count(*) FROM catalog.services s JOIN catalog.categories c ON c.id=s.category_id
		 WHERE s.code LIKE 'TIK-%' AND s.active AND c.active AND s.owner_org_id=c.owner_org_id
		 AND EXISTS (SELECT 1 FROM catalog.service_forms f WHERE f.service_id=s.id AND jsonb_array_length(f.fields)>0)
		 AND EXISTS (SELECT 1 FROM catalog.policies p WHERE p.service_id=s.id AND p.effective_at<=now() AND p.upload_max_bytes>0 AND cardinality(p.allowed_mime)>0)`)
		if valid != 16 {
			t.Fatalf("catalog fixture valid entries = %d, want 16", valid)
		}
		if count := queryCount(4, `SELECT count(DISTINCT service_id) FROM assignment.routing_rules WHERE active AND id::text BETWEEN '90000000-0000-4000-8000-000000000011' AND '90000000-0000-4000-8000-000000000026' AND cardinality(required_skills)>0`); count != 16 {
			t.Fatalf("missing catalog routing: %d", count)
		}
		route := "/catalog/services/30000000-0000-4000-8000-000000000011"
		public.request("GET", route, nil, 404, "", nil)
		asn.request("GET", route, nil, 200, "", nil)
		id := create(public)
		public.request("POST", "/tickets", map[string]any{"service_id": svc, "service_version": 1, "form_version": 2, "policy_version": 1, "title": "Uji versi", "description": "Versi drift sintetis", "answers": map[string]string{"ringkasan": "Sinyal"}}, 409, "", nil)
		if queryCount(2, `SELECT count(*) FROM intake.tickets WHERE id=$1 AND service_snapshot->'form'->>'form_version'='1' AND service_snapshot->'policy'->>'policy_version'='1'`, id) != 1 {
			t.Fatal("old snapshot not preserved")
		}
		const sample = "30000000-0000-4000-8000-000000000024"
		route = "/admin/services/" + sample + "/routing/L1"
		old := admin.request("GET", route, nil, 200, "", nil)
		payload := map[string]any{"expected_version": old["version"], "team_id": team, "required_skills": []string{"wifi", "public"}, "active": true, "reason": "Konfigurasi routing lab"}
		public.request("PUT", route, payload, 404, "", nil)
		revision := admin.request("PUT", route, payload, 200, "", nil)
		if revision["version"] != float64(2) {
			t.Fatal("routing revision did not advance")
		}
		admin.request("PUT", route, payload, 409, "", nil)
		if queryCount(4, `SELECT count(*) FROM assignment.routing_rules WHERE service_id=$1 AND level='L1'`, sample) != 2 {
			t.Fatal("historic routing revision was overwritten")
		}
	})

	t.Run("lifecycle-and-classification", func(t *testing.T) {
		id := create(public)
		path := "/tickets/" + id
		operator.request("POST", path+"/dispatch", dispatchBody(1, ""), 409, "", nil)
		assertState(transition(operator, id, "REQUEST_INFORMATION", 1, 200), "NEEDS_INFORMATION")
		transition(other, id, "SUPPLY_INFORMATION", 2, 404)
		assertState(transition(public, id, "SUPPLY_INFORMATION", 2, 200), "OPEN")
		operator.request("POST", path+"/verify", map[string]any{"expected_version": 3, "category_id": team, "priority": "HIGH", "classifier_version": 2, "reason": "Kategori tim tidak sah"}, 422, "", nil)
		result := verify(id, 3)
		assertState(result, "TRIAGED")
		proposed := result["classification"].(map[string]any)
		decision := result["classification_decision"].(map[string]any)
		if proposed["category_id"] != category || proposed["priority"] != "NORMAL" || proposed["confidence"] != 0.7 || decision["category_id"] != category || decision["priority"] != "HIGH" {
			t.Fatal("proposal or operator decision not preserved separately")
		}
		if queryCount(2, `SELECT count(*) FROM intake.ticket_verifications WHERE ticket_id=$1 AND confidence=0.7 AND classifier_version=2 AND proposed_category=$2 AND octet_length(evidence_digest)=32 AND override_reason<>''`, id, category) != 1 {
			t.Fatal("verification provenance incomplete")
		}
		p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		if p["assignee_id"] != technician {
			t.Fatal("expected eligible L1 technician")
		}
		body := dispatchBody(4, p["digest"].(string))
		key := web.ID()
		assertState(coordinator.request("POST", path+"/dispatch", body, 200, key, nil), "ASSIGNED")
		assertState(coordinator.request("POST", path+"/dispatch", body, 200, key, nil), "ASSIGNED")
		tech.request("POST", path+"/resolve", map[string]any{"expected_version": 5, "summary": "Hasil belum dimulai"}, 409, "", nil)
		assertState(transition(tech, id, "START", 5, 200), "IN_PROGRESS")
		resolved := tech.request("POST", path+"/resolve", map[string]any{"expected_version": 6, "summary": "Perbaikan sintetis selesai"}, 200, "", nil)
		attempt := resolved["active_attempt_id"]
		coordinator.request("POST", path+"/dispatch", dispatchBody(7, ""), 409, "", nil)
		public.request("POST", path+"/confirmation", map[string]any{"expected_version": 7, "attempt_id": web.ID(), "decision": "ACCEPT"}, 409, "", nil)
		public.request("POST", path+"/confirmation", map[string]any{"expected_version": 7, "attempt_id": attempt, "decision": "FEEDBACK", "feedback": "Masih perlu ditinjau"}, 200, "", nil)
		assertState(public.request("POST", path+"/confirmation", map[string]any{"expected_version": 8, "attempt_id": attempt, "decision": "REJECT", "reason": "Gangguan masih terlihat"}, 200, "", nil), "IN_PROGRESS")
		r2 := tech.request("POST", path+"/resolve", map[string]any{"expected_version": 9, "summary": "Penanganan lanjutan selesai"}, 200, "", nil)
		newClient().request("POST", path+"/close", map[string]any{"expected_version": 10, "attempt_id": r2["active_attempt_id"]}, 401, "", nil)
		assertState(public.request("POST", path+"/close", map[string]any{"expected_version": 10, "attempt_id": r2["active_attempt_id"]}, 200, "", nil), "CLOSED")
		coordinator.request("POST", path+"/dispatch", dispatchBody(11, ""), 409, "", nil)
		if public.request("GET", path, nil, 200, "", nil)["reopen_until"] == nil || coordinator.request("GET", path, nil, 200, "", nil)["reopen_until"] != nil {
			t.Fatal("reopen availability was not scoped to authorized actors")
		}
		exec(2, `UPDATE intake.resolution_attempts SET updated_at=now()-interval '8 days' WHERE id=$1`, r2["active_attempt_id"])
		transition(public, id, "REOPEN", 11, 409)
		exec(2, `UPDATE intake.resolution_attempts SET updated_at=now() WHERE id=$1`, r2["active_attempt_id"])
		reopened := transition(public, id, "REOPEN", 11, 200)
		assertState(reopened, "OPEN")
		if reopened["episode_id"] == result["episode_id"] || reopened["verification"] != "PENDING" || queryCount(2, `SELECT count(*) FROM intake.episode_reopens WHERE ticket_id=$1 AND previous_episode_id=$2 AND episode_id=$3`, id, result["episode_id"], reopened["episode_id"]) != 1 {
			t.Fatal("reopen did not link a new episode")
		}
		assertState(transition(public, id, "CANCEL", 12, 200), "CANCELLED")
	})

	t.Run("roster-fallback-stale-and-cas", func(t *testing.T) {
		id := create(public)
		verify(id, 1)
		path := "/tickets/" + id
		other.request("GET", path+"/dispatch-proposal?tier=L1", nil, 404, "", nil)
		l2 := coordinator.request("GET", path+"/dispatch-proposal?tier=L2", nil, 200, "", nil)
		if l2["assignee_id"] == technician {
			t.Fatal("L1 technician recommended at L2")
		}
		p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		digest := p["digest"].(string)
		exec(4, `UPDATE assignment.rosters SET available_from=now()+interval '1 day',version=version+1 WHERE subject_id=$1`, technician)
		if p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil); p["status"] != "MANUAL" {
			t.Fatal("future roster was accepted")
		}
		coordinator.request("POST", path+"/dispatch", dispatchBody(2, digest), 409, "", nil)
		exec(4, `UPDATE assignment.rosters SET available_from=now()-interval '1 day',version=version+1 WHERE subject_id=$1`, technician)
		exec(0, `UPDATE identity.subjects SET active=false WHERE id=$1`, technician)
		if p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil); p["status"] != "MANUAL" {
			t.Fatal("inactive identity was accepted")
		}
		exec(0, `UPDATE identity.subjects SET active=true WHERE id=$1`, technician)
		exec(4, `UPDATE assignment.rosters SET available_until=now()-interval '1 hour',version=version+1 WHERE subject_id=$1`, technician)
		if p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil); p["status"] != "MANUAL" {
			t.Fatal("expired roster was accepted")
		}
		exec(4, `UPDATE assignment.rosters SET available_until=now()+interval '1 day',version=version+1 WHERE subject_id=$1`, technician)
		exec(4, `UPDATE assignment.rosters SET skills=ARRAY['network'],version=version+1 WHERE subject_id=$1`, technician)
		if p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil); p["status"] != "MANUAL" {
			t.Fatal("roster with only part of required skills was accepted")
		}
		exec(4, `UPDATE assignment.rosters SET skills=ARRAY['hardware','network'],version=version+1 WHERE subject_id=$1`, technician)
		p = coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		body := dispatchBody(2, p["digest"].(string))
		statuses := make(chan int, 2)
		var wg sync.WaitGroup
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				raw, _ := json.Marshal(body)
				req, _ := http.NewRequest(http.MethodPost, base+"/api/v1"+path+"/dispatch", strings.NewReader(string(raw)))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Origin", base)
				req.Header.Set("X-CSRF-Token", coordinator.csrf())
				req.Header.Set("Idempotency-Key", web.ID())
				res, err := coordinator.http.Do(req)
				if err != nil {
					statuses <- 0
					return
				}
				res.Body.Close()
				statuses <- res.StatusCode
			}()
		}
		wg.Wait()
		close(statuses)
		seen := map[int]int{}
		for status := range statuses {
			seen[status]++
		}
		if seen[200] != 1 || seen[409] != 1 {
			t.Fatalf("dispatch CAS results %v", seen)
		}
		if queryCount(4, `SELECT count(*) FROM assignment.assignment_proposals WHERE ticket_id=$1`, id) != 0 {
			t.Fatal("M5 wrote before delivery")
		}
		if queryCount(2, `SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1 AND event_type='TicketStateChanged' AND payload ? 'dispatch'`, id) != 1 {
			t.Fatal("dispatch fact not atomic")
		}
	})

	t.Run("postcommit-inbox-replay-order", func(t *testing.T) {
		id := create(public)
		verify(id, 1)
		path := "/tickets/" + id
		p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		// Add checks only in this disposable database, then remove them before retry.
		if _, err := faultDB.Exec(ctx, "ALTER TABLE intake.outbox ADD CONSTRAINT rm002_fail_m3 CHECK (NOT(payload ? 'dispatch' AND aggregate_id = '"+id+"'::uuid)) NOT VALID"); err != nil {
			t.Fatal(err)
		}
		coordinator.request("POST", path+"/dispatch", dispatchBody(2, p["digest"].(string)), 422, "", nil)
		assertState(coordinator.request("GET", path, nil, 200, "", nil), "TRIAGED")
		if queryCount(2, `SELECT count(*) FROM intake.ticket_versions WHERE ticket_id=$1 AND ticket_version=3`, id) != 0 ||
			queryCount(4, `SELECT count(*) FROM assignment.assignment_proposals WHERE ticket_id=$1`, id) != 0 {
			t.Fatal("partial effect before M3 commit")
		}
		if _, err := faultDB.Exec(ctx, "ALTER TABLE intake.outbox DROP CONSTRAINT rm002_fail_m3"); err != nil {
			t.Fatal(err)
		}
		coordinator.request("POST", path+"/dispatch", dispatchBody(2, p["digest"].(string)), 200, "", nil)
		var m5 delivery.Binding
		for _, b := range runtime.Bindings {
			if b.Source.ConsumerID == "M5" {
				m5 = b
				break
			}
		}
		if m5.Source == nil {
			t.Fatal("M5 binding missing")
		}
		var chosen delivery.Event
		for {
			v, err := m5.Source.Claim(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if v.Aggregate == id && v.Version == 3 {
				chosen = v
				break
			}
			if err = m5.Consumer.Consume(ctx, v); err != nil {
				t.Fatal(err)
			}
			if err = m5.Source.Ack(ctx, v); err != nil {
				t.Fatal(err)
			}
		}
		if _, err := faultDB.Exec(ctx, "ALTER TABLE assignment.inbox ADD CONSTRAINT rm002_fail_m5 CHECK (event_id <> '"+chosen.ID+"'::uuid) NOT VALID"); err != nil {
			t.Fatal(err)
		}
		if err := m5.Consumer.Consume(ctx, chosen); err == nil {
			t.Fatal("expected inbox failure")
		}
		if queryCount(4, `SELECT count(*) FROM assignment.assignment_proposals WHERE id=$1`, chosen.ID) != 0 ||
			queryCount(4, `SELECT count(*) FROM assignment.load_projection WHERE ticket_id=$1 AND source_version=3`, id) != 0 {
			t.Fatal("M5 effects escaped inbox rollback")
		}
		assertState(coordinator.request("GET", path, nil, 200, "", nil), "ASSIGNED")
		if _, err := faultDB.Exec(ctx, "ALTER TABLE assignment.inbox DROP CONSTRAINT rm002_fail_m5"); err != nil {
			t.Fatal(err)
		}
		errorsFromWorkers := make(chan error, 2)
		for i := 0; i < 2; i++ {
			go func() { errorsFromWorkers <- m5.Consumer.Consume(ctx, chosen) }()
		}
		for i := 0; i < 2; i++ {
			if err := <-errorsFromWorkers; err != nil {
				t.Fatal(err)
			}
		}
		if queryCount(4, `SELECT count(*) FROM assignment.assignment_proposals WHERE id=$1 AND ticket_id=$2`, chosen.ID, id) != 1 ||
			queryCount(4, `SELECT count(*) FROM assignment.inbox WHERE event_id=$1 AND consumer_id='M5'`, chosen.ID) != 1 {
			t.Fatal("dispatch effect or inbox missing before ACK")
		}
		restarted := NewApplication(pools, options)
		var next delivery.Binding
		for _, b := range restarted.Bindings {
			if b.Source.ConsumerID == "M5" {
				next = b
				break
			}
		}
		next.Source.Now = func() time.Time { return time.Now().Add(time.Minute) }
		for {
			v, err := next.Source.Claim(ctx)
			if errors.Is(err, delivery.ErrEmpty) {
				break
			}
			if err != nil {
				t.Fatal(err)
			}
			if err = next.Consumer.Consume(ctx, v); err != nil {
				t.Fatal(err)
			}
			if err = next.Source.Ack(ctx, v); err != nil {
				t.Fatal(err)
			}
		}
		if queryCount(2, `SELECT count(*) FROM intake.outbox_delivery WHERE event_id=$1 AND consumer_id='M5' AND state='ACKED' AND attempts=2`, chosen.ID) != 1 ||
			queryCount(4, `SELECT count(*) FROM assignment.load_projection WHERE ticket_id=$1 AND source_version=3 AND assignee_id=$2 AND service_owner_org_id=$3`, id, technician, org) != 1 {
			t.Fatal("lost ACK recovery or monotonic projection failed")
		}
		if err := next.Consumer.Consume(ctx, chosen); err != nil {
			t.Fatal(err)
		}
		chosen.Payload = []byte(`{"state":"OPEN","service_owner_org_id":"10000000-0000-4000-8000-000000000001"}`)
		chosen.Digest, _ = delivery.Digest(chosen.Payload)
		if err := next.Consumer.Consume(ctx, chosen); !errors.Is(err, delivery.ErrIntegrity) {
			t.Fatalf("conflicting digest got %v", err)
		}
		if queryCount(4, `SELECT count(*) FROM assignment.assignment_proposals WHERE ticket_id=$1`, id) != 1 {
			t.Fatal("duplicate assignment projection")
		}
		for _, b := range restarted.Bindings {
			if b.Source.ConsumerID != "M6" && b.Source.ConsumerID != "M9" {
				continue
			}
			for {
				err := delivery.Step(ctx, b.Source, b.Consumer, delivery.Hooks{})
				if errors.Is(err, delivery.ErrEmpty) {
					break
				}
				if err != nil {
					t.Fatal(err)
				}
			}
		}
	})

	t.Run("projected-load-reassignment-and-operator-reject", func(t *testing.T) {
		const secondTech = "20000000-0000-4000-8000-000000000010"
		exec(4, `UPDATE assignment.rosters SET skills=skills||ARRAY['hardware','network'],version=version+1 WHERE subject_id=$1`, secondTech)
		id := create(public)
		verify(id, 1)
		path := "/tickets/" + id
		p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		if p["assignee_id"] != secondTech || len(p["candidates"].([]any)) != 2 || p["projection_as_of"] == nil {
			t.Fatal("preferred candidate does not follow durable projected load")
		}
		assigned := coordinator.request("POST", path+"/dispatch", dispatchBody(2, p["digest"].(string)), 200, "", nil)
		if assigned["assignee_id"] != technician {
			t.Fatal("eligible override did not preserve the selected technician")
		}
		l2 := coordinator.request("GET", path+"/dispatch-proposal?tier=L2&mode=reassign", nil, 200, "", nil)
		body := dispatchBody(3, l2["digest"].(string))
		body["tier"], body["assignee_id"] = "L2", secondTech
		reassigned := coordinator.request("POST", path+"/reassign", body, 200, "", nil)
		if reassigned["assignee_id"] != secondTech || reassigned["accepted_at"] != assigned["accepted_at"] || reassigned["episode_id"] != assigned["episode_id"] {
			t.Fatal("reassignment changed acceptance facts or did not set the new technician")
		}
		transition(tech, id, "START", 4, 404)
		rejectID := create(public)
		operator.request("POST", "/tickets/"+rejectID+"/reject", map[string]any{"expected_version": 1, "reason": "Laporan sintetis di luar cakupan"}, 200, "", nil)
		assertState(public.request("GET", "/tickets/"+rejectID, nil, 200, "", nil), "CANCELLED")
	})

	t.Run("lifecycle-state-action-matrix", func(t *testing.T) {
		// Set up every state through the same HTTP commands used by the application.
		prepare := func(state string) map[string]any {
			id := create(public)
			path := "/tickets/" + id
			if state == "OPEN" {
				return public.request("GET", path, nil, 200, "", nil)
			}
			if state == "NEEDS_INFORMATION" || state == "CANCELLED" {
				action := "REQUEST_INFORMATION"
				actor := operator
				if state == "CANCELLED" {
					action, actor = "CANCEL", public
				}
				return transition(actor, id, action, 1, 200)
			}
			v := verify(id, 1)
			if state == "TRIAGED" {
				return v
			}
			p := coordinator.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
			v = coordinator.request("POST", path+"/dispatch", dispatchBody(2, p["digest"].(string)), 200, "", nil)
			if state == "ASSIGNED" {
				return v
			}
			v = transition(tech, id, "START", 3, 200)
			if state == "IN_PROGRESS" {
				return v
			}
			tech.request("POST", path+"/resolve", map[string]any{"expected_version": 4, "summary": "Perbaikan untuk matriks lifecycle"}, 200, "", nil)
			v = public.request("GET", path, nil, 200, "", nil)
			if state == "CLOSED" {
				public.request("POST", path+"/confirmation", map[string]any{"expected_version": 5, "attempt_id": v["active_attempt_id"], "decision": "ACCEPT"}, 200, "", nil)
				v = public.request("GET", path, nil, 200, "", nil)
			}
			return v
		}
		legal := map[string]map[string]string{
			"REQUEST_INFORMATION": {"OPEN": "NEEDS_INFORMATION", "TRIAGED": "NEEDS_INFORMATION"},
			"SUPPLY_INFORMATION":  {"NEEDS_INFORMATION": "OPEN"},
			"START":               {"ASSIGNED": "IN_PROGRESS"},
			"CANCEL":              {"OPEN": "CANCELLED", "TRIAGED": "CANCELLED", "NEEDS_INFORMATION": "CANCELLED"},
			"REOPEN":              {"CLOSED": "OPEN"},
		}
		states := []string{"OPEN", "TRIAGED", "NEEDS_INFORMATION", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"}
		actions := []string{"REQUEST_INFORMATION", "SUPPLY_INFORMATION", "START", "CANCEL", "REOPEN"}
		for _, state := range states {
			for _, action := range actions {
				t.Run(state+"/"+action, func(t *testing.T) {
					v := prepare(state)
					id := v["id"].(string)
					version := int(v["version"].(float64))
					actor := public
					if action == "REQUEST_INFORMATION" {
						actor = operator
					}
					if action == "START" {
						actor = tech
					}
					want := 409
					next, allowed := legal[action][state]
					if allowed {
						want = 200
						transition(actor, id, action, version+1, 409)
					} else if action == "START" && (state == "OPEN" || state == "TRIAGED" || state == "NEEDS_INFORMATION" || state == "CANCELLED") {
						want = 404 // Unassigned technicians cannot read or mutate these tickets.
					}
					history := queryCount(2, "SELECT count(*) FROM intake.ticket_versions WHERE ticket_id=$1", id)
					outbox := queryCount(2, "SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1", id)
					transition(actor, id, action, version, want)
					latest := public.request("GET", "/tickets/"+id, nil, 200, "", nil)
					if allowed {
						assertState(latest, next)
						if latest["version"] != float64(version+1) {
							t.Fatal("valid transition did not advance one version")
						}
					} else if latest["state"] != state || latest["version"] != v["version"] ||
						queryCount(2, "SELECT count(*) FROM intake.ticket_versions WHERE ticket_id=$1", id) != history ||
						queryCount(2, "SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1", id) != outbox {
						t.Fatal("forbidden transition changed durable state")
					}
				})
			}
		}
	})
	t.Run("published-form-and-policy-version-drift", func(t *testing.T) {
		id := create(public)
		path := "/admin/services/" + svc
		form := public.request("GET", "/catalog/services/"+svc+"/form", nil, 200, "", nil)
		admin.request("PUT", path+"/form", map[string]any{"expected_version": 1, "form_version": 2, "fields": form["fields"]}, 200, "", nil)
		stale := map[string]any{"service_id": svc, "service_version": 1, "form_version": 1, "policy_version": 1, "title": "WiFi jaringan lab", "description": "Gangguan sintetis", "answers": map[string]string{"ringkasan": "WiFi terputus"}}
		public.request("POST", "/tickets", stale, 409, "", nil)
		admin.request("PUT", path+"/policy", map[string]any{"expected_version": 2, "policy_version": 2, "upload_max_bytes": 1048576, "allowed_mime": []string{"application/pdf"}, "audience_org_ids": []string{}}, 200, "", nil)
		stale["service_version"], stale["form_version"] = 3, 2
		public.request("POST", "/tickets", stale, 409, "", nil)
		stale["policy_version"] = 2
		fresh := public.request("POST", "/tickets", stale, 201, "", nil)["id"]
		if queryCount(2, `SELECT count(*) FROM intake.tickets WHERE (id=$1 AND form_version=1 AND policy_version=1 AND service_snapshot->'form'->>'form_version'='1') OR (id=$2 AND form_version=2 AND policy_version=2 AND service_snapshot->'policy'->>'policy_version'='2')`, id, fresh) != 2 {
			t.Fatal("historical snapshot or refreshed versions missing")
		}
	})
}
