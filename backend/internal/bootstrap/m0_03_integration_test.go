package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type testClient struct {
	t    *testing.T
	base string
	http *http.Client
}

func (c testClient) csrf() string {
	u, _ := url.Parse(c.base)
	for _, v := range c.http.Jar.Cookies(u) {
		if v.Name == "helpdesk_tracking_csrf" {
			return v.Value
		}
	}
	for _, v := range c.http.Jar.Cookies(u) {
		if v.Name == "helpdesk_csrf" {
			return v.Value
		}
	}
	return ""
}
func (c testClient) request(method, path string, body any, want int, key string, headers map[string]string) map[string]any {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, c.base+"/api/v1"+path, reader)
	req.Header.Set("Origin", c.base)
	if method != "GET" {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", c.csrf())
		if key == "" {
			key = web.ID()
		}
		req.Header.Set("Idempotency-Key", key)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	response, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(response.Body)
	if path == "/auth/sessions" && want == 201 {
		found := false
		for _, cookie := range response.Cookies() {
			if cookie.Name == "helpdesk_session" {
				found = true
				if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || len(cookie.Value) != 64 || bytes.Contains(raw, []byte(cookie.Value)) {
					c.t.Fatal("session cookie or disclosure policy violated")
				}
			}
		}
		if !found {
			c.t.Fatal("session cookie missing")
		}
	}
	if response.StatusCode != want {
		c.t.Fatalf("%s %s got %d want %d: %s", method, path, response.StatusCode, want, raw)
	}
	if len(raw) == 0 {
		return nil
	}
	var result map[string]any
	if err = json.Unmarshal(raw, &result); err != nil {
		c.t.Fatalf("not JSON: %s", raw)
	}
	return result
}
func (c testClient) login(index int) {
	boot := c.request("GET", "/auth/bootstrap", nil, 200, "", nil)
	subject := fmt.Sprintf("20000000-0000-4000-8000-%012d", index)
	nonce := boot["csrf_token"].(string)
	c.request("POST", "/auth/sessions", map[string]any{"lab_subject_id": subject, "csrf_token": nonce}, 201, "", map[string]string{"X-CSRF-Token": nonce})
}
func items(v map[string]any) []any { return v["items"].([]any) }

func TestM003Integration(t *testing.T) {
	if os.Getenv("HELPDESK_M003_TEST") != "1" {
		t.Skip("NOT_RUN: isolated PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe integration target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
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
	if err = pools.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgx.ParseConfig("postgres://postgres@localhost/helpdesk?sslmode=disable")
	cfg.Host = host
	cfg.Password = password
	admin, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(ctx)
	key := []byte("synthetic-lab-test-key-no-production-credentials")
	srv := httptest.NewUnstartedServer(nil)
	base := "http://" + srv.Listener.Addr().String()
	srv.Config.Handler = Application(pools, m1.Options{Lab: true, Key: key, Origin: base})
	srv.Start()
	defer srv.Close()
	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 8 * time.Second}}
	}
	guest, public, asn, operator, manager, other := client(), client(), client(), client(), client(), client()
	orgA := "10000000-0000-4000-8000-000000000001"
	orgB := "10000000-0000-4000-8000-000000000002"
	serviceA := "30000000-0000-4000-8000-000000000003"
	t.Run("guest_public_ASN_staff_audience_and_hidden_detail", func(t *testing.T) {
		if len(items(guest.request("GET", "/catalog/services", nil, 200, "", nil))) != 1 {
			t.Fatal("guest audience leak")
		}
		guest.request("GET", "/catalog/services/"+serviceA, nil, 404, "", map[string]string{"X-Role": "SUPER_ADMIN", "X-User-Kind": "ASN"})
		guest.request("GET", "/admin/services", nil, 401, "", nil)
		public.login(1)
		asn.login(3)
		operator.login(4)
		manager.login(5)
		other.login(6)
		if len(items(public.request("GET", "/catalog/services", nil, 200, "", nil))) != 2 {
			t.Fatal("public audience leak")
		}
		if len(items(asn.request("GET", "/catalog/services", nil, 200, "", nil))) != 3 {
			t.Fatal("ASN audience leak")
		}
		if len(items(operator.request("GET", "/catalog/services", nil, 200, "", nil))) != 3 {
			t.Fatal("staff audience leak")
		}
		asn.request("GET", "/catalog/services/30000000-0000-4000-8000-000000000005", nil, 404, "", nil)
		public.request("GET", "/catalog/services/"+serviceA+"/form", nil, 404, "", nil)
		operator.request("GET", "/admin/services", nil, 403, "", nil)
		first := guest.request("GET", "/catalog/services?limit=1", nil, 200, "", nil)
		if len(items(first)) != 1 || first["next_cursor"] != nil {
			t.Fatal("cursor leaks hidden count")
		}
		guest.request("GET", "/catalog/services?limit=101", nil, 400, "", nil)
	})
	t.Run("trusted_actor_CSRF_CORS_allowlist_and_disabled_lab", func(t *testing.T) {
		me := public.request("GET", "/auth/me", nil, 200, "", map[string]string{"X-User-ID": "20000000-0000-4000-8000-000000000005", "X-Role": "PLATFORM_ADMIN", "X-User-Kind": "ASN"})
		if me["subject_id"] != "20000000-0000-4000-8000-000000000001" {
			t.Fatal("forged actor accepted")
		}
		boot := guest.request("GET", "/auth/bootstrap", nil, 200, "", nil)
		payload := map[string]any{"lab_subject_id": "20000000-0000-4000-8000-000000000005", "csrf_token": boot["csrf_token"], "role": "SUPER_ADMIN"}
		guest.request("POST", "/auth/sessions", payload, 400, "", map[string]string{"X-CSRF-Token": boot["csrf_token"].(string)})
		delete(payload, "role")
		payload["lab_subject_id"] = web.ID()
		guest.request("POST", "/auth/sessions", payload, 401, "", map[string]string{"X-CSRF-Token": boot["csrf_token"].(string)})
		manager.request("POST", "/admin/services", map[string]any{}, 403, "", map[string]string{"Origin": "https://evil.invalid"})
		manager.request("POST", "/admin/services", map[string]any{}, 403, "", map[string]string{"X-CSRF-Token": "wrong"})
		blocked := httptest.NewUnstartedServer(nil)
		origin := "http://" + blocked.Listener.Addr().String()
		blocked.Config.Handler = Application(pools, m1.Options{Origin: origin})
		blocked.Start()
		defer blocked.Close()
		v := client()
		v.base = origin
		v.request("GET", "/auth/bootstrap", nil, 403, "", nil)
	})
	var createdID string
	t.Run("catalog_persistence_idempotency_CAS_and_atomic_audit", func(t *testing.T) {
		input := map[string]any{"code": "LAB-API-CREATED", "name": "Layanan dibuat API", "active": true, "owner_org_id": orgA, "access_mode": "PUBLIC_GUEST", "form_version": 1, "category_id": nil}
		key := web.ID()
		created := manager.request("POST", "/admin/services", input, 201, key, nil)
		createdID = created["id"].(string)
		replay := manager.request("POST", "/admin/services", input, 201, key, nil)
		if replay["id"] != createdID {
			t.Fatal("replay duplicated service")
		}
		input["name"] = "changed intent"
		manager.request("POST", "/admin/services", input, 409, key, nil)
		input["expected_version"] = 1
		manager.request("PUT", "/admin/services/"+createdID, input, 200, "", nil)
		manager.request("PUT", "/admin/services/"+createdID, input, 409, "", nil)
		other.request("PUT", "/admin/services/"+createdID, input, 404, "", nil)
		rows := other.request("GET", "/admin/services", nil, 200, "", nil)
		for _, row := range items(rows) {
			if row.(map[string]any)["owner_org_id"] != orgB {
				t.Fatal("cross OPD list")
			}
		}
		var count int
		err := admin.QueryRow(ctx, `SELECT count(*) FROM catalog.audit_intents WHERE object_id=$1`, createdID).Scan(&count)
		if err != nil || count != 2 {
			t.Fatal("non-atomic or duplicate audit", count, err)
		}
		err = admin.QueryRow(ctx, `SELECT count(*) FROM catalog.outbox_delivery d JOIN catalog.outbox o USING(event_id) WHERE o.aggregate_id=$1 AND d.consumer_id='M9' AND d.state='PENDING'`, createdID).Scan(&count)
		if err != nil || count != 2 {
			t.Fatal("audit delivery missing")
		}
	})
	t.Run("immutable_form_policy_and_validation", func(t *testing.T) {
		current := manager.request("GET", "/admin/services/"+createdID, nil, 200, "", nil)
		fields := []any{map[string]any{"key": "kejadian", "label": "Kejadian", "kind": "text", "required": true, "options": []string{}}}
		form := manager.request("PUT", "/admin/services/"+createdID+"/form", map[string]any{"expected_version": current["version"], "form_version": 2, "fields": fields}, 200, "", nil)
		if form["form_version"] != float64(2) {
			t.Fatal("form version")
		}
		old := manager.request("GET", "/admin/services/"+createdID+"/form?version=1", nil, 200, "", nil)
		if len(old["fields"].([]any)) != 0 {
			t.Fatal("old form overwritten")
		}
		manager.request("PUT", "/admin/services/"+createdID+"/form", map[string]any{"expected_version": form["version"], "form_version": 3, "fields": append(fields, fields[0])}, 422, "", nil)
		policy := manager.request("PUT", "/admin/services/"+createdID+"/policy", map[string]any{"expected_version": form["version"], "policy_version": 2, "upload_max_bytes": 1024, "allowed_mime": []string{"image/png"}, "audience_org_ids": []string{orgA}}, 200, "", nil)
		if policy["policy_version"] != float64(2) {
			t.Fatal("policy version")
		}
	})
	t.Run("master_org_team_category_membership_and_grant_ceiling", func(t *testing.T) {
		created := manager.request("POST", "/admin/organizations", map[string]any{"code": "LAB-NEW", "name": "Organisasi API", "active": true}, 201, "", nil)
		id := created["id"].(string)
		manager.request("PUT", "/admin/organizations/"+id, map[string]any{"expected_version": 1, "code": "LAB-NEW", "name": "Organisasi API nonaktif", "active": false}, 200, "", nil)
		manager.request("PUT", "/admin/organizations/"+id, map[string]any{"expected_version": 2, "code": "LAB-NEW", "name": "Organisasi API aktif", "active": true}, 200, "", nil)
		team := manager.request("POST", "/admin/teams", map[string]any{"organization_id": orgA, "name": "Tim API", "active": true}, 201, "", nil)
		manager.request("PUT", "/admin/teams/"+team["id"].(string), map[string]any{"expected_version": 1, "organization_id": orgA, "name": "Tim API nonaktif", "active": false}, 200, "", nil)
		category := manager.request("POST", "/admin/categories", map[string]any{"owner_org_id": orgA, "code": "LAB-API-CAT", "name": "Kategori API", "active": true}, 201, "", nil)
		manager.request("PUT", "/admin/categories/"+category["id"].(string), map[string]any{"expected_version": 1, "owner_org_id": orgA, "code": "LAB-API-CAT", "name": "Kategori API", "active": false}, 200, "", nil)
		manager.request("PUT", "/admin/categories/40000000-0000-4000-8000-000000000002", map[string]any{"expected_version": 1, "owner_org_id": orgA, "code": "LAB-HIDDEN", "name": "Hidden", "active": true}, 404, "", nil)
		binding := map[string]any{"subject_id": "20000000-0000-4000-8000-000000000002", "organization_id": orgA, "team_id": nil, "permissions": []string{"notification.read"}, "expires_at": time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339), "reason": "fixture grant"}
		b := manager.request("POST", "/admin/memberships", binding, 201, "", nil)
		binding["expected_version"] = 1
		binding["revoked"] = true
		manager.request("PUT", "/admin/memberships/"+b["id"].(string), binding, 200, "", nil)
		binding["permissions"] = []string{"system.purge.request"}
		manager.request("POST", "/admin/memberships", binding, 403, "", nil)
		manager.request("PUT", "/admin/teams/50000000-0000-4000-8000-000000000002", map[string]any{"organization_id": orgA, "expected_version": 1, "name": "forged", "active": true}, 404, "", nil)
		manager.request("GET", "/admin/teams?organization_id="+orgB, nil, 404, "", nil)
		manager.request("GET", "/admin/categories?organization_id="+orgB, nil, 404, "", nil)
		manager.request("GET", "/admin/categories?organization_id="+orgA+"&limit=1", nil, 200, "", nil)
	})
	t.Run("live_membership_revoke_expiry_and_logout", func(t *testing.T) {
		if _, err := admin.Exec(ctx, `UPDATE identity.memberships SET revoked_at=now() WHERE subject_id='20000000-0000-4000-8000-000000000003'`); err != nil {
			t.Fatal(err)
		}
		asn.request("GET", "/catalog/services/"+serviceA, nil, 404, "", nil)
		session := public.request("GET", "/auth/me", nil, 200, "", nil)
		public.request("POST", "/auth/logout", map[string]any{"expected_version": session["version"], "reason": "integration logout"}, 200, "", nil)
		public.request("GET", "/auth/me", nil, 401, "", nil)
		expiring := client()
		expiring.login(2)
		me := expiring.request("GET", "/auth/me", nil, 200, "", nil)
		if _, err := admin.Exec(ctx, `UPDATE identity.sessions SET expires_at=now()-interval '1 second' WHERE id=$1`, me["id"]); err != nil {
			t.Fatal(err)
		}
		expiring.request("GET", "/auth/me", nil, 401, "", nil)
		revoked := client()
		revoked.login(4)
		me = revoked.request("GET", "/auth/me", nil, 200, "", nil)
		if _, err := admin.Exec(ctx, `UPDATE identity.sessions SET revoked_at=now() WHERE id=$1`, me["id"]); err != nil {
			t.Fatal(err)
		}
		revoked.request("GET", "/auth/me", nil, 401, "", nil)
	})
	t.Run("new_pools_and_module_instances_preserve_session_and_master", func(t *testing.T) {
		reopened, e := database.Open(ctx, host, secrets)
		if e != nil {
			t.Fatal(e)
		}
		defer reopened.Close()
		next := httptest.NewUnstartedServer(nil)
		origin := "http://" + next.Listener.Addr().String()
		next.Config.Handler = Application(reopened, m1.Options{Lab: true, Key: key, Origin: origin})
		next.Start()
		defer next.Close()
		persisted := manager
		persisted.base = origin
		persisted.request("GET", "/auth/me", nil, 200, "", nil)
		persisted.request("GET", "/admin/services/"+createdID, nil, 200, "", nil)
	})
	t.Run("domain_marker_and_audit_contract", func(t *testing.T) {
		if _, err := admin.Exec(ctx, `UPDATE identity.domain_version SET version=2`); err != nil {
			t.Fatal(err)
		}
		guest.request("GET", "/health/ready", nil, 503, "", nil)
		if _, err := admin.Exec(ctx, `UPDATE identity.domain_version SET version=3`); err != nil {
			t.Fatal(err)
		}
		var invalid int
		err := admin.QueryRow(ctx, `SELECT count(*) FROM identity.outbox WHERE payload->>'reason'='' OR NOT(payload ? 'actor_id')`).Scan(&invalid)
		if err != nil || invalid != 0 {
			t.Fatal("audit event violates contract", invalid, err)
		}
	})
}
