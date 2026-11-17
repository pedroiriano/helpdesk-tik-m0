package bootstrap

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	m7 "helpdesk.local/m0/internal/modules/m7/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestRM003Integration(t *testing.T) {
	if os.Getenv("HELPDESK_RM003_TEST") != "1" {
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
	fault, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer fault.Close(ctx)
	t.Setenv("HELPDESK_UPLOAD_ROOT", t.TempDir())
	t.Setenv("HELPDESK_SCANNER", "127.0.0.1:1")
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Origin: base, Key: []byte("synthetic-rm003-key-not-production-secret")})
	fixed := time.Date(2026, 11, 6, 8, 30, 0, 0, time.UTC)
	runtime.Intake.Service().Now = func() time.Time { return fixed }
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()
	login := func(index int) testClient {
		jar, _ := cookiejar.New(nil)
		c := testClient{t, base, &http.Client{Jar: jar, Timeout: 15 * time.Second}}
		c.login(index)
		return c
	}
	public, operator, coord, tech, target, admin, approver, super := login(1), login(4), login(11), login(9), login(12), login(5), login(18), login(17)
	const org = "10000000-0000-4000-8000-000000000001"
	const svc = "30000000-0000-4000-8000-000000000001"
	const security = "30000000-0000-4000-8000-000000000016"
	const techID = "20000000-0000-4000-8000-000000000009"
	const team = "50000000-0000-4000-8000-000000000001"
	const category = "40000000-0000-4000-8000-000000000010"
	const reason = "Pemeriksaan sintetis RM0-03"
	date := func(v string) time.Time {
		out, err := time.Parse(time.RFC3339, v)
		if err != nil {
			t.Fatal(err)
		}
		return out
	}
	eq := func(got, want any) {
		t.Helper()
		if got != want {
			t.Fatalf("got %v (%T), want %v (%T)", got, got, want, want)
		}
	}
	count := func(query string, args ...any) int {
		t.Helper()
		var n int
		if err := fault.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	sql := func(query string, args ...any) {
		t.Helper()
		if _, err := fault.Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	drain := func() {
		t.Helper()
		for _, b := range runtime.Bindings {
			for i := 0; i < 250; i++ {
				err := delivery.Step(ctx, b.Source, b.Consumer, delivery.Hooks{})
				if errors.Is(err, delivery.ErrEmpty) {
					break
				}
				if err != nil {
					t.Fatalf("delivery to %s: %v", b.Source.ConsumerID, err)
				}
			}
		}
	}
	create := func(service string, answers map[string]string) map[string]any {
		receipt := public.request("POST", "/tickets", map[string]any{"service_id": service, "service_version": 1, "form_version": 1, "policy_version": 1,
			"title": "WiFi jaringan lab", "description": reason, "answers": answers}, 201, "", nil)
		return public.request("GET", "/tickets/"+receipt["id"].(string), nil, 200, "", nil)
	}
	verify := func(path, priority string) map[string]any {
		return operator.request("POST", path+"/verify", map[string]any{"expected_version": 1, "category_id": category,
			"priority": priority, "classifier_version": 2, "reason": reason}, 200, "", nil)
	}
	start := func(path string) float64 {
		p := coord.request("GET", path+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		coord.request("POST", path+"/dispatch", map[string]any{"expected_version": 2, "team_id": team, "assignee_id": techID,
			"proposal_version": 2, "proposal_digest": p["digest"], "tier": "L1", "reason": reason}, 200, "", nil)
		return tech.request("POST", path+"/transitions", map[string]any{"expected_version": 3, "action": "START", "reason": reason}, 200, "", nil)["version"].(float64)
	}
	answers := map[string]string{"ringkasan": "WiFi terputus"}
	t.Log("R3-A-calendar-policy-http")
	{
		v := create(svc, answers)
		eq(v["resolution_due_at"], "2026-11-10T08:30:00Z")
		eq(v["response_due_at"], "2026-11-10T01:30:00Z")
		path := "/tickets/" + v["id"].(string)
		fixed = fixed.Add(5 * time.Minute)
		updated := verify(path, "HIGH")
		eq(updated["resolution_due_at"], "2026-11-10T04:30:00Z")
		eq(updated["first_response_at"], "2026-11-06T08:35:00Z")
		fixed = date("2026-11-07T16:30:00Z")
		securityAnswers := map[string]string{"indikasi_insiden": "Sinyal sintetis", "target_sistem": "https://example.invalid", "waktu_terdeteksi": "2026-11-07", "kontak_pelapor": "000-fiktif"}
		v = create(security, securityAnswers)
		eq(v["calendar_version"], "CAL-247-v1")
		eq(v["resolution_due_at"], "2026-11-08T00:30:00Z")
		updated = verify("/tickets/"+v["id"].(string), "CRITICAL")
		eq(updated["resolution_due_at"], "2026-11-07T18:30:00Z")
	}
	var path, ticket, attempt string
	var due24 time.Time
	t.Log("R3-B-clock-R3-C-durable-proof")
	{
		fixed = date("2026-11-10T01:00:00Z")
		v := create(svc, answers)
		ticket = v["id"].(string)
		path = "/tickets/" + ticket
		verify(path, "HIGH")
		version := start(path)
		fixed = fixed.Add(15 * time.Minute)
		vendorInput := map[string]any{"expected_version": version, "vendor_id": "92000000-0000-4000-8000-000000000001",
			"internal_pic_id": "20000000-0000-4000-8000-000000000012", "external_reference": "CASE-RM003",
			"contract_reference": "KONTRAK-SINTETIS", "next_followup_at": fixed.Add(time.Hour), "expected_return_at": fixed.Add(2 * time.Hour)}
		tech.request("POST", path+"/vendor-cases", vendorInput, 422, "", nil)
		vendorInput["internal_pic_id"] = techID
		vendor := tech.request("POST", path+"/vendor-cases", vendorInput, 201, "", nil)
		version = vendor["version"].(float64)
		fixed = fixed.Add(15 * time.Minute)
		beforePause := public.request("GET", path+"/sla", nil, 200, "", nil)
		eq(beforePause["gross_seconds"], float64(1800))
		eq(beforePause["net_seconds"], float64(1800))
		pause := map[string]any{"expected_version": version, "until": fixed.Add(time.Hour), "reason": reason, "policy_version": 1}
		operator.request("POST", path+"/pauses", pause, 403, "", nil)
		v = coord.request("POST", path+"/pauses", pause, 201, "", nil)
		fixed = fixed.Add(30 * time.Minute)
		pause["expected_version"], pause["until"] = v["version"], fixed.Add(time.Hour)
		v = coord.request("POST", path+"/pauses", pause, 201, "", nil)
		fixed = fixed.Add(30 * time.Minute)
		clock := public.request("GET", path+"/sla", nil, 200, "", nil)
		eq(clock["gross_seconds"], float64(5400))
		eq(clock["net_seconds"], float64(1800))
		eq(clock["status"], "PAUSED")
		fixed = date("2026-11-10T04:00:00Z")
		resolved := tech.request("POST", path+"/resolve", map[string]any{"expected_version": v["version"], "summary": reason}, 200, "", nil)
		detail := public.request("GET", path, nil, 200, "", nil)
		attempt = detail["active_attempt_id"].(string)
		due24 = fixed.Add(24 * time.Hour)
		eq(public.request("GET", path+"/sla", nil, 200, "", nil)["net_seconds"], float64(5400))
		run := runtime.Intake.Service().ScheduledAutoClose
		if stale, err := run(ctx, ticket, attempt, int64(resolved["version"].(float64)), due24); stale || err == nil {
			t.Fatal("auto-close bypassed durable notification proof")
		}
		drain()
		if count("SELECT count(*) FROM intake.confirmation_notifications WHERE ticket_id=$1 AND attempt_id=$2", ticket, attempt) != 1 {
			t.Fatal("proof not delivered")
		}
		if stale, err := run(ctx, ticket, attempt, int64(resolved["version"].(float64)), due24.Add(-time.Nanosecond)); stale || err == nil {
			t.Fatal("auto-close ran before 24 hours")
		}
		fixed = due24.Add(72 * time.Hour)
		clock = public.request("GET", path+"/sla", nil, 200, "", nil)
		eq(clock["as_of"], "2026-11-10T04:00:00Z")
		eq(clock["status"], "ON_TRACK")
	}
	t.Log("R3-D-lease-reclaim-lost-ack-and-replay")
	{
		scheduler := runtime.Escalation.Service().Store
		first, err := scheduler.ClaimDueJob(ctx, due24)
		if err != nil {
			t.Fatal(err)
		}
		eq(first.TicketID, ticket)
		if stale, err := runtime.Intake.Service().ScheduledAutoClose(ctx, ticket, attempt, first.ExpectedVersion, due24); stale || err != nil {
			t.Fatalf("auto-close failed: stale=%v err=%v", stale, err)
		}
		restarted := NewApplication(pools, m1.Options{Lab: true, Origin: base, Key: []byte("synthetic-rm003-key-not-production-secret")})
		second, err := restarted.Escalation.Service().Store.ClaimDueJob(ctx, due24.Add(31*time.Second))
		if err != nil {
			t.Fatal(err)
		}
		eq(second.ID, first.ID)
		eq(second.Attempts, 2)
		if err := scheduler.FinishJob(ctx, first, due24, "ACKED", "", nil); !errors.Is(err, m7.ErrLostLease) {
			t.Fatalf("old fence accepted: %v", err)
		}
		if stale, err := restarted.Intake.Service().ScheduledAutoClose(ctx, ticket, attempt, second.ExpectedVersion, due24.Add(time.Minute)); stale || err != nil {
			t.Fatalf("lost ACK did not reconcile: %v %v", stale, err)
		}
		if err := scheduler.FinishJob(ctx, second, due24, "ACKED", "", nil); err != nil {
			t.Fatal(err)
		}
		eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1 AND decision='AUTO_NO_RESPONSE'", attempt), 1)
		if err := scheduler.CreateJob(ctx, ticket, attempt, second.ExpectedVersion, "AUTO_CLOSE", "rm0-03-fault-replay", due24); err != nil {
			t.Fatal(err)
		}
		var id string
		if err := fault.QueryRow(ctx, "SELECT id::text FROM escalation.jobs WHERE idempotency_key='rm0-03-fault-replay'").Scan(&id); err != nil {
			t.Fatal(err)
		}
		run := runtime.Escalation.Service().RunDueAutoClose
		if _, err := run(ctx, due24, func(context.Context, string, string, int64, time.Time) error { return web.Fail(412, "fault proof") }); err != nil {
			t.Fatal(err)
		}
		jobPath := path + "/scheduler-jobs/" + id
		status := super.request("GET", jobPath, nil, 200, "", nil)
		eq(status["last_error_code"], "NOTIFICATION_PROOF_PENDING")
		eq(status["state"], "PENDING")
		sql("UPDATE escalation.jobs SET attempts=7,retry_at=$2 WHERE id=$1", id, due24)
		if _, err := run(ctx, due24, func(context.Context, string, string, int64, time.Time) error { return errors.New("fault dependency") }); err != nil {
			t.Fatal(err)
		}
		status = super.request("GET", jobPath, nil, 200, "", nil)
		eq(status["state"], "DEAD_LETTER")
		req := map[string]any{"expected_version": status["version"], "reason": reason}
		public.request("POST", jobPath+"/replay", req, 403, "", nil)
		key := web.ID()
		replay := super.request("POST", jobPath+"/replay", req, 202, key, nil)
		same := super.request("POST", jobPath+"/replay", req, 202, key, nil)
		eq(replay["version"], same["version"])
		eq(count("SELECT count(*) FROM escalation.job_replays WHERE job_id=$1", id), 1)
	}
	t.Log("R3-C-concurrent-auto-close-and-R3-F-late-resolution")
	{
		fixed = date("2026-11-10T05:15:00Z")
		late := create(svc, answers)
		lateID := late["id"].(string)
		latePath := "/tickets/" + lateID
		verify(latePath, "HIGH")
		version := start(latePath)
		fixed = date("2026-11-10T05:30:00Z")
		early := tech.request("POST", latePath+"/resolve", map[string]any{"expected_version": version, "summary": reason}, 200, "", nil)
		earlyDetail := public.request("GET", latePath, nil, 200, "", nil)
		earlyAttempt := earlyDetail["active_attempt_id"].(string)
		rejected := public.request("POST", latePath+"/confirmation", map[string]any{"expected_version": early["version"], "attempt_id": earlyAttempt, "decision": "REJECT", "reason": reason}, 200, "", nil)
		eq(rejected["state"], "IN_PROGRESS")
		if stale, err := runtime.Intake.Service().ScheduledAutoClose(ctx, lateID, earlyAttempt, 1, fixed.Add(24*time.Hour)); !stale || err != nil {
			t.Fatalf("rejected attempt still actionable: %v %v", stale, err)
		}
		version = rejected["version"].(float64)
		fixed = date("2026-11-11T02:00:00Z")
		resolved := tech.request("POST", latePath+"/resolve", map[string]any{"expected_version": version, "summary": reason}, 200, "", nil)
		drain()
		detail := public.request("GET", latePath, nil, 200, "", nil)
		lateAttempt := detail["active_attempt_id"].(string)
		ready := make(chan struct{})
		results := make(chan error, 2)
		for range 2 {
			go func() {
				<-ready
				_, err := runtime.Intake.Service().ScheduledAutoClose(ctx, lateID, lateAttempt, int64(resolved["version"].(float64)), fixed.Add(24*time.Hour))
				results <- err
			}()
		}
		close(ready)
		for range 2 {
			err := <-results
			var conflict *web.Error
			if err != nil && (!errors.As(err, &conflict) || conflict.Status != 409) {
				t.Fatal(err)
			}
		}
		eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1 AND decision='AUTO_NO_RESPONSE'", lateAttempt), 1)
		eq(public.request("GET", latePath+"/sla", nil, 200, "", nil)["status"], "BREACHED")
	}

	t.Log("R3-F-facts-export-R3-E-owner-revocation")
	{
		drain()
		from, to := "2026-11-10T00:00:00Z", "2026-11-11T00:00:00Z"
		query := "/reports?from=" + from + "&to=" + to + "&organization_id=" + org
		rep := coord.request("GET", query, nil, 200, "", nil)
		eq(rep["count"], float64(1))
		eq(rep["denominator"], float64(2))
		eq(rep["breached"], float64(1))
		eq(rep["sla_percent"], float64(50))
		fixed = date("2026-11-10T05:00:00Z")
		transfer := create(svc, answers)
		id := transfer["id"].(string)
		targetPath := "/tickets/" + id
		drain()
		exp := coord.request("POST", "/reports/exports", map[string]any{"organization_id": org, "from": from, "to": to, "timezone": "Asia/Jakarta", "format": "CSV", "cohort": "ACCEPTED"}, 202, "", nil)
		eq(exp["state"], "SUCCEEDED")
		op := "/reports/exports/" + exp["id"].(string)
		file, err := coord.http.Get(base + "/api/v1" + op + "/file")
		if err != nil {
			t.Fatal(err)
		}
		content, err := io.ReadAll(file.Body)
		file.Body.Close()
		if err != nil || file.StatusCode != 200 || !strings.Contains(string(content), id) {
			t.Fatal("export receipt has no scoped CSV snapshot")
		}
		target.request("GET", op, nil, 404, "", nil)
		const targetOrg = "10000000-0000-4000-8000-000000000002"
		const targetTeam = "50000000-0000-4000-8000-000000000002"
		transferVersion := transfer["version"]
		for _, level := range []string{"L2", "COORDINATOR", "LEADERSHIP"} {
			escalation := coord.request("POST", targetPath+"/escalations", map[string]any{"expected_version": transferVersion, "level": level, "reason": reason}, 202, "", nil)
			receipt := "/operations/" + escalation["id"].(string)
			eq(coord.request("GET", receipt, nil, 200, "", nil)["state"], "SUCCEEDED")
			target.request("GET", receipt, nil, 404, "", nil)
			transferVersion = coord.request("GET", targetPath, nil, 200, "", nil)["version"]
		}
		eq(count("SELECT count(DISTINCT level) FROM intake.escalation_marks WHERE ticket_id=$1", id), 3)
		coord.request("GET", targetPath+"/attachments", nil, 200, "", nil)
		search := func(c testClient) bool {
			response := c.request("GET", "/search?owner=M3&q=WiFi%20jaringan%20lab", nil, 200, "", nil)
			entries, _ := response["items"].([]any)
			for _, entry := range entries {
				if hit, ok := entry.(map[string]any); ok && hit["id"] == id {
					return true
				}
			}
			return false
		}
		eq(search(coord), true)

		handoff := coord.request("POST", targetPath+"/handoffs", map[string]any{"expected_version": transferVersion, "target_org_id": targetOrg, "target_team_id": targetTeam, "reason": reason}, 201, "", nil)
		coord.request("GET", targetPath, nil, 200, "", nil)
		offerPath := targetPath + "/handoffs/" + handoff["id"].(string)
		target.request("GET", targetPath, nil, 404, "", nil)
		coord.request("GET", offerPath, nil, 404, "", nil)
		public.request("GET", offerPath, nil, 404, "", nil)
		offer := target.request("GET", offerPath, nil, 200, "", nil)
		eq(offer["ticket_version"], handoff["version"])
		eq(offer["title"], nil)
		eq(offer["description"], nil)
		key := web.ID()
		acceptInput := map[string]any{"expected_version": offer["ticket_version"], "reason": reason}
		accepted := target.request("POST", offerPath+"/accept", acceptInput, 200, key, nil)
		replay := target.request("POST", offerPath+"/accept", acceptInput, 200, key, nil)
		eq(accepted["version"], replay["version"])
		// Simulate the legacy receipt digest on this disposable record.
		legacyPayload, err := json.Marshal(struct {
			ExpectedVersion int64  `json:"expected_version"`
			Reason          string `json:"reason"`
		}{int64(offer["ticket_version"].(float64)), reason})
		if err != nil {
			t.Fatal(err)
		}
		legacyHash := sha256.Sum256(legacyPayload)
		sql("UPDATE intake.idempotency_records SET payload_digest=$1 WHERE command='AcceptHandoff' AND target=$2 AND key=$3", legacyHash[:], id, key)
		eq(target.request("POST", offerPath+"/accept", acceptInput, 200, key, nil)["version"], accepted["version"])
		sql("UPDATE intake.tickets SET service_owner_org_id=$1 WHERE id=$2", org, id)
		target.request("POST", offerPath+"/accept", acceptInput, 404, key, nil)
		sql("UPDATE intake.tickets SET service_owner_org_id=$1 WHERE id=$2", targetOrg, id)
		target.request("GET", offerPath, nil, 404, "", nil)
		coord.request("GET", targetPath, nil, 404, "", nil)
		coord.request("GET", targetPath+"/attachments", nil, 404, "", nil)
		eq(search(coord), false)
		target.request("GET", targetPath, nil, 200, "", nil)
		eq(search(target), true)
		coord.request("GET", op+"/download", nil, 409, "", nil)
		pendingProjection := coord.request("GET", query, nil, 200, "", nil)
		eq(pendingProjection["accepted"], float64(2))
		drain()
		rep = coord.request("GET", query, nil, 200, "", nil)
		eq(rep["accepted"], float64(2))
		next := target.request("GET", strings.Replace(query, org, targetOrg, 1), nil, 200, "", nil)
		eq(next["backlog"], float64(1))
	}
	t.Log("R3-B-reopen-preserves-ticket-and-resets-episode")
	{
		fixed = due24.Add(time.Hour)
		before := public.request("GET", path, nil, 200, "", nil)
		after := public.request("POST", path+"/transitions", map[string]any{"expected_version": before["version"], "action": "REOPEN", "reason": reason}, 200, "", nil)
		eq(after["accepted_at"], before["accepted_at"])
		if after["episode_id"] == before["episode_id"] {
			t.Fatal("reopen reused old episode")
		}
		nowClock := public.request("GET", path+"/sla", nil, 200, "", nil)
		eq(nowClock["episode_started_at"], fixed.Format(time.RFC3339))
		eq(nowClock["gross_seconds"], float64(0))
		drain()
		report := coord.request("GET", "/reports?from=2026-11-10T00:00:00Z&to=2026-11-11T00:00:00Z&organization_id="+org, nil, 200, "", nil)
		eq(report["backlog"], float64(1))
		eq(report["denominator"], float64(1))
		eq(report["count"], float64(0))

		if stale, err := runtime.Intake.Service().ScheduledAutoClose(ctx, ticket, attempt, 1, fixed); !stale || err != nil {
			t.Fatalf("old attempt not fenced after reopen: %v %v", stale, err)
		}
	}

	t.Log("R3-G-sink-issued-challenge-revocation")
	{
		challenge := coord.request("POST", "/notifications/sink-challenges", map[string]any{"scope_org_id": org}, 201, "", nil)
		in := map[string]any{"scope_org_id": org, "verification_code": "fabricated-code", "channel": "SINK", "expected_version": 1}
		coord.request("POST", "/notifications/telegram-bindings", in, 422, "", nil)
		in["verification_code"] = challenge["code"]
		binding := coord.request("POST", "/notifications/telegram-bindings", in, 201, "", nil)
		coord.request("POST", "/notifications/telegram-bindings", in, 422, "", nil)
		coord.request("POST", "/notifications/telegram-bindings/"+binding["id"].(string)+"/revoke", map[string]any{"expected_version": 1, "reason": reason}, 200, "", nil)
		eq(count("SELECT count(*) FROM notify_audit.telegram_bindings WHERE id=$1 AND revoked_at IS NOT NULL", binding["id"]), 1)
		eq(count("SELECT count(*) FROM notify_audit.delivery_jobs WHERE channel='SINK' AND state='ACKED'"), 3)
	}

	t.Log("R3-H-scoped-job-approval-and-health")
	{
		const path = "/admin/operations"
		req := map[string]any{"target_id": org, "kind": "BACKUP_MANIFEST", "reason": reason}
		job := admin.request("POST", path, req, 202, "", nil)
		eq(job["state"], "REQUESTED")
		jobID := job["id"].(string)
		approval := path + "/" + jobID + "/approve"
		execute := path + "/" + jobID + "/execute"
		artifactPath := path + "/" + jobID + "/artifact"
		intent := map[string]any{"expected_version": 1, "reason": reason}
		// Unapproved job must not execute.
		admin.request("POST", execute, intent, 409, "", nil)
		admin.request("POST", approval, intent, 403, "", nil)
		target.request("POST", approval, intent, 403, "", nil)
		done := approver.request("POST", approval, intent, 200, "", nil)
		eq(done["state"], "APPROVED")
		eq(done["approved_by"], "20000000-0000-4000-8000-000000000018")
		// Cross-org actor rejected, stale version rejected.
		target.request("POST", execute, map[string]any{"expected_version": 2, "reason": reason}, 403, "", nil)
		approver.request("POST", execute, map[string]any{"expected_version": 1, "reason": reason}, 409, "", nil)
		// Execute approved BACKUP_MANIFEST cleanly + verify idempotent replay.
		execKey := web.ID()
		execIntent := map[string]any{"expected_version": 2, "reason": reason}
		executed := approver.request("POST", execute, execIntent, 200, execKey, nil)
		eq(executed["state"], "SUCCEEDED")
		replayed := approver.request("POST", execute, execIntent, 200, execKey, nil)
		eq(replayed["state"], "SUCCEEDED")
		eq(replayed["version"], executed["version"])
		manifestReceipt, ok := executed["execution_receipt"].(map[string]any)
		if !ok || manifestReceipt["status"] != "SUCCEEDED" {
			t.Fatalf("expected SUCCEEDED backup manifest receipt, got %#v", executed["execution_receipt"])
		}
		manifestSHA, _ := manifestReceipt["manifest_sha256"].(string)
		if len(manifestSHA) != 64 {
			t.Fatalf("expected 64-hex manifest sha256, got %q", manifestSHA)
		}
		if ownersMap, ok := manifestReceipt["owners"].(map[string]any); !ok || len(ownersMap) != 9 {
			t.Fatalf("expected 9 owner summaries in manifest receipt, got %#v", manifestReceipt["owners"])
		}
		// Cross-org artifact read rejected; authorized read returns canonical artifact with matching digest.
		target.request("GET", artifactPath, nil, 403, "", nil)
		artResp, err := admin.http.Get(base + "/api/v1" + artifactPath)
		if err != nil {
			t.Fatal(err)
		}
		artBody, err := io.ReadAll(artResp.Body)
		artResp.Body.Close()
		if err != nil || artResp.StatusCode != 200 {
			t.Fatalf("expected 200 artifact download, got %d err=%v", artResp.StatusCode, err)
		}
		eq(artResp.Header.Get("X-Manifest-SHA256"), manifestSHA)
		sum := sha256.Sum256(artBody)
		eq(fmt.Sprintf("%x", sum[:]), manifestSHA)
		// HEALTH_REPORT execution rejected on /execute, but immediate diagnostics succeed.
		req["kind"] = "HEALTH_REPORT"
		health := admin.request("POST", path, req, 202, "", nil)
		eq(health["state"], "SUCCEEDED")
		receipt := health["execution_receipt"].(map[string]any)
		eq(receipt["scanner"], "UNAVAILABLE")
		eq(receipt["storage"], "HEALTHY")
		eq(receipt["status"], "DEGRADED")
		admin.request("POST", path+"/"+health["id"].(string)+"/execute", map[string]any{"expected_version": 1, "reason": reason}, 422, "", nil)
	}
	t.Log("R3-G-sink-transaction-fault-and-R3-C-feedback-race")
	{
		fixed = date("2026-11-12T01:00:00Z")
		draft := create(svc, answers)
		id := draft["id"].(string)
		route := "/tickets/" + id
		verify(route, "HIGH")
		version := start(route)
		fixed = fixed.Add(15 * time.Minute)
		resolved := tech.request("POST", route+"/resolve", map[string]any{"expected_version": version, "summary": reason}, 200, "", nil)
		info := public.request("GET", route, nil, 200, "", nil)
		attemptID := info["active_attempt_id"].(string)
		// Force the sink transaction to fail after trying to persist its notification.
		sql("ALTER TABLE notify_audit.delivery_jobs ADD CONSTRAINT rm003_sink_fault CHECK (state <> 'ACKED') NOT VALID")
		source := runtime.Intake.Source()
		consumer := runtime.Notify.Consumer()
		for {
			event, err := source.Claim(ctx)
			if err != nil {
				t.Fatal(err)
			}
			err = consumer.Consume(ctx, event)
			if event.Aggregate == id && event.Type == "ResolutionProposed" {
				if err == nil {
					t.Fatal("sink fault was not observed")
				}
				if err = source.Retry(ctx, event, false); err != nil {
					t.Fatal(err)
				}
				eq(count("SELECT count(*) FROM notify_audit.notifications WHERE attempt_id=$1", attemptID), 0)
				eq(count("SELECT count(*) FROM intake.outbox_delivery WHERE event_id=$1 AND consumer_id='M9' AND state='PENDING' AND attempts=1 AND last_error_code IS NOT NULL", event.ID), 1)
				break
			}
			if err != nil {
				t.Fatal(err)
			}
			if err = source.Ack(ctx, event); err != nil {
				t.Fatal(err)
			}
		}
		sql("ALTER TABLE notify_audit.delivery_jobs DROP CONSTRAINT rm003_sink_fault")
		source.Now = func() time.Time { return time.Now().UTC().Add(30 * time.Second) }
		for {
			err := delivery.Step(ctx, source, consumer, delivery.Hooks{})
			if errors.Is(err, delivery.ErrEmpty) {
				break
			}
			if err != nil {
				t.Fatal(err)
			}
		}
		drain()
		eq(count("SELECT count(*) FROM intake.confirmation_notifications WHERE ticket_id=$1 AND attempt_id=$2", id, attemptID), 1)
		eq(count("SELECT count(*) FROM notify_audit.notifications WHERE attempt_id=$1", attemptID), 1)

		fixed = fixed.Add(24 * time.Hour)
		raw, err := json.Marshal(map[string]any{"expected_version": resolved["version"], "attempt_id": attemptID, "decision": "FEEDBACK", "reason": reason})
		if err != nil {
			t.Fatal(err)
		}
		request, err := http.NewRequestWithContext(ctx, "POST", base+"/api/v1"+route+"/confirmation", strings.NewReader(string(raw)))
		if err != nil {
			t.Fatal(err)
		}
		request.Header.Set("Origin", base)
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-CSRF-Token", public.csrf())
		request.Header.Set("Idempotency-Key", web.ID())
		ready := make(chan struct{})
		closeResult := make(chan error, 1)
		go func() {
			<-ready
			_, err := runtime.Intake.Service().ScheduledAutoClose(ctx, id, attemptID, int64(resolved["version"].(float64)), fixed)
			closeResult <- err
		}()
		close(ready)
		response, err := public.http.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, response.Body)
		response.Body.Close()
		if err = <-closeResult; err != nil {
			var conflict *web.Error
			if !errors.As(err, &conflict) || conflict.Status != 409 {
				t.Fatal(err)
			}
		}
		eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1", attemptID), 1)
		switch response.StatusCode {
		case 200:
			eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1 AND decision='FEEDBACK'", attemptID), 1)
			stale, err := runtime.Intake.Service().ScheduledAutoClose(ctx, id, attemptID, 1, fixed)
			if !stale || err != nil {
				t.Fatalf("feedback did not fence replay: %v %v", stale, err)
			}
		case 409:
			eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1 AND decision='AUTO_NO_RESPONSE'", attemptID), 1)
		default:
			t.Fatalf("unexpected feedback race HTTP status %d", response.StatusCode)
		}
	}

	t.Run("human-response-and-requester-only-feedback", func(t *testing.T) {
		v := create(svc, answers)
		id := v["id"].(string)
		path := "/tickets/" + id
		comment := func(c testClient, version any, visibility string, status int) map[string]any {
			return c.request("POST", path+"/comments", map[string]any{"expected_version": version, "visibility": visibility, "body": reason}, status, "", nil)
		}
		v = comment(public, v["version"], "REQUESTER", 201)
		eq(count("SELECT count(*) FROM intake.tickets WHERE id=$1 AND first_response_at IS NULL", id), 1)
		v = comment(operator, v["version"], "INTERNAL", 201)
		eq(count("SELECT count(*) FROM intake.tickets WHERE id=$1 AND first_response_at IS NULL", id), 1)
		v = comment(operator, v["version"], "REQUESTER", 201)
		firstResponse := fixed
		eq(count("SELECT count(*) FROM intake.tickets WHERE id=$1 AND first_response_at=$2", id, firstResponse), 1)
		fixed = fixed.Add(time.Minute)
		v = comment(operator, v["version"], "REQUESTER", 201)
		eq(count("SELECT count(*) FROM intake.tickets WHERE id=$1 AND first_response_at=$2", id, firstResponse), 1)
		comment(operator, 1, "REQUESTER", 409)
		eq(count("SELECT count(*) FROM intake.comments WHERE ticket_id=$1", id), 4)
		foreign := login(2)
		comment(foreign, v["version"], "REQUESTER", 404)

		v = create(svc, answers)
		id, path = v["id"].(string), "/tickets/"+v["id"].(string)
		verify(path, "NORMAL")
		version := start(path)
		v = tech.request("POST", path+"/resolve", map[string]any{"expected_version": version, "summary": reason}, 200, "", nil)
		attempt := v["active_attempt_id"].(string)
		v = comment(tech, v["version"], "REQUESTER", 201)
		eq(count("SELECT count(*) FROM intake.resolution_attempts WHERE id=$1 AND outcome='PENDING'", attempt), 1)
		eq(count("SELECT count(*) FROM intake.confirmation_events WHERE attempt_id=$1", attempt), 0)
		v = comment(public, v["version"], "REQUESTER", 201)
		eq(count("SELECT count(*) FROM intake.resolution_attempts WHERE id=$1 AND outcome='REVIEW_REQUIRED'", attempt), 1)
		drain()
		stale, err := runtime.Intake.Service().ScheduledAutoClose(ctx, id, attempt, 1, fixed.Add(25*time.Hour))
		if !stale || err != nil {
			t.Fatalf("requester comment did not hold auto-close: %v %v", stale, err)
		}
	})

}
