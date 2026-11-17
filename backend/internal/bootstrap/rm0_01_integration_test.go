package bootstrap

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

func TestRM001Integration(t *testing.T) {
	if os.Getenv("HELPDESK_RM001_TEST") != "1" {
		t.Skip("NOT_RUN: isolated PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe database target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
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
	t.Setenv("HELPDESK_UPLOAD_ROOT", t.TempDir())
	t.Setenv("HELPDESK_SCANNER", os.Getenv("HELPDESK_TEST_SCANNER"))
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-rm001-key-not-production-secret"), Origin: base})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()
	newClient := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 15 * time.Second}}
	}
	orgA := "10000000-0000-4000-8000-000000000001"
	orgB := "10000000-0000-4000-8000-000000000002"
	editor, publisher, other, guest := newClient(), newClient(), newClient(), newClient()
	editor.login(14)
	publisher.login(15)
	// A second editor in another OPD is a fixture in this disposable database.
	_, err = pools[0].Exec(ctx, `UPDATE identity.subjects SET role_code='EDITOR' WHERE id='20000000-0000-4000-8000-000000000009'; UPDATE identity.memberships SET org_id='10000000-0000-4000-8000-000000000002',team_id=NULL,permissions=ARRAY['content.read','content.write','media.read','media.write','media.reuse'] WHERE subject_id='20000000-0000-4000-8000-000000000009'`)
	if err != nil {
		t.Fatal(err)
	}
	other.login(9)
	article := func(c testClient, org, title string) map[string]any {
		return c.request("POST", "/knowledge/articles", map[string]any{"expected_version": 1, "title": title, "slug": "rm001-" + web.ID(), "body": "Panduan sintetis untuk audit keamanan.", "audience": "PUBLIC_GUEST", "org_id": org}, 201, "", nil)
	}
	target := article(editor, orgA, "Target publikasi A")
	targetB := article(other, orgB, "Rahasia organisasi B rm001")
	var source, copy map[string]any
	var sourceData, copyData []byte
	imageBytes := func(c color.RGBA) []byte {
		im := image.NewRGBA(image.Rect(0, 0, 2, 2))
		im.Set(0, 0, c)
		var out bytes.Buffer
		if err := png.Encode(&out, im); err != nil {
			t.Fatal(err)
		}
		return out.Bytes()
	}
	binary := func(c testClient, id string, data []byte, want int, csrf bool) map[string]any {
		t.Helper()
		r, _ := http.NewRequest("PUT", base+"/api/v1/media/"+id+"/content", bytes.NewReader(data))
		r.Header.Set("Origin", base)
		r.Header.Set("Idempotency-Key", web.ID())
		r.Header.Set("Content-Type", "image/png")
		if csrf {
			r.Header.Set("X-CSRF-Token", c.csrf())
		}
		res, err := c.http.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("binary upload got %d want %d: %s", res.StatusCode, want, raw)
		}
		var out map[string]any
		_ = json.Unmarshal(raw, &out)
		return out
	}
	metadata := func(c testClient, org string, data []byte, key string) map[string]any {
		hash := sha256.Sum256(data)
		return c.request("POST", "/media", map[string]any{"expected_version": 1, "filename": "synthetic.png", "mime": "image/png", "size_bytes": len(data), "sha256": hex.EncodeToString(hash[:]), "alt": "Gambar sintetis", "caption": "", "license": "CC0", "org_id": org}, 201, key, nil)
	}

	t.Run("R1-A-authentication-and-legacy", func(t *testing.T) {
		c := newClient()
		boot := c.request("GET", "/auth/bootstrap", nil, 200, "", nil)
		nonce := boot["csrf_token"].(string)
		for _, identifier := range []string{"admin", "operator", "1980010100000000"} {
			c.request("POST", "/auth/sessions", map[string]any{"identifier": identifier, "password": "", "csrf_token": nonce}, 401, "", map[string]string{"X-CSRF-Token": nonce})
		}
		c.request("POST", "/auth/sessions", map[string]any{"lab_subject_id": web.ID(), "csrf_token": nonce}, 401, "", map[string]string{"X-CSRF-Token": nonce})
		id := web.ID()
		old := sha256.Sum256([]byte("old-password"))
		_, err := pools[0].Exec(ctx, `INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,email,password_hash) VALUES($1,'PUBLIC','0000000000009901','Legacy synthetic','PUBLIC','legacy-rm001@example.invalid',$2)`, id, "legacy-sha256$"+hex.EncodeToString(old[:]))
		if err != nil {
			t.Fatal(err)
		}
		for _, pw := range []string{"", "wrong"} {
			c.request("POST", "/auth/sessions", map[string]any{"identifier": "legacy-rm001@example.invalid", "password": pw, "csrf_token": nonce}, 401, "", map[string]string{"X-CSRF-Token": nonce})
		}
		c.request("POST", "/auth/sessions", map[string]any{"identifier": "LEGACY-RM001@example.invalid", "password": "old-password", "csrf_token": nonce}, 201, "", map[string]string{"X-CSRF-Token": nonce})
		var upgraded bool
		if err := pools[0].QueryRow(ctx, `SELECT password_hash LIKE 'pbkdf2-sha256$v1$%' FROM identity.subjects WHERE id=$1`, id).Scan(&upgraded); err != nil || !upgraded {
			t.Fatal("legacy proof was not upgraded")
		}
		_, err = pools[0].Exec(ctx, `UPDATE identity.sessions SET expires_at=now()-interval '1 second' WHERE subject_id=$1`, id)
		if err != nil {
			t.Fatal(err)
		}
		c.request("GET", "/auth/me", nil, 401, "", nil)
		c.request("POST", "/auth/sessions", map[string]any{"identifier": "legacy-rm001@example.invalid", "password": "old-password", "csrf_token": nonce}, 201, "", map[string]string{"X-CSRF-Token": nonce})
		_, err = pools[0].Exec(ctx, `UPDATE identity.subjects SET active=false WHERE id=$1`, id)
		if err != nil {
			t.Fatal(err)
		}
		c.request("GET", "/auth/me", nil, 401, "", nil)
		c.request("POST", "/auth/sessions", map[string]any{"identifier": "legacy-rm001@example.invalid", "password": "old-password", "csrf_token": nonce}, 401, "", map[string]string{"X-CSRF-Token": nonce})
	})
	t.Run("R1-B-registration-replay-concurrency", func(t *testing.T) {
		c := newClient()
		boot := c.request("GET", "/auth/bootstrap", nil, 200, "", nil)
		nonce := boot["csrf_token"].(string)
		in := map[string]any{"nik": "0000000000009902", "name": "Synthetic registrant", "email": "RM001-REGISTER@example.invalid", "phone": "081234509902", "password": "synthetic-password", "csrf_token": nonce}
		bad := map[string]any{}
		for k, v := range in {
			bad[k] = v
		}
		bad["nik"] = "abcdefghijklmnop"
		c.request("POST", "/auth/register", bad, 422, "", map[string]string{"X-CSRF-Token": nonce})
		bad["nik"] = in["nik"]
		bad["password"] = "short"
		c.request("POST", "/auth/register", bad, 422, "", map[string]string{"X-CSRF-Token": nonce})
		key := web.ID()
		var wg sync.WaitGroup
		var ids sync.Map
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				out := c.request("POST", "/auth/register", in, 201, key, map[string]string{"X-CSRF-Token": nonce})
				ids.Store(out["subject_id"], true)
			}()
		}
		wg.Wait()
		count := 0
		ids.Range(func(k, v any) bool { count++; return true })
		if count != 1 {
			t.Fatal("registration created multiple principals")
		}
		out := c.request("POST", "/auth/register", in, 201, key, map[string]string{"X-CSRF-Token": nonce})
		subject := out["subject_id"].(string)
		var persisted int
		if err := pools[0].QueryRow(ctx, `SELECT count(*) FROM identity.subjects WHERE email='rm001-register@example.invalid' AND external_ref=$1 AND password_hash LIKE 'pbkdf2-sha256$v1$%'`, in["nik"]).Scan(&persisted); err != nil || persisted != 1 {
			t.Fatal("registration did not persist exactly one normalized principal with adaptive verifier")
		}

		changed := map[string]any{}
		for k, v := range in {
			changed[k] = v
		}
		changed["phone"] = "081234509999"
		c.request("POST", "/auth/register", changed, 409, key, map[string]string{"X-CSRF-Token": nonce})
		c.request("POST", "/auth/register", in, 409, web.ID(), map[string]string{"X-CSRF-Token": nonce})
		_, err := pools[0].Exec(ctx, `UPDATE identity.sessions SET revoked_at=now() WHERE subject_id=$1`, subject)
		if err != nil {
			t.Fatal(err)
		}
		c.request("POST", "/auth/register", in, 401, key, map[string]string{"X-CSRF-Token": nonce})
		anonymous := newClient()
		anonymous.request("POST", "/auth/register", in, 403, "", nil)
	})
	t.Run("R1-C-upload-authorization-and-replay", func(t *testing.T) {
		sourceData = imageBytes(color.RGBA{R: 255, A: 255})
		copyData = imageBytes(color.RGBA{B: 255, A: 255})
		key := web.ID()
		source = metadata(editor, orgA, sourceData, key)
		if again := metadata(editor, orgA, sourceData, key); again["id"] != source["id"] {
			t.Fatal("metadata replay duplicated media")
		}
		id := source["id"].(string)
		binary(guest, id, sourceData, 401, false)
		binary(other, id, sourceData, 404, true)
		sameOrg := newClient()
		sameOrg.login(11) // media.write in OPD A, but not the upload owner.
		binary(sameOrg, id, sourceData, 404, true)
		binary(editor, id, sourceData, 403, false)
		source = binary(editor, id, sourceData, 200, true)
		binary(editor, id, sourceData, 200, true)
		binary(editor, id, copyData, 409, true)
		guest.request("POST", "/media", map[string]any{}, 401, "", map[string]string{"X-Guest-Capability": strings.Repeat("a", 64)})
		guest.request("GET", "/media/"+id+"/download", nil, 404, "", nil)
		copy = metadata(editor, orgA, copyData, web.ID())
		copy = binary(editor, copy["id"].(string), copyData, 200, true)
		oldTime := time.Now().Add(-25 * time.Hour)
		var storageKey string
		if err := pools[7].QueryRow(ctx, `SELECT storage_key FROM knowledge.media WHERE id=$1`, id).Scan(&storageKey); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(filepath.Join(os.Getenv("HELPDESK_UPLOAD_ROOT"), storageKey), oldTime, oldTime); err != nil {
			t.Fatal(err)
		}
		if err := runtime.Intake.Reconcile(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(filepath.Join(os.Getenv("HELPDESK_UPLOAD_ROOT"), storageKey)); err != nil {
			t.Fatal("collector removed referenced M8 blob")
		}
		badMetadata := map[string]any{"expected_version": 1, "filename": "fixture.png", "mime": "image/png", "size_bytes": 10485761, "sha256": strings.Repeat("0", 64), "alt": "Fixture", "license": "CC0", "org_id": orgA}
		editor.request("POST", "/media", badMetadata, 422, "", nil)
		badMetadata["size_bytes"] = 1
		badMetadata["filename"] = "../fixture.png"
		editor.request("POST", "/media", badMetadata, 422, "", nil)
		mismatchedMIME := metadata(editor, orgA, []byte("synthetic text fixture"), web.ID())
		binary(editor, mismatchedMIME["id"].(string), []byte("synthetic text fixture"), 422, true)
		bad := metadata(editor, orgA, sourceData, web.ID())
		binary(editor, bad["id"].(string), copyData, 422, true)
		// Real scanner unavailability keeps the object private and quarantined.
		originalFiles := runtime.Knowledge.Service().Files
		runtime.Knowledge.Service().Files = blob.Files{Root: os.Getenv("HELPDESK_UPLOAD_ROOT"), Scanner: "127.0.0.1:1"}
		pending := metadata(editor, orgA, sourceData, web.ID())
		binary(editor, pending["id"].(string), sourceData, 422, true)
		runtime.Knowledge.Service().Files = originalFiles
		var state string
		if err := pools[7].QueryRow(ctx, `SELECT status FROM knowledge.media WHERE id=$1`, pending["id"]).Scan(&state); err != nil || state != "QUARANTINED" {
			t.Fatal("scanner failure did not quarantine")
		}
		guest.request("GET", "/media/"+pending["id"].(string)+"/download", nil, 404, "", nil)

	})
	t.Run("R1-D-approved-redaction-publication", func(t *testing.T) {
		sourceID := source["id"].(string)
		copyID := copy["id"].(string)
		in := map[string]any{"expected_version": source["version"], "sanitized_copy_id": copyID, "target_id": target["id"], "target_audience": "PUBLIC_GUEST", "reason": "Salinan sintetis telah ditinjau dan data sensitif dihapus"}
		editor.request("POST", "/media/"+sourceID+"/approvals", in, 403, "", nil)
		bad := map[string]any{}
		for k, v := range in {
			bad[k] = v
		}
		bad["sanitized_copy_id"] = sourceID
		publisher.request("POST", "/media/"+sourceID+"/approvals", bad, 422, "", nil)
		approval := publisher.request("POST", "/media/"+sourceID+"/approvals", in, 201, "", nil)
		reuse := map[string]any{"expected_version": source["version"], "sanitized_copy_id": copyID, "approval_id": web.ID(), "target_owner": "M8", "target_id": target["id"], "target_audience": "PUBLIC_GUEST", "reason": "Publikasi salinan hasil tinjauan"}
		editor.request("POST", "/media/"+sourceID+"/reuse", reuse, 404, "", nil)
		delete(reuse, "approval_id")
		editor.request("POST", "/media/"+sourceID+"/reuse", reuse, 403, "", nil)
		reuse["approval_id"] = approval["id"]
		key := web.ID()
		out := editor.request("POST", "/media/"+sourceID+"/reuse", reuse, 200, key, nil)
		if out["id"] != copyID {
			t.Fatal("publication must reference the reviewed copy")
		}
		editor.request("POST", "/media/"+sourceID+"/reuse", reuse, 200, key, nil)
		// Source snapshot, destination and reviewer authority must remain current.
		badCopy := metadata(editor, orgA, copyData, web.ID())
		badCopy = binary(editor, badCopy["id"].(string), copyData, 200, true)
		alternate := map[string]any{}
		for k, v := range in {
			alternate[k] = v
		}
		alternate["sanitized_copy_id"] = badCopy["id"]
		second := publisher.request("POST", "/media/"+sourceID+"/approvals", alternate, 201, "", nil)
		secondReuse := map[string]any{}
		for k, v := range reuse {
			secondReuse[k] = v
		}
		secondReuse["approval_id"] = second["id"]
		secondReuse["sanitized_copy_id"] = badCopy["id"]
		secondReuse["target_audience"] = "PUBLIC_AUTH"
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 409, "", nil)
		secondReuse["target_audience"] = "PUBLIC_GUEST"
		_, err := pools[0].Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000015'`)
		if err != nil {
			t.Fatal(err)
		}
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 403, "", nil)
		_, err = pools[0].Exec(ctx, `UPDATE identity.memberships SET revoked_at=NULL WHERE subject_id='20000000-0000-4000-8000-000000000015'`)
		if err != nil {
			t.Fatal(err)
		}
		// Revocation and expiry are checked on each use, not trusted from client pointers.
		revoked := publisher.request("POST", "/media/"+sourceID+"/approvals", alternate, 201, "", nil)
		publisher.request("POST", "/media/approvals/"+revoked["id"].(string)+"/revoke", map[string]any{"expected_version": 1, "reason": "Tinjauan sintetis dicabut"}, 200, "", nil)
		secondReuse["approval_id"] = revoked["id"]
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 404, "", nil)
		expired := publisher.request("POST", "/media/"+sourceID+"/approvals", alternate, 201, "", nil)
		_, err = pools[7].Exec(ctx, `UPDATE knowledge.media_approvals SET expires_at=now()-interval '1 second' WHERE id=$1`, expired["id"])
		if err != nil {
			t.Fatal(err)
		}
		secondReuse["approval_id"] = expired["id"]
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 404, "", nil)
		secondReuse["approval_id"] = second["id"]
		_, err = pools[7].Exec(ctx, `UPDATE knowledge.media SET version=version+1 WHERE id=$1`, sourceID)
		if err != nil {
			t.Fatal(err)
		}
		// Input still carries the former version: reject before publication.
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 422, "", nil)
		_, err = pools[7].Exec(ctx, `UPDATE knowledge.media SET version=version-1 WHERE id=$1`, sourceID)
		if err != nil {
			t.Fatal(err)
		}
		_, err = pools[7].Exec(ctx, `UPDATE knowledge.media SET version=version+1 WHERE id=$1`, badCopy["id"])
		if err != nil {
			t.Fatal(err)
		}
		editor.request("POST", "/media/"+sourceID+"/reuse", secondReuse, 409, "", nil)

		publisher.request("POST", "/knowledge/articles/"+target["id"].(string)+"/transitions", map[string]any{"expected_version": 1, "action": "PUBLISH", "reason": "Terbitkan panduan sintetis"}, 200, "", nil)
		res, err := guest.http.Get(base + "/api/v1/media/" + copyID + "/download")
		if err != nil {
			t.Fatal(err)
		}
		actual, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 || !bytes.Equal(actual, copyData) || bytes.Equal(actual, sourceData) {
			t.Fatal("published bytes are not the reviewed redacted copy")
		}
		// A preserved historical reference without real approval grants no access.
		_, err = pools[7].Exec(ctx, `INSERT INTO knowledge.content_media_refs(id,content_id,media_id) VALUES($1,$2,$3)`, web.ID(), target["id"], sourceID)
		if err != nil {
			t.Fatal(err)
		}
		guest.request("GET", "/media/"+sourceID+"/download", nil, 404, "", nil)
		publisher.request("POST", "/knowledge/articles/"+target["id"].(string)+"/transitions", map[string]any{"expected_version": 2, "action": "ARCHIVE", "reason": "Arsipkan panduan sintetis"}, 200, "", nil)
		guest.request("GET", "/media/"+copyID+"/download", nil, 404, "", nil)
	})
	t.Run("R1-E-scoped-M3-library-and-search", func(t *testing.T) {
		public, otherPublic, operator, technician := newClient(), newClient(), newClient(), newClient()
		public.login(1)
		otherPublic.login(2)
		operator.login(4)
		technician.login(10)
		ticket := public.request("POST", "/tickets", map[string]any{"service_id": "30000000-0000-4000-8000-000000000001", "service_version": 1, "form_version": 1, "policy_version": 1, "title": "RM001 private search sentinel", "description": "Data sintetis pemohon A", "answers": map[string]string{"ringkasan": "Sentinel akses"}}, 201, "", nil)
		ticketID := ticket["id"].(string)
		// Seed only the attachment record/blob in this disposable owner's store.
		fileID := web.ID()
		hash := sha256.Sum256(sourceData)
		_, _, err := runtime.Intake.Service().Files.Put(ctx, fileID, bytes.NewReader(sourceData), 10485760)
		if err != nil {
			t.Fatal(err)
		}
		_, err = pools[2].Exec(ctx, `INSERT INTO intake.attachments(id,ticket_id,principal_id,storage_key,status,mime,size_bytes,sha256,alt,license,display_name,audience) VALUES($1,$2,'20000000-0000-4000-8000-000000000001',$5,'CLEAN','image/png',$3,$4,'Synthetic','PRIVATE','sentinel.png','REQUESTER')`, fileID, ticketID, len(sourceData), hash[:], fileID)
		if err != nil {
			t.Fatal(err)
		}
		for _, c := range []testClient{otherPublic, other, technician} {
			c.request("GET", "/media/"+fileID+"/download", nil, 404, "", nil)
			page := c.request("GET", "/search?owner=M3&q=RM001", nil, 200, "", nil)
			for _, hit := range page["items"].([]any) {
				if hit.(map[string]any)["id"] == ticketID {
					t.Fatal("search leaked a forbidden ticket")
				}
			}
			list := c.request("GET", "/media?owner=M3&limit=100", nil, 200, "", nil)
			for _, item := range list["items"].([]any) {
				if item.(map[string]any)["id"] == fileID {
					t.Fatal("library leaked forbidden attachment")
				}
			}
		}
		// Metadata is authorized before any blob is returned.
		for _, c := range []testClient{public, operator} {
			res, err := c.http.Get(base + "/api/v1/media/" + fileID + "/download")
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.StatusCode != 200 {
				t.Fatal("authorized media read rejected")
			}
		}
		coordinator := newClient()
		coordinator.login(11)
		cleanCopy := metadata(editor, orgA, copyData, web.ID())
		cleanCopy = binary(editor, cleanCopy["id"].(string), copyData, 200, true)
		newTarget := article(editor, orgA, "Publikasi redaksi sumber M3")
		approvalInput := map[string]any{"expected_version": 1, "sanitized_copy_id": cleanCopy["id"], "target_id": newTarget["id"], "target_audience": "PUBLIC_GUEST", "reason": "Koordinator meninjau salinan redaksi sintetis"}
		// Editorial mandate alone must never reveal ticket bytes.
		publisher.request("POST", "/media/"+fileID+"/approvals", approvalInput, 404, "", nil)
		approved := coordinator.request("POST", "/media/"+fileID+"/approvals", approvalInput, 201, "", nil)
		reuseInput := map[string]any{"expected_version": 1, "sanitized_copy_id": cleanCopy["id"], "approval_id": approved["id"], "target_id": newTarget["id"], "target_owner": "M8", "target_audience": "PUBLIC_GUEST", "reason": "Hubungkan hasil redaksi yang disetujui"}
		coordinator.request("POST", "/media/"+fileID+"/reuse", reuseInput, 200, "", nil)
		publisher.request("POST", "/knowledge/articles/"+newTarget["id"].(string)+"/transitions", map[string]any{"expected_version": 1, "action": "PUBLISH", "reason": "Terbitkan hasil redaksi sintetis"}, 200, "", nil)
		res, err := guest.http.Get(base + "/api/v1/media/" + cleanCopy["id"].(string) + "/download")
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 || !bytes.Equal(data, copyData) {
			t.Fatal("M3 publication did not use redacted copy")
		}
		guest.request("GET", "/media/"+fileID+"/download", nil, 404, "", nil)
		guest.request("GET", "/media?owner=M3", nil, 401, "", map[string]string{"X-Guest-Capability": strings.Repeat("a", 64)})
		other.request("GET", "/knowledge/articles/"+target["id"].(string), nil, 404, "", nil)
	})

	t.Run("R1-E-content-scope-and-revocation", func(t *testing.T) {
		id := targetB["id"].(string)
		editor.request("GET", "/knowledge/articles/"+id, nil, 404, "", nil)
		editor.request("PUT", "/knowledge/articles/"+id, map[string]any{"expected_version": 1, "title": "X", "slug": "x", "body": "Valid synthetic body", "audience": "PUBLIC_GUEST", "org_id": orgA}, 404, "", nil)
		page := editor.request("GET", "/knowledge/articles?limit=100", nil, 200, "", nil)
		for _, it := range page["items"].([]any) {
			if it.(map[string]any)["id"] == id {
				t.Fatal("cross-OPD draft listed")
			}
		}
		other.request("GET", "/media/"+source["id"].(string)+"/download", nil, 404, "", nil)
		_, err := pools[0].Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000014'`)
		if err != nil {
			t.Fatal(err)
		}
		editor.request("GET", "/knowledge/articles/"+target["id"].(string), nil, 404, "", nil)
		editor.request("GET", "/media/"+source["id"].(string)+"/download", nil, 404, "", nil)
		editor.request("POST", "/knowledge/articles", map[string]any{}, 403, "", nil)
	})
	t.Run("R1-E-ASN-catalog-search-matches-detail", func(t *testing.T) {
		a, b := newClient(), newClient()
		a.login(3)
		b.login(8)
		service := "30000000-0000-4000-8000-000000000013"
		for _, row := range []struct {
			c    testClient
			want bool
		}{{a, true}, {b, false}, {guest, false}} {
			page := row.c.request("GET", "/search?owner=M2&q=TIK-DOM-01", nil, 200, "", nil)
			found := false
			for _, item := range page["items"].([]any) {
				if item.(map[string]any)["id"] == service {
					found = true
				}
			}
			if found != row.want {
				t.Fatal("catalog search violated organization scope")
			}
		}
	})
	t.Run("R1-E-report-export-live-scope", func(t *testing.T) {
		leadership := newClient()
		leadership.login(13)
		// Membership in B without report rights must not broaden report rights in A.
		_, err := pools[0].Exec(ctx, `INSERT INTO identity.memberships(id,subject_id,org_id,valid_until,permissions) VALUES($1,'20000000-0000-4000-8000-000000000013',$2,now()+interval '1 day',ARRAY['notification.read'])`, web.ID(), orgB)
		if err != nil {
			t.Fatal(err)
		}
		query := map[string]any{"organization_id": orgA, "from": "2026-01-01T00:00:00Z", "to": "2026-12-31T23:59:59Z", "timezone": "Asia/Jakarta", "cohort": "ACCEPTED", "format": "CSV"}
		op := leadership.request("POST", "/reports/exports", query, 202, "", nil)
		path := "/reports/exports/" + op["id"].(string)
		leadership.request("GET", path, nil, 200, "", nil)
		leadership.request("GET", path+"/download", nil, 200, "", nil)
		query["organization_id"] = orgB
		leadership.request("POST", "/reports/exports", query, 403, "", nil)
		leadership.request("GET", "/reports?organization_id="+orgB+"&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z", nil, 403, "", nil)
		_, err = pools[0].Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000013' AND org_id=$1`, orgA)
		if err != nil {
			t.Fatal(err)
		}
		// Retain valid report rights in B; an existing export for A must still be denied.
		_, err = pools[0].Exec(ctx, `UPDATE identity.memberships SET permissions=ARRAY['report.read','report.export'] WHERE subject_id='20000000-0000-4000-8000-000000000013' AND org_id=$1`, orgB)
		if err != nil {
			t.Fatal(err)
		}
		for _, suffix := range []string{"", "/download", "/file"} {
			leadership.request("GET", path+suffix, nil, 404, "", nil)
		}
	})
	t.Run("R1-F-nonlab-and-migration-readiness", func(t *testing.T) {
		if err := pools.Ready(ctx); err != nil {
			t.Fatal(err)
		}
		srv := httptest.NewUnstartedServer(nil)
		origin := "http://" + srv.Listener.Addr().String()
		srv.Config.Handler = Application(pools, m1.Options{Lab: false, Key: []byte("synthetic-rm001-key-not-production-secret"), Origin: origin})
		srv.Start()
		defer srv.Close()
		jar, _ := cookiejar.New(nil)
		c := testClient{t, origin, &http.Client{Jar: jar, Timeout: 5 * time.Second}}
		c.request("GET", "/auth/bootstrap", nil, 403, "", nil)
		c.request("POST", "/auth/sessions", map[string]any{"lab_subject_id": "20000000-0000-4000-8000-000000000017", "csrf_token": strings.Repeat("a", 64)}, 403, "", nil)
		c.request("POST", "/auth/register", map[string]any{}, 403, "", nil)
	})
	t.Run("R1-G-audit-durable-and-contract-receipts", func(t *testing.T) {
		for i := 0; i < 4; i++ {
			for _, b := range runtime.Bindings {
				for n := 0; n < 100; n++ {
					if err := delivery.Step(ctx, b.Source, b.Consumer, delivery.Hooks{}); err != nil {
						break
					}
				}
			}
		}

		var count int
		if err := pools[8].QueryRow(ctx, `SELECT count(*) FROM notify_audit.audit_entries WHERE action IN ('ApproveSanitizedMedia','ReuseSanitizedMedia','RegisterPublicSubject')`).Scan(&count); err != nil || count < 3 {
			t.Fatal("audit effects not durable")
		}
		if _, err := delivery.Digest([]byte(`{"proof":true}`)); err != nil {
			t.Fatal(err)
		}
	})
}
