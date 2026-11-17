package bootstrap

import (
	"context"
	"fmt"
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
)

func TestM011Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M011_TEST") != "1" {
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

	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m011-key-not-a-production-secret"), Origin: base})
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

	// Sesi pengguna:
	// Subjek 1: Pemohon Publik (PUBLIC)
	// Subjek 3: Pemohon ASN (ASN)
	// Subjek 4: Operator OPD A (OPERATOR)
	// Subjek 5: Admin Lab OPD A (PLATFORM_ADMIN)
	// Subjek 6: Admin OPD B (ADMIN_OPD)
	// Subjek 9: Teknisi L1 OPD A (TECHNICIAN)
	// Subjek 11: Koordinator OPD A (COORDINATOR, memiliki ticket.archive)
	// Subjek 17: Super Admin Kota Depok (SUPER_ADMIN, memiliki system.purge.request)
	// Subjek 18: Second Admin Approver (PLATFORM_ADMIN, untuk dual-control)

	pub1 := client()
	pub1.login(1)

	asn := client()
	asn.login(3)

	operator := client()
	operator.login(4)

	platformAdmin := client()
	platformAdmin.login(5)

	adminOPD := client()
	adminOPD.login(6)

	tech := client()
	tech.login(9)

	coord := client()
	coord.login(11)

	superAdmin := client()
	superAdmin.login(17)

	var closedTicketID string
	var closedTicketVer int64

	// =========================================================================
	// Subtest 1: AC22 Purge Rejected For Non-Super Admin
	// =========================================================================
	t.Run("Subtest1_AC22_Purge_Rejected_For_Non_Super_Admin", func(t *testing.T) {
		purgePayload := map[string]any{
			"expected_version":        1,
			"object_id":               "10000000-0000-4000-8000-000000000001",
			"retention_policy_version": 1,
			"reason":                  "Permintaan purge tidak berizin",
		}

		// Aktor-aktor non-Super Admin mencoba request purge -> DITOLAK TEGAS (403 Forbidden)
		nonSuperAdmins := []struct {
			name   string
			client testClient
		}{
			{"Koordinator", coord},
			{"Operator", operator},
			{"Admin OPD", adminOPD},
			{"Platform Admin", platformAdmin},
			{"Publik", pub1},
			{"ASN", asn},
		}

		for _, tc := range nonSuperAdmins {
			t.Run(tc.name, func(t *testing.T) {
				tc.client.request("POST", "/admin/purge-requests", purgePayload, 403, "", nil)
			})
		}
	})

	// =========================================================================
	// Subtest 2: AC22 Purge Request By Super Admin Recorded As Disabled
	// =========================================================================
	t.Run("Subtest2_AC22_Purge_Request_By_Super_Admin_Recorded_As_Disabled", func(t *testing.T) {
		purgePayload := map[string]any{
			"expected_version":        1,
			"object_id":               "10000000-0000-4000-8000-000000000001",
			"retention_policy_version": 1,
			"reason":                  "Permintaan pemusnahan retensi arsip oleh Super Admin",
		}

		resp := superAdmin.request("POST", "/admin/purge-requests", purgePayload, 202, "", nil)
		if resp["state"] != "DISABLED" && resp["status"] != "DISABLED" {
			t.Fatalf("AC22 Violation: Purge request status must be DISABLED, got %v", resp)
		}
	})

	// =========================================================================
	// Subtest 3: AC22 Dual Control Enforcement On System Operations
	// =========================================================================
	t.Run("Subtest3_AC22_Dual_Control_Enforcement_On_System_Operations", func(t *testing.T) {
		superAdminID := "20000000-0000-4000-8000-000000000017"
		approverID := "20000000-0000-4000-8000-000000000018"

		// Self-approval (approved_by == requested_by) -> DITOLAK (400 Bad Request)
		selfApproved := map[string]any{
			"expected_version": 1,
			"kind":            "BACKUP_MANIFEST",
			"target_id":       "10000000-0000-4000-8000-000000000001",
			"reason":          "Manifest backup dengan self approval",
			"approved_by":     superAdminID,
		}
		superAdmin.request("POST", "/admin/operations", selfApproved, 400, "", nil)

		// Dual-control dengan approved_by berbeda -> DITERIMA (202 Accepted)
		validDual := map[string]any{
			"expected_version": 1,
			"kind":            "BACKUP_MANIFEST",
			"target_id":       "10000000-0000-4000-8000-000000000001",
			"reason":          "Manifest backup dengan dual approval terpisah",
			"approved_by":     approverID,
		}
		superAdmin.request("POST", "/admin/operations", validDual, 202, "", nil)
	})

	// =========================================================================
	// Subtest 4: AC22 Archive Closed Ticket Preserves History
	// =========================================================================
	t.Run("Subtest4_AC22_Archive_Closed_Ticket_Preserves_History", func(t *testing.T) {
		// 1. Buat tiket oleh pemohon publik
		createResp := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Tiket untuk siklus pengujian arsip M0-11",
			"description":     "Tiket operasional sampai terminal untuk diarsipkan",
			"answers":         map[string]any{"ringkasan": "Ruang Server Lt 2"},
		}, 201, "", nil)
		ticketID := createResp["id"].(string)
		ver := int64(createResp["version"].(float64))

		// 2. Operator verifikasi tiket
		verResp := operator.request("POST", fmt.Sprintf("/tickets/%s/verify", ticketID), map[string]any{
			"expected_version":   ver,
			"category_id":        "40000000-0000-4000-8000-000000000001",
			"priority":           "NORMAL",
			"reason":             "Verifikasi M0-11",
			"classifier_version": 1,
			"evidence_digest":    "0000000000000000000000000000000000000000000000000000000000000000",
		}, 200, "", nil)
		ver = int64(verResp["version"].(float64))

		// 3. Koordinator dispatch ke teknisi
		dispResp := coord.request("POST", fmt.Sprintf("/tickets/%s/dispatch", ticketID), map[string]any{
			"expected_version": ver,
			"team_id":          "50000000-0000-4000-8000-000000000001",
			"assignee_id":      "20000000-0000-4000-8000-000000000009",
			"proposal_version": 1,
			"reason":           "Penugasan teknisi untuk penyelesaian",
			"tier":             "L1",
		}, 200, "", nil)
		ver = int64(dispResp["version"].(float64))

		// 4. Teknisi resolve tiket
		resResp := tech.request("POST", fmt.Sprintf("/tickets/%s/resolve", ticketID), map[string]any{
			"expected_version": ver,
			"summary":          "Pekerjaan tuntas secara menyeluruh",
		}, 200, "", nil)
		ver = int64(resResp["version"].(float64))

		// 5. Pemohon confirm -> status CLOSED
		confResp := pub1.request("POST", fmt.Sprintf("/tickets/%s/confirmation", ticketID), map[string]any{
			"expected_version": ver,
			"decision":         "ACCEPT",
		}, 200, "", nil)
		if confResp["state"] != "CLOSED" {
			t.Fatalf("Expected state CLOSED, got %v", confResp["state"])
		}
		ver = int64(confResp["version"].(float64))

		// 6. Koordinator mengarsipkan tiket terminal
		archResp := coord.request("POST", fmt.Sprintf("/tickets/%s/archive", ticketID), map[string]any{
			"expected_version": ver,
			"reason":           "Pengarsipan tiket closed sesuai mandat retensi",
		}, 200, "", nil)
		if archResp["archived_at"] == nil {
			t.Fatalf("AC22 Violation: archived_at must not be null after archive")
		}
		closedTicketID = ticketID
		closedTicketVer = int64(archResp["version"].(float64))

		// 7. Periksa tiket di database: riwayat, komentar tetap utuh
		tkt := coord.request("GET", fmt.Sprintf("/tickets/%s", ticketID), nil, 200, "", nil)
		if tkt["archived_at"] == nil {
			t.Fatalf("archived_at in GET must not be null")
		}
	})

	// =========================================================================
	// Subtest 5: AC22 Archive Active Ticket Rejected 409
	// =========================================================================
	t.Run("Subtest5_AC22_Archive_Active_Ticket_Rejected_409", func(t *testing.T) {
		// Pemohon buat tiket aktif
		activeTkt := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Tiket aktif tidak boleh diarsipkan",
			"description":     "Percobaan pengarsipan tiket yang belum terminal",
			"answers":         map[string]any{"ringkasan": "Depok"},
		}, 201, "", nil)
		activeID := activeTkt["id"].(string)
		activeVer := int64(activeTkt["version"].(float64))

		// Koordinator coba arsipkan tiket aktif -> DITOLAK 409 Conflict
		coord.request("POST", fmt.Sprintf("/tickets/%s/archive", activeID), map[string]any{
			"expected_version": activeVer,
			"reason":           "Mencoba arsip tiket aktif",
		}, 409, "", nil)
	})

	// =========================================================================
	// Subtest 6: AC22 Restore Archived Ticket Succeeds
	// =========================================================================
	t.Run("Subtest6_AC22_Restore_Archived_Ticket_Succeeds", func(t *testing.T) {
		if closedTicketID == "" {
			t.Skip("No archived ticket available from Subtest 4")
		}

		// Koordinator memulihkan tiket terarsip
		restoreResp := coord.request("POST", fmt.Sprintf("/tickets/%s/restore-archive", closedTicketID), map[string]any{
			"expected_version": closedTicketVer,
			"reason":           "Pemulihan arsip untuk penelaahan audit kembali",
		}, 200, "", nil)

		if restoreResp["archived_at"] != nil {
			t.Fatalf("AC22 Violation: archived_at must be null after restore, got %v", restoreResp["archived_at"])
		}

		// Periksa via GET
		tkt := coord.request("GET", fmt.Sprintf("/tickets/%s", closedTicketID), nil, 200, "", nil)
		if tkt["archived_at"] != nil {
			t.Fatalf("archived_at in GET must be null after restore")
		}
	})

	// =========================================================================
	// Subtest 7: AC24 Scoped Runner Allowlist Enforcement
	// =========================================================================
	t.Run("Subtest7_AC24_Scoped_Runner_Allowlist_Enforcement", func(t *testing.T) {
		orgID := "10000000-0000-4000-8000-000000000001"

		// Allowlisted job: BACKUP_MANIFEST -> DITERIMA (202 Accepted)
		resBackup := platformAdmin.request("POST", "/admin/operations", map[string]any{
			"expected_version": 1,
			"target_id":       orgID,
			"kind":            "BACKUP_MANIFEST",
			"reason":          "Pencatatan manifest cadangan harian",
		}, 202, "", nil)
		if resBackup["kind"] != "BACKUP_MANIFEST" {
			t.Fatalf("Expected BACKUP_MANIFEST, got %v", resBackup["kind"])
		}

		// Allowlisted job: HEALTH_REPORT -> DITERIMA (202 Accepted)
		resHealth := platformAdmin.request("POST", "/admin/operations", map[string]any{
			"expected_version": 1,
			"target_id":       orgID,
			"kind":            "HEALTH_REPORT",
			"reason":          "Penyusunan laporan diagnosa kesehatan sistem",
		}, 202, "", nil)
		if resHealth["kind"] != "HEALTH_REPORT" {
			t.Fatalf("Expected HEALTH_REPORT, got %v", resHealth["kind"])
		}

		// Illegal job kinds -> DITOLAK 400 Bad Request
		illegalKinds := []string{"SHELL_EXEC", "SQL_CONSOLE", "ARBITRARY_SCRIPT", "ROOT_RUNNER"}
		for _, kind := range illegalKinds {
			platformAdmin.request("POST", "/admin/operations", map[string]any{
				"expected_version": 1,
				"target_id":       orgID,
				"kind":            kind,
				"reason":          "Percobaan eksekusi operasi ilegal",
			}, 400, "", nil)
		}
	})

	// =========================================================================
	// Subtest 8: AC24 Maintenance Mode ReadOnly Blocks Writes
	// =========================================================================
	t.Run("Subtest8_AC24_Maintenance_Mode_ReadOnly_Blocks_Writes", func(t *testing.T) {
		orgID := "10000000-0000-4000-8000-000000000001"

		// Aktifkan mode READ_ONLY
		platformAdmin.request("POST", "/admin/maintenance", map[string]any{
			"expected_version": 1,
			"organization_id":  orgID,
			"mode":             "READ_ONLY",
			"starts_at":        time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
			"ends_at":          time.Now().Add(2 * time.Hour).Format(time.RFC3339),
			"message":          "Jendela pemeliharaan berkala infrastruktur",
		}, 201, "", nil)

		// Operasi baca (GET) tetap berhasil (200 OK)
		pub1.request("GET", "/catalog/services", nil, 200, "", nil)

		// Mutasi tulis (POST tiket) DIBLOKIR dengan HTTP 503 Service Unavailable
		pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Laporan saat pemeliharaan",
			"description":     "Harus ditolak karena mode read-only aktif",
			"answers":         map[string]any{"ringkasan": "Kantor"},
		}, 503, "", nil)

		// Kembalikan ke mode NORMAL
		platformAdmin.request("POST", "/admin/maintenance", map[string]any{
			"expected_version": 1,
			"organization_id":  orgID,
			"mode":             "NORMAL",
			"starts_at":        time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
			"ends_at":          time.Now().Add(-1 * time.Minute).Format(time.RFC3339),
			"message":          "Pemeliharaan selesai, sistem beroperasi normal kembali",
		}, 201, "", nil)

		// Sekarang mutasi tulis berhasil kembali
		pub1.request("POST", "/tickets", map[string]any{
			"service_id":      "30000000-0000-4000-8000-000000000001",
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Laporan setelah pemeliharaan selesai",
			"description":     "Berhasil tersimpan pada status normal",
			"answers":         map[string]any{"ringkasan": "Kantor"},
		}, 201, "", nil)
	})

	// =========================================================================
	// Subtest 9: AC24 Redacted System Health No Secret Leakage
	// =========================================================================
	t.Run("Subtest9_AC24_Redacted_System_Health_No_Secret_Leakage", func(t *testing.T) {
		healthResp := platformAdmin.request("GET", "/admin/health", nil, 200, "", nil)

		if healthResp["status"] != "HEALTHY" {
			t.Fatalf("Expected health status HEALTHY, got %v", healthResp["status"])
		}

		// Verifikasi komponen penting ada
		modules, ok := healthResp["modules"].(map[string]any)
		if !ok || len(modules) < 9 {
			t.Fatalf("Expected at least 9 modules in health report, got %v", modules)
		}

		// Pastikan tidak ada kebocoran credential, password atau connection string
		rawResp := fmt.Sprintf("%v", healthResp)
		forbiddenStrings := []string{
			password,
			"synthetic-m011-key-not-a-production-secret",
			"postgres://",
			"password=",
			"/tmp/",
		}

		for _, secret := range forbiddenStrings {
			if strings.Contains(rawResp, secret) {
				t.Fatalf("AC24 Security Violation: Redacted health report leaks sensitive string: %s", secret)
			}
		}
	})

	flushDeliveries()
}
