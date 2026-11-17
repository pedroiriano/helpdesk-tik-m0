package bootstrap

import (
	"bytes"
	"context"
	"crypto/sha256"
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

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestM008Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M008_TEST") != "1" {
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m008-key-not-a-production-secret"), Origin: base})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()

	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}

	public := client()
	other := client()
	tech1 := client()
	editor := client()

	public.login(1)
	other.login(2)
	tech1.login(9)
	editor.login(14)

	service := "30000000-0000-4000-8000-000000000001"

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

	createTicketWithAttachment := func(t *testing.T, title string, fileContent []byte) (ticketID, attachmentID string) {
		createPayload := map[string]any{
			"service_id":      service,
			"service_version": 1,
			"form_version":    1,
			"policy_version":  1,
			"title":           title,
			"description":     "Deskripsi tiket dengan lampiran M0-08",
			"answers":         map[string]string{"ringkasan": "Lampiran kendala teknis"},
		}
		created := public.request("POST", "/tickets", createPayload, 201, "", nil)
		ticketID = created["id"].(string)

		req, err := http.NewRequest("POST", base+"/api/v1/tickets/"+ticketID+"/attachments", bytes.NewReader(fileContent))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", base)
		req.Header.Set("Content-Type", "application/octet-stream")
		req.Header.Set("X-File-Mime", "image/png")
		req.Header.Set("X-Filename", "diagram.png")
		req.Header.Set("X-Attachment-Audience", "REQUESTER")
		req.Header.Set("X-Expected-Version", "1")
		req.Header.Set("X-CSRF-Token", public.csrf())
		req.Header.Set("Idempotency-Key", web.ID())

		resp, err := public.http.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 201 {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 201 attachment upload, got %d: %s", resp.StatusCode, string(body))
		}

		attList := public.request("GET", "/tickets/"+ticketID+"/attachments", nil, 200, "", nil)
		items := attList["items"].([]any)
		if len(items) == 0 {
			t.Fatalf("expected attachment in ticket %s, got 0", ticketID)
		}
		attachmentID = items[0].(map[string]any)["id"].(string)

		// Set status CLEAN langsung di database untuk pengujian download & reuse
		_, err = db.Exec(ctx, "UPDATE intake.attachments SET status = 'CLEAN' WHERE id = $1", attachmentID)
		if err != nil {
			t.Fatal(err)
		}

		flushDeliveries()
		return ticketID, attachmentID
	}

	var imgBuf bytes.Buffer
	if err := png.Encode(&imgBuf, image.NewRGBA(image.Rect(0, 0, 10, 10))); err != nil {
		t.Fatal(err)
	}
	validPngBytes := imgBuf.Bytes()

	// -------------------------------------------------------------
	// SUBTEST 1: AC18 Pustaka Media Terpadu Dua-Owner (M3 vs M8)
	// -------------------------------------------------------------
	t.Run("AC18_Two_Owner_Media_Isolation", func(t *testing.T) {
		_, m3AttID := createTicketWithAttachment(t, "AC18 Media Isolation M3", validPngBytes)

		// 1. Verifikasi list media M3 mengembalikan attachment M3
		listM3 := public.request("GET", "/media?owner=M3&status=CLEAN", nil, 200, "", nil)
		itemsM3 := listM3["items"].([]any)
		foundM3 := false
		for _, it := range itemsM3 {
			m := it.(map[string]any)
			if m["id"] == m3AttID {
				foundM3 = true
				if m["owner"] != "M3" {
					t.Fatalf("expected owner M3, got %v", m["owner"])
				}
			}
		}
		if !foundM3 {
			t.Fatalf("expected attachment %s in M3 media list", m3AttID)
		}

		// 2. Editor M8 membuat media di M8
		pngHash := sha256.Sum256(validPngBytes)
		m8Upload := map[string]any{
			"expected_version": 1,
			"filename":         "panduan.png",
			"mime":             "image/png",
			"size_bytes":       len(validPngBytes),
			"sha256":           fmt.Sprintf("%x", pngHash),
			"alt":              "Foto Panduan Jaringan Diskominfotik",
			"caption":          "Infrastruktur Data Center Depok",
			"license":          "CC-BY-4.0",
			"source":           "Diskominfotik Kota Depok",
		}
		createdM8 := editor.request("POST", "/media", m8Upload, 201, "", nil)
		m8ID := createdM8["id"].(string)

		// Kirim konten blob biner ke M8
		req, _ := http.NewRequest("PUT", base+"/api/v1/media/"+m8ID+"/content", bytes.NewReader(validPngBytes))
		req.Header.Set("Origin", base)
		req.Header.Set("Content-Type", "image/png")
		req.Header.Set("X-CSRF-Token", editor.csrf())
		req.Header.Set("Idempotency-Key", web.ID())
		resM8, err := editor.http.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resM8.Body.Close()
		if resM8.StatusCode != 200 && resM8.StatusCode != 201 {
			t.Fatalf("expected 200/201 from M8 content put, got %d", resM8.StatusCode)
		}

		// Update M8 media menjadi CLEAN untuk ketersediaan
		_, _ = db.Exec(ctx, "UPDATE knowledge.media SET status = 'CLEAN' WHERE id = $1", m8ID)

		// 3. Verifikasi list media M8 memuat m8ID dan TIDAK memuat m3AttID
		listM8 := editor.request("GET", "/media?owner=M8&status=CLEAN", nil, 200, "", nil)
		itemsM8 := listM8["items"].([]any)
		foundM8 := false
		for _, it := range itemsM8 {
			m := it.(map[string]any)
			if m["id"] == m8ID {
				foundM8 = true
				if m["owner"] != "M8" {
					t.Fatalf("expected owner M8, got %v", m["owner"])
				}
			}
			if m["id"] == m3AttID {
				t.Fatalf("CROSS-OWNER CONTAMINATION: M3 attachment %s appeared in M8 media list", m3AttID)
			}
		}
		if !foundM8 {
			t.Fatalf("expected M8 media %s in M8 media list", m8ID)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 2: AC18 Larangan Mutlak Direct Reuse Media Privat M3 ke Publik
	// -------------------------------------------------------------
	t.Run("AC18_Direct_Private_Reuse_Forbidden", func(t *testing.T) {
		_, m3AttID := createTicketWithAttachment(t, "AC18 Direct Reuse Forbidden", validPngBytes)

		// Percobaan 1: Pengguna biasa (bukan editor berizin) mencoba reuse -> 403 Forbidden
		unauthorizedReuse := map[string]any{
			"expected_version": 1,
			"target_owner":     "M8",
			"target_id":        "00000000-0000-4000-8000-000000000001",
			"target_audience":  "PUBLIC_GUEST",
			"reason":           "Coba direct reuse publik tanpa izin",
		}
		public.request("POST", "/media/"+m3AttID+"/reuse", unauthorizedReuse, 403, "", nil)

		// Percobaan 2: Editor berizin mencoba reuse langsung TANPA approval dan salinan tersanitasi
		illegalDirectReuse := map[string]any{
			"expected_version": 1,
			"target_owner":     "M8",
			"target_id":        "00000000-0000-4000-8000-000000000001",
			"target_audience":  "PUBLIC_GUEST",
			"reason":           "Coba publikasi langsung tanpa sanitasi dan approval",
		}
		editor.request("POST", "/media/"+m3AttID+"/reuse", illegalDirectReuse, 404, "", nil)
	})

	// -------------------------------------------------------------
	// SUBTEST 3: AC18 Sanitized Media Reuse dengan Pencatatan Provenance
	// -------------------------------------------------------------
	t.Run("AC18_Forged_Sanitized_Pointers_Rejected", func(t *testing.T) {
		_, m3AttID := createTicketWithAttachment(t, "AC18 Sanitized Reuse Test", validPngBytes)

		sanitizedCopyID := web.ID()
		approvalID := web.ID()

		validSanitizedReuse := map[string]any{
			"expected_version":  1,
			"target_owner":      "M8",
			"target_id":         web.ID(),
			"target_audience":   "PUBLIC_GUEST",
			"sanitized_copy_id": sanitizedCopyID,
			"approval_id":       approvalID,
			"reason":            "Salinan tersanitasi untuk artikel panduan jaringan publik",
		}
		// RM0-01: UUID pointers alone are not a server approval. The successful
		// reviewed-redaction path is exercised in TestRM001Integration for M3/M8.
		editor.request("POST", "/media/"+m3AttID+"/reuse", validSanitizedReuse, 404, "", nil)
		var created int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM knowledge.media WHERE id=$1", sanitizedCopyID).Scan(&created); err != nil || created != 0 {
			t.Fatal("forged approval created media")
		}

		flushDeliveries()
	})

	// -------------------------------------------------------------
	// SUBTEST 4: AC07 Penegakan ACL Lampiran Tiket Privat & Anti-Leakage
	// -------------------------------------------------------------
	t.Run("AC07_Attachment_ACL_Enforcement", func(t *testing.T) {
		ticketID, m3AttID := createTicketWithAttachment(t, "AC07 Attachment ACL Test", validPngBytes)

		// 1. Pemilik tiket (public) dapat mengunduh attachment miliknya
		req, _ := http.NewRequest("GET", base+"/api/v1/tickets/"+ticketID+"/attachments/"+m3AttID+"/download", nil)
		req.Header.Set("Origin", base)
		resOwner, err := public.http.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		bodyOwner, _ := io.ReadAll(resOwner.Body)
		resOwner.Body.Close()
		if resOwner.StatusCode != 200 {
			t.Fatalf("expected 200 for owner download, got %d: %s", resOwner.StatusCode, string(bodyOwner))
		}
		if !bytes.Equal(bodyOwner, validPngBytes) {
			t.Fatalf("downloaded bytes mismatch: got %d bytes, want %d bytes", len(bodyOwner), len(validPngBytes))
		}

		// 2. Pemohon lain (other) ditolak saat mengunduh attachment milik orang lain
		reqOther, _ := http.NewRequest("GET", base+"/api/v1/tickets/"+ticketID+"/attachments/"+m3AttID+"/download", nil)
		reqOther.Header.Set("Origin", base)
		resOther, err := other.http.Do(reqOther)
		if err != nil {
			t.Fatal(err)
		}
		resOther.Body.Close()
		if resOther.StatusCode != 403 && resOther.StatusCode != 404 {
			t.Fatalf("ACL LEAKAGE: other user was able to download private attachment! status=%d", resOther.StatusCode)
		}

		// 3. Attachment berstatus QUARANTINED tidak boleh disajikan ke siapapun
		_, _ = db.Exec(ctx, "UPDATE intake.attachments SET status = 'QUARANTINED' WHERE id = $1", m3AttID)
		reqQuar, _ := http.NewRequest("GET", base+"/api/v1/tickets/"+ticketID+"/attachments/"+m3AttID+"/download", nil)
		reqQuar.Header.Set("Origin", base)
		resQuar, err := public.http.Do(reqQuar)
		if err != nil {
			t.Fatal(err)
		}
		resQuar.Body.Close()
		if resQuar.StatusCode == 200 {
			t.Fatal("SECURITY LEAK: QUARANTINED file was served to user!")
		}
		if resQuar.StatusCode != 403 && resQuar.StatusCode != 409 {
			t.Fatalf("expected 403 or 409 for quarantined attachment, got %d", resQuar.StatusCode)
		}
	})

	// -------------------------------------------------------------
	// SUBTEST 5: AC19 Draft Autosave & CAS Version Collision Protection
	// -------------------------------------------------------------
	t.Run("AC19_Draft_Autosave_And_Version_Conflict", func(t *testing.T) {
		draftID := web.ID()

		// 1. Simpan draft baru (expected_version = 0)
		draftNew := map[string]any{
			"expected_version": 0,
			"form_version":     1,
			"title":            "Draft Tiket Permohonan Jaringan Depok",
			"description":      "Uraian kendala bandwidth internet ruang rapat",
			"answers":          map[string]string{"lokasi": "Gedung Dibaleka II Lantai 5"},
		}
		resNew := public.request("PUT", "/drafts/"+draftID, draftNew, 200, "", nil)
		ver1 := int64(resNew["version"].(float64))
		if ver1 != 1 {
			t.Fatalf("expected draft version 1 on creation, got %d", ver1)
		}

		// 2. Simpan draft pembaruan (expected_version = 1)
		draftUpdate := map[string]any{
			"expected_version": 1,
			"form_version":     1,
			"title":            "Draft Tiket Permohonan Jaringan Depok (Revisi)",
			"description":      "Uraian kendala bandwidth internet ruang rapat utama",
			"answers":          map[string]string{"lokasi": "Gedung Dibaleka II Lantai 5 Ruang 501"},
		}
		resUp := public.request("PUT", "/drafts/"+draftID, draftUpdate, 200, "", nil)
		ver2 := int64(resUp["version"].(float64))
		if ver2 != 2 {
			t.Fatalf("expected draft version 2 on update, got %d", ver2)
		}

		// 3. Tab bersaing / request konkuren dengan expected_version lama (versi 1) -> 409 Conflict
		competingTabReq := map[string]any{
			"expected_version": 1,
			"form_version":     1,
			"title":            "Draft Tiket dari Tab Lain yang Telat",
			"description":      "Penulisan simultan dari tab lain",
			"answers":          map[string]string{"lokasi": "Lantai 5"},
		}
		public.request("PUT", "/drafts/"+draftID, competingTabReq, 409, "", nil)
	})

	// -------------------------------------------------------------
	// SUBTEST 6: AC19 Isolasi Draft Antar-Akun & Penghapusan Selesai
	// -------------------------------------------------------------
	t.Run("AC19_Account_Switch_Draft_Isolation", func(t *testing.T) {
		draftID := web.ID()

		// Pengguna 1 (public) membuat draft pribadi
		draftPublic := map[string]any{
			"expected_version": 0,
			"form_version":     1,
			"title":            "Draft Rahasia Pengguna 1",
			"description":      "Data sensitif permohonan",
			"answers":          map[string]string{"privat": "ya"},
		}
		public.request("PUT", "/drafts/"+draftID, draftPublic, 200, "", nil)

		// Pengguna 2 (other) mencoba membaca draft pengguna 1 -> ditolak 404
		other.request("GET", "/drafts/"+draftID, nil, 404, "", nil)

		// Pengguna 2 memanggil list drafts -> tidak melihat draftID milik pengguna 1
		otherDrafts := other.request("GET", "/drafts", nil, 200, "", nil)
		items := otherDrafts["items"].([]any)
		for _, item := range items {
			d := item.(map[string]any)
			if d["id"] == draftID {
				t.Fatalf("PRIVACY BREACH: User 2 can see User 1's draft %s in drafts list!", draftID)
			}
		}

		// Pengguna 1 menghapus draft setelah selesai
		public.request("DELETE", "/drafts/"+draftID, nil, 204, "", nil)
		public.request("GET", "/drafts/"+draftID, nil, 404, "", nil)
	})

	// -------------------------------------------------------------
	// SUBTEST 7: AC20 Pengujian Aksesibilitas Keyboard & Markup Modal
	// -------------------------------------------------------------
	t.Run("AC20_Keyboard_Accessible_Media_Picker", func(t *testing.T) {
		// Periksa keberadaan atribut aksesibilitas pada template dan script PIUI jika tersedia
		laporHtmlPath := filepath.Join("..", "..", "frontend", "dist", "lapor.html")
		htmlBytes, err := os.ReadFile(laporHtmlPath)
		if err != nil {
			t.Logf("frontend dist tidak dimount ke kontainer pengujian backend: %v; verifikasi statis dijalankan via scripts/test_piui_build.py", err)
			return
		}
		html := string(htmlBytes)

		// Verifikasi atribut dialog & aria pada modal picker
		if !strings.Contains(html, `role="dialog"`) {
			t.Error("missing role=\"dialog\" in media modal")
		}
		if !strings.Contains(html, `aria-modal="true"`) {
			t.Error("missing aria-modal=\"true\" in media modal")
		}
		if !strings.Contains(html, `aria-labelledby="media-modal-title"`) {
			t.Error("missing aria-labelledby in media modal")
		}
		if !strings.Contains(html, `data-open-media-picker`) {
			t.Error("missing data-open-media-picker button")
		}
		if !strings.Contains(html, `data-close-media-modal`) {
			t.Error("missing data-close-media-modal button")
		}

		// Verifikasi script client m0-04.js memiliki handler keyboard Escape dan tab/trap
		jsPath := filepath.Join("..", "..", "frontend", "dist", "helpdesk", "m0-04.js")
		jsBytes, err := os.ReadFile(jsPath)
		if err != nil {
			t.Fatalf("failed to read m0-04.js: %v", err)
		}
		js := string(jsBytes)
		if !strings.Contains(js, "Escape") {
			t.Error("missing Escape key handler in m0-04.js")
		}
		if !strings.Contains(js, "Tab") {
			t.Error("missing Tab key focus trap in m0-04.js")
		}
	})
}
