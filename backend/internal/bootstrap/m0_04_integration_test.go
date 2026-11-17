package bootstrap

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/modules/m2"
	"helpdesk.local/m0/internal/modules/m3"
	"helpdesk.local/m0/internal/modules/m4"
	classification "helpdesk.local/m0/internal/modules/m4/api"
	"helpdesk.local/m0/internal/modules/m5"
	"helpdesk.local/m0/internal/modules/m6"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
	"image"
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
)

type unavailableConsumer struct{}

func (unavailableConsumer) Consume(context.Context, delivery.Event) error {
	return errors.New("synthetic unavailable consumer")
}

type changingClassifier struct {
	Base   classification.Port
	Change func()
}

func (c changingClassifier) Propose(ctx context.Context, text string) (classification.Proposal, error) {
	p, e := c.Base.Propose(ctx, text)
	c.Change()
	return p, e
}

func TestM004Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M004_TEST") != "1" {
		t.Skip("NOT_RUN: disposable PostgreSQL and real scanner opt-in required")
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
	runtime := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m004-key-not-a-production-secret"), Origin: base})
	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Test-Lost-Response") == "1" {
			record := httptest.NewRecorder()
			runtime.Handler.ServeHTTP(record, r)
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				_ = conn.Close()
			}
			return
		}
		runtime.Handler.ServeHTTP(w, r)
	})
	server.Start()
	defer server.Close()
	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}
	guest, public, other, asn, operator, configAdmin, cross := client(), client(), client(), client(), client(), client(), client()
	public.login(1)
	other.login(2)
	asn.login(3)
	operator.login(4)
	configAdmin.login(5)
	cross.login(8)
	service := "30000000-0000-4000-8000-000000000001"
	input := map[string]any{"service_id": service, "service_version": 1, "form_version": 1, "policy_version": 1, "title": "Internet lab tidak terhubung", "description": "Laporan sintetis M0-04", "answers": map[string]string{"ringkasan": "Gangguan jaringan lab"}}
	created := public.request("POST", "/tickets", input, 201, "", nil)
	id := created["id"].(string)
	var asnID string
	count := func(query string, args ...any) int {
		var n int
		if e := db.QueryRow(ctx, query, args...).Scan(&n); e != nil {
			t.Fatal(e)
		}
		return n
	}
	t.Run("create_atomic_lost_response_concurrent_replay_and_validation", func(t *testing.T) {
		lostKey := web.ID()
		raw, _ := json.Marshal(input)
		req, _ := http.NewRequest("POST", base+"/api/v1/tickets", bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", base)
		req.Header.Set("X-CSRF-Token", public.csrf())
		req.Header.Set("Idempotency-Key", lostKey)
		req.Header.Set("X-Test-Lost-Response", "1")
		res, err := public.http.Do(req)
		if err == nil {
			res.Body.Close()
			t.Fatal("expected lost HTTP response after commit")
		}
		public.request("POST", "/tickets", input, 201, lostKey, nil)
		key := web.ID()
		first := public.request("POST", "/tickets", input, 201, key, nil)
		var wg sync.WaitGroup
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				again := public.request("POST", "/tickets", input, 201, key, nil)
				if again["id"] != first["id"] {
					t.Error("duplicate effect")
				}
			}()
		}
		wg.Wait()
		if count(`SELECT count(*) FROM intake.tickets WHERE id=$1`, first["id"]) != 1 || count(`SELECT count(*) FROM intake.ticket_versions WHERE ticket_id=$1`, first["id"]) != 1 || count(`SELECT count(*) FROM intake.outbox WHERE aggregate_id=$1 AND event_type='TicketCreated'`, first["id"]) != 1 {
			t.Fatal("atomicity/replay violated")
		}
		bad := map[string]any{}
		for k, v := range input {
			bad[k] = v
		}
		bad["title"] = "Intent berbeda"
		public.request("POST", "/tickets", bad, 409, key, nil)
		bad["service_version"] = 99
		public.request("POST", "/tickets", bad, 409, "", nil)
		bad["role"] = "SUPER_ADMIN"
		public.request("POST", "/tickets", bad, 400, "", nil)
		// Force transaction failure after aggregate insert; no ticket/history/receipt/event can survive.
		_, e := db.Exec(ctx, `CREATE FUNCTION intake.test_rollback() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic rollback'; END$$;CREATE TRIGGER test_rollback BEFORE INSERT ON intake.ticket_versions FOR EACH ROW EXECUTE FUNCTION intake.test_rollback()`)
		if e != nil {
			t.Fatal(e)
		}
		before := count(`SELECT count(*) FROM intake.tickets`)
		public.request("POST", "/tickets", input, 503, "", nil)
		if count(`SELECT count(*) FROM intake.tickets`) != before {
			t.Fatal("partial commit")
		}
		_, _ = db.Exec(ctx, `DROP TRIGGER test_rollback ON intake.ticket_versions;DROP FUNCTION intake.test_rollback()`)
	})
	t.Run("live_account_scope_internal_notes_and_CAS", func(t *testing.T) {
		asn.request("GET", "/tickets/"+id, nil, 404, "", nil)
		if len(items(asn.request("GET", "/tickets", nil, 200, "", nil))) != 0 {
			t.Fatal("ASN self scope expanded to organization")
		}
		asnInput := map[string]any{}
		for k, v := range input {
			asnInput[k] = v
		}
		asnInput["service_id"] = "30000000-0000-4000-8000-000000000003"
		asnCreated := asn.request("POST", "/tickets", asnInput, 201, "", nil)
		asnID = asnCreated["id"].(string)
		asn.request("GET", "/tickets/"+asnID, nil, 200, "", nil)
		other.request("GET", "/tickets/"+asnID, nil, 404, "", nil)
		other.request("GET", "/tickets/"+id, nil, 404, "", nil)
		configAdmin.request("GET", "/tickets/"+id, nil, 404, "", nil)
		cross.request("GET", "/tickets/"+id, nil, 404, "", nil)
		guest.request("GET", "/tickets/"+id, nil, 401, "", nil)
		operator.request("GET", "/tickets/"+id, nil, 200, "", nil)
		if len(items(other.request("GET", "/tickets?limit=1", nil, 200, "", nil))) != 0 {
			t.Fatal("scope before pagination")
		}
		internal := map[string]any{"expected_version": 1, "body": "SECRET-INTERNAL-M004", "visibility": "INTERNAL"}
		public.request("POST", "/tickets/"+id+"/comments", internal, 403, "", nil)
		operator.request("POST", "/tickets/"+id+"/comments", internal, 201, "", nil)
		operator.request("POST", "/tickets/"+id+"/comments", internal, 409, "", nil)
		list := public.request("GET", "/tickets/"+id+"/comments", nil, 200, "", nil)
		if len(items(list)) != 0 {
			t.Fatal("internal note leaked")
		}
		raw, _ := json.Marshal(public.request("GET", "/tickets/"+id, nil, 200, "", nil))
		if bytes.Contains(raw, []byte("SECRET-INTERNAL")) {
			t.Fatal("private detail leak")
		}
		public.request("POST", "/tickets/"+id+"/comments", map[string]any{"expected_version": 2, "body": "Terima kasih lab", "visibility": "REQUESTER"}, 201, "", nil)
		public.request("GET", "/tickets/"+id+"/history?limit=1", nil, 200, "", nil)
		public.request("POST", "/tickets/"+id+"/comments", map[string]any{"expected_version": 3, "body": "x", "visibility": "REQUESTER"}, 403, "", map[string]string{"X-CSRF-Token": "forged"})
		public.request("GET", "/tickets/"+id+"/resolve", nil, 404, "", nil)
	})
	var guestID, capability string
	t.Run("guest_capability_binding_tracking_expiry_revocation", func(t *testing.T) {
		b := make([]byte, 32)
		_, _ = rand.Read(b)
		capability = hex.EncodeToString(b)
		boot := guest.request("GET", "/auth/bootstrap", nil, 200, "", nil)
		nonce := boot["csrf_token"].(string)
		headers := map[string]string{"X-Guest-Capability": capability, "X-CSRF-Token": nonce}
		key := web.ID()
		v := guest.request("POST", "/tickets", input, 201, key, headers)
		guestID = v["id"].(string)
		guest.request("POST", "/tickets", input, 201, key, headers)
		track := guest.request("POST", "/guest/tracking-session", map[string]string{"csrf_token": nonce}, 201, "", headers)
		if track["ticket_id"] != guestID {
			t.Fatal("wrong tracking binding")
		}
		guest.request("GET", "/tickets/"+guestID, nil, 200, "", nil)
		u, _ := http.NewRequest("GET", base, nil)
		trackingCSRF := ""
		for _, cookie := range guest.http.Jar.Cookies(u.URL) {
			if cookie.Name == "helpdesk_tracking_csrf" {
				trackingCSRF = cookie.Value
			}
		}
		_, _ = db.Exec(ctx, `UPDATE intake.guest_capabilities SET scopes=ARRAY['ticket.read'] WHERE ticket_id=$1`, guestID)
		guest.request("POST", "/tickets/"+guestID+"/comments", map[string]any{"expected_version": 1, "body": "Guest scope test", "visibility": "REQUESTER"}, 403, "", map[string]string{"X-CSRF-Token": trackingCSRF})
		_, _ = db.Exec(ctx, `UPDATE intake.guest_capabilities SET scopes=ARRAY['ticket.read','ticket.comment','ticket.attach'] WHERE ticket_id=$1`, guestID)
		guest.request("POST", "/tickets/"+guestID+"/comments", map[string]any{"expected_version": 1, "body": "Guest comment authorized", "visibility": "REQUESTER"}, 201, "", map[string]string{"X-CSRF-Token": trackingCSRF})
		guest.request("GET", "/tickets/"+id, nil, 404, "", nil)
		_, _ = db.Exec(ctx, `UPDATE intake.guest_capabilities SET expires_at=now()-interval '1 second' WHERE ticket_id=$1`, guestID)
		guest.request("GET", "/tickets/"+guestID, nil, 401, "", nil)
		guest.request("POST", "/tickets", input, 401, key, headers)
		_, _ = db.Exec(ctx, `UPDATE intake.guest_capabilities SET expires_at=now()+interval '1 day' WHERE ticket_id=$1`, guestID)
		guest.request("POST", "/guest/tracking-session", map[string]string{"csrf_token": nonce}, 201, "", headers)
	})
	t.Run("real_stream_scan_download_quarantine_ACL_and_missing_blob", func(t *testing.T) {
		var imageData bytes.Buffer
		_ = png.Encode(&imageData, image.NewRGBA(image.Rect(0, 0, 2, 2)))
		data := imageData.Bytes()
		upload := func(c testClient, ticket, name, mime, audience string, version int, want int, data []byte) {
			req, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+ticket+"/attachments", bytes.NewReader(data))
			req.Header.Set("Content-Type", "application/octet-stream")
			req.Header.Set("Origin", base)
			req.Header.Set("X-CSRF-Token", c.csrf())
			req.Header.Set("Idempotency-Key", web.ID())
			req.Header.Set("X-Expected-Version", fmt.Sprint(version))
			req.Header.Set("X-Filename", name)
			req.Header.Set("X-File-Mime", mime)
			req.Header.Set("X-Attachment-Audience", audience)
			res, e := c.http.Do(req)
			if e != nil {
				t.Fatal(e)
			}
			defer res.Body.Close()
			body, _ := io.ReadAll(res.Body)
			if res.StatusCode != want {
				t.Fatalf("upload %d want%d %s", res.StatusCode, want, body)
			}
		}
		upload(public, id, "../../bad.png", "image/png", "REQUESTER", 3, 422, data)
		upload(public, id, "bad.pdf", "application/pdf", "REQUESTER", 3, 422, data)
		upload(other, id, "x.png", "image/png", "REQUESTER", 3, 404, data)
		upload(public, id, "x.png", "image/png", "INTERNAL", 3, 403, data)
		upload(public, id, "lab.png", "image/png", "REQUESTER", 3, 201, data)
		files := items(public.request("GET", "/tickets/"+id+"/attachments", nil, 200, "", nil))
		fid := files[0].(map[string]any)["id"].(string)
		public.request("GET", "/tickets/"+id+"/attachments/"+fid+"/download", nil, 409, "", nil)
		if e := runtime.Intake.ScanOne(ctx); e != nil {
			t.Fatal(e)
		}
		file := items(public.request("GET", "/tickets/"+id+"/attachments", nil, 200, "", nil))[0].(map[string]any)
		if file["status"] != "CLEAN" {
			t.Fatal("real scanner did not clean fixture")
		}
		res, e := public.http.Get(base + "/api/v1/tickets/" + id + "/attachments/" + fid + "/download")
		if e != nil {
			t.Fatal(e)
		}
		got, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 || !bytes.Equal(got, data) || !strings.HasPrefix(res.Header.Get("Content-Disposition"), "attachment;") {
			t.Fatal("download bytes/headers mismatch")
		}
		other.request("GET", "/tickets/"+id+"/attachments/"+fid+"/download", nil, 404, "", nil)
		_, _ = db.Exec(ctx, `UPDATE intake.attachments SET status='REJECTED' WHERE id=$1`, fid)
		public.request("GET", "/tickets/"+id+"/attachments/"+fid+"/download", nil, 409, "", nil)
		_, _ = db.Exec(ctx, `UPDATE intake.attachments SET status='CLEAN' WHERE id=$1`, fid)
		// Real antivirus signature detection uses harmless EICAR test string directly against clamd.
		scanner := blob.Files{Scanner: os.Getenv("HELPDESK_TEST_SCANNER")}
		status, e := scanner.Scan(ctx, []byte("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"))
		if e != nil || status != "REJECTED" {
			t.Fatal("real scanner detection unproven", e, status)
		}
		scanner.Scanner = "127.0.0.1:1"
		if _, e = scanner.Scan(ctx, data); e == nil {
			t.Fatal("unavailable scanner must fail")
		}
		var storage string
		if e = db.QueryRow(ctx, `SELECT storage_key FROM intake.attachments WHERE id=$1`, fid).Scan(&storage); e != nil {
			t.Fatal(e)
		}
		if e = os.Remove(filepath.Join(root, storage)); e != nil {
			t.Fatal(e)
		}
		public.request("GET", "/tickets/"+id+"/attachments/"+fid+"/download", nil, 503, "", nil)
		upload(operator, id, "internal.png", "image/png", "INTERNAL", 4, 201, data)
		t.Setenv("HELPDESK_SCANNER", "127.0.0.1:1")
		unavailable := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m004-key-not-a-production-secret"), Origin: base})
		if e = unavailable.Intake.ScanOne(ctx); e != nil {
			t.Fatal(e)
		}
		if count(`SELECT count(*) FROM intake.attachments WHERE ticket_id=$1 AND audience='INTERNAL' AND status='QUARANTINED'`, id) != 1 {
			t.Fatal("scanner outage did not fail closed")
		}
		_, _ = db.Exec(ctx, `UPDATE intake.attachments SET next_scan_at=now()-interval '1 second' WHERE ticket_id=$1 AND status='QUARANTINED'`, id)
		if e = runtime.Intake.ScanOne(ctx); e != nil {
			t.Fatal(e)
		}
		orphan := web.ID()
		if e = os.WriteFile(filepath.Join(root, orphan), data, 0600); e != nil {
			t.Fatal(e)
		}
		old := time.Now().Add(-25 * time.Hour)
		_ = os.Chtimes(filepath.Join(root, orphan), old, old)
		if e = runtime.Intake.Reconcile(ctx); e != nil {
			t.Fatal(e)
		}
		if _, e = os.Stat(filepath.Join(root, orphan)); !os.IsNotExist(e) {
			t.Fatal("unreferenced old blob not reconciled")
		}
		if len(items(public.request("GET", "/tickets/"+id+"/attachments", nil, 200, "", nil))) != 1 {
			t.Fatal("internal file metadata leak")
		}
	})
	t.Run("durable_outbox_crash_ACK_dedup_monotonic_and_integrity", func(t *testing.T) {
		source := runtime.Sources[2]
		fault := errors.New("test after consumer commit before ACK")
		if e := delivery.Step(ctx, source, runtime.Consumer, delivery.Hooks{AfterConsumer: func() error { return fault }}); !errors.Is(e, fault) {
			t.Fatal("fault hook not reached", e)
		}
		_, _ = db.Exec(ctx, `UPDATE intake.outbox_delivery SET lease_until=now()-interval '1 second' WHERE state='LEASED'`)
		for _, s := range runtime.Sources {
			for i := 0; i < 100; i++ {
				e := delivery.Step(ctx, s, runtime.Consumer, delivery.Hooks{})
				if e == delivery.ErrEmpty {
					break
				}
				if e != nil {
					t.Fatal(e)
				}
			}
		}
		if count(`SELECT count(*) FROM intake.outbox_delivery WHERE consumer_id='M9' AND state<>'ACKED'`) != 0 {
			var info []byte
			_ = db.QueryRow(ctx, `SELECT COALESCE(json_agg(json_build_object('state',state,'attempts',attempts,'error',last_error_code,'lease',lease_until,'next',next_attempt_at,'now',now())),'[]') FROM intake.outbox_delivery WHERE consumer_id='M9' AND state<>'ACKED'`).Scan(&info)
			t.Fatal("M9 delivery incomplete", string(info))
		}
		if count(`SELECT count(*) FROM intake.outbox_delivery WHERE consumer_id IN ('M5','M6','M7') AND state='PENDING'`) == 0 {
			t.Fatal("future targets were removed/ACKed")
		}
		if count(`SELECT count(*) FROM notify_audit.audit_entries`) == 0 {
			t.Fatal("no durable audit")
		}
		var eventID string
		var payload []byte
		var digest []byte
		var version int64
		var correlation string
		var occurred time.Time
		if e = db.QueryRow(ctx, `SELECT event_id::text,payload,digest,aggregate_version,correlation_id::text,occurred_at FROM intake.outbox WHERE event_type='TicketCreated' ORDER BY event_id LIMIT 1`).Scan(&eventID, &payload, &digest, &version, &correlation, &occurred); e != nil {
			t.Fatal(e)
		}
		var p map[string]any
		_ = json.Unmarshal(payload, &p)
		var aggregate string
		_ = db.QueryRow(ctx, `SELECT aggregate_id::text FROM intake.outbox WHERE event_id=$1`, eventID).Scan(&aggregate)
		v := delivery.Event{ID: eventID, Type: "TicketCreated", Producer: "M3", SchemaVersion: 1, Aggregate: aggregate, Version: version, Correlation: correlation, Occurred: occurred, Payload: payload, Digest: digest}
		if e = runtime.Consumer.Consume(ctx, v); e != nil {
			t.Fatal(e)
		}
		v.Digest = make([]byte, 32)
		if !errors.Is(runtime.Consumer.Consume(ctx, v), delivery.ErrIntegrity) {
			t.Fatal("digest mismatch accepted")
		}
		v.Digest = digest
		v.Aggregate = web.ID()
		if !errors.Is(runtime.Consumer.Consume(ctx, v), delivery.ErrIntegrity) {
			t.Fatal("duplicate event envelope binding changed")
		}
		v.Aggregate = aggregate
		v.ID = web.ID()
		v.Version = 9
		v.Type = "TicketStateChanged"
		p["state"] = "OPEN"
		v.Payload, _ = json.Marshal(p)
		v.Digest, _ = delivery.Digest(v.Payload)
		if e = runtime.Consumer.Consume(ctx, v); e != nil {
			t.Fatal(e)
		}
		v.ID = web.ID()
		v.Version = 2
		if e = runtime.Consumer.Consume(ctx, v); e != nil {
			t.Fatal(e)
		}
		if count(`SELECT source_version FROM notify_audit.report_facts WHERE ticket_id=$1`, aggregate) != 9 {
			t.Fatal("projection moved backwards")
		}
		// A real consumer transaction failure must roll back both audit and inbox, then bounded retries dead-letter.
		retryID := web.ID()
		_, e = db.Exec(ctx, `INSERT INTO intake.outbox(event_id,event_type,schema_version,aggregate_id,aggregate_version,occurred_at,correlation_id,payload,digest) SELECT $1,event_type,schema_version,aggregate_id,aggregate_version,occurred_at,correlation_id,payload,digest FROM intake.outbox WHERE event_type='AuditRecorded' LIMIT 1`, retryID)
		if e != nil {
			t.Fatal(e)
		}
		_, e = db.Exec(ctx, `INSERT INTO intake.outbox_delivery(event_id,consumer_id,state) VALUES($1,'M9','PENDING')`, retryID)
		if e != nil {
			t.Fatal(e)
		}
		_, e = db.Exec(ctx, `CREATE FUNCTION notify_audit.test_inbox_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic consumer rollback'; END$$;CREATE TRIGGER test_inbox_fail BEFORE INSERT ON notify_audit.inbox FOR EACH ROW EXECUTE FUNCTION notify_audit.test_inbox_fail()`)
		if e != nil {
			t.Fatal(e)
		}
		clock := time.Now()
		source.Now = func() time.Time { return clock }
		if e = delivery.Step(ctx, source, runtime.Consumer, delivery.Hooks{}); e == nil {
			t.Fatal("consumer failure ignored")
		}
		if count(`SELECT count(*) FROM notify_audit.audit_entries WHERE source_event_id=$1`, retryID) != 0 || count(`SELECT count(*) FROM notify_audit.inbox WHERE event_id=$1`, retryID) != 0 {
			t.Fatal("partial consumer commit")
		}
		_, _ = db.Exec(ctx, `DROP TRIGGER test_inbox_fail ON notify_audit.inbox;DROP FUNCTION notify_audit.test_inbox_fail()`)
		for i := 1; i < 8; i++ {
			clock = clock.Add(2 * time.Minute)
			if e = delivery.Step(ctx, source, unavailableConsumer{}, delivery.Hooks{}); e == nil {
				t.Fatal("retry unexpectedly ACKed")
			}
		}
		if count(`SELECT count(*) FROM intake.outbox_delivery WHERE event_id=$1 AND state='DEAD_LETTER' AND attempts=8`, retryID) != 1 {
			t.Fatal("unbounded retry")
		}
		// Explicit operator fixture recovery preserves event identity/digest, never a fake ACK.
		_, _ = db.Exec(ctx, `UPDATE intake.outbox_delivery SET state='PENDING',attempts=0,next_attempt_at=now(),last_error_code='LAB_RECOVERY_APPROVED' WHERE event_id=$1 AND consumer_id='M9' AND state='DEAD_LETTER'`, retryID)
		clock = clock.Add(2 * time.Minute)
		if e = delivery.Step(ctx, source, runtime.Consumer, delivery.Hooks{}); e != nil {
			t.Fatal(e)
		}
		source.Now = time.Now
	})
	t.Run("restart_instances_live_membership_logout_and_guest_revoke", func(t *testing.T) {
		runtime2 := NewApplication(pools, m1.Options{Lab: true, Key: []byte("synthetic-m004-key-not-a-production-secret"), Origin: base})
		server.Config.Handler = runtime2.Handler
		public.request("GET", "/tickets/"+id, nil, 200, "", nil)
		_, _ = db.Exec(ctx, `UPDATE identity.subjects SET role_code='PLATFORM_ADMIN',kind='STAFF' WHERE id='20000000-0000-4000-8000-000000000001'`)
		public.request("GET", "/tickets/"+id, nil, 404, "", nil)
		_, _ = db.Exec(ctx, `UPDATE identity.subjects SET role_code='PUBLIC',kind='PUBLIC' WHERE id='20000000-0000-4000-8000-000000000001'`)
		_, _ = db.Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000003'`)
		asn.request("GET", "/tickets/"+asnID, nil, 404, "", nil)
		_, _ = db.Exec(ctx, `UPDATE identity.memberships SET revoked_at=NULL WHERE subject_id='20000000-0000-4000-8000-000000000003'`)
		operator.request("GET", "/tickets/"+id, nil, 200, "", nil)
		_, _ = db.Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000004'`)
		operator.request("GET", "/tickets/"+id, nil, 404, "", nil)
		_, _ = db.Exec(ctx, `UPDATE identity.memberships SET revoked_at=NULL WHERE subject_id='20000000-0000-4000-8000-000000000004'`)
		// Tracking CSRF is separately scoped and never becomes an M1 session.
		u, _ := http.NewRequest("GET", base, nil)
		trackCSRF := ""
		for _, c := range guest.http.Jar.Cookies(u.URL) {
			if c.Name == "helpdesk_tracking_csrf" {
				trackCSRF = c.Value
			}
		}
		guest.request("POST", "/tickets/"+guestID+"/capability/revoke", map[string]any{"expected_version": 1, "reason": "Fin uji"}, 200, "", map[string]string{"X-CSRF-Token": trackCSRF})
		guest.request("GET", "/tickets/"+guestID, nil, 401, "", nil)

		// Switching from a live guest session to an account and back must not resurrect guest access.
		if _, err := db.Exec(ctx, `UPDATE intake.guest_capabilities SET revoked_at=NULL WHERE ticket_id=$1`, guestID); err != nil {
			t.Fatal(err)
		}
		nonce := guest.request("GET", "/auth/bootstrap", nil, 200, "", nil)["csrf_token"].(string)
		guest.request("POST", "/guest/tracking-session", map[string]string{"csrf_token": nonce}, 201, "", map[string]string{"X-Guest-Capability": capability, "X-CSRF-Token": nonce})
		guest.login(2)
		for _, cookie := range guest.http.Jar.Cookies(u.URL) {
			if cookie.Name == "helpdesk_tracking" || cookie.Name == "helpdesk_tracking_csrf" {
				t.Fatal("account switch retained guest cookies")
			}
		}
		account := guest.request("GET", "/auth/me", nil, 200, "", nil)
		guest.request("POST", "/auth/logout", map[string]any{"expected_version": account["version"], "reason": "Uji pindah konteks"}, 200, "", nil)
		guest.request("GET", "/tickets/"+guestID, nil, 401, "", nil)
	})
	t.Run("catalog_change_between_snapshot_and_commit_is_rejected", func(t *testing.T) {
		identity := m1.NewRuntime(pools[0], m1.Options{Lab: true, Key: []byte("synthetic-m004-key-not-a-production-secret"), Origin: base})
		catalog := m2.NewRuntime(pools[1], identity.Port())
		classifier := changingClassifier{Base: m4.New(pools[3]).Port(), Change: func() {
			if _, e := db.Exec(ctx, `UPDATE catalog.services SET version=version+1 WHERE id=$1`, service); e != nil {
				t.Fatal(e)
			}
		}}
		intake := m3.NewRuntime(pools[2], identity.Port(), catalog.Port(), classifier, m5.NewRuntime(pools[4], identity.Port()).Port(), m6.New(pools[5]).Port(), []byte("synthetic-m004-key-not-a-production-secret"), base, root, os.Getenv("HELPDESK_TEST_SCANNER"))
		mux := http.NewServeMux()
		intake.Register(mux)
		server.Config.Handler = web.Guard(mux, base)
		before := count(`SELECT count(*) FROM intake.tickets`)
		public.request("POST", "/tickets", input, 409, "", nil)
		if count(`SELECT count(*) FROM intake.tickets`) != before {
			t.Fatal("stale snapshot committed")
		}
	})
}
