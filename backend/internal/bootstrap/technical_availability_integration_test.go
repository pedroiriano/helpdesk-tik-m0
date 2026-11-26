package bootstrap

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

const (
	techOrg       = "10000000-0000-4000-8000-000000000001"
	techTeam      = "50000000-0000-4000-8000-000000000001"
	techOtherTeam = "50000000-0000-4000-8000-000000000042"
	techSubject   = "20000000-0000-4000-8000-000000000009"
	techRoster    = "91000000-0000-4000-8000-000000000001"
	techReason    = "Fixture sintetis pengujian ketersediaan"
)

type technicalFixture struct {
	ctx     context.Context
	db      *pgx.Conn
	runtime *Runtime
	login   func(int) testClient
	drain   func()
}

func newTechnicalFixture(t *testing.T) technicalFixture {
	t.Helper()
	if os.Getenv("HELPDESK_TECHNICAL_TEST") != "1" {
		t.Skip("NOT_RUN: isolated PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe database target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	t.Cleanup(cancel)
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
	t.Cleanup(pools.Close)
	cfg, err := pgx.ParseConfig("user=postgres dbname=helpdesk sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	cfg.Host, cfg.Password = host, password
	db, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(ctx) })
	t.Setenv("HELPDESK_UPLOAD_ROOT", t.TempDir())
	t.Setenv("HELPDESK_SCANNER", "127.0.0.1:1")
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	rt := NewApplication(pools, m1.Options{Lab: true, Origin: base, Key: []byte("synthetic-technical-integration-test-key")})
	server.Config.Handler = rt.Handler
	server.Start()
	t.Cleanup(server.Close)
	return technicalFixture{ctx: ctx, db: db, runtime: rt, login: func(index int) testClient {
		jar, _ := cookiejar.New(nil)
		client := testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
		client.login(index)
		return client
	}, drain: func() {
		t.Helper()
		for _, binding := range rt.Bindings {
			for i := 0; i < 1000; i++ {
				err := delivery.Step(ctx, binding.Source, binding.Consumer, delivery.Hooks{})
				if errors.Is(err, delivery.ErrEmpty) {
					break
				}
				if err != nil {
					t.Fatalf("delivery to %s: %v", binding.Source.ConsumerID, err)
				}
			}
		}
	}}
}

func TestTechnicalAvailability(t *testing.T) {
	f := newTechnicalFixture(t)
	f.drain()
	admin, adminB, tech, techB, public, coordinator, operator := f.login(5), f.login(6), f.login(9), f.login(7), f.login(1), f.login(11), f.login(4)
	from := time.Now().UTC().Truncate(time.Second).Add(-time.Hour)
	path := "/admin/teams/" + techTeam + "/rosters"
	scope := "?organization_id=" + techOrg
	own := "/technicians/me"
	assert := func(condition bool, message string) {
		t.Helper()
		if !condition {
			t.Fatal(message)
		}
	}
	status := func(client testClient, path, rosterID string) string {
		t.Helper()
		for _, item := range items(client.request("GET", path, nil, 200, "", nil)) {
			row := item.(map[string]any)
			if row["id"] == rosterID {
				return row["availability"].(map[string]any)["status"].(string)
			}
		}
		t.Fatal("roster not visible")
		return ""
	}
	assert(status(admin, path+scope, techRoster) == "UNCONFIGURED", "old roster must stay readable with capacity unset")
	adminB.request("GET", path+scope, nil, 403, "", nil)
	public.request("GET", own+"/absences", nil, 403, "", nil)
	techB.request("GET", own+"/rosters"+scope, nil, 403, "", nil)
	in := map[string]any{"subject_id": techSubject, "expected_version": 1, "skills": []string{"hardware", "network"},
		"available_from": from, "available_until": from.Add(2 * time.Hour), "active": true, "capacity": 4, "reason": techReason}
	directory := "/staff/roster-teams" + scope
	if len(items(coordinator.request("GET", directory, nil, 200, "", nil))) == 0 {
		t.Fatal("coordinator has no scoped roster teams")
	}
	operator.request("GET", directory, nil, 403, "", nil)
	adminB.request("GET", directory, nil, 403, "", nil)
	operator.request("PUT", path+"/"+techRoster+scope, in, 403, "", nil)
	competingWrites(t, coordinator, "PUT", path+"/"+techRoster+scope, in)
	in["expected_version"] = 0
	admin.request("POST", path+scope, in, 409, "", nil)
	in["available_from"], in["available_until"] = from.Add(2*time.Hour), from.Add(3*time.Hour)
	future := admin.request("POST", path+scope, in, 201, "", nil)["id"].(string)
	assert(status(admin, path+scope, future) == "OUTSIDE_SCHEDULE", "future schedule must not be on duty")
	assert(status(tech, own+"/rosters"+scope, techRoster) == "AVAILABLE", "technician should see own current schedule")
	_, err := f.db.Exec(f.ctx, "INSERT INTO identity.teams(id,org_id,name) VALUES($1,$2,'Tim fixture gabungan')", techOtherTeam, techOrg)
	if err != nil {
		t.Fatal(err)
	}
	in["available_from"], in["available_until"] = from, from.Add(2*time.Hour)
	admin.request("POST", "/admin/teams/"+techOtherTeam+"/rosters"+scope, in, 201, "", nil)
	summaryPath := "/admin/technical-capacity" + scope + "&team_id=" + techTeam + "&team_id=" + techOtherTeam + "&skill=hardware"
	summary := admin.request("GET", summaryPath, nil, 200, "", nil)
	assert(summary["remaining"] == float64(4) && summary["technicians"] == float64(1), "account must not be counted twice")
	adminB.request("GET", summaryPath, nil, 403, "", nil)
	absence := map[string]any{"starts_at": from, "ends_at": from.Add(2 * time.Hour), "reason": techReason}
	id := tech.request("POST", own+"/absences", absence, 201, "", nil)["id"].(string)
	tech.request("POST", own+"/absences", absence, 409, "", nil)
	assert(len(items(techB.request("GET", own+"/absences", nil, 200, "", nil))) == 0, "other technician absence exposed")
	assert(len(items(tech.request("GET", own+"/absences", nil, 200, "", nil))) == 1, "absence must persist")
	assert(status(admin, path+scope, techRoster) == "ABSENT", "absence must override shift")
	cancel := map[string]any{"expected_version": 1, "reason": techReason}
	techB.request("POST", own+"/absences/"+id+"/cancel", cancel, 404, "", nil)
	tech.request("POST", own+"/absences/"+id+"/cancel", cancel, 200, "", nil)
	tech.request("POST", own+"/absences/"+id+"/cancel", cancel, 409, "", nil)
	assert(status(admin, path+scope, techRoster) == "AVAILABLE", "cancel must restore availability")
	f.drain()
	var num int
	if err := f.db.QueryRow(f.ctx, "SELECT count(*) FROM notify_audit.audit_entries WHERE action IN ('RecordTechnicianAbsence','CancelTechnicianAbsence')").Scan(&num); err != nil || num != 2 {
		t.Fatalf("expected two committed absence audits, got %d (%v)", num, err)
	}
	if _, err = f.db.Exec(f.ctx, "UPDATE identity.subjects SET active=false WHERE id=$1", techSubject); err != nil {
		t.Fatal(err)
	}
	assert(status(admin, path+scope, techRoster) == "INACTIVE", "disabled account must not count")
}

func competingWrites(t *testing.T, client testClient, method, path string, payload any) {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	gate := make(chan struct{})
	statuses := make(chan int, 2)
	for i := 0; i < 2; i++ {
		req, err := http.NewRequest(method, client.base+"/api/v1"+path, bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", client.base)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", client.csrf())
		req.Header.Set("Idempotency-Key", web.ID())
		go func() {
			<-gate
			res, e := client.http.Do(req)
			if e != nil {
				statuses <- 0
				return
			}
			defer res.Body.Close()
			statuses <- res.StatusCode
		}()
	}
	close(gate)
	a, b := <-statuses, <-statuses
	if min(a, b) != 200 || max(a, b) != 409 {
		t.Fatalf("concurrent writes gave %d / %d", a, b)
	}
}

func verifiedTechnicalTicket(client, operator testClient) string {
	created := client.request("POST", "/tickets", map[string]any{
		"service_id":      "30000000-0000-4000-8000-000000000001",
		"service_version": 1, "form_version": 1, "policy_version": 1,
		"title": "Fixture teknis jaringan", "description": techReason, "answers": map[string]string{"ringkasan": "Fixture sintetis"},
	}, 201, "", nil)
	path := "/tickets/" + created["id"].(string)
	operator.request("POST", path+"/verify", map[string]any{
		"expected_version": 1, "category_id": "40000000-0000-4000-8000-000000000010",
		"priority": "NORMAL", "classifier_version": 2, "reason": techReason,
	}, 200, "", nil)
	return path
}

func assignmentSelection(proposal map[string]any, subject, team string, manual bool) map[string]any {
	return map[string]any{"expected_version": proposal["ticket_version"], "proposal_version": proposal["ticket_version"],
		"proposal_digest": proposal["digest"], "tier": "L1", "assignee_id": subject, "team_id": team, "reason": techReason, "manual": manual}
}

func TestTechnicalDispatch(t *testing.T) {
	f := newTechnicalFixture(t)
	f.drain()
	public, operator, coord, tech, coordB := f.login(1), f.login(4), f.login(11), f.login(9), f.login(12)
	const second = "20000000-0000-4000-8000-000000000010"
	_, err := f.db.Exec(f.ctx, "UPDATE assignment.rosters SET capacity=1 WHERE subject_id=$1", techSubject)
	if err != nil {
		t.Fatal(err)
	}
	path := verifiedTechnicalTicket(public, operator)
	route := path + "/dispatch-proposal?tier=L1"
	pending := coord.request("GET", route, nil, 200, "", nil)
	if pending["status"] != "MANUAL" {
		t.Fatal("pending projection produced capacity recommendation")
	}
	coordB.request("GET", route, nil, 404, "", nil)
	f.drain()
	p := coord.request("GET", route, nil, 200, "", nil)
	if p["status"] != "RECOMMENDED" || p["assignee_id"] != techSubject {
		t.Fatalf("expected technician with capacity: %v", p)
	}
	competingWrites(t, coord, "POST", path+"/dispatch", assignmentSelection(p, techSubject, techTeam, false))
	f.drain()
	reassign := path + "/dispatch-proposal?tier=L1&mode=reassign"
	full := coord.request("GET", reassign, nil, 200, "", nil)
	if full["status"] != "MANUAL" {
		t.Fatal("full technician recommended")
	}
	var fullCandidate bool
	for _, raw := range full["candidates"].([]any) {
		roster := raw.(map[string]any)["roster"].(map[string]any)
		if roster["subject_id"] == techSubject && roster["availability"] == "FULL" && roster["active_tickets"] == float64(1) {
			fullCandidate = true
		}
	}
	if !fullCandidate {
		t.Fatal("authorized fallback should show full status")
	}
	now := time.Now().UTC().Truncate(time.Second)
	tech.request("POST", "/technicians/me/absences", map[string]any{"starts_at": now.Add(-time.Hour),
		"ends_at": now.Add(time.Hour), "reason": techReason}, 201, "", nil)
	absent := coord.request("GET", reassign, nil, 200, "", nil)
	tickets := items(coord.request("GET", "/tickets?state=ASSIGNED", nil, 200, "", nil))
	if len(tickets) != 1 || tickets[0].(map[string]any)["assignment_needs_review"] != true {
		t.Fatal("coordinator queue did not signal reassignment review")
	}
	for _, raw := range absent["candidates"].([]any) {
		if raw.(map[string]any)["roster"].(map[string]any)["subject_id"] == techSubject {
			t.Fatal("absent technician offered for manual dispatch")
		}
	}
	_, err = f.db.Exec(f.ctx, "UPDATE assignment.rosters SET capacity=3,skills=ARRAY['hardware','network','system','security'] WHERE subject_id=$1", second)
	if err != nil {
		t.Fatal(err)
	}
	next := coord.request("GET", reassign, nil, 200, "", nil)
	if next["status"] != "RECOMMENDED" || next["assignee_id"] != second {
		t.Fatalf("expected alternative technician: %v", next)
	}
	coord.request("POST", path+"/reassign", assignmentSelection(next, second, techTeam, false), 200, "", nil)
	f.drain()
	ticketID := strings.TrimPrefix(path, "/tickets/")
	var oldCount, newCount int
	count := func() {
		t.Helper()
		err := f.db.QueryRow(f.ctx, `SELECT count(*) FILTER(WHERE assignee_id=$2),count(*) FILTER(WHERE assignee_id=$3)
         FROM assignment.load_projection WHERE ticket_id=$1 AND state IN ('ASSIGNED','IN_PROGRESS')`, ticketID, techSubject, second).Scan(&oldCount, &newCount)
		if err != nil || oldCount != 0 || newCount != 1 {
			t.Fatalf("reassignment workload %d / %d (%v)", oldCount, newCount, err)
		}
	}
	count()
	var replay delivery.Event
	err = f.db.QueryRow(f.ctx, `SELECT event_id::text,event_type,schema_version,aggregate_id::text,aggregate_version,occurred_at,payload,digest
        FROM intake.outbox WHERE aggregate_id=$1 AND event_type='TicketStateChanged' AND aggregate_version=3`, ticketID).
		Scan(&replay.ID, &replay.Type, &replay.SchemaVersion, &replay.Aggregate, &replay.Version, &replay.Occurred, &replay.Payload, &replay.Digest)
	if err != nil {
		t.Fatal(err)
	}
	replay.Producer = "M3"
	for _, binding := range f.runtime.Bindings {
		if binding.Source.ConsumerID == "M5" {
			if err := binding.Consumer.Consume(f.ctx, replay); err != nil {
				t.Fatal(err)
			}
		}
	}
	count()
	techSecond := f.login(10)
	updated := techSecond.request("GET", path, nil, 200, "", nil)
	started := techSecond.request("POST", path+"/transitions", map[string]any{
		"expected_version": updated["version"], "action": "START", "reason": techReason,
	}, 200, "", nil)
	vendor := techSecond.request("POST", path+"/vendor-cases", map[string]any{
		"expected_version": started["version"], "vendor_id": "00000000-0000-4000-8000-000000000099",
		"internal_pic_id": second, "external_reference": "VND-TECH-01", "contract_reference": "FIXTURE-001",
		"expected_return_at": now.Add(4 * time.Hour), "next_followup_at": now.Add(2 * time.Hour),
	}, 201, "", nil)
	readLoad := func(assignee *string, owner string, waiting bool) {
		t.Helper()
		var gotAssignee *string
		var gotOwner string
		var gotWaiting bool
		err := f.db.QueryRow(f.ctx, "SELECT assignee_id::text,service_owner_org_id::text,awaiting_vendor FROM assignment.load_projection WHERE ticket_id=$1", ticketID).
			Scan(&gotAssignee, &gotOwner, &gotWaiting)
		if err != nil || gotOwner != owner || gotWaiting != waiting ||
			(assignee == nil && gotAssignee != nil) || (assignee != nil && (gotAssignee == nil || *gotAssignee != *assignee)) {
			t.Fatalf("unexpected workload after transition: assignee=%v owner=%s vendor=%v err=%v", gotAssignee, gotOwner, gotWaiting, err)
		}
	}
	f.drain()
	other := second
	readLoad(&other, techOrg, true)
	closed := techSecond.request("POST", path+"/vendor-cases/"+vendor["id"].(string)+"/close", map[string]any{
		"expected_version": vendor["version"], "reason": techReason,
	}, 200, "", nil)
	f.drain()
	readLoad(&other, techOrg, false)
	const nextOrg = "10000000-0000-4000-8000-000000000002"
	const nextTeam = "50000000-0000-4000-8000-000000000002"
	handoff := coord.request("POST", path+"/handoffs", map[string]any{
		"expected_version": closed["version"], "target_org_id": nextOrg, "target_team_id": nextTeam, "reason": techReason,
	}, 201, "", nil)
	f.drain()
	readLoad(&other, techOrg, false)
	coordB.request("GET", path, nil, 404, "", nil)
	coordB.request("POST", path+"/handoffs/"+handoff["id"].(string)+"/accept", map[string]any{
		"expected_version": handoff["version"], "reason": techReason,
	}, 200, "", nil)
	f.drain()
	readLoad(nil, nextOrg, false)
	coord.request("GET", path, nil, 404, "", nil)
	coordB.request("GET", path, nil, 200, "", nil)
}

func TestTechnicalPerformance(t *testing.T) {
	f := newTechnicalFixture(t)
	f.drain()
	applicant, operator, coord, tech, techB, leader, cross := f.login(1), f.login(4), f.login(11), f.login(9), f.login(10), f.login(13), f.login(12)
	const second = "20000000-0000-4000-8000-000000000010"
	if _, err := f.db.Exec(f.ctx, "UPDATE assignment.rosters SET capacity=4, skills=ARRAY['hardware','network','system','security'] WHERE team_id=$1", techTeam); err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Truncate(time.Second)
	now := start
	f.runtime.Intake.Service().Now = func() time.Time { return now }
	path := verifiedTechnicalTicket(applicant, operator)
	current := func(client testClient) map[string]any { return client.request("GET", path, nil, 200, "", nil) }
	route := path + "/dispatch-proposal?tier=L1"
	assign := func(client testClient, subject string) {
		f.drain()
		p := coord.request("GET", route, nil, 200, "", nil)
		if p["status"] != "RECOMMENDED" {
			t.Fatalf("cannot dispatch: %v", p)
		}
		coord.request("POST", path+"/dispatch", assignmentSelection(p, subject, techTeam, false), 200, "", nil)
		version := current(client)["version"]
		client.request("POST", path+"/transitions", map[string]any{"expected_version": version, "action": "START", "reason": techReason}, 200, "", nil)
	}
	finish := func(client testClient) map[string]any {
		now = now.Add(time.Minute)
		w := client.request("POST", path+"/work-logs", map[string]any{"expected_version": current(client)["version"], "started_at": now.Add(-time.Minute), "ended_at": now, "summary": techReason}, 201, "", nil)
		now = now.Add(time.Minute)
		return client.request("POST", path+"/resolve", map[string]any{"expected_version": w["version"], "summary": techReason}, 200, "", nil)
	}
	assign(tech, techSubject)
	first := finish(tech)
	f.drain()
	now = now.Add(time.Minute)
	applicant.request("POST", path+"/confirmation", map[string]any{"expected_version": current(applicant)["version"], "decision": "ACCEPT", "attempt_id": first["active_attempt_id"]}, 200, "", nil)
	now = now.Add(time.Minute)
	reopened := applicant.request("POST", path+"/transitions", map[string]any{
		"expected_version": current(applicant)["version"], "action": "REOPEN", "reason": techReason}, 200, "", nil)
	operator.request("POST", path+"/verify", map[string]any{
		"expected_version": reopened["version"], "category_id": "40000000-0000-4000-8000-000000000010",
		"priority": "NORMAL", "classifier_version": 2, "reason": techReason}, 200, "", nil)
	assign(techB, second)
	last := finish(techB)
	f.drain()
	now = now.Add(24*time.Hour + time.Minute)
	version := int64(current(applicant)["version"].(float64))
	stale, err := f.runtime.Intake.Service().ScheduledAutoClose(f.ctx, strings.TrimPrefix(path, "/tickets/"), last["active_attempt_id"].(string), version, now)
	if stale || err != nil {
		t.Fatalf("auto-close stale=%v err=%v", stale, err)
	}
	f.drain()
	query := url.Values{"organization_id": {techOrg}, "team_id": {techTeam}, "from": {start.Format(time.RFC3339)}, "to": {now.Add(time.Second).Format(time.RFC3339)}}
	endpoint := "/reports/technical-performance"
	report := func(client testClient) map[string]any {
		return client.request("GET", endpoint+"?"+query.Encode(), nil, 200, "", nil)
	}
	assertCounts := func(data map[string]any, want map[string]float64) {
		t.Helper()
		for key, n := range want {
			if data[key] != n {
				t.Fatalf("%s: expected %v got %v", key, n, data[key])
			}
		}
	}
	both := report(leader)
	assertCounts(both, map[string]float64{"resolved_tickets": 1, "resolution_attempts": 2, "confirmed": 1,
		"auto_closed": 1, "reopened": 1, "work_logs": 2, "work_seconds": 120, "sla_measured": 2})
	assertCounts(report(coord), map[string]float64{"resolution_attempts": 2})
	assertCounts(report(tech), map[string]float64{"resolution_attempts": 1, "confirmed": 1, "auto_closed": 0, "reopened": 1, "work_logs": 1})
	assertCounts(report(techB), map[string]float64{"resolution_attempts": 1, "confirmed": 0, "auto_closed": 1, "reopened": 0, "work_logs": 1})
	applicant.request("GET", endpoint+"?"+query.Encode(), nil, 403, "", nil)
	cross.request("GET", endpoint+".csv?"+query.Encode(), nil, 403, "", nil)
	tech.request("GET", endpoint+".csv?"+query.Encode(), nil, 403, "", nil)
	response, err := leader.http.Get(leader.base + "/api/v1" + endpoint + ".csv?" + query.Encode())
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		raw, _ := io.ReadAll(response.Body)
		t.Fatalf("CSV status=%d %s", response.StatusCode, raw)
	}
	records, err := csv.NewReader(response.Body).ReadAll()
	if err != nil || len(records) != 2 {
		t.Fatalf("CSV rows=%d (%v)", len(records), err)
	}
	for i, column := range records[0] {
		if number, ok := both[column].(float64); ok && column != "sla_percent" && records[1][i] != fmt.Sprintf("%.0f", number) {
			t.Fatalf("CSV %s differs from API", column)
		}
	}
	query.Set("from", start.Add(2*time.Minute).Format(time.RFC3339))
	query.Set("to", start.Add(2*time.Minute).Format(time.RFC3339))
	leader.request("GET", endpoint+"?"+query.Encode(), nil, 422, "", nil)
	query.Set("from", now.Add(-time.Second).Format(time.RFC3339))
	query.Set("to", now.Format(time.RFC3339))
	empty := report(leader)
	assertCounts(empty, map[string]float64{"resolved_tickets": 0, "sla_measured": 0, "auto_closed": 0})
	if empty["sla_percent"] != nil {
		t.Fatal("zero denominator must produce null percentage")
	}
}
