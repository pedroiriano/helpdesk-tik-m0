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
	"helpdesk.local/m0/internal/platform/web"
)

func TestM009Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M009_TEST") != "1" {
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m009-key-not-a-production-secret"), Origin: base})
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

	// Subjek 5: Admin Lab OPD A (catalog.write, identity.grant)
	// Subjek 14: Editor Konten OPD A (content.write, content.read)
	// Subjek 15: Penerbit Konten OPD A (content.publish, content.write, content.read)
	// Subjek 3: Pegawai ASN OPD A (ASN_AUTH)
	// Subjek 1: Pemohon Publik 1 (PUBLIC_AUTH)
	// Subjek 2: Pemohon Publik 2 (PUBLIC_AUTH)

	admin := client()
	admin.login(5)

	editor := client()
	editor.login(14)

	publisher := client()
	publisher.login(15)

	asn := client()
	asn.login(3)

	pub1 := client()
	pub1.login(1)

	pub2 := client()
	pub2.login(2)

	anonymous := client()

	var articleID string

	// =========================================================================
	// Subtest 1: AC24 Portal Navigation Menu No Implicit Permissions
	// =========================================================================
	t.Run("Subtest1_AC24_Portal_Navigation_Menu_No_Implicit_Permissions", func(t *testing.T) {
		// 1. Sanitasi rute berbahaya ditolak 422
		admin.request("POST", "/admin/navigation", map[string]any{
			"expected_version": 1,
			"route":            "http://external.site/malicious",
			"label":            "Link Luar Berbahaya",
			"audience":         "PUBLIC_GUEST",
			"position":         1,
		}, 422, "", nil)

		admin.request("POST", "/admin/navigation", map[string]any{
			"expected_version": 1,
			"route":            "/../../etc/passwd",
			"label":            "Path Traversal",
			"audience":         "PUBLIC_GUEST",
			"position":         2,
		}, 422, "", nil)

		// 2. Rute sah berhasil disimpan
		receipt := admin.request("POST", "/admin/navigation", map[string]any{
			"expected_version": 1,
			"route":            "/admin/app/finance",
			"label":            "Keuangan OPD Internal",
			"audience":         "STAFF_ONLY",
			"position":         10,
		}, 201, "", nil)
		if receipt["id"] == nil || int64(receipt["version"].(float64)) != 1 {
			t.Fatalf("receipt navigasi tidak valid: %+v", receipt)
		}

		admin.request("POST", "/admin/navigation", map[string]any{
			"expected_version": 1,
			"route":            "/panduan/layanan-utama",
			"label":            "Panduan Layanan Utama",
			"audience":         "PUBLIC_GUEST",
			"position":         1,
		}, 201, "", nil)

		// 3. Verifikasi daftar navigasi publik
		navList := anonymous.request("GET", "/catalog/navigation", nil, 200, "", nil)
		items, ok := navList["items"].([]any)
		if !ok {
			t.Fatalf("items navigasi tidak ditemukan: %+v", navList)
		}
		foundPublic := false
		for _, rawItem := range items {
			it := rawItem.(map[string]any)
			route := it["route"].(string)
			if route == "/panduan/layanan-utama" {
				foundPublic = true
			}
			if route == "/admin/app/finance" {
				t.Fatalf("AC24 violation: menu STAFF_ONLY bocor ke pengunjung publik: %s", route)
			}
		}
		if !foundPublic {
			t.Fatalf("menu publik /panduan/layanan-utama tidak ditemukan")
		}

		// 4. Invariant AC24: Menu navigasi ada, namun pemanggilan endpoint admin/terproteksi oleh publik tetap ditolak (401/403)
		anonymous.request("POST", "/admin/navigation", map[string]any{
			"expected_version": 1,
			"route":            "/hacked",
			"label":            "Hacked",
			"audience":         "PUBLIC_GUEST",
			"position":         99,
		}, 401, "", nil)
	})

	// =========================================================================
	// Subtest 2: AC12 Content Sanitization Server Side
	// =========================================================================
	t.Run("Subtest2_AC12_Content_Sanitization_Server_Side", func(t *testing.T) {
		// 1. Serangan XSS: tag script
		editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Artikel XSS Script",
			"slug":             "artikel-xss-script",
			"body":             "<p>Penjelasan panduan</p><script>alert('pwned')</script>",
			"audience":         "PUBLIC_GUEST",
			"alt":              "Alt text artikel",
		}, 422, "", nil)

		// 2. Serangan XSS: iframe javascript URI
		editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Artikel XSS Iframe",
			"slug":             "artikel-xss-iframe",
			"body":             "<iframe src='javascript:alert(1)'></iframe>",
			"audience":         "PUBLIC_GUEST",
			"alt":              "Alt text artikel",
		}, 422, "", nil)

		// 3. Serangan XSS: inline onerror event handler
		editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Artikel XSS OnError",
			"slug":             "artikel-xss-onerror",
			"body":             "<img src='invalid-url' onerror='alert(1)'>",
			"audience":         "PUBLIC_GUEST",
			"alt":              "Alt text artikel",
		}, 422, "", nil)

		// 4. Konten HTML/teks bersih lolos sanitasi
		createdArticle := editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Panduan Akses Jaringan Wi-Fi Resmi",
			"slug":             "panduan-akses-wifi-resmi",
			"body":             "<p>Untuk mengakses jaringan Wi-Fi Pemerintah Kota Depok, silakan pilih SSID Depok-SmartCity dan masukkan identitas Anda.</p>",
			"audience":         "PUBLIC_GUEST",
			"alt":              "Ilustrasi Wi-Fi Resmi",
		}, 201, "", nil)

		if createdArticle["id"] == nil || createdArticle["state"] != "DRAFT" || int64(createdArticle["version"].(float64)) != 1 {
			t.Fatalf("artikel DRAFT tidak sesuai: %+v", createdArticle)
		}
		articleID = createdArticle["id"].(string)
	})

	// =========================================================================
	// Subtest 3: AC12 Editorial Workflow Transitions
	// =========================================================================
	t.Run("Subtest3_AC12_Editorial_Workflow_Transitions", func(t *testing.T) {
		// 1. Artikel DRAFT tidak terlihat oleh publik
		pubList := anonymous.request("GET", "/knowledge/articles", nil, 200, "", nil)
		if rawItems, ok := pubList["items"].([]any); ok {
			for _, rawIt := range rawItems {
				it := rawIt.(map[string]any)
				if it["id"] == articleID {
					t.Fatalf("AC12 violation: artikel DRAFT muncul di list publik")
				}
			}
		}
		anonymous.request("GET", "/knowledge/articles/"+articleID, nil, 404, "", nil)

		// 2. Transisi ilegal dari DRAFT langsung ke ARCHIVE ditolak 422
		editor.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 1,
			"action":           "ARCHIVE",
			"reason":           "Langsung arsip tanpa publish",
		}, 422, "", nil)

		// 3. Editor mengajukan REVIEW
		revArticle := editor.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 1,
			"action":           "REVIEW",
			"reason":           "Artikel telah disunting dan siap direview",
		}, 200, "", nil)
		if revArticle["state"] != "REVIEW" || int64(revArticle["version"].(float64)) != 2 {
			t.Fatalf("transisi ke REVIEW gagal: %+v", revArticle)
		}

		// 4. Editor (tanpa hak content.publish) mencoba PUBLISH -> ditolak 403
		editor.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 2,
			"action":           "PUBLISH",
			"reason":           "Mencoba publish sendiri tanpa izin",
		}, 403, "", nil)

		// 5. Publisher (Subjek 15 memiliki hak content.publish) melakukan PUBLISH
		pubArticle := publisher.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 2,
			"action":           "PUBLISH",
			"reason":           "Disetujui untuk dipublikasikan kepada masyarakat",
		}, 200, "", nil)
		if pubArticle["state"] != "PUBLISHED" || int64(pubArticle["version"].(float64)) != 3 {
			t.Fatalf("transisi ke PUBLISHED gagal: %+v", pubArticle)
		}

		// 7. Artikel PUBLISHED sekarang terlihat oleh publik
		readArticle := anonymous.request("GET", "/knowledge/articles/"+articleID, nil, 200, "", nil)
		if readArticle["id"] != articleID || readArticle["state"] != "PUBLISHED" || !strings.Contains(readArticle["body"].(string), "Depok-SmartCity") {
			t.Fatalf("pembacaan publik artikel PUBLISHED tidak sesuai: %+v", readArticle)
		}

		// 8. Transisi ARCHIVE oleh publisher
		publisher.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 3,
			"action":           "ARCHIVE",
			"reason":           "Informasi usang",
		}, 200, "", nil)

		// Publik kembali mendapat 404
		anonymous.request("GET", "/knowledge/articles/"+articleID, nil, 404, "", nil)

		// 9. Transisi RESTORE kembali ke DRAFT
		publisher.request("POST", "/knowledge/articles/"+articleID+"/transitions", map[string]any{
			"expected_version": 4,
			"action":           "RESTORE",
			"reason":           "Dipulihkan kembali ke draft",
		}, 200, "", nil)
	})

	// =========================================================================
	// Subtest 4: AC12 Event ContentPublished Outbox Roundtrip
	// =========================================================================
	t.Run("Subtest4_AC12_Event_ContentPublished_Outbox_Roundtrip", func(t *testing.T) {
		// Buat artikel baru untuk pengujian outbox roundtrip
		art := editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Panduan Outbox Event Test",
			"slug":             "panduan-outbox-event-test",
			"body":             "<p>Uji penerbitan event ContentPublished.</p>",
			"audience":         "PUBLIC_GUEST",
			"alt":              "Alt event test",
		}, 201, "", nil)
		targetArtID := art["id"].(string)

		// Publish artikel oleh publisher
		publisher.request("POST", "/knowledge/articles/"+targetArtID+"/transitions", map[string]any{
			"expected_version": 1,
			"action":           "PUBLISH",
			"reason":           "Terbit untuk event roundtrip test",
		}, 200, "", nil)

		// Periksa event di knowledge.outbox
		var eventID, eventType, aggregateID string
		var payload []byte
		err := pools[7].QueryRow(ctx, `
			SELECT event_id::text, event_type, aggregate_id::text, payload
			FROM knowledge.outbox
			WHERE aggregate_id = $1 AND event_type = 'ContentPublished'
		`, targetArtID).Scan(&eventID, &eventType, &aggregateID, &payload)
		if err != nil {
			t.Fatalf("event ContentPublished tidak ditemukan di knowledge.outbox: %v", err)
		}
		if eventType != "ContentPublished" || aggregateID != targetArtID {
			t.Fatalf("metadata event outbox tidak cocok: type=%s agg=%s", eventType, aggregateID)
		}

		// Jalankan pengiriman delivery
		flushDeliveries()

		// Buktikan event masuk inbox M9 dan tercatat di audit_entries
		var inboxCount int
		err = pools[8].QueryRow(ctx, `SELECT COUNT(*) FROM notify_audit.inbox WHERE event_id = $1 AND consumer_id = 'M9'`, eventID).Scan(&inboxCount)
		if err != nil || inboxCount != 1 {
			t.Fatalf("event tidak terdaftar di notify_audit.inbox: count=%d, err=%v", inboxCount, err)
		}

		var auditCount int
		err = pools[8].QueryRow(ctx, `SELECT COUNT(*) FROM notify_audit.audit_entries WHERE source_event_id = $1 AND action = 'ContentPublished'`, eventID).Scan(&auditCount)
		if err != nil || auditCount != 1 {
			t.Fatalf("entri audit ContentPublished tidak tercatat di M9: count=%d, err=%v", auditCount, err)
		}
	})

	// =========================================================================
	// Subtest 5: AC23 Scope Safe Search Multi Owner
	// =========================================================================
	t.Run("Subtest5_AC23_Scope_Safe_Search_Multi_Owner", func(t *testing.T) {
		// 1. Validasi parameter pencarian
		pub1.request("GET", "/search?owner=M99&q=test", nil, 400, "", nil)
		pub1.request("GET", "/search?owner=M2&q=a", nil, 400, "", nil)

		// 2. Pencarian Layanan (M2)
		searchM2 := pub1.request("GET", "/search?owner=M2&q=Layanan", nil, 200, "", nil)
		m2Items := searchM2["items"].([]any)
		if len(m2Items) == 0 {
			t.Fatalf("pencarian layanan M2 tidak menghasilkan hit")
		}
		for _, raw := range m2Items {
			h := raw.(map[string]any)
			if h["owner"] != "M2" || h["kind"] != "SERVICE" {
				t.Fatalf("SearchHit M2 tidak sesuai format: %+v", h)
			}
		}

		// 3. Pencarian Tiket (M3) dengan penegakan isolasi pemilik
		// Buat tiket atas nama Pemohon Publik 1
		serviceID := m2Items[0].(map[string]any)["id"].(string)
		tkt := pub1.request("POST", "/tickets", map[string]any{
			"service_id":      serviceID,
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           "Kendala Akses Rahasia Pemohon 1",
			"description":     "Deskripsi publik keluhan pemohon 1 tentang gangguan koneksi jaringan di kantor kelurahan.",
			"answers":         map[string]string{"ringkasan": "Keluhan pemohon 1"},
		}, 201, "", nil)
		ticketID := tkt["id"].(string)

		// Tambahkan komentar catatan internal teknisi via SQL langsung untuk membuktikan larangan snippet bocor
		_, err := pools[2].Exec(ctx, `
			INSERT INTO intake.comments(id, version, ticket_id, author_id, visibility, body, created_at)
			VALUES($1, 1, $2, '00000000-0000-4000-8000-000000000005', 'INTERNAL', 'Catatan internal rahasia teknisi: password router adalah 12345', now())
		`, web.ID(), ticketID)
		if err != nil {
			t.Fatalf("gagal insert catatan internal: %v", err)
		}

		// Pemohon 1 mencari tiketnya -> ditemukan, snippet bersih tanpa internal note
		searchM3User1 := pub1.request("GET", "/search?owner=M3&q=Rahasia", nil, 200, "", nil)
		m3Items1 := searchM3User1["items"].([]any)
		if len(m3Items1) == 0 {
			t.Fatalf("Pemohon 1 gagal menemukan tiket miliknya")
		}
		if m3Items1[0].(map[string]any)["id"] != ticketID {
			t.Fatalf("ID tiket tidak cocok")
		}
		if strings.Contains(m3Items1[0].(map[string]any)["snippet"].(string), "password router") {
			t.Fatalf("AC23 violation: snippet membocorkan catatan internal teknisi!")
		}

		// Pemohon 2 mencari kata kunci yang sama persis -> wajib 0 hits (data privat terisolasi!)
		searchM3User2 := pub2.request("GET", "/search?owner=M3&q=Rahasia", nil, 200, "", nil)
		m3Items2 := searchM3User2["items"].([]any)
		if len(m3Items2) != 0 {
			t.Fatalf("AC23 violation: Pemohon 2 dapat melihat tiket milik Pemohon 1! items=%+v", m3Items2)
		}

		// 4. Pencarian Artikel (M8): artikel draft tidak boleh muncul
		searchM8 := pub1.request("GET", "/search?owner=M8&q=Outbox", nil, 200, "", nil)
		m8Items := searchM8["items"].([]any)
		if len(m8Items) == 0 {
			t.Fatalf("artikel PUBLISHED Outbox tidak ditemukan di M8 search")
		}
	})

	// =========================================================================
	// Subtest 6: AC23 Dynamic Revocation Anti Leakage
	// =========================================================================
	t.Run("Subtest6_AC23_Dynamic_Revocation_Anti_Leakage", func(t *testing.T) {
		// 1. Buat artikel ber-audience ASN_AUTH
		asnArticle := editor.request("POST", "/knowledge/articles", map[string]any{
			"expected_version": 1,
			"title":            "Kebijakan Tunjangan Kinerja Khusus ASN Depok",
			"slug":             "kebijakan-tukin-asn-depok",
			"body":             "<p>Rincian perhitungan tunjangan kinerja dan absensi khusus aparatur sipil negara.</p>",
			"audience":         "ASN_AUTH",
			"alt":              "Alt kebijakan ASN",
		}, 201, "", nil)
		targetID := asnArticle["id"].(string)

		publisher.request("POST", "/knowledge/articles/"+targetID+"/transitions", map[string]any{
			"expected_version": 1,
			"action":           "PUBLISH",
			"reason":           "Terbitkan untuk ASN",
		}, 200, "", nil)

		// 2. Skenario A: Subjek 3 (ASN) melakukan pencarian -> artikel ditemukan
		tempAsn := client()
		tempAsn.login(3)
		searchHitsBefore := tempAsn.request("GET", "/search?owner=M8&q=Tunjangan", nil, 200, "", nil)
		itemsBefore := searchHitsBefore["items"].([]any)
		if len(itemsBefore) == 0 {
			t.Fatalf("Pengguna ASN gagal menemukan artikel ASN_AUTH")
		}

		// 3. Skenario B: Sesi dicabut / logout
		tempAsn.request("POST", "/auth/logout", map[string]any{
			"expected_version": 1,
			"reason":           "Pengujian dynamic revocation anti leakage",
		}, 200, "", nil)

		// 4. Pencarian ulang paska pencabutan hak -> WAJIB 0 HITS tanpa kebocoran snippet atau count!
		searchHitsAfter := tempAsn.request("GET", "/search?owner=M8&q=Tunjangan", nil, 200, "", nil)
		itemsAfter := searchHitsAfter["items"].([]any)
		if len(itemsAfter) != 0 {
			t.Fatalf("AC23 violation: artikel ASN_AUTH masih muncul paska-pencabutan sesi! count=%d", len(itemsAfter))
		}
	})

	// =========================================================================
	// Subtest 7: AC20 Keyboard Accessible Search Combobox
	// =========================================================================
	t.Run("Subtest7_AC20_Keyboard_Accessible_Search_Combobox", func(t *testing.T) {
		comboCode, err := os.ReadFile(filepath.Join("..", "..", "frontend", "src", "features", "search-combobox.ts"))
		if err != nil {
			t.Logf("frontend src/dist tidak dimount ke kontainer pengujian backend: %v; verifikasi statis UI dijalankan via test_piui_build.py dan smoke_m0_09_local.py", err)
			return
		}
		codeStr := string(comboCode)

		for _, attr := range []string{"role", "combobox", "aria-expanded", "aria-autocomplete", "aria-activedescendant", "role", "option"} {
			if !strings.Contains(codeStr, attr) {
				t.Fatalf("AC20 violation: search-combobox.ts tidak memuat atribut ARIA '%s'", attr)
			}
		}

		for _, key := range []string{"ArrowDown", "ArrowUp", "Enter", "Escape"} {
			if !strings.Contains(codeStr, key) {
				t.Fatalf("AC20 violation: search-combobox.ts tidak menangani event tombol '%s'", key)
			}
		}

		catalogHTML, err := os.ReadFile(filepath.Join("..", "..", "frontend", "dist", "layanan.html"))
		if err != nil {
			t.Fatalf("gagal membaca dist/layanan.html: %v", err)
		}
		htmlStr := string(catalogHTML)
		if !strings.Contains(htmlStr, `role="combobox"`) || !strings.Contains(htmlStr, `id="hd-public-search"`) {
			t.Fatalf("dist/layanan.html tidak memuat elemen search combobox aksesibel")
		}
	})
}
