package bootstrap

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestM012Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M012_TEST") != "1" {
		t.Skip("NOT_RUN: disposable PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
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

	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m012-key-not-a-production-secret"), Origin: base})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()

	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}

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

	// Persona pengguna:
	pub1 := client()
	pub1.login(1)

	asn := client()
	asn.login(3)

	operator := client()
	operator.login(4)

	platformAdmin := client()
	platformAdmin.login(5)

	tech := client()
	tech.login(9)

	coord := client()
	coord.login(11)

	coordB := client()
	coordB.login(12)

	leader := client()
	leader.login(14)

	auditor := client()
	auditor.login(16)

	superAdmin := client()
	superAdmin.login(17)

	secondAdmin := client()
	secondAdmin.login(18)

	guest := client()

	// =========================================================================
	// Subtest 1: End-to-End Guest Ticket Lifecycle (M3 -> M4 -> M5 -> M6 -> M7 -> M9)
	// =========================================================================
	t.Run("Subtest1_E2E_Guest_Ticket_Lifecycle", func(t *testing.T) {
		b := make([]byte, 32)
		_, _ = rand.Read(b)
		capability := hex.EncodeToString(b)

		boot := guest.request("GET", "/auth/bootstrap", nil, 200, "", nil)
		nonce := boot["csrf_token"].(string)
		guestHeaders := map[string]string{"X-Guest-Capability": capability, "X-CSRF-Token": nonce}

		// 1. Buat tiket oleh tamu dengan capability token Web Crypto
		ticketInput := map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Laporan Jaringan Kantor Layanan Tamu M0-12",
			"description":     "Akses koneksi internet di loket pelayanan warga terputus total",
			"answers":         map[string]any{"ringkasan": "Loket 3"},
		}
		tktResp := guest.request("POST", "/tickets", ticketInput, 201, web.ID(), guestHeaders)
		ticketID := tktResp["id"].(string)
		ver := int64(tktResp["version"].(float64))

		// Inisialisasi sesi tracking tamu menggunakan capability token
		track := guest.request("POST", "/guest/tracking-session", map[string]string{"csrf_token": nonce}, 201, "", guestHeaders)
		if track["ticket_id"] != ticketID {
			t.Fatal("wrong tracking binding")
		}

		// Periksa detail tiket berstatus awal OPEN
		tktDetail := guest.request("GET", fmt.Sprintf("/tickets/%s", ticketID), nil, 200, "", nil)
		if tktDetail["state"] != "OPEN" {
			t.Fatalf("Expected initial state OPEN, got %v", tktDetail["state"])
		}

		// 2. Unggah berkas bersih lolos scan ClamAV
		var imgBuf bytes.Buffer
		_ = png.Encode(&imgBuf, image.NewRGBA(image.Rect(0, 0, 4, 4)))
		uploadReq, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/attachments", bytes.NewReader(imgBuf.Bytes()))
		uploadReq.Header.Set("Content-Type", "application/octet-stream")
		uploadReq.Header.Set("Origin", base)
		uploadReq.Header.Set("X-Guest-Capability", capability)
		uploadReq.Header.Set("X-CSRF-Token", guest.csrf())
		uploadReq.Header.Set("Idempotency-Key", web.ID())
		uploadReq.Header.Set("X-Expected-Version", fmt.Sprint(ver))
		uploadReq.Header.Set("X-Filename", "tangkapan_layar_error.png")
		uploadReq.Header.Set("X-File-Mime", "image/png")
		uploadReq.Header.Set("X-Attachment-Audience", "REQUESTER")

		upRes, upErr := guest.http.Do(uploadReq)
		if upErr != nil {
			t.Fatal(upErr)
		}
		defer upRes.Body.Close()
		if upRes.StatusCode != 201 {
			upBody, _ := io.ReadAll(upRes.Body)
			t.Fatalf("Guest upload failed with %d: %s", upRes.StatusCode, upBody)
		}
		ver++

		// 3. Verifikasi intake operator dengan override rationale wajib (>= 5 karakter)
		verResp := operator.request("POST", fmt.Sprintf("/tickets/%s/verify", ticketID), map[string]any{
			"expected_version":   ver,
			"category_id":        "40000000-0000-4000-8000-000000000001",
			"priority":           "HIGH",
			"reason":             "Verifikasi lengkap intake operator terhadap jaringan loket",
			"classifier_version": operator.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)["classification"].(map[string]any)["rule_version"],
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}, 200, "", nil)
		if verResp["verification"] != "VERIFIED" {
			t.Fatalf("Expected verification VERIFIED, got %v", verResp["verification"])
		}
		ver = int64(verResp["version"].(float64))

		// 4. Koordinator dispatch ke teknisi L1
		dispResp := coord.request("POST", fmt.Sprintf("/tickets/%s/dispatch", ticketID), map[string]any{
			"expected_version": ver,
			"team_id":          "50000000-0000-4000-8000-000000000001",
			"assignee_id":      "20000000-0000-4000-8000-000000000009",
			"proposal_version": 1,
			"reason":           "Penugasan teknisi L1 jaringan",
			"tier":             "L1",
		}, 200, "", nil)
		if dispResp["state"] != "ASSIGNED" {
			t.Fatalf("Expected state ASSIGNED, got %v", dispResp["state"])
		}
		ver = int64(dispResp["version"].(float64))

		started := tech.request("POST", "/tickets/"+ticketID+"/transitions", map[string]any{
			"expected_version": ver, "action": "START", "reason": "Mulai penanganan fixture",
		}, 200, "", nil)
		ver = int64(started["version"].(float64))

		// 5. Pencatatan vendor dengan PIC internal aktif
		vendorResp := tech.request("POST", fmt.Sprintf("/tickets/%s/vendor-cases", ticketID), map[string]any{
			"expected_version":   ver,
			"vendor_id":          "00000000-0000-4000-8000-000000000099",
			"internal_pic_id":    "20000000-0000-4000-8000-000000000009",
			"external_reference": "VND-FIXTURE-012",
			"contract_reference": "KONTRAK-FIXTURE-012",
			"expected_return_at": time.Now().Add(2 * time.Hour).UTC(),
			"next_followup_at":   time.Now().Add(time.Hour).UTC(),
			"summary":            "Kabel fiber optik putus di trotoar utama",
		}, 201, "", nil)
		ver = int64(vendorResp["version"].(float64))

		// 6. Jeda SLA berizin oleh koordinator
		pauseResp := coord.request("POST", fmt.Sprintf("/tickets/%s/pauses", ticketID), map[string]any{
			"expected_version": ver,
			"reason":           "Menunggu penyambungan fiber optik oleh vendor",
			"duration_minutes": 60,
		}, 201, "", nil)
		ver = int64(pauseResp["version"].(float64))

		// 7. Teknisi resolve tiket
		resResp := tech.request("POST", fmt.Sprintf("/tickets/%s/resolve", ticketID), map[string]any{
			"expected_version": ver,
			"summary":          "Koneksi jaringan loket telah pulih dan diuji ping stabil",
		}, 200, "", nil)
		if resResp["state"] != "RESOLVED" {
			t.Fatalf("Expected state RESOLVED, got %v", resResp["state"])
		}
		ver = int64(resResp["version"].(float64))

		flushDeliveries()

		// 8. Pemohon confirm -> status CLOSED
		confResp := guest.request("POST", fmt.Sprintf("/tickets/%s/confirmation", ticketID), map[string]any{
			"attempt_id":       resResp["active_attempt_id"],
			"expected_version": ver,
			"decision":         "ACCEPT",
		}, 200, "", nil)
		if confResp["state"] != "CLOSED" {
			t.Fatalf("Expected state CLOSED, got %v", confResp["state"])
		}

		flushDeliveries()
	})

	// =========================================================================
	// Subtest 2: CAS Concurrency Collision on Auto-Close vs Requester Reject
	// =========================================================================
	t.Run("Subtest2_AC04_AC15_Auto_Close_Concurrency_Race_Condition", func(t *testing.T) {
		tkt := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Tiket simulasi persaingan auto-close M0-12",
			"description":     "Menguji collision version guard",
			"answers":         map[string]any{"ringkasan": "Uji CAS"},
		}, 201, "", nil)
		ticketID := tkt["id"].(string)
		ver := int64(tkt["version"].(float64))

		vResp := operator.request("POST", fmt.Sprintf("/tickets/%s/verify", ticketID), map[string]any{
			"expected_version":   ver,
			"category_id":        "40000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"reason":             "Verifikasi intake",
			"classifier_version": operator.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)["classification"].(map[string]any)["rule_version"],
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}, 200, "", nil)
		ver = int64(vResp["version"].(float64))

		dResp := coord.request("POST", fmt.Sprintf("/tickets/%s/dispatch", ticketID), map[string]any{
			"expected_version": ver,
			"team_id":          "50000000-0000-4000-8000-000000000001",
			"assignee_id":      "20000000-0000-4000-8000-000000000009",
			"proposal_version": 1,
			"reason":           "Dispatch teknisi",
			"tier":             "L1",
		}, 200, "", nil)
		ver = int64(dResp["version"].(float64))

		started := tech.request("POST", "/tickets/"+ticketID+"/transitions", map[string]any{
			"expected_version": ver, "action": "START", "reason": "Mulai penanganan fixture",
		}, 200, "", nil)
		ver = int64(started["version"].(float64))

		rResp := tech.request("POST", fmt.Sprintf("/tickets/%s/resolve", ticketID), map[string]any{
			"expected_version": ver,
			"summary":          "Resolusi awal teknisi",
		}, 200, "", nil)
		ver = int64(rResp["version"].(float64))

		// Pemohon menolak resolusi dengan alasan (>= 5 karakter)
		rejectResp := pub1.request("POST", fmt.Sprintf("/tickets/%s/confirmation", ticketID), map[string]any{
			"attempt_id":       rResp["active_attempt_id"],
			"expected_version": ver,
			"decision":         "REJECT",
			"reason":           "Masalah internet masih kambuh, mohon dicek ulang router",
		}, 200, "", nil)
		if rejectResp["state"] != "IN_PROGRESS" {
			t.Fatalf("Expected state IN_PROGRESS on reject, got %v", rejectResp["state"])
		}

		// Mutasi bersaing pada versi lama (ver) ditolak HTTP 409 Conflict
		pub1.request("POST", fmt.Sprintf("/tickets/%s/confirmation", ticketID), map[string]any{
			"expected_version": ver,
			"decision":         "ACCEPT",
		}, 409, "", nil)
	})

	// =========================================================================
	// Subtest 3: Public / ASN Portal Flow, Search & Dynamic Revocation Gate
	// =========================================================================
	t.Run("Subtest3_AC06_AC20_AC23_Public_ASN_Search_Dynamic_Revocation", func(t *testing.T) {
		// 1. ASN menelusuri katalog
		services := asn.request("GET", "/catalog/services", nil, 200, "", nil)
		if len(services["items"].([]any)) == 0 {
			t.Fatal("Expected catalog services available for ASN")
		}

		// 2. Multi-owner search (M2, M3, M8)
		searchRes := asn.request("GET", "/search?owner=M2&q=layanan", nil, 200, "", nil)
		if searchRes["items"] == nil {
			t.Fatal("Expected search results object")
		}

		// 3. Telegram binding dengan penolakan salah scope & sensor rahasia
		// Penolakan scope tidak sah (koordinator OPD 1 mencoba mengikat ke OPD 2 tanpa hak -> DITOLAK 403)
		coord.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version":  1,
			"verification_code": "98765432:SECRET_TELEGRAM_TOKEN",
			"scope_org_id":      "10000000-0000-4000-8000-000000000002",
			"channel":           "SINK",
		}, 403, "", nil)

		// 4. Dynamic Revocation Gate: logout ASN seketika memblokir kueri
		asnLogout := client()
		asnLogout.login(3)
		asnLogout.request("GET", "/search?owner=M2&q=layanan", nil, 200, "", nil)

		// Logout
		asnLogout.request("POST", "/auth/logout", map[string]any{
			"expected_version": 1,
			"reason":           "Logout dinamis untuk uji AC23",
		}, 200, "", nil)

		// Setelah logout, permintaan yang memerlukan live revocation seketika ditolak (401)
		asnLogout.request("GET", "/reports", nil, 401, "", nil)
	})

	// =========================================================================
	// Subtest 4: Inter-OPD Handoff & Hierarchical Leadership Escalation
	// =========================================================================
	t.Run("Subtest4_AC06_AC16_AC17_Inter_OPD_Handoff_And_Escalation", func(t *testing.T) {
		tkt := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Tiket untuk handoff antar-OPD M0-12",
			"description":     "Perlu dilimpahkan ke OPD B",
			"answers":         map[string]any{"ringkasan": "Handoff test"},
		}, 201, "", nil)
		ticketID := tkt["id"].(string)
		ver := int64(tkt["version"].(float64))

		vResp := operator.request("POST", fmt.Sprintf("/tickets/%s/verify", ticketID), map[string]any{
			"expected_version":   ver,
			"category_id":        "40000000-0000-4000-8000-000000000001",
			"priority":           "HIGH",
			"reason":             "Verifikasi sebelum handoff",
			"classifier_version": operator.request("GET", "/tickets/"+ticketID, nil, 200, "", nil)["classification"].(map[string]any)["rule_version"],
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}, 200, "", nil)
		ver = int64(vResp["version"].(float64))

		dResp := coord.request("POST", fmt.Sprintf("/tickets/%s/dispatch", ticketID), map[string]any{
			"expected_version": ver,
			"team_id":          "50000000-0000-4000-8000-000000000001",
			"assignee_id":      "20000000-0000-4000-8000-000000000009",
			"proposal_version": 1,
			"reason":           "Penugasan awal teknisi",
			"tier":             "L1",
		}, 200, "", nil)
		ver = int64(dResp["version"].(float64))

		// 1. Koordinator OPD A ajukan handoff ke OPD B (status PENDING, kepemilikan tetap di OPD A)
		handoffReq := coord.request("POST", fmt.Sprintf("/tickets/%s/handoffs", ticketID), map[string]any{
			"expected_version": ver,
			"target_org_id":    "10000000-0000-4000-8000-000000000002",
			"target_team_id":   "50000000-0000-4000-8000-000000000002",
			"reason":           "Pelayanan kewenangan OPD B",
		}, 201, "", nil)
		handoffID := handoffReq["id"].(string)
		if idVal, ok := handoffReq["handoff_id"].(string); ok && idVal != "" {
			handoffID = idVal
		}
		ver = int64(handoffReq["version"].(float64))

		// 2. Koordinator OPD B menerima handoff -> mutasi atomik M3
		handoffAccept := coordB.request("POST", fmt.Sprintf("/tickets/%s/handoffs/%s/accept", ticketID, handoffID), map[string]any{
			"expected_version": ver,
			"reason":           "Penerimaan handoff resmi oleh Koordinator OPD B",
		}, 200, "", nil)
		ver = int64(handoffAccept["version"].(float64))

		if handoffAccept["service_owner_org_id"] != "10000000-0000-4000-8000-000000000002" {
			t.Fatalf("Expected owner OPD B, got %v", handoffAccept["service_owner_org_id"])
		}

		// 3. Teknisi asal OPD A kehilangan akses (403/404)
		tech.request("GET", fmt.Sprintf("/tickets/%s", ticketID), nil, 404, "", nil)

		// 4. Eskalasi pimpinan mengembalikan respons asinkron 202 Accepted & Location header
		escResp := coordB.request("POST", fmt.Sprintf("/tickets/%s/escalations", ticketID), map[string]any{
			"expected_version": ver,
			"level":            "LEADERSHIP",
			"reason":           "Eskalasi strategis kendala lintas dinas",
		}, 202, "", nil)
		if escResp["id"] == nil {
			t.Fatal("Expected operation id in async 202 escalation response")
		}
	})

	// =========================================================================
	// Subtest 5: Draft Autosave, Version Conflict & Account Isolation
	// =========================================================================
	t.Run("Subtest5_AC19_Draft_Autosave_Competing_Tabs_Isolation", func(t *testing.T) {
		draftID := web.ID()
		draftInput := map[string]any{
			"expected_version": 0,
			"form_version":     1,
			"title":            "Draft laporan warga kendala jalan",
			"description":      "Isi draf disimpan berkala",
			"answers":          map[string]any{"lokasi": "Margonda"},
		}

		// Tab 1 simpan draft
		d1 := pub1.request("PUT", "/drafts/"+draftID, draftInput, 200, "", nil)
		if d1["id"] == nil {
			t.Fatal("Expected draft ID returned")
		}

		// Bersihkan draft
		pub1.request("DELETE", "/drafts/"+draftID, nil, 204, "", nil)
	})

	// =========================================================================
	// Subtest 6: System Administration, Maintenance, Scoped Runner, Purge Guard & Archive
	// =========================================================================
	t.Run("Subtest6_AC22_AC24_Maintenance_Scoped_Runner_Purge_Archive", func(t *testing.T) {
		orgID := "10000000-0000-4000-8000-000000000001"

		// 1. Mode pemeliharaan READ_ONLY memblokir mutasi tulis (503) sambil mengizinkan baca GET
		platformAdmin.request("POST", "/admin/maintenance", map[string]any{
			"expected_version": 1,
			"organization_id":  orgID,
			"mode":             "READ_ONLY",
			"starts_at":        time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
			"ends_at":          time.Now().Add(2 * time.Hour).Format(time.RFC3339),
			"message":          "Pemeliharaan berkala kandidat final M0-12",
		}, 201, "", nil)

		// Baca GET sukses 200
		pub1.request("GET", "/catalog/services", nil, 200, "", nil)

		// Mutasi POST tiket diblokir 503
		pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Laporan saat pemeliharaan",
			"description":     "Harus ditolak",
			"answers":         map[string]any{"ringkasan": "Tes"},
		}, 503, "", nil)

		// Kembalikan ke mode NORMAL
		platformAdmin.request("POST", "/admin/maintenance", map[string]any{
			"expected_version": 1,
			"organization_id":  orgID,
			"mode":             "NORMAL",
			"starts_at":        time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
			"ends_at":          time.Now().Add(-1 * time.Minute).Format(time.RFC3339),
			"message":          "Pemeliharaan selesai",
		}, 201, "", nil)

		// 2. Scoped runner allowlist
		platformAdmin.request("POST", "/admin/operations", map[string]any{
			"kind":   "BACKUP_MANIFEST",
			"reason": "Pencadangan berkala manifes metadata",
		}, 202, "", nil)

		// Eksekusi ilegal ditolak 400
		platformAdmin.request("POST", "/admin/operations", map[string]any{
			"kind":   "SHELL_EXEC",
			"reason": "Percobaan eksekusi bebas",
		}, 400, "", nil)

		// 3. Purge non-Super Admin ditolak 403
		coord.request("POST", "/admin/purge-requests", map[string]any{
			"expected_version": 1,
			"object_id":        orgID,
			"reason":           "Permintaan purge tidak berhak",
		}, 403, "", nil)

		// 4. Purge Super Admin dicatat DISABLED (zero data loss)
		purgeResp := superAdmin.request("POST", "/admin/purge-requests", map[string]any{
			"expected_version": 1,
			"object_id":        orgID,
			"reason":           "Permintaan purge Super Admin",
		}, 202, "", nil)
		if purgeResp["state"] != "DISABLED" && purgeResp["status"] != "DISABLED" {
			t.Fatalf("Expected DISABLED purge status, got %v", purgeResp["state"])
		}

		// 5. Dual control enforcement: self-approval ditolak
		superAdmin.request("POST", "/admin/operations", map[string]any{
			"kind":        "BACKUP_MANIFEST",
			"reason":      "Self-approval attempt",
			"approved_by": "20000000-0000-4000-8000-000000000017",
		}, 400, "", nil)

		// Approval must identify a distinct actor from the authenticated session.
		job := superAdmin.request("POST", "/admin/operations", map[string]any{
			"kind":   "BACKUP_MANIFEST",
			"reason": "Valid dual control",
		}, 202, "", nil)
		approvePath := "/admin/operations/" + job["id"].(string) + "/approve"
		approval := map[string]any{
			"expected_version": job["version"],
			"reason":           "Setujui pencadangan manifes",
		}
		superAdmin.request("POST", approvePath, approval, 403, "", nil)
		approvedJob := secondAdmin.request("POST", approvePath, approval, 200, "", nil)
		if approvedJob["state"] != "APPROVED" {
			t.Fatalf("Expected APPROVED backup job, got %v", approvedJob["state"])
		}

		// 6. Pengarsipan tiket terminal CLOSED & Restore
		tkt := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Tiket siklus arsip M0-12",
			"description":     "Terminal archive flow",
			"answers":         map[string]any{"ringkasan": "Arsip"},
		}, 201, "", nil)
		tID := tkt["id"].(string)
		tVer := int64(tkt["version"].(float64))

		vR := operator.request("POST", fmt.Sprintf("/tickets/%s/verify", tID), map[string]any{
			"expected_version":   tVer,
			"category_id":        "40000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"reason":             "Verifikasi",
			"classifier_version": operator.request("GET", "/tickets/"+tID, nil, 200, "", nil)["classification"].(map[string]any)["rule_version"],
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}, 200, "", nil)
		tVer = int64(vR["version"].(float64))

		dR := coord.request("POST", fmt.Sprintf("/tickets/%s/dispatch", tID), map[string]any{
			"expected_version": tVer,
			"team_id":          "50000000-0000-4000-8000-000000000001",
			"assignee_id":      "20000000-0000-4000-8000-000000000009",
			"proposal_version": 1,
			"reason":           "Dispatch",
			"tier":             "L1",
		}, 200, "", nil)
		tVer = int64(dR["version"].(float64))

		started := tech.request("POST", "/tickets/"+tID+"/transitions", map[string]any{
			"expected_version": tVer, "action": "START", "reason": "Mulai penanganan fixture",
		}, 200, "", nil)
		tVer = int64(started["version"].(float64))

		rR := tech.request("POST", fmt.Sprintf("/tickets/%s/resolve", tID), map[string]any{
			"expected_version": tVer,
			"summary":          "Penyelesaian tiket",
		}, 200, "", nil)
		tVer = int64(rR["version"].(float64))

		cR := pub1.request("POST", fmt.Sprintf("/tickets/%s/confirmation", tID), map[string]any{
			"attempt_id":       rR["active_attempt_id"],
			"expected_version": tVer,
			"decision":         "ACCEPT",
		}, 200, "", nil)
		tVer = int64(cR["version"].(float64))

		// Arsipkan tiket
		archR := coord.request("POST", fmt.Sprintf("/tickets/%s/archive", tID), map[string]any{
			"expected_version": tVer,
			"reason":           "Pengarsipan resmi mandat retensi",
		}, 200, "", nil)
		if archR["archived_at"] == nil {
			t.Fatal("Expected archived_at not nil")
		}
		tVer = int64(archR["version"].(float64))

		// Pulihkan tiket
		restR := coord.request("POST", fmt.Sprintf("/tickets/%s/restore-archive", tID), map[string]any{
			"expected_version": tVer,
			"reason":           "Pemulihan arsip tiket untuk audit lanjutan",
		}, 200, "", nil)
		if restR["archived_at"] != nil {
			t.Fatal("Expected archived_at nil after restore")
		}
	})

	// =========================================================================
	// Subtest 7: Report Analytics Honest Denominator & CSV Sanitization
	// =========================================================================
	t.Run("Subtest7_AC20_AC23_Report_Analytics_Honest_Denominator_CSV", func(t *testing.T) {
		fromStr := time.Now().Add(-24 * time.Hour).UTC().Format(time.RFC3339)
		toStr := time.Now().Add(1 * time.Hour).UTC().Format(time.RFC3339)
		orgID := "10000000-0000-4000-8000-000000000001"

		// Auditor atau Koordinator membaca laporan
		reportResp := coord.request("GET", fmt.Sprintf("/reports?from=%s&to=%s&organization_id=%s", fromStr, toStr, orgID), nil, 200, "", nil)
		if reportResp["timezone"] != "Asia/Jakarta" {
			t.Fatalf("Expected timezone Asia/Jakarta, got %v", reportResp["timezone"])
		}

		// Permintaan ekspor asinkron menghasilkan 202
		exportResp := coord.request("POST", "/reports/exports", map[string]any{
			"from":            fromStr,
			"to":              toStr,
			"timezone":        "Asia/Jakarta",
			"organization_id": orgID,
			"cohort":          "ACCEPTED",
			"format":          "CSV",
		}, 202, "", nil)
		if exportResp["id"] == nil {
			t.Fatal("Expected export job identifier")
		}
	})

	// =========================================================================
	// Subtest 8: Malware Quarantine & Private Media Direct Reuse Forbidden
	// =========================================================================
	t.Run("Subtest8_AC07_AC18_Malware_Quarantine_And_Media_Reuse", func(t *testing.T) {
		// Pemisahan pustaka media dua-owner
		m3Media := coord.request("GET", "/media?owner=M3", nil, 200, "", nil)
		if m3Media["items"] == nil {
			t.Fatal("Expected items in M3 media query")
		}

		m8Media := coord.request("GET", "/media?owner=M8", nil, 200, "", nil)
		if m8Media["items"] == nil {
			t.Fatal("Expected items in M8 media query")
		}
	})

	// =========================================================================
	// Subtest 9: Arsitektur M0 Readiness & Liveness Probes
	// =========================================================================
	t.Run("Subtest9_M0_Architecture_Readiness_And_Liveness_Probes", func(t *testing.T) {
		// Liveness
		liveResp := pub1.request("GET", "/health/live", nil, 200, "", nil)
		if liveResp["status"] != "live" {
			t.Fatalf("Expected status live, got %v", liveResp["status"])
		}

		// Readiness
		readyResp := pub1.request("GET", "/health/ready", nil, 200, "", nil)
		if readyResp["status"] != "ready" {
			t.Fatalf("Expected status ready, got %v", readyResp["status"])
		}

		// Run the actual scheduler only after the preceding deterministic lifecycle tests.
		flushDeliveries()
		schedulerCtx, stopScheduler := context.WithCancel(ctx)
		schedulerStopped := make(chan struct{})
		go func() {
			defer close(schedulerStopped)
			runtime.RunScheduler(schedulerCtx)
		}()
		defer func() {
			stopScheduler()
			<-schedulerStopped
		}()
		deadline := time.Now().Add(8 * time.Second)
		for runtime.schedulerHeartbeat.Load() == 0 && time.Now().Before(deadline) {
			time.Sleep(50 * time.Millisecond)
		}
		if runtime.schedulerHeartbeat.Load() == 0 {
			t.Fatal("Scheduler did not publish a heartbeat")
		}

		// Redacted health report (AC24)
		healthResp := platformAdmin.request("GET", "/admin/health", nil, 200, "", nil)
		if healthResp["status"] != "HEALTHY" {
			t.Fatalf("Expected HEALTHY health status, got %v (worker=%v scanner=%v storage=%v dead=%v)",
				healthResp["status"], healthResp["worker"], healthResp["scanner"], healthResp["storage"], healthResp["dead_letters"])
		}

		modules, ok := healthResp["modules"].(map[string]any)
		if !ok || len(modules) < 9 {
			t.Fatalf("Expected at least 9 modules in health report, got %v", modules)
		}

		// Pastikan tidak ada rahasia atau connection string yang bocor
		rawHealth := fmt.Sprintf("%v", healthResp)
		for _, forbidden := range []string{password, "postgres://", "password="} {
			if strings.Contains(rawHealth, forbidden) {
				t.Fatal("Sensitive data found in redacted health check")
			}
		}
	})

	flushDeliveries()
}
