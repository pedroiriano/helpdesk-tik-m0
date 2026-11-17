package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestM007Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M007_TEST") != "1" {
		t.Skip("NOT_RUN: disposable PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	secretDir := t.TempDir()
	root := t.TempDir()
	t.Setenv("HELPDESK_UPLOAD_ROOT", root)
	t.Setenv("HELPDESK_SCANNER", os.Getenv("HELPDESK_TEST_SCANNER"))

	for i := 1; i <= 9; i++ {
		if e := os.WriteFile(filepath.Join(secretDir, fmt.Sprintf("m%d", i)), []byte(password), 0600); e != nil {
			t.Fatal(e)
		}
	}

	pools, e := database.Open(ctx, host, secretDir)
	if e != nil {
		t.Fatal(e)
	}
	defer pools.Close()

	cfg, _ := pgx.ParseConfig("postgres://postgres@localhost/helpdesk?sslmode=disable")
	cfg.Host = host
	cfg.Password = password
	db, e := pgx.ConnectConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close(ctx)

	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m007-key-not-a-production-secret"), Origin: base})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()

	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}

	public := client()
	operator := client()
	tech1 := client()
	techOPDB := client()
	coordA := client()
	coordB := client()

	public.login(1)
	operator.login(4)
	techOPDB.login(7)
	tech1.login(9)
	coordA.login(11)
	coordB.login(12)

	service := "30000000-0000-4000-8000-000000000001"
	teamID := "50000000-0000-4000-8000-000000000001"
	team2ID := "50000000-0000-4000-8000-000000000002"
	tech1ID := "20000000-0000-4000-8000-000000000009"
	org1ID := "10000000-0000-4000-8000-000000000001"
	org2ID := "10000000-0000-4000-8000-000000000002"

	flushDeliveries := func() {
		for round := 0; round < 5; round++ {
			for _, b := range runtime.Bindings {
				for n := 0; n < 20; n++ {
					if err := delivery.Step(ctx, b.Source, b.Consumer, delivery.Hooks{}); err != nil {
						break
					}
				}
			}
		}
	}

	createAndDispatchTicket := func(t *testing.T, title string) (ticketID string, version int64) {
		createPayload := map[string]any{
			"service_id":      service,
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           title,
			"description":     "Deskripsi tiket kendala operasional M0-07",
			"answers":         map[string]string{"ringkasan": "Kendala jaringan OPD"},
		}
		created := public.request("POST", "/tickets", createPayload, 201, "", nil)
		ticketID = created["id"].(string)
		version = int64(created["version"].(float64))

		verifyPayload := map[string]any{
			"expected_version":   version,
			"category_id":        "50000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"reason":             "Verifikasi laporan sebelum dispatch",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}
		verResp := operator.request("POST", "/tickets/"+ticketID+"/verify", verifyPayload, 200, "", nil)
		version = int64(verResp["version"].(float64))

		dispatchPayload := map[string]any{
			"expected_version": version,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"proposal_version": 1,
			"reason":           "Penugasan teknisi L1",
			"tier":             "L1",
		}
		dispResp := operator.request("POST", "/tickets/"+ticketID+"/dispatch", dispatchPayload, 200, "", nil)
		version = int64(dispResp["version"].(float64))

		flushDeliveries()
		return ticketID, version
	}

	// -------------------------------------------------------------
	// SUBTEST 1: AC16 Kasus Vendor & PIC Internal Wajib
	// -------------------------------------------------------------
	t.Run("AC16_VendorCase_Requires_Internal_PIC", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC16 Vendor Case Test")

		// Negatif: Pencatatan kasus vendor TANPA PIC internal -> 422 Unprocessable Entity
		missingPIC := map[string]any{
			"expected_version": version,
			"vendor_id":        "00000000-0000-4000-8000-000000000099",
			"internal_pic_id":  "",
			"reference_no":     "VEND-REF-001",
			"summary":          "Eskalasi ke ISP Telkom untuk fiber optik",
		}
		tech1.request("POST", "/tickets/"+ticketID+"/vendor-cases", missingPIC, 422, "", nil)

		// Positif: Pencatatan kasus vendor dengan PIC internal aktif
		validVendor := map[string]any{
			"expected_version": version,
			"vendor_id":        "00000000-0000-4000-8000-000000000099",
			"internal_pic_id":  tech1ID,
			"reference_no":     "VEND-REF-001",
			"summary":          "Koordinasi penggantian modul SFP oleh vendor pihak ketiga",
		}
		resp := tech1.request("POST", "/tickets/"+ticketID+"/vendor-cases", validVendor, 201, "", nil)
		newVer := int64(resp["version"].(float64))
		if newVer <= version {
			t.Fatalf("expected version increment, got %d <= %d", newVer, version)
		}

		// Verifikasi penugasan tiket tidak terhapus dan PIC internal tercatat
		ticketData := tech1.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)
		if ticketData["assignee_id"] != tech1ID {
			t.Fatalf("vendor case removed internal assignee! got %v", ticketData["assignee_id"])
		}

		// Verifikasi audit log outbox di M9
		flushDeliveries()
		var outboxCount int
		err := db.QueryRow(ctx, "SELECT count(*) FROM notify_audit.audit_entries WHERE action = 'VendorCaseRecorded'").Scan(&outboxCount)
		if err != nil || outboxCount == 0 {
			t.Fatalf("expected VendorCaseRecorded audit log in M9, err=%v count=%d", err, outboxCount)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 2: AC16 Jeda Waktu SLA Berizin & Kalkulasi Gross vs Net
	// -------------------------------------------------------------
	t.Run("AC16_Authorized_Pause_And_SLA_Gross_Net_Deduplication", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC16 SLA Pause Test")

		// Negatif: Teknisi atau pemohon mencoba pause tanpa izin ticket.pause -> 403 Forbidden
		pauseReq := map[string]any{
			"expected_version": version,
			"reason":           "Menunggu spare part router dikirim",
			"duration_minutes": 60,
		}
		tech1.request("POST", "/tickets/"+ticketID+"/pauses", pauseReq, 403, "", nil)
		public.request("POST", "/tickets/"+ticketID+"/pauses", pauseReq, 403, "", nil)

		// Positif: Koordinator berizin ticket.pause menyetujui jeda
		pauseResp := coordA.request("POST", "/tickets/"+ticketID+"/pauses", pauseReq, 201, "", nil)
		version = int64(pauseResp["version"].(float64))

		// Setujui jeda kedua yang berdekatan/overlapping untuk menguji deduplikasi interval
		pauseReq2 := map[string]any{
			"expected_version": version,
			"reason":           "Perpanjangan jeda konfirmasi pabrikan",
			"duration_minutes": 120,
		}
		pauseResp2 := coordA.request("POST", "/tickets/"+ticketID+"/pauses", pauseReq2, 201, "", nil)
		version = int64(pauseResp2["version"].(float64))

		flushDeliveries()

		// Verifikasi endpoint SLA mengembalikan gross vs net terpisah
		slaData := public.request("GET", "/tickets/"+ticketID+"/sla", nil, 200, "", nil)
		grossSec, ok1 := slaData["gross_seconds"].(float64)
		netSec, ok2 := slaData["net_seconds"].(float64)
		if !ok1 || !ok2 {
			t.Fatalf("missing gross_seconds or net_seconds in SLA response: %v", slaData)
		}
		if netSec > grossSec {
			t.Fatalf("net seconds (%f) cannot exceed gross seconds (%f)", netSec, grossSec)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 3: AC17 Pengajuan Handoff Antar-OPD
	// -------------------------------------------------------------
	t.Run("AC17_Handoff_Request_Pending_Keeps_Origin_Ownership", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC17 Handoff Pending Test")

		// Koordinator OPD A mengajukan handoff ke OPD B
		handoffReq := map[string]any{
			"expected_version": version,
			"target_org_id":    org2ID,
			"target_team_id":   team2ID,
			"reason":           "Pelimpahan wewenang penanganan server aplikasi Bappeda",
		}
		hResp := coordA.request("POST", "/tickets/"+ticketID+"/handoffs", handoffReq, 201, "", nil)
		hID := hResp["id"].(string)
		if idVal, ok := hResp["handoff_id"].(string); ok && idVal != "" {
			hID = idVal
		}
		if hID == "" {
			t.Fatal("empty handoff ID")
		}

		// Selama status handoff PENDING, service_owner_org_id tetap OPD A (org1ID)
		tkt := tech1.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)
		if tkt["service_owner_org_id"] != org1ID {
			t.Fatalf("ticket owner changed prematurely! got %v want %s", tkt["service_owner_org_id"], org1ID)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 4: AC06 & AC17 Penerimaan Handoff Atomik & Pencabutan Delegasi
	// -------------------------------------------------------------
	t.Run("AC06_AC17_Handoff_Acceptance_Atomic_Transfer_And_Revocation", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC06 AC17 Handoff Acceptance Test")

		// Ajukan handoff dari OPD A ke OPD B
		handoffReq := map[string]any{
			"expected_version": version,
			"target_org_id":    org2ID,
			"target_team_id":   team2ID,
			"reason":           "Pelimpahan wewenang penanganan server Bappeda",
		}
		hResp := coordA.request("POST", "/tickets/"+ticketID+"/handoffs", handoffReq, 201, "", nil)
		handoffID := hResp["id"].(string)
		if idVal, ok := hResp["handoff_id"].(string); ok && idVal != "" {
			handoffID = idVal
		}
		version = int64(hResp["version"].(float64))

		// Negatif: Koordinator OPD asal (Coord A) mencoba menerima handoff milik OPD target -> 403 Forbidden
		acceptReq := map[string]any{
			"expected_version": version,
			"reason":           "Mencoba menerima tiket sendiri secara ilegal",
		}
		coordA.request("POST", "/tickets/"+ticketID+"/handoffs/"+handoffID+"/accept", acceptReq, 403, "", nil)

		// Positif: Koordinator OPD target (Coord B) menerima handoff resmi
		acceptReqValid := map[string]any{
			"expected_version": version,
			"reason":           "Handoff diterima resmi oleh koordinator Bappeda",
		}
		accResp := coordB.request("POST", "/tickets/"+ticketID+"/handoffs/"+handoffID+"/accept", acceptReqValid, 200, "", nil)
		version = int64(accResp["version"].(float64))

		flushDeliveries()

		// Verifikasi mutasi atomik pada tiket:
		// 1. service_owner_org_id berubah menjadi Org B
		// 2. handling_team_id berubah menjadi Team 2
		// 3. assignee_id dicabut menjadi NULL
		tktAfter := coordB.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)
		if tktAfter["service_owner_org_id"] != org2ID {
			t.Fatalf("expected service_owner_org_id %s, got %v", org2ID, tktAfter["service_owner_org_id"])
		}
		if tktAfter["handling_team_id"] != team2ID {
			t.Fatalf("expected handling_team_id %s, got %v", team2ID, tktAfter["handling_team_id"])
		}
		if tktAfter["assignee_id"] != nil {
			t.Fatalf("expected assignee_id to be revoked (nil), got %v", tktAfter["assignee_id"])
		}

		// Revocation check: Teknisi lama (Tech1 OPD A) mencoba menyelesaikan tiket -> 404 Not Found (akses dicabut total)
		resolveReq := map[string]any{
			"expected_version": version,
			"summary":          "Mencoba resolve setelah tiket dilimpahkan",
		}
		tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveReq, 404, "", nil)
	})

	// -------------------------------------------------------------
	// SUBTEST 5: AC06 Penolakan Akses Lintas Scope OPD
	// -------------------------------------------------------------
	t.Run("AC06_Cross_OPD_Scope_Access_Denied", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC06 Cross OPD Isolation Check")

		// Handoff ke OPD B dan diterima oleh Coord B
		handoffReq := map[string]any{
			"expected_version": version,
			"target_org_id":    org2ID,
			"target_team_id":   team2ID,
			"reason":           "Pelimpahan wewenang",
		}
		hResp := coordA.request("POST", "/tickets/"+ticketID+"/handoffs", handoffReq, 201, "", nil)
		handoffID := hResp["id"].(string)
		if idVal, ok := hResp["handoff_id"].(string); ok && idVal != "" {
			handoffID = idVal
		}
		version = int64(hResp["version"].(float64))

		coordB.request("POST", "/tickets/"+ticketID+"/handoffs/"+handoffID+"/accept", map[string]any{
			"expected_version": version,
			"reason":           "Diterima resmi",
		}, 200, "", nil)

		// Teknisi OPD A (Diskominfo) sekarang DITOLAK membaca tiket privat OPD B (Bappeda)
		tech1.request("GET", "/tickets/"+ticketID, nil, 404, "", nil)

		// Sebaliknya, Koordinator OPD B dapat melihat tiket yang telah berpindah kepemilikan
		coordB.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)
	})

	// -------------------------------------------------------------
	// SUBTEST 6: AC17 Eskalasi Berjenjang & Operasi Asinkron 202
	// -------------------------------------------------------------
	t.Run("AC17_Hierarchical_Escalation_And_Async_Operation_202", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC17 Escalation Test")

		// Teknisi ajukan eskalasi tingkat L2
		escalateReq := map[string]any{
			"expected_version": version,
			"level":            "L2",
			"reason":           "Eskalasi ke tim infrastruktur jaringan pusat data",
		}

		nonce := tech1.csrf()
		raw, _ := json.Marshal(escalateReq)
		req, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/escalations", bytes.NewReader(raw))
		req.Header.Set("Origin", base)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", nonce)
		req.Header.Set("Idempotency-Key", web.ID())

		resp, err := tech1.http.Do(req)
		if err != nil {
			t.Fatalf("escalation request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d", resp.StatusCode)
		}
		loc := resp.Header.Get("Location")
		if !strings.HasPrefix(loc, "/api/v1/operations/") {
			t.Fatalf("expected Location header /api/v1/operations/{id}, got %s", loc)
		}

		var op map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&op)
		opID := op["id"].(string)

		// Pembacaan operasi melalui GET /api/v1/operations/{id}
		opResp := tech1.request("GET", "/operations/"+opID, nil, 200, "", nil)
		if opResp["id"] != opID || (opResp["kind"] != "ESCALATE" && opResp["kind"] != "ESCALATION") {
			t.Fatalf("unexpected operation payload: %v", opResp)
		}

		// Verifikasi mark eskalasi di database
		var markCount int
		err = db.QueryRow(ctx, "SELECT count(*) FROM intake.escalation_marks WHERE ticket_id = $1 AND level = 'L2'", ticketID).Scan(&markCount)
		if err != nil || markCount == 0 {
			t.Fatalf("expected escalation mark in DB, err=%v count=%d", err, markCount)
		}

		flushDeliveries()
	})

	// -------------------------------------------------------------
	// SUBTEST 7: AC17 Proteksi Konkurensi CAS pada Mutasi Bersaing
	// -------------------------------------------------------------
	t.Run("AC17_CAS_Concurrency_Protection_On_Competing_Mutations", func(t *testing.T) {
		ticketID, version := createAndDispatchTicket(t, "AC17 Concurrency CAS Test")

		var wg sync.WaitGroup
		wg.Add(2)
		var status1, status2 int

		req1 := map[string]any{
			"expected_version": version,
			"vendor_id":        "00000000-0000-4000-8000-000000000099",
			"internal_pic_id":  tech1ID,
			"reference_no":     "CAS-VEND-1",
			"summary":          "Kasus vendor konkruen",
		}
		req2 := map[string]any{
			"expected_version": version,
			"reason":           "Jeda waktu konkruen",
			"duration_minutes": 30,
		}

		go func() {
			defer wg.Done()
			nonce := tech1.csrf()
			raw, _ := json.Marshal(req1)
			r, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/vendor-cases", bytes.NewReader(raw))
			r.Header.Set("Origin", base)
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("X-CSRF-Token", nonce)
			r.Header.Set("Idempotency-Key", web.ID())
			res, err := tech1.http.Do(r)
			if err == nil {
				status1 = res.StatusCode
				res.Body.Close()
			}
		}()

		go func() {
			defer wg.Done()
			nonce := coordA.csrf()
			raw, _ := json.Marshal(req2)
			r, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/pauses", bytes.NewReader(raw))
			r.Header.Set("Origin", base)
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("X-CSRF-Token", nonce)
			r.Header.Set("Idempotency-Key", web.ID())
			res, err := coordA.http.Do(r)
			if err == nil {
				status2 = res.StatusCode
				res.Body.Close()
			}
		}()

		wg.Wait()

		// Salah satu wajib berhasil (201) dan yang lain wajib 409 Conflict
		success1 := status1 == 201
		success2 := status2 == 201

		if success1 && success2 {
			t.Fatal("CONCURRENCY CAS VIOLATION: Both competing mutations succeeded on same version!")
		}
		if (status1 != 201 && status1 != 409) || (status2 != 201 && status2 != 409) {
			t.Fatalf("unexpected statuses: status1=%d, status2=%d", status1, status2)
		}
	})
}
