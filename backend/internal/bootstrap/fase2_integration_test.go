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
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestFase2Integration(t *testing.T) {
	if os.Getenv("HELPDESK_FASE2_TEST") != "1" {
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
	// Explicit capacity for the synthetic configuration used by auto recommendations.
	if _, err := fault.Exec(ctx, "UPDATE assignment.rosters SET capacity=8"); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HELPDESK_UPLOAD_ROOT", t.TempDir())
	t.Setenv("HELPDESK_SCANNER", "127.0.0.1:1")
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Origin: base, Key: []byte("synthetic-fase2-key-not-production-secret")})
	fixed := time.Date(2026, 11, 17, 9, 0, 0, 0, time.UTC)
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
	public, operator, adminA, adminB, tech, coord, coordB, editor, super :=
		login(1), login(4), login(5), login(6), login(9), login(11), login(12), login(14), login(17)

	const orgA = "10000000-0000-4000-8000-000000000001"
	const orgB = "10000000-0000-4000-8000-000000000002"
	const teamA = "50000000-0000-4000-8000-000000000001"
	const teamB = "50000000-0000-4000-8000-000000000002"
	const svcA = "30000000-0000-4000-8000-000000000001"
	const techID = "20000000-0000-4000-8000-000000000009"
	const catA = "40000000-0000-4000-8000-000000000010"
	const reason = "Pengujian integrasi Fase 2 sintetis"

	eq := func(got, want any) {
		t.Helper()
		if got != want {
			t.Fatalf("got %v (%T), want %v (%T)", got, got, want, want)
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

	t.Log("staff-directory-and-operations")
	{
		public.request("GET", "/staff/directory?organization_id="+orgA, nil, 403, "", nil)
		adminB.request("GET", "/staff/directory?organization_id="+orgA, nil, 403, "", nil)
		coord.request("GET", "/staff/directory?organization_id=bad", nil, 400, "", nil)
		dir := coord.request("GET", "/staff/directory?organization_id="+orgA, nil, 200, "", nil)
		if len(items(dir)) == 0 {
			t.Fatal("expected internal staff entries for orgA")
		}

		teamDirectory := "/staff/directory?organization_id=" + orgA + "&team_id="
		public.request("GET", teamDirectory+teamA, nil, 403, "", nil)
		operator.request("GET", teamDirectory+teamA, nil, 403, "", nil)
		coord.request("GET", teamDirectory+teamA, nil, 200, "", nil)
		adminA.request("GET", teamDirectory+"invalid", nil, 400, "", nil)
		adminA.request("GET", teamDirectory+teamB, nil, 404, "", nil)
		eligible := items(adminA.request("GET", teamDirectory+teamA, nil, 200, "", nil))
		found := false
		for _, row := range eligible {
			person := row.(map[string]any)
			eq(person["role"], "TECHNICIAN")
			if person["id"] == techID {
				found = true
			}
			if person["id"] == "20000000-0000-4000-8000-000000000007" {
				t.Fatal("technician from another PD appeared in team directory")
			}
		}
		eq(found, true)

		division := adminA.request("POST", "/admin/divisions", map[string]any{
			"organization_id": orgA, "name": "Bidang Uji Filter M1", "active": true,
		}, 201, "", nil)["id"].(string)
		team := adminA.request("POST", "/admin/teams", map[string]any{
			"organization_id": orgA, "division_id": division, "name": "Tim Uji Filter M1", "active": true,
		}, 201, "", nil)["id"].(string)
		filtered := "/admin/teams?organization_id=" + orgA + "&division_id="
		matches := items(adminA.request("GET", filtered+division+"&limit=1", nil, 200, "", nil))
		eq(len(matches), 1)
		eq(matches[0].(map[string]any)["id"], team)
		adminA.request("GET", filtered+"invalid", nil, 400, "", nil)
		adminB.request("GET", filtered+division, nil, 404, "", nil)

		public.request("GET", "/admin/operations", nil, 403, "", nil)
		super.request("POST", "/admin/operations", map[string]any{
			"kind": "BACKUP_MANIFEST", "target_id": orgA, "reason": reason,
		}, 202, "", nil)
		ops := super.request("GET", "/admin/operations?limit=10", nil, 200, "", nil)
		if len(items(ops)) == 0 {
			t.Fatal("expected operations history entries")
		}
	}

	t.Log("media-approvals-list")
	{
		public.request("GET", "/media/approvals", nil, 403, "", nil)
		res := editor.request("GET", "/media/approvals?limit=20", nil, 200, "", nil)
		if _, ok := res["items"].([]any); !ok {
			t.Fatal("expected items slice from media approvals")
		}
	}

	t.Log("ticket-ops-completion-and-bulk")
	{
		create := func() map[string]any {
			return public.request("POST", "/tickets", map[string]any{
				"service_id": svcA, "service_version": 1, "form_version": 1, "policy_version": 1,
				"title": "Insiden Jaringan Lab Fase 2", "description": reason,
				"answers": map[string]string{"ringkasan": "Koneksi lambat di lab"},
			}, 201, "", nil)
		}
		t1 := create()
		t2 := create()
		id1, id2 := t1["id"].(string), t2["id"].(string)
		p1 := "/tickets/" + id1

		v := operator.request("POST", p1+"/verify", map[string]any{
			"expected_version": 1, "category_id": catA, "priority": "NORMAL", "classifier_version": 2, "reason": reason,
		}, 200, "", nil)
		drain()
		prop := coord.request("GET", p1+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		v = coord.request("POST", p1+"/dispatch", map[string]any{
			"expected_version": v["version"], "team_id": teamA, "assignee_id": techID,
			"proposal_version": 2, "proposal_digest": prop["digest"], "tier": "L1", "reason": reason,
		}, 200, "", nil)
		v = tech.request("POST", p1+"/transitions", map[string]any{
			"expected_version": v["version"], "action": "START", "reason": reason,
		}, 200, "", nil)

		// Filtered list + invalid state negative check
		coord.request("GET", "/tickets?state=NOT_A_STATE", nil, 400, "", nil)
		filtered := coord.request("GET", "/tickets?state=IN_PROGRESS&service_id="+svcA, nil, 200, "", nil)
		if len(items(filtered)) == 0 {
			t.Fatal("expected ticket in filtered queue")
		}

		// Work log
		public.request("POST", p1+"/work-logs", map[string]any{
			"expected_version": v["version"], "started_at": "2026-11-17T08:00:00Z", "ended_at": "2026-11-17T08:30:00Z", "summary": reason,
		}, 403, "", nil)
		tech.request("POST", p1+"/work-logs", map[string]any{
			"expected_version": v["version"], "started_at": "2026-11-17T09:00:00Z", "ended_at": "2026-11-17T08:00:00Z", "summary": reason,
		}, 422, "", nil)
		wl := tech.request("POST", p1+"/work-logs", map[string]any{
			"expected_version": v["version"], "started_at": "2026-11-17T08:00:00Z", "ended_at": "2026-11-17T08:45:00Z", "summary": reason,
		}, 201, "", nil)

		// Vendor case + close
		vc := tech.request("POST", p1+"/vendor-cases", map[string]any{
			"expected_version":   wl["version"],
			"vendor_id":          "00000000-0000-4000-8000-000000000099",
			"internal_pic_id":    techID,
			"external_reference": "VND-FASE2-01",
			"contract_reference": "KTR-FASE2-2026",
			"expected_return_at": "2026-11-17T14:00:00Z",
			"next_followup_at":   "2026-11-17T11:00:00Z",
		}, 201, "", nil)
		caseID := vc["id"].(string)
		public.request("POST", p1+"/vendor-cases/"+caseID+"/close", map[string]any{
			"expected_version": vc["version"], "reason": reason,
		}, 403, "", nil)
		vcClosed := tech.request("POST", p1+"/vendor-cases/"+caseID+"/close", map[string]any{
			"expected_version": vc["version"], "reason": reason,
		}, 200, "", nil)
		eq(vcClosed["state"], "CLOSED")
		tech.request("POST", p1+"/vendor-cases/"+caseID+"/close", map[string]any{
			"expected_version": vcClosed["version"], "reason": reason,
		}, 409, "", nil)

		// Pause + early resume
		ps := coord.request("POST", p1+"/pauses", map[string]any{
			"expected_version": vcClosed["version"], "until": "2026-11-17T15:00:00Z", "reason": reason,
		}, 201, "", nil)
		pauseID := ps["id"].(string)
		operator.request("POST", p1+"/pauses/"+pauseID+"/resume", map[string]any{
			"expected_version": ps["version"], "reason": reason,
		}, 403, "", nil)
		psRes := coord.request("POST", p1+"/pauses/"+pauseID+"/resume", map[string]any{
			"expected_version": ps["version"], "reason": reason,
		}, 200, "", nil)
		eq(psRes["state"], "RESUMED")
		coord.request("POST", p1+"/pauses/"+pauseID+"/resume", map[string]any{
			"expected_version": psRes["version"], "reason": reason,
		}, 409, "", nil)

		// Handoff inbox + reject + cancel
		h1 := coord.request("POST", p1+"/handoffs", map[string]any{
			"expected_version": psRes["version"], "target_org_id": orgB, "target_team_id": teamB, "reason": reason,
		}, 201, "", nil)
		hid1 := h1["id"].(string)
		inList := coordB.request("GET", "/handoffs?limit=20", nil, 200, "", nil)
		if len(items(inList)) == 0 {
			t.Fatal("expected pending handoff in target OPD B inbox")
		}
		operator.request("POST", p1+"/handoffs/"+hid1+"/reject", map[string]any{
			"expected_version": h1["version"], "reason": reason,
		}, 403, "", nil)
		rej := coordB.request("POST", p1+"/handoffs/"+hid1+"/reject", map[string]any{
			"expected_version": h1["version"], "reason": reason,
		}, 200, "", nil)
		var h1State string
		if err := fault.QueryRow(ctx, `SELECT state FROM intake.handoff_requests WHERE id=$1`, hid1).Scan(&h1State); err != nil {
			t.Fatal(err)
		}
		eq(h1State, "REJECTED")

		h2 := coord.request("POST", p1+"/handoffs", map[string]any{
			"expected_version": rej["version"], "target_org_id": orgB, "target_team_id": teamB, "reason": reason,
		}, 201, "", nil)
		hid2 := h2["id"].(string)
		can := coord.request("POST", p1+"/handoffs/"+hid2+"/cancel", map[string]any{
			"expected_version": h2["version"], "reason": reason,
		}, 200, "", nil)
		var h2State string
		if err := fault.QueryRow(ctx, `SELECT state FROM intake.handoff_requests WHERE id=$1`, hid2).Scan(&h2State); err != nil {
			t.Fatal(err)
		}
		eq(h2State, "CANCELLED")
		coord.request("POST", p1+"/handoffs/"+hid2+"/cancel", map[string]any{
			"expected_version": can["version"], "reason": reason,
		}, 409, "", nil)
		coordB.request("POST", p1+"/handoffs/"+hid2+"/reject", map[string]any{
			"expected_version": can["version"], "reason": reason,
		}, 404, "", nil)

		// Operational records read
		public.request("GET", p1+"/operational-records", nil, 403, "", nil)
		opsRec := tech.request("GET", p1+"/operational-records", nil, 200, "", nil)
		if len(opsRec["work_logs"].([]any)) == 0 || len(opsRec["vendor_cases"].([]any)) == 0 || len(opsRec["pauses"].([]any)) == 0 || len(opsRec["handoffs"].([]any)) < 2 {
			t.Fatalf("unexpected operational records counts: %v", opsRec)
		}

		// Resolve t1 -> drain -> creates AUTO_CLOSE scheduler job; test scheduler listing + bulk ACL
		resolved := tech.request("POST", p1+"/resolve", map[string]any{
			"expected_version": can["version"], "summary": reason,
		}, 200, "", nil)
		drain()
		public.request("GET", p1+"/scheduler-jobs", nil, 403, "", nil)
		operator.request("GET", "/admin/scheduler-jobs", nil, 403, "", nil)
		tJobs := adminA.request("GET", p1+"/scheduler-jobs", nil, 200, "", nil)
		if len(items(tJobs)) == 0 {
			t.Fatal("expected scheduler job for resolved ticket")
		}
		aJobs := adminA.request("GET", "/admin/scheduler-jobs?limit=20", nil, 200, "", nil)
		if len(items(aJobs)) == 0 {
			t.Fatal("expected admin scheduler jobs for orgA")
		}

		// Bulk partial ACL/CAS + operator lacking ticket.archive gets FORBIDDEN item outcome
		v2 := public.request("POST", "/tickets/"+id2+"/transitions", map[string]any{
			"expected_version": 1, "action": "CANCEL", "reason": reason,
		}, 200, "", nil)
		public.request("POST", "/tickets/bulk", map[string]any{
			"action": "ARCHIVE", "targets": []any{map[string]any{"id": id2, "expected_version": v2["version"]}}, "reason": reason,
		}, 403, "", nil)
		opBulk := operator.request("POST", "/tickets/bulk", map[string]any{
			"action": "ARCHIVE", "targets": []any{map[string]any{"id": id2, "expected_version": v2["version"]}}, "reason": reason,
		}, 200, "", nil)
		eq(items(opBulk)[0].(map[string]any)["outcome"], "FORBIDDEN")

		bulkRes := coord.request("POST", "/tickets/bulk", map[string]any{
			"action": "ARCHIVE",
			"targets": []any{
				map[string]any{"id": id2, "expected_version": v2["version"]},
				map[string]any{"id": id1, "expected_version": 999},
				map[string]any{"id": "00000000-0000-4000-8000-000000000999", "expected_version": 1},
			},
			"reason": reason,
		}, 200, "", nil)
		bItems := items(bulkRes)
		eq(bItems[0].(map[string]any)["outcome"], "SUCCESS")
		eq(bItems[1].(map[string]any)["outcome"], "CONFLICT")
		eq(bItems[2].(map[string]any)["outcome"], "NOT_FOUND")
		_ = resolved
		drain()
	}

	t.Log("admin-rules-m4-m5-m6-m7")
	{
		for _, suffix := range []string{"classification", "routing", "sla", "escalation"} {
			public.request("GET", "/admin/"+suffix+"-rules", nil, 403, "", nil)
			operator.request("GET", "/admin/"+suffix+"-rules", nil, 403, "", nil)
			list := adminA.request("GET", "/admin/"+suffix+"-rules", nil, 200, "", nil)
			ruleList := items(list)
			if len(ruleList) == 0 {
				created := adminA.request("POST", "/admin/"+suffix+"-rules", map[string]any{
					"expected_version": 1, "code": strings.ToUpper(suffix) + "-LAB-01", "rule_version": 1, "active": true, "reason": reason,
				}, 201, "", nil)
				ruleList = []any{created}
			}
			first := ruleList[0].(map[string]any)
			ruleVer := int64(first["version"].(float64))
			code := first["code"].(string)
			nextActive := !first["active"].(bool)

			// Wrong expected_version -> 409
			adminA.request("POST", "/admin/"+suffix+"-rules", map[string]any{
				"expected_version": 999, "code": code, "rule_version": 1, "active": nextActive, "reason": reason,
			}, 409, "", nil)

			// Valid toggle + idempotent replay
			key := web.ID()
			payload := map[string]any{
				"expected_version": ruleVer, "code": code, "rule_version": int64(first["rule_version"].(float64)), "active": nextActive, "reason": reason,
			}
			upd := adminA.request("POST", "/admin/"+suffix+"-rules", payload, 201, key, nil)
			eq(upd["active"], nextActive)
			eq(int64(upd["version"].(float64)), ruleVer+1)
			adminA.request("POST", "/admin/"+suffix+"-rules", payload, 201, key, nil)

			// Restore active=true so SLA/routing rules remain active
			if !nextActive {
				adminA.request("POST", "/admin/"+suffix+"-rules", map[string]any{
					"expected_version": ruleVer + 1, "code": code, "rule_version": int64(first["rule_version"].(float64)), "active": true, "reason": reason,
				}, 201, "", nil)
			}
		}
		drain()
		var auditCount int
		if err := fault.QueryRow(ctx, `SELECT count(*) FROM notify_audit.audit_entries WHERE action IN ('ConfigureClassification','ConfigureRouting','ConfigureSla','ConfigureEscalation')`).Scan(&auditCount); err != nil {
			t.Fatal(err)
		}
		if auditCount < 4 {
			raw, _ := json.Marshal(auditCount)
			t.Fatalf("expected M4-M7 audit entries drained to M9, got %s", raw)
		}
	}
	t.Run("penyempurnaan-maintenance", func(t *testing.T) {
		now := time.Now().UTC()
		policy := func(org, mode string, start, end time.Time) map[string]any {
			in := map[string]any{"mode": mode, "starts_at": start, "ends_at": end, "message": reason}
			if org != "" {
				in["organization_id"] = org
			}
			return in
		}
		create := map[string]any{
			"service_id": svcA, "service_version": 1, "form_version": 1, "policy_version": 1,
			"title": "Periksa isolasi pemeliharaan", "description": reason,
			"answers": map[string]string{"ringkasan": "Pengujian dua organisasi"},
		}
		localB := policy(orgB, "READ_ONLY", now.Add(-time.Minute), now.Add(time.Hour))
		adminA.request("POST", "/admin/maintenance", localB, 403, "", nil)
		// Super Admin fixture is scoped to A; provision the B window directly on the isolated owner DB.
		bWindow := web.ID()
		if _, err := fault.Exec(ctx, "INSERT INTO identity.maintenance_policies(id,org_id,mode,starts_at,ends_at,message) VALUES($1,$2,$3,$4,$5,$6)",
			bWindow, orgB, "READ_ONLY", localB["starts_at"], localB["ends_at"], reason); err != nil {
			t.Fatal(err)
		}
		eq(public.request("GET", "/maintenance/status", nil, 200, "", nil)["active"], nil)
		created := public.request("POST", "/tickets", create, 201, "", nil)
		p := "/tickets/" + created["id"].(string)
		localA := policy(orgA, "DRAIN", now.Add(-time.Minute), now.Add(time.Hour))
		adminA.request("POST", "/admin/maintenance", localA, 201, "", nil)
		public.request("POST", "/tickets", create, 503, "", nil)
		verified := operator.request("POST", p+"/verify", map[string]any{
			"expected_version": 1, "category_id": catA, "priority": "NORMAL", "classifier_version": 2, "reason": reason,
		}, 200, "", nil)
		handoff := map[string]any{"expected_version": verified["version"], "target_org_id": orgB, "target_team_id": teamB, "reason": reason}
		coord.request("POST", p+"/handoffs", handoff, 503, "", nil)

		global := super.request("POST", "/admin/maintenance", policy("", "READ_ONLY", now.Add(-time.Minute), now.Add(time.Hour)), 201, "", nil)
		active := public.request("GET", "/maintenance/status", nil, 200, "", nil)["active"].(map[string]any)
		eq(active["id"], global["id"])
		stopA := policy(orgA, "NORMAL", now, now.Add(time.Minute))
		stopA["target_id"] = global["id"]
		adminA.request("POST", "/admin/maintenance", stopA, 404, "", nil)
		delete(stopA, "target_id")
		adminA.request("POST", "/admin/maintenance", stopA, 201, "", nil)
		public.request("POST", "/tickets", create, 503, "", nil)
		super.request("POST", "/admin/maintenance", policy("", "NORMAL", now, now.Add(time.Minute)), 201, "", nil)
		public.request("POST", "/tickets", create, 201, "", nil)
		eq(public.request("GET", "/maintenance/status", nil, 200, "", nil)["active"], nil)
		coord.request("POST", p+"/handoffs", handoff, 503, "", nil)
		if _, err := fault.Exec(ctx, "UPDATE identity.maintenance_policies SET ends_at=now() WHERE id=$1", bWindow); err != nil {
			t.Fatal(err)
		}
		coord.request("POST", p+"/handoffs", handoff, 201, "", nil)
	})
	t.Run("penyempurnaan-roster-search", func(t *testing.T) {
		path := "/admin/teams/" + teamA + "/rosters"
		scope := "?organization_id=" + orgA
		adminB.request("GET", path+scope, nil, 403, "", nil)
		public.request("GET", path+scope, nil, 403, "", nil)
		list := items(adminA.request("GET", path+scope+"&limit=100", nil, 200, "", nil))
		var old map[string]any
		for _, row := range list {
			if v := row.(map[string]any); v["subject_id"] == techID {
				old = v
			}
		}
		if old == nil {
			t.Fatal("fixture roster unavailable")
		}
		now := time.Now().UTC().Truncate(time.Second)
		in := map[string]any{"subject_id": techID, "expected_version": 0, "skills": old["skills"],
			"available_from": now.Add(-time.Minute), "available_until": now.Add(time.Hour), "active": true, "reason": reason}
		adminA.request("POST", path+scope, in, 409, "", nil)
		in["expected_version"], in["active"] = old["version"], false
		edit := path + "/" + old["id"].(string) + scope
		adminA.request("PUT", edit, in, 200, "", nil)
		adminA.request("PUT", edit, in, 409, "", nil)
		in["expected_version"], in["active"] = 0, true
		in["subject_id"] = "20000000-0000-4000-8000-000000000007"
		adminA.request("POST", path+scope, in, 422, "", nil)
		in["subject_id"] = techID
		in["capacity"] = 8
		key := web.ID()
		newRoster := adminA.request("POST", path+scope, in, 201, key, nil)
		eq(adminA.request("POST", path+scope, in, 201, key, nil)["id"], newRoster["id"])
		ticket := public.request("POST", "/tickets", map[string]any{
			"service_id": svcA, "service_version": 1, "form_version": 1, "policy_version": 1,
			"title": "Rekomendasi roster teknisi", "description": reason, "answers": map[string]string{"ringkasan": "Uji roster"},
		}, 201, "", nil)
		ticketPath := "/tickets/" + ticket["id"].(string)
		coord.request("GET", ticketPath+"/dispatch-proposal?tier=L1", nil, 409, "", nil)
		operator.request("POST", ticketPath+"/verify", map[string]any{
			"expected_version": 1, "category_id": catA, "priority": "NORMAL", "classifier_version": 2, "reason": reason,
		}, 200, "", nil)
		drain()
		eq(coord.request("GET", ticketPath+"/dispatch-proposal?tier=L1", nil, 200, "", nil)["assignee_id"], techID)
		in["expected_version"], in["active"] = newRoster["version"], false
		adminA.request("PUT", path+"/"+newRoster["id"].(string)+scope, in, 200, "", nil)
		fallback := coord.request("GET", ticketPath+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
		eq(fallback["status"], "MANUAL")
		if fallback["assignee_id"] == techID {
			t.Fatal("disabled roster was recommended")
		}
		candidates := fallback["candidates"].([]any)
		if len(candidates) == 0 {
			t.Fatal("no live fallback technician in the organization")
		}
		candidate := candidates[0].(map[string]any)["roster"].(map[string]any)
		manual := map[string]any{
			"expected_version": fallback["ticket_version"], "proposal_version": fallback["ticket_version"],
			"team_id": teamB, "assignee_id": techID, "manual": true, "tier": "L1", "reason": reason,
		}
		coord.request("POST", ticketPath+"/dispatch", manual, 422, "", nil)
		manual["team_id"], manual["assignee_id"] = candidate["team_id"], candidate["subject_id"]
		eq(coord.request("POST", ticketPath+"/dispatch", manual, 200, "", nil)["assignee_id"], candidate["subject_id"])
		drain()
		var writes int
		if err := fault.QueryRow(ctx, "SELECT count(*) FROM notify_audit.audit_entries WHERE action='WriteRoster'").Scan(&writes); err != nil || writes != 3 {
			t.Fatalf("expected 3 durable roster audit entries, got %d (%v)", writes, err)
		}

		anon := testClient{t, base, &http.Client{Timeout: 10 * time.Second}}
		paginate := func(c testClient, route string) {
			first := c.request("GET", route+"&limit=1", nil, 200, "", nil)
			cursor, ok := first["next_cursor"].(string)
			if !ok || len(items(first)) != 1 {
				t.Fatalf("missing search page or cursor for %s: items=%d", route, len(items(first)))
			}
			second := c.request("GET", route+"&limit=1&cursor="+cursor, nil, 200, "", nil)
			if len(items(second)) != 1 || items(first)[0].(map[string]any)["id"] == items(second)[0].(map[string]any)["id"] {
				t.Fatal("duplicate or missing second search page")
			}
			c.request("GET", route+"X&limit=1&cursor="+cursor, nil, 400, "", nil)
		}
		paginate(public, "/search?owner=M2&q=Lab")
		paginate(public, "/search?owner=M3&q=Fase")
		pageOne := public.request("GET", "/tickets?q=Fase&limit=1&service_id="+svcA, nil, 200, "", nil)
		eq(len(items(pageOne)), 1)
		queueCursor := pageOne["next_cursor"].(string)
		pageTwo := public.request("GET", "/tickets?q=Fase&limit=1&service_id="+svcA+"&cursor="+queueCursor, nil, 200, "", nil)
		eq(len(items(pageTwo)), 1)
		if items(pageOne)[0].(map[string]any)["id"] == items(pageTwo)[0].(map[string]any)["id"] {
			t.Fatal("ticket queue search repeated the same ticket")
		}
		for _, visibility := range []string{"PUBLIC", "PUBLIC", "PRIVATE"} {
			id := web.ID()
			if _, err := fault.Exec(ctx, `INSERT INTO knowledge.media
				(id,principal_id,org_id,storage_key,status,visibility,mime,size_bytes,sha256,alt,caption,license,source)
				VALUES($1,'20000000-0000-4000-8000-000000000014',$2,$3,'CLEAN',$4,'image/png',1,$5,'Audio pencarian fixture','','','')`,
				id, orgA, id, visibility, make([]byte, 32)); err != nil {
				t.Fatal(err)
			}
		}
		paginate(anon, "/search?owner=M8&kind=MEDIA&q=Audio")
		page := anon.request("GET", "/search?owner=M8&kind=MEDIA&q=Audio", nil, 200, "", nil)
		eq(len(items(page)), 2)
		anon.request("GET", "/search?owner=M8&kind=MEDIA&q=Audio&cursor=malformed", nil, 400, "", nil)
		first := operator.request("GET", "/search?owner=M3&q=Fase&limit=1", nil, 200, "", nil)
		cursor := first["next_cursor"].(string)
		if _, err := fault.Exec(ctx, "UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000004'"); err != nil {
			t.Fatal(err)
		}
		eq(len(items(operator.request("GET", "/search?owner=M3&q=Fase&limit=1&cursor="+cursor, nil, 200, "", nil))), 0)
	})

}
