package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestM005Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M005_TEST") != "1" {
		t.Skip("NOT_RUN: disposable PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m005-key-not-a-production-secret"), Origin: base})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()

	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}

	public := client()
	other := client()
	asn := client()
	operator := client()
	tech1 := client()
	tech2 := client()
	guest := client()

	public.login(1)
	other.login(2)
	asn.login(3)
	operator.login(4)
	tech1.login(9)
	tech2.login(10)

	service := "30000000-0000-4000-8000-000000000001"
	teamID := "50000000-0000-4000-8000-000000000001"
	tech1ID := "20000000-0000-4000-8000-000000000009"
	tech2ID := "20000000-0000-4000-8000-000000000010"

	count := func(query string, args ...any) int {
		var n int
		if e := db.QueryRow(ctx, query, args...).Scan(&n); e != nil {
			t.Fatal(e)
		}
		return n
	}

	input := map[string]any{
		"service_id":      service,
		"service_version": 1,
		"form_version":    1,
		"policy_version":  1,
		"title":           "Gangguan printer lab",
		"description":     "Printer di laboratorium TIK tidak merespons",
		"answers":         map[string]string{"ringkasan": "Printer offline"},
	}

	// -------------------------------------------------------------
	// 1. AC04: Guard Status & Operator Verification Flow
	// -------------------------------------------------------------
	var ticket1ID string
	t.Run("AC04_guard_dispatch_authorization_and_verification", func(t *testing.T) {
		created := public.request("POST", "/tickets", input, 201, "", nil)
		ticket1ID = created["id"].(string)

		// Negatif 1: Dispatch tiket yang masih berstatus OPEN wajib ditolak 409 TICKET_NOT_VERIFIED
		dispatchAttempt := map[string]any{
			"expected_version": 1,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"proposal_version": 1,
			"reason":           "Mencoba dispatch langsung sebelum verifikasi",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/dispatch", dispatchAttempt, 409, "", nil)

		// Negatif 2: Otorisasi verifikasi & penolakan - hanya operator sah
		verifyInput := map[string]any{
			"expected_version":   1,
			"category_id":        "50000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000001",
			"reason":             "Verifikasi sesuai kategori",
		}
		public.request("POST", "/tickets/"+ticket1ID+"/verify", verifyInput, 403, "", nil)
		asn.request("POST", "/tickets/"+ticket1ID+"/verify", verifyInput, 404, "", nil)
		guest.request("POST", "/tickets/"+ticket1ID+"/verify", verifyInput, 401, "", nil)
		public.request("POST", "/tickets/"+ticket1ID+"/reject", map[string]any{"expected_version": 1, "rejection_reason": "Alasan publik"}, 403, "", nil)

		// Negatif 3: Reject tanpa alasan wajib ditolak 400
		operator.request("POST", "/tickets/"+ticket1ID+"/reject", map[string]any{"expected_version": 1, "rejection_reason": ""}, 400, "", nil)

		// Negatif 4 (AC13): Override kategori tanpa alasan atau alasan < 5 karakter wajib ditolak 400
		overrideTanpaAlasan := map[string]any{
			"expected_version":   1,
			"category_id":        "50000000-0000-4000-8000-000000000002",
			"priority":           "HIGH",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000001",
			"reason":             "",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/verify", overrideTanpaAlasan, 400, "", nil)

		overrideAlasanPendek := map[string]any{
			"expected_version":   1,
			"category_id":        "50000000-0000-4000-8000-000000000002",
			"priority":           "HIGH",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000001",
			"reason":             "pend",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/verify", overrideAlasanPendek, 400, "", nil)

		// Positif 1: Operator verifikasi dengan alasan override sah (>= 5 karakter)
		overrideSah := map[string]any{
			"expected_version":   1,
			"category_id":        "50000000-0000-4000-8000-000000000002",
			"priority":           "HIGH",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000001",
			"reason":             "Kategori disesuaikan ke infrastruktur perangkat keras",
		}
		res := operator.request("POST", "/tickets/"+ticket1ID+"/verify", overrideSah, 200, "", nil)
		if res["verification"] != "VERIFIED" {
			t.Fatalf("expected VERIFIED, got %v", res["verification"])
		}

		// Verifikasi database: tiket ter-update, version=2, outbox memuat TicketVerified
		if count(`SELECT count(*) FROM intake.tickets WHERE id=$1 AND verification='VERIFIED' AND version=2`, ticket1ID) != 1 {
			t.Fatal("ticket state or version not updated")
		}
		if count(`SELECT count(*) FROM intake.ticket_verifications WHERE ticket_id=$1 AND override_reason<>''`, ticket1ID) != 1 {
			t.Fatal("verification record with override missing")
		}
		if count(`SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1 AND event_type='TicketVerified'`, ticket1ID) != 1 {
			t.Fatal("TicketVerified event missing from outbox")
		}

		// Negatif 5: Tiket yang sudah diverifikasi tidak bisa diverifikasi ulang (409)
		operator.request("POST", "/tickets/"+ticket1ID+"/verify", overrideSah, 409, "", nil)
	})

	// -------------------------------------------------------------
	// 2. Operator Reject Flow
	// -------------------------------------------------------------
	t.Run("AC04_operator_rejection_flow", func(t *testing.T) {
		created := public.request("POST", "/tickets", input, 201, "", nil)
		ticket2ID := created["id"].(string)

		rejectInput := map[string]any{
			"expected_version": 1,
			"rejection_reason": "Laporan tidak lengkap dan tidak dapat diproses lebih lanjut",
		}
		operator.request("POST", "/tickets/"+ticket2ID+"/reject", rejectInput, 200, "", nil)

		if count(`SELECT count(*) FROM intake.tickets WHERE id=$1 AND state='CANCELLED' AND version=2`, ticket2ID) != 1 {
			t.Fatal("rejected ticket state not updated properly")
		}
	})

	// -------------------------------------------------------------
	// 3. AC13: Routing Disposisi L1/L2 & Validasi Teknisi
	// -------------------------------------------------------------
	t.Run("AC13_technician_validation_and_l1_l2_dispatch", func(t *testing.T) {
		// Negatif 1: Dispatch ke non-staf / invalid user (Subjek 1) ditolak 422
		nonStaffDispatch := map[string]any{
			"expected_version": 2,
			"team_id":          teamID,
			"assignee_id":      "20000000-0000-4000-8000-000000000001",
			"tier":             "L1",
			"proposal_version": 1,
			"reason":           "Uji penugasan non staf",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/dispatch", nonStaffDispatch, 422, "", nil)

		// Negatif 2: Dispatch ke tim yang salah / teknisi tidak terdaftar dalam roster ditolak 422
		wrongTeamDispatch := map[string]any{
			"expected_version": 2,
			"team_id":          "80000000-0000-4000-8000-000000000099",
			"assignee_id":      tech1ID,
			"tier":             "L1",
			"proposal_version": 1,
			"reason":           "Uji penugasan salah tim",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/dispatch", wrongTeamDispatch, 422, "", nil)

		// Negatif 3: Dispatch dengan versi usang (expected_version: 1 padahal sudah versi 2) ditolak 409
		staleDispatch := map[string]any{
			"expected_version": 1,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"tier":             "L1",
			"proposal_version": 1,
			"reason":           "Uji versi usang",
		}
		operator.request("POST", "/tickets/"+ticket1ID+"/dispatch", staleDispatch, 409, "", nil)

		// Positif: Dispatch sukses ke Teknisi L1 (Subjek 9)
		validDispatch := map[string]any{
			"expected_version": 2,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"tier":             "L1",
			"proposal_version": 1,
			"reason":           "Disposisi ke teknisi L1 untuk pengecekan printer",
		}
		res := operator.request("POST", "/tickets/"+ticket1ID+"/dispatch", validDispatch, 200, "", nil)
		if res["state"] != "ASSIGNED" {
			t.Fatalf("expected state ASSIGNED, got %v", res["state"])
		}

		// Verifikasi database: state=ASSIGNED, assignee_id=tech1ID, version=3
		if count(`SELECT count(*) FROM intake.tickets WHERE id=$1 AND state='ASSIGNED' AND assignee_id=$2 AND version=3`, ticket1ID, tech1ID) != 1 {
			t.Fatal("ticket state or assignee not recorded")
		}
		if count(`SELECT count(*) FROM assignment.assignment_proposals WHERE ticket_id=$1 AND assignee_id=$2`, ticket1ID, tech1ID) != 1 {
			t.Fatal("assignment proposal not recorded in M5")
		}
		if count(`SELECT count(*) FROM assignment.load_projection WHERE ticket_id=$1 AND assignee_id=$2 AND state='ASSIGNED'`, ticket1ID, tech1ID) != 1 {
			t.Fatal("load projection not recorded in M5")
		}
		if count(`SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1 AND event_type='AssignmentChanged'`, ticket1ID) != 1 {
			t.Fatal("AssignmentChanged event missing from outbox")
		}
	})

	// -------------------------------------------------------------
	// 4. AC13: Optimistic Concurrency Control (CAS Guard) Collision
	// -------------------------------------------------------------
	t.Run("AC13_optimistic_concurrency_CAS_collision", func(t *testing.T) {
		created := public.request("POST", "/tickets", input, 201, "", nil)
		casTicketID := created["id"].(string)

		// Verifikasi tiket agar siap di-dispatch (menjadi versi 2)
		operator.request("POST", "/tickets/"+casTicketID+"/verify", map[string]any{
			"expected_version":   1,
			"category_id":        "50000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000001",
			"reason":             "Verifikasi siap dispatch",
		}, 200, "", nil)

		// 2 operator / client serentak mendispatch tiket yang sama dengan expected_version = 2
		var wg sync.WaitGroup
		statusCodes := make([]int, 2)

		dispatchPayloadA := map[string]any{
			"expected_version": 2,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"tier":             "L1",
			"proposal_version": 1,
			"reason":           "Operator A mencoba dispatch L1",
		}
		dispatchPayloadB := map[string]any{
			"expected_version": 2,
			"team_id":          teamID,
			"assignee_id":      tech2ID,
			"tier":             "L2",
			"proposal_version": 1,
			"reason":           "Operator B mencoba dispatch L2",
		}

		sendDispatch := func(idx int, payload map[string]any) {
			defer wg.Done()
			raw, _ := json.Marshal(payload)
			req, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+casTicketID+"/dispatch", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", base)
			req.Header.Set("X-CSRF-Token", operator.csrf())
			req.Header.Set("Idempotency-Key", web.ID())
			res, err := operator.http.Do(req)
			if err != nil {
				t.Errorf("request error: %v", err)
				return
			}
			res.Body.Close()
			statusCodes[idx] = res.StatusCode
		}

		wg.Add(2)
		go sendDispatch(0, dispatchPayloadA)
		go sendDispatch(1, dispatchPayloadB)
		wg.Wait()

		// Tepat satu menang (200) dan tepat satu kalah (409 Conflict)
		count200 := 0
		count409 := 0
		for _, code := range statusCodes {
			if code == 200 {
				count200++
			} else if code == 409 {
				count409++
			}
		}

		if count200 != 1 || count409 != 1 {
			t.Fatalf("expected exactly one 200 and one 409, got %v", statusCodes)
		}

		// Pastikan versi tiket tepat 3 dan konsisten di database
		if count(`SELECT count(*) FROM intake.tickets WHERE id=$1 AND version=3`, casTicketID) != 1 {
			t.Fatal("ticket state or version inconsistent after concurrent dispatch")
		}
	})

	// -------------------------------------------------------------
	// 5. Antrean Operator & Teknisi
	// -------------------------------------------------------------
	t.Run("operator_and_technician_queues", func(t *testing.T) {
		// Antrean verifikasi operator
		vQueue := operator.request("GET", "/operator/queue/verification", nil, 200, "", nil)
		if vQueue["items"] == nil {
			t.Fatal("verification queue missing items")
		}

		// Antrean disposisi operator
		dQueue := operator.request("GET", "/operator/queue/dispatch", nil, 200, "", nil)
		if dQueue["items"] == nil {
			t.Fatal("dispatch queue missing items")
		}

		// Antrean tugas teknisi 1 (Subjek 9) harus memuat ticket1ID
		myTasks1 := tech1.request("GET", "/technician/queue/my-tasks", nil, 200, "", nil)
		items1 := myTasks1["items"].([]any)
		foundTicket1 := false
		for _, it := range items1 {
			m := it.(map[string]any)
			if m["id"] == ticket1ID {
				foundTicket1 = true
				break
			}
		}
		if !foundTicket1 {
			t.Fatalf("expected ticket %s in technician 1 queue, but not found", ticket1ID)
		}

		// Antrean tugas teknisi 2 (Subjek 10) tidak boleh memuat ticket1ID
		myTasks2 := tech2.request("GET", "/technician/queue/my-tasks", nil, 200, "", nil)
		items2 := myTasks2["items"].([]any)
		for _, it := range items2 {
			m := it.(map[string]any)
			if m["id"] == ticket1ID {
				t.Fatalf("ticket %s leaked into technician 2 queue", ticket1ID)
			}
		}

		// Daftar teknisi untuk tim
		techList := operator.request("GET", "/technicians?team_id="+teamID, nil, 200, "", nil)
		if len(techList["items"].([]any)) < 2 {
			t.Fatal("expected at least 2 technicians in team roster")
		}

		// Otorisasi antrean: publik & ASN tidak boleh mengakses antrean operator
		public.request("GET", "/operator/queue/verification", nil, 403, "", nil)
		asn.request("GET", "/operator/queue/verification", nil, 403, "", nil)
	})

	// -------------------------------------------------------------
	// 6. Aliran Durable Event & Konsumsi M9 (Audit & ACK)
	// -------------------------------------------------------------
	t.Run("durable_outbox_processing_and_m9_audit_ack", func(t *testing.T) {
		// Jalankan delivery.Step untuk semua sources (M1..M9)
		for _, s := range runtime.Sources {
			for i := 0; i < 100; i++ {
				err := delivery.Step(ctx, s, runtime.Consumer, delivery.Hooks{})
				if err == delivery.ErrEmpty {
					break
				}
				if err != nil {
					t.Fatalf("delivery step error: %v", err)
				}
			}
		}

		// Verifikasi M9 outbox delivery: semua pesan untuk M9 telah berstatus ACKED
		unackedM9 := count(`SELECT count(*) FROM intake.outbox_delivery WHERE consumer_id='M9' AND state<>'ACKED'`)
		if unackedM9 != 0 {
			var debugInfo []byte
			_ = db.QueryRow(ctx, `SELECT COALESCE(json_agg(json_build_object('event_id', event_id, 'state', state, 'error', last_error_code)), '[]') FROM intake.outbox_delivery WHERE consumer_id='M9' AND state<>'ACKED'`).Scan(&debugInfo)
			t.Fatalf("unacked M9 deliveries remaining: %s", string(debugInfo))
		}

		// Verifikasi audit log M9: memuat entri dari TicketVerified dan AssignmentChanged
		verifiedAudits := count(`SELECT count(*) FROM notify_audit.audit_entries WHERE action='TicketVerified'`)
		if verifiedAudits == 0 {
			t.Fatal("no audit entries for TicketVerified in M9")
		}
		assignmentAudits := count(`SELECT count(*) FROM notify_audit.audit_entries WHERE action='AssignmentChanged'`)
		if assignmentAudits == 0 {
			t.Fatal("no audit entries for AssignmentChanged in M9")
		}

		// Verifikasi consumer masa depan (M6, M7) tetap berstatus PENDING secara jujur
		if count(`SELECT count(*) FROM intake.outbox_delivery WHERE consumer_id IN ('M6', 'M7') AND state='PENDING'`) == 0 {
			t.Fatal("future targets (M6, M7) were removed or fake ACKed")
		}
	})
}
