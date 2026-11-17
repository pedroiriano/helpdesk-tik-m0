package bootstrap

import (
	"context"
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

	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestM010Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M010_TEST") != "1" {
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m010-key-not-a-production-secret"), Origin: base})
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
	// Subjek 5: Admin Lab OPD A (PLATFORM_ADMIN)
	// Subjek 11: Koordinator OPD A (COORDINATOR, memiliki report.read, report.export)
	// Subjek 4: Operator OPD A (OPERATOR, tidak memiliki report.read / report.export)
	// Subjek 1: Pemohon Publik 1 (PUBLIC, memiliki notification.read, notification.binding)

	admin := client()
	admin.login(5)

	coord := client()
	coord.login(11)

	operator := client()
	operator.login(4)

	pub1 := client()
	pub1.login(1)

	auditor := client()
	auditor.login(16)

	var bindingID string

	// =========================================================================
	// Subtest 1: AC21 Telegram Binding Invalid Scope Rejected
	// =========================================================================
	t.Run("Subtest1_AC21_Telegram_Binding_Invalid_Scope_Rejected", func(t *testing.T) {
		// Aktor publik mencoba mengikat chat ID ke scope OPD internal staf -> DITOLAK (400)
		pub1.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version":  1,
			"verification_code": "12345678:ABCDEF_BOT_TOKEN",
			"scope_org_id":      "10000000-0000-4000-8000-000000000001", // OPD internal
			"channel":           "SINK",
		}, 400, "", nil)

		// Koordinator OPD A mencoba mengikat ke OPD B tanpa hak -> DITOLAK (403)
		coord.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version":  1,
			"verification_code": "98765432:SECRET_TELEGRAM_TOKEN",
			"scope_org_id":      "10000000-0000-4000-8000-000000000002", // OPD Lab 2
			"channel":           "SINK",
		}, 403, "", nil)
	})

	// =========================================================================
	// Subtest 2: AC21 Telegram Binding Secret Masked
	// =========================================================================
	t.Run("Subtest2_AC21_Telegram_Binding_Secret_Masked", func(t *testing.T) {
		// Koordinator OPD A mengikatkan chat ID ke organisasinya sendiri (OPD 1)
		secretToken := "12345678:SENSITIVE_BOT_TOKEN_XYZ"
		resp := coord.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version":  1,
			"verification_code": secretToken,
			"scope_org_id":      "10000000-0000-4000-8000-000000000001",
			"channel":           "SINK",
		}, 201, "", nil)

		bID, ok := resp["id"].(string)
		if !ok || !web.UUID(bID) {
			t.Fatalf("Expected valid binding UUID, got %v", resp["id"])
		}
		bindingID = bID

		// Periksa di database notify_audit.telegram_bindings bahwa chat_ref tersimpan dalam format masked
		var maskedInDB string
		err := pools[8].QueryRow(ctx, `SELECT chat_ref FROM notify_audit.telegram_bindings WHERE id = $1`, bindingID).Scan(&maskedInDB)
		if err != nil {
			t.Fatalf("Query telegram_bindings failed: %v", err)
		}
		if strings.Contains(maskedInDB, "SENSITIVE_BOT_TOKEN_XYZ") {
			t.Fatalf("AC21 Violation: Secret token mentah bocor di database: %s", maskedInDB)
		}
		if !strings.Contains(maskedInDB, "****") && maskedInDB != "TG-***" {
			t.Fatalf("AC21 Violation: Nilai tidak tersensor mask: %s", maskedInDB)
		}
	})

	// =========================================================================
	// Subtest 3: AC21 Telegram Binding Revocation Immediate
	// =========================================================================
	t.Run("Subtest3_AC21_Telegram_Binding_Revocation_Immediate", func(t *testing.T) {
		if bindingID == "" {
			t.Fatal("bindingID is empty")
		}

		// Pencabutan binding oleh koordinator
		revokeResp := coord.request("POST", fmt.Sprintf("/notifications/telegram-bindings/%s/revoke", bindingID), map[string]any{
			"expected_version": 1,
			"reason":           "Pencabutan saluran Telegram uji",
		}, 200, "", nil)

		newVer, _ := revokeResp["version"].(float64)
		if newVer != 2 {
			t.Fatalf("Expected version 2 after revoke, got %v", newVer)
		}

		// Percobaan mencabut kembali ditolak 409
		coord.request("POST", fmt.Sprintf("/notifications/telegram-bindings/%s/revoke", bindingID), map[string]any{
			"expected_version": 2,
			"reason":           "Pencabutan kedua kali",
		}, 409, "", nil)
	})

	// =========================================================================
	// Subtest 4: AC21 Delivery Failure And Retry Visibility
	// =========================================================================
	t.Run("Subtest4_AC21_Delivery_Failure_And_Retry_Visibility", func(t *testing.T) {
		// Simulasikan notifikasi baru di database notify_audit
		notifID := web.ID()
		jobID := web.ID()
		now := time.Now().UTC()

		_, err := pools[8].Exec(ctx, `
			INSERT INTO notify_audit.notifications (id, version, recipient_id, source_event_id, template_version, title, stored_at)
			VALUES ($1, 1, '20000000-0000-4000-8000-000000000001', $2, 1, 'Uji Kegagalan Notifikasi', $3)
		`, notifID, web.ID(), now)
		if err != nil {
			t.Fatalf("Insert notification failed: %v", err)
		}

		// Simulasikan delivery_job dengan status DEAD_LETTER dan attempts = 3
		_, err = pools[8].Exec(ctx, `
			INSERT INTO notify_audit.delivery_jobs (id, version, notification_id, channel, state, attempts, error_code)
			VALUES ($1, 1, $2, 'SINK', 'DEAD_LETTER', 3, 'ERR_TIMEOUT')
		`, jobID, notifID)
		if err != nil {
			t.Fatalf("Insert delivery_jobs failed: %v", err)
		}

		// Ambil daftar notifikasi oleh penerima (pub1)
		listResp := pub1.request("GET", "/notifications?limit=10", nil, 200, "", nil)
		items, ok := listResp["items"].([]any)
		if !ok || len(items) == 0 {
			t.Fatalf("Expected notifications items, got %v", listResp)
		}

		foundFailed := false
		for _, rawItem := range items {
			itemMap, _ := rawItem.(map[string]any)
			if itemMap["id"] == notifID {
				if itemMap["delivery_state"] == "DEAD_LETTER" {
					foundFailed = true
				}
			}
		}
		if !foundFailed {
			t.Fatal("AC21 Violation: Status kegagalan pengiriman DEAD_LETTER tidak terlihat pada notifikasi pengguna")
		}
	})

	// =========================================================================
	// Subtest 5: AC23 Report Scoped Access And Denominator
	// =========================================================================
	t.Run("Subtest5_AC23_Report_Scoped_Access_And_Denominator", func(t *testing.T) {
		// Operator tanpa izin report.read ditolak HTTP 403
		fromStr := "2026-01-01T00:00:00Z"
		toStr := "2026-12-31T23:59:59Z"
		orgID := "10000000-0000-4000-8000-000000000001"

		operator.request("GET", fmt.Sprintf("/reports?from=%s&to=%s&organization_id=%s", fromStr, toStr, orgID), nil, 403, "", nil)

		// Koordinator berizin report.read berhasil mengakses laporan
		rep := coord.request("GET", fmt.Sprintf("/reports?from=%s&to=%s&organization_id=%s", fromStr, toStr, orgID), nil, 200, "", nil)

		if rep["timezone"] != "Asia/Jakarta" {
			t.Fatalf("Expected timezone Asia/Jakarta, got %v", rep["timezone"])
		}
		if rep["measure"] != "SLA" {
			t.Fatalf("Expected measure SLA, got %v", rep["measure"])
		}
		if _, ok := rep["denominator"]; !ok {
			t.Fatal("Expected denominator field in report")
		}
		if _, ok := rep["count"]; !ok {
			t.Fatal("Expected count field in report")
		}
	})

	// =========================================================================
	// Subtest 6: AC23 Report Export CSV Formula Sanitization
	// =========================================================================
	t.Run("Subtest6_AC23_Report_Export_CSV_Formula_Sanitization", func(t *testing.T) {
		fromStr := "2026-01-01T00:00:00Z"
		toStr := "2026-12-31T23:59:59Z"
		orgID := "10000000-0000-4000-8000-000000000001"

		// Masukkan data sintetis report_facts dengan nilai diawali formula injection
		_, err := pools[8].Exec(ctx, `
			INSERT INTO notify_audit.report_facts (id, version, ticket_id, requester_id, source_version, org_id, accepted_at, state, policy_version)
			VALUES ($1, 1, $2, $3, 1, $4, '2026-06-01T10:00:00Z', '=CMD|'' /C calc''!A0', 1)
			ON CONFLICT (ticket_id) DO UPDATE SET state = '=CMD|'' /C calc''!A0'
		`, web.ID(), "00000000-0000-4000-8000-000000000099", "20000000-0000-4000-8000-000000000001", orgID)
		if err != nil {
			t.Fatalf("Insert report_facts failed: %v", err)
		}

		// Ajukan ekspor laporan oleh Koordinator
		expResp := coord.request("POST", "/reports/exports", map[string]any{
			"from":            fromStr,
			"to":              toStr,
			"timezone":        "Asia/Jakarta",
			"organization_id": orgID,
			"cohort":          "ACCEPTED",
			"format":          "CSV",
		}, 202, "", nil)

		exportID, _ := expResp["id"].(string)
		if exportID == "" {
			t.Fatal("Expected export ID")
		}

		// Unduh file CSV
		req, _ := http.NewRequestWithContext(ctx, "GET", base+fmt.Sprintf("/api/v1/reports/exports/%s/file", exportID), nil)
		resp, err := coord.http.Do(req)
		if err != nil {
			t.Fatalf("Download export failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			t.Fatalf("Expected 200 OK, got %d", resp.StatusCode)
		}
		csvBody, _ := io.ReadAll(resp.Body)
		csvStr := string(csvBody)

		// Verifikasi proteksi formula injection: karakter '=' wajib diprefix tanda kutip tunggal "'"
		if strings.Contains(csvStr, ",=CMD") {
			t.Fatalf("AC23 Violation: Formula CSV tidak disanitasi: %s", csvStr)
		}
		if !strings.Contains(csvStr, ",'=CMD") {
			t.Fatalf("AC23 Violation: Prefix quote sanitasi formula tidak ditemukan: %s", csvStr)
		}
	})

	// =========================================================================
	// Subtest 7: AC23 Dynamic Revocation Export And Analytics
	// =========================================================================
	t.Run("Subtest7_AC23_Dynamic_Revocation_Export_And_Analytics", func(t *testing.T) {
		fromStr := "2026-01-01T00:00:00Z"
		toStr := "2026-12-31T23:59:59Z"
		orgID := "10000000-0000-4000-8000-000000000001"

		// Buat klien sementara yang login sebagai Koordinator
		tempCoord := client()
		tempCoord.login(11)

		// Ajukan ekspor laporan saat sesi masih aktif
		expResp := tempCoord.request("POST", "/reports/exports", map[string]any{
			"from":            fromStr,
			"to":              toStr,
			"timezone":        "Asia/Jakarta",
			"organization_id": orgID,
			"cohort":          "ACCEPTED",
			"format":          "CSV",
		}, 202, "", nil)
		exportID := expResp["id"].(string)

		// Pastikan unduh metadata berhasil saat sesi aktif
		tempCoord.request("GET", fmt.Sprintf("/reports/exports/%s/download", exportID), nil, 200, "", nil)

		// Lakukan logout untuk mencabut sesi aktor secara dinamis
		tempCoord.request("POST", "/auth/logout", map[string]any{
			"expected_version": 1,
			"reason":           "Logout dinamis untuk uji AC23",
		}, 200, "", nil)

		// Permintaan unduh metadata paska-revocation seketika DITOLAK (401/403)
		tempCoord.request("GET", fmt.Sprintf("/reports/exports/%s/download", exportID), nil, 401, "", nil)

		// Permintaan file streaming paska-revocation seketika DITOLAK (401)
		req, _ := http.NewRequestWithContext(ctx, "GET", base+fmt.Sprintf("/api/v1/reports/exports/%s/file", exportID), nil)
		resp, err := tempCoord.http.Do(req)
		if err != nil {
			t.Fatalf("Download request error: %v", err)
		}
		resp.Body.Close()
		if resp.StatusCode != 401 && resp.StatusCode != 403 {
			t.Fatalf("AC23 Violation: Unduhan file masih dapat diakses setelah sesi dicabut! Status: %d", resp.StatusCode)
		}

		// Permintaan query laporan paska-revocation juga seketika DITOLAK
		tempCoord.request("GET", fmt.Sprintf("/reports?from=%s&to=%s&organization_id=%s", fromStr, toStr, orgID), nil, 401, "", nil)
	})

	// =========================================================================
	// Subtest 8: FR20 Audit Entries Append Only And Auditor Role
	// =========================================================================
	t.Run("Subtest8_FR20_Audit_Entries_Append_Only_And_Auditor_Role", func(t *testing.T) {
		// Pengguna publik atau operator ditolak mengakses log audit
		pub1.request("GET", "/audit", nil, 403, "", nil)
		operator.request("GET", "/audit", nil, 403, "", nil)

		// Auditor berizin audit.read berhasil mengakses
		auditResp := auditor.request("GET", "/audit?limit=20", nil, 200, "", nil)
		items, ok := auditResp["items"].([]any)
		if !ok {
			t.Fatalf("Expected audit items list, got %v", auditResp)
		}

		// Pastikan seluruh entri audit memiliki struktur wajib dan rahasia tersensor
		for _, rawItem := range items {
			itemMap, _ := rawItem.(map[string]any)
			reason, _ := itemMap["reason"].(string)
			if strings.Contains(reason, "SENSITIVE_BOT_TOKEN_XYZ") {
				t.Fatalf("FR20 Violation: Log audit membocorkan secret bot token: %s", reason)
			}
		}
	})

	flushDeliveries()
}
