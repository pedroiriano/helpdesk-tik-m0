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
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestM006Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M006_TEST") != "1" {
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m006-key-not-a-production-secret"), Origin: base})
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

	public.login(1)
	other.login(2)
	asn.login(3)
	operator.login(4)
	tech1.login(9)
	tech2.login(10)

	service := "30000000-0000-4000-8000-000000000001"
	teamID := "50000000-0000-4000-8000-000000000001"
	tech1ID := "20000000-0000-4000-8000-000000000009"
	_ = other
	_ = asn
	_ = tech2

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

	// -------------------------------------------------------------
	// Helper: Buat tiket lab, verifikasi, dan dispatch ke teknisi
	// -------------------------------------------------------------
	createAndDispatchTicket := func(t *testing.T, title string) (ticketID string, version int64, assigneeID string) {
		createPayload := map[string]any{
			"service_id":      service,
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           title,
			"description":     "Uraian kendala teknis jaringan internet kantor",
			"answers":         map[string]string{"ringkasan": "Printer offline"},
		}
		created := public.request("POST", "/tickets", createPayload, 201, "", nil)
		ticketID = created["id"].(string)
		version = int64(created["version"].(float64))

		// Operator Verifikasi
		verifyPayload := map[string]any{
			"expected_version":   version,
			"category_id":        "50000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"reason":             "Verifikasi disahkan untuk tindak lanjut",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}
		verResp := operator.request("POST", "/tickets/"+ticketID+"/verify", verifyPayload, 200, "", nil)
		version = int64(verResp["version"].(float64))

		// Operator Dispatch ke teknisi
		dispatchPayload := map[string]any{
			"expected_version": version,
			"team_id":          teamID,
			"assignee_id":      tech1ID,
			"proposal_version": 1,
			"reason":           "Penugasan teknisi L1 lapangan",
			"tier":             "L1",
		}
		dispResp := operator.request("POST", "/tickets/"+ticketID+"/dispatch", dispatchPayload, 200, "", nil)
		version = int64(dispResp["version"].(float64))
		assigneeID = tech1ID

		flushDeliveries()
		return ticketID, version, assigneeID
	}

	// -------------------------------------------------------------
	// SUBTEST 1: AC08 Engine SLA & Kalkulasi Kalender Kerja M6
	// -------------------------------------------------------------
	t.Run("AC08_SLA_Calculation_And_Clock_Projection", func(t *testing.T) {
		ticketID, _, _ := createAndDispatchTicket(t, "AC08 SLA Engine Check")

		// Query clock projection di M6
		now := time.Now().UTC()
		clock, err := runtime.SLA.Port().GetClock(ctx, ticketID, now)
		if err != nil {
			t.Fatalf("get clock from M6: %v", err)
		}
		if clock.Status != "ON_TRACK" && clock.Status != "AT_RISK" && clock.Status != "BREACHED" {
			t.Fatalf("unexpected clock status: %s", clock.Status)
		}

		// API GET /api/v1/tickets/{id}/sla
		slaBody := public.request("GET", "/tickets/"+ticketID+"/sla", nil, 200, "", nil)
		if slaBody["ticket_id"] != ticketID {
			t.Fatalf("SLA endpoint ticket_id mismatch: %v", slaBody)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 2: AC14 Alur Resolusi Teknisi (Positif & Negatif)
	// -------------------------------------------------------------
	t.Run("AC14_Technician_Resolve_Positive_And_Negative", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC14 Technician Resolve Check")

		// Negatif 1: Resolve tanpa summary / < 5 karakter -> 400 Bad Request
		resolveShort := map[string]any{
			"expected_version": version,
			"summary":          "fix",
		}
		tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveShort, 400, "", nil)

		// Negatif 2: Non-assignee / non-staf resolve -> 403 Forbidden
		resolveValid := map[string]any{
			"expected_version": version,
			"summary":          "Penggantian kabel patch cord dan port switch berhasil",
		}
		public.request("POST", "/tickets/"+ticketID+"/resolve", resolveValid, 403, "", nil)

		// Negatif 3: Expected version collision -> 409 Conflict
		resolveWrongVer := map[string]any{
			"expected_version": version + 99,
			"summary":          "Perbaikan switch jaringan tuntas",
		}
		tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveWrongVer, 409, "", nil)

		// Positif: Teknisi sah menyelesaikan tiket
		posBody := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveValid, 200, "", nil)
		posState := posBody["state"].(string)
		posAttempt := posBody["active_attempt_id"].(string)

		if posState != "RESOLVED" || posAttempt == "" {
			t.Fatalf("expected RESOLVED with active attempt ID, got %+v", posBody)
		}

		// Verifikasi DB constraint & 24 hour due
		var state string
		var activeAttempt string
		var resolvedAt, dueAt time.Time
		errDB := db.QueryRow(ctx, `SELECT t.state, t.active_attempt_id::text, a.resolved_at, a.confirmation_due_at
			FROM intake.tickets t
			JOIN intake.resolution_attempts a ON t.active_attempt_id = a.id
			WHERE t.id=$1`, ticketID).Scan(&state, &activeAttempt, &resolvedAt, &dueAt)
		if errDB != nil {
			t.Fatalf("verify resolve in DB: %v", errDB)
		}
		if state != "RESOLVED" || activeAttempt != posAttempt {
			t.Fatalf("state mismatch in DB: %s, attempt %s", state, activeAttempt)
		}
		// confirmation_due_at wajib persis 24 jam kalender dari resolved_at
		expectedDue := resolvedAt.Add(24 * time.Hour)
		if dueAt.Sub(expectedDue).Abs() > time.Second {
			t.Fatalf("confirmation_due_at mismatch: got %v, expected %v", dueAt, expectedDue)
		}

		flushDeliveries()
	})

	// -------------------------------------------------------------
	// SUBTEST 3: AC05 Durable Notification M9 & Event Balik ke M3
	// -------------------------------------------------------------
	t.Run("AC05_Durable_Notification_And_Edge_Event_Roundtrip", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC05 Notification Roundtrip")

		resolveBody := map[string]any{
			"expected_version": version,
			"summary":          "Konfigurasi ulang DNS dan gateway selesai",
		}
		resolved := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveBody, 200, "", nil)
		attemptID := resolved["active_attempt_id"].(string)

		// Sebelum flush: pastikan bukti notifikasi belum ada di M3
		var countBefore int
		_ = db.QueryRow(ctx, `SELECT count(*) FROM intake.confirmation_notifications WHERE ticket_id=$1 AND attempt_id=$2`, ticketID, attemptID).Scan(&countBefore)
		if countBefore != 0 {
			t.Fatalf("expected 0 confirmation_notifications before delivery flush, got %d", countBefore)
		}

		// Flush delivery M3 -> M9 (ResolutionProposed) dan M9 -> M3 (NotificationStored)
		flushDeliveries()

		// Verifikasi M9 menyimpan notifikasi secara durable
		var notifCount int
		err := db.QueryRow(ctx, `SELECT count(*) FROM notify_audit.notifications WHERE ticket_id=$1 AND attempt_id=$2`, ticketID, attemptID).Scan(&notifCount)
		if err != nil || notifCount < 1 {
			t.Fatalf("M9 durable notification missing: %v, count=%d", err, notifCount)
		}

		// Verifikasi M3 menerima bukti NotificationStored di intake.confirmation_notifications
		var countAfter int
		err = db.QueryRow(ctx, `SELECT count(*) FROM intake.confirmation_notifications WHERE ticket_id=$1 AND attempt_id=$2`, ticketID, attemptID).Scan(&countAfter)
		if err != nil || countAfter < 1 {
			t.Fatalf("intake.confirmation_notifications missing proof after roundtrip: %v, count=%d", err, countAfter)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 4: AC14 Konfirmasi Pemohon (ACCEPT -> CLOSED)
	// -------------------------------------------------------------
	t.Run("AC14_Requester_Confirm_Accept", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC14 Requester Accept")

		resolveBody := map[string]any{
			"expected_version": version,
			"summary":          "Pembersihan printer dan penggantian toner selesai",
		}
		resolved := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveBody, 200, "", nil)
		resolvedVer := int64(resolved["version"].(float64))
		attemptID := resolved["active_attempt_id"].(string)

		flushDeliveries()

		// Pemohon sah menyetujui hasil penanganan (ACCEPT)
		confirmBody := map[string]any{
			"expected_version": resolvedVer,
			"decision":         "ACCEPT",
		}
		confResp := public.request("POST", "/tickets/"+ticketID+"/confirmation", confirmBody, 200, "", nil)
		if confResp["state"] != "CLOSED" {
			t.Fatalf("expected state CLOSED, got %v", confResp["state"])
		}

		// Cek outcome di database
		var attemptOutcome string
		_ = db.QueryRow(ctx, `SELECT outcome FROM intake.resolution_attempts WHERE id=$1`, attemptID).Scan(&attemptOutcome)
		if attemptOutcome != "ACCEPTED" {
			t.Fatalf("expected attempt outcome ACCEPTED, got %s", attemptOutcome)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 5: AC14 Konfirmasi Pemohon (REJECT -> IN_PROGRESS)
	// -------------------------------------------------------------
	t.Run("AC14_Requester_Confirm_Reject_With_Reason", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC14 Requester Reject")

		resolveBody := map[string]any{
			"expected_version": version,
			"summary":          "Restart router dan konfigurasi ulang VLAN",
		}
		resolved := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveBody, 200, "", nil)
		resolvedVer := int64(resolved["version"].(float64))
		attemptID := resolved["active_attempt_id"].(string)

		// Negatif: Reject tanpa alasan -> 400 Bad Request
		rejectNoReason := map[string]any{
			"expected_version": resolvedVer,
			"decision":         "REJECT",
			"reason":           "",
		}
		public.request("POST", "/tickets/"+ticketID+"/confirmation", rejectNoReason, 400, "", nil)

		// Positif: Reject dengan alasan >= 5 karakter -> Tiket kembali ke IN_PROGRESS, active_attempt_id = NULL
		rejectValid := map[string]any{
			"expected_version": resolvedVer,
			"decision":         "REJECT",
			"reason":           "Koneksi masih sering putus saat zoom meeting berlangsung",
		}
		rejResp := public.request("POST", "/tickets/"+ticketID+"/confirmation", rejectValid, 200, "", nil)
		if rejResp["state"] != "IN_PROGRESS" {
			t.Fatalf("expected state IN_PROGRESS after reject, got %v", rejResp["state"])
		}

		// Periksa di DB: active_attempt_id harus NULL, attempt lama outcome REJECTED
		var activeAttempt *string
		var attemptOutcome string
		_ = db.QueryRow(ctx, `SELECT active_attempt_id::text FROM intake.tickets WHERE id=$1`, ticketID).Scan(&activeAttempt)
		if activeAttempt != nil {
			t.Fatalf("expected active_attempt_id NULL, got %v", *activeAttempt)
		}
		_ = db.QueryRow(ctx, `SELECT outcome FROM intake.resolution_attempts WHERE id=$1`, attemptID).Scan(&attemptOutcome)
		if attemptOutcome != "REJECTED" {
			t.Fatalf("expected attempt outcome REJECTED, got %s", attemptOutcome)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 6: AC14 Penahanan Auto-Close via Feedback / Komentar
	// -------------------------------------------------------------
	t.Run("AC14_Feedback_Holds_AutoClose", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC14 Feedback Hold Check")

		resolveBody := map[string]any{
			"expected_version": version,
			"summary":          "Pembersihan cache dan restart server lokal",
		}
		resolved := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveBody, 200, "", nil)
		resolvedVer := int64(resolved["version"].(float64))
		attemptID := resolved["active_attempt_id"].(string)

		flushDeliveries()

		// Pemohon mengirim komentar saat tiket RESOLVED
		commentBody := map[string]any{
			"expected_version": resolvedVer,
			"body":             "Mohon ditunggu, saya masih menguji kestabilan koneksi",
			"visibility":       "REQUESTER",
		}
		public.request("POST", "/tickets/"+ticketID+"/comments", commentBody, 201, "", nil)

		// Verifikasi attempt outcome berubah menjadi REVIEW_REQUIRED
		var attemptOutcome string
		_ = db.QueryRow(ctx, `SELECT outcome FROM intake.resolution_attempts WHERE id=$1`, attemptID).Scan(&attemptOutcome)
		if attemptOutcome != "REVIEW_REQUIRED" {
			t.Fatalf("expected outcome REVIEW_REQUIRED, got %s", attemptOutcome)
		}

		// Coba eksekusi auto-close pada attempt ini -> Wajib ditolak 409
		simulatedNow := time.Now().UTC().Add(48 * time.Hour)
		_, errClose := runtime.Intake.Service().AutoClose(ctx, ticketID, m3api.AutoCloseInput{
			ExpectedVersion: resolvedVer + 1,
			AttemptID:       attemptID,
		}, simulatedNow)
		if errClose == nil {
			t.Fatal("expected auto-close to be rejected when REVIEW_REQUIRED, but it succeeded")
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 7: AC15 Scheduler Auto-Close & Concurrency Collision
	// -------------------------------------------------------------
	t.Run("AC15_Guarded_AutoClose_And_Concurrency_Collision", func(t *testing.T) {
		ticketID, version, _ := createAndDispatchTicket(t, "AC15 AutoClose Guard")

		resolveBody := map[string]any{
			"expected_version": version,
			"summary":          "Penyambungan kabel fiber optic putus tuntas",
		}
		resolved := tech1.request("POST", "/tickets/"+ticketID+"/resolve", resolveBody, 200, "", nil)
		resolvedVer := int64(resolved["version"].(float64))
		attemptID := resolved["active_attempt_id"].(string)

		// Skenario 7.1: Auto-close ditolak sebelum bukti notifikasi NotificationStored tersedia
		simulatedNow := time.Now().UTC().Add(30 * time.Hour)
		_, errWithoutProof := runtime.Intake.Service().AutoClose(ctx, ticketID, m3api.AutoCloseInput{
			ExpectedVersion: resolvedVer,
			AttemptID:       attemptID,
		}, simulatedNow)
		if errWithoutProof == nil || !strings.Contains(errWithoutProof.Error(), "CONFIRMATION_NOTIFICATION_MISSING") {
			t.Fatalf("expected CONFIRMATION_NOTIFICATION_MISSING before notification stored, got %v", errWithoutProof)
		}

		// Sekarang jalankan flush agar bukti notifikasi M9 masuk ke M3
		flushDeliveries()

		// Skenario 7.2: Balapan Konkurensi (Race Condition)
		// Simulasikan Pemohon me-Reject tiket tepat bersamaan dengan runner AutoClose mengeksekusi penutupan!
		var wg sync.WaitGroup
		wg.Add(2)
		var statusReject int
		var errAutoClose error

		rejectBody := map[string]any{
			"expected_version": resolvedVer,
			"decision":         "REJECT",
			"reason":           "Masih belum stabil; saya tolak resolusi",
		}

		go func() {
			defer wg.Done()
			nonce := public.csrf()
			raw, _ := json.Marshal(rejectBody)
			req, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/confirmation", bytes.NewReader(raw))
			req.Header.Set("Origin", base)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-CSRF-Token", nonce)
			req.Header.Set("Idempotency-Key", web.ID())
			resp, err := public.http.Do(req)
			if err == nil {
				statusReject = resp.StatusCode
				resp.Body.Close()
			}
		}()

		go func() {
			defer wg.Done()
			// Simulasi scheduler mencoba auto-close pada expected_version yang sama
			_, errAutoClose = runtime.Intake.Service().AutoClose(ctx, ticketID, m3api.AutoCloseInput{
				ExpectedVersion: resolvedVer,
				AttemptID:       attemptID,
			}, simulatedNow)
		}()

		wg.Wait()

		// Salah satu wajib berhasil (200 / nil) dan yang lain wajib gagal (409)
		rejectSuccess := statusReject == 200
		autoCloseSuccess := errAutoClose == nil

		if rejectSuccess && autoCloseSuccess {
			t.Fatal("CONCURRENCY VIOLATION: Both reject and auto-close succeeded on same version!")
		}
		if !rejectSuccess && !autoCloseSuccess {
			t.Fatalf("both failed: rejectStatus=%d, autoCloseErr=%v", statusReject, errAutoClose)
		}

		// Skenario 7.3: Stale Attempt Guard
		// Tiket baru yang aktif tidak boleh ditutup oleh job yang membawa attempt lama yang sudah ditolak
		_, errStale := runtime.Intake.Service().AutoClose(ctx, ticketID, m3api.AutoCloseInput{
			ExpectedVersion: resolvedVer + 1,
			AttemptID:       attemptID,
		}, simulatedNow.Add(48*time.Hour))
		if errStale == nil {
			t.Fatal("expected stale attempt auto-close to fail, but it succeeded")
		}
	})
}
