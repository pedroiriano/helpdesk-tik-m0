package bootstrap

import (
	"bufio"
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
)

type mockOIDC struct {
	key        *rsa.PrivateKey
	kid        string
	clientID   string
	secret     string
	srv        *httptest.Server
	mu         sync.Mutex
	codes      map[string]oidcAuthCode
	overrideID string
	nextClaims map[string]any
}

type oidcAuthCode struct {
	Challenge   string
	Nonce       string
	RedirectURI string
}

func newMockOIDC(t *testing.T) *mockOIDC {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	m := &mockOIDC{
		key:      priv,
		kid:      "depok-sso-k1",
		clientID: "helpdesk-tik-depok",
		secret:   "synthetic-oidc-client-secret-for-test",
		codes:    map[string]oidcAuthCode{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /jwks.json", func(w http.ResponseWriter, r *http.Request) {
		eBytes := big.NewInt(int64(m.key.PublicKey.E)).Bytes()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]any{{
				"kty": "RSA",
				"kid": m.kid,
				"use": "sig",
				"alg": "RS256",
				"n":   base64.RawURLEncoding.EncodeToString(m.key.PublicKey.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(eBytes),
			}},
		})
	})
	mux.HandleFunc("GET /authorize", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("client_id") != m.clientID || q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") == "" || q.Get("nonce") == "" {
			http.Error(w, "invalid oidc authorize request", http.StatusBadRequest)
			return
		}
		code := web.ID()
		m.mu.Lock()
		m.codes[code] = oidcAuthCode{
			Challenge:   q.Get("code_challenge"),
			Nonce:       q.Get("nonce"),
			RedirectURI: q.Get("redirect_uri"),
		}
		m.mu.Unlock()
		redir, _ := url.Parse(q.Get("redirect_uri"))
		rq := redir.Query()
		rq.Set("code", code)
		rq.Set("state", q.Get("state"))
		redir.RawQuery = rq.Encode()
		http.Redirect(w, r, redir.String(), http.StatusFound)
	})
	mux.HandleFunc("POST /token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		code := r.FormValue("code")
		m.mu.Lock()
		entry, ok := m.codes[code]
		if ok {
			delete(m.codes, code)
		}
		override := m.overrideID
		m.overrideID = ""
		extra := m.nextClaims
		m.nextClaims = nil
		m.mu.Unlock()
		if !ok || r.FormValue("client_id") != m.clientID || r.FormValue("client_secret") != m.secret || r.FormValue("redirect_uri") != entry.RedirectURI {
			http.Error(w, "invalid client or code", http.StatusUnauthorized)
			return
		}
		sum := sha256.Sum256([]byte(r.FormValue("code_verifier")))
		if base64.RawURLEncoding.EncodeToString(sum[:]) != entry.Challenge {
			http.Error(w, "pkce mismatch", http.StatusUnauthorized)
			return
		}
		idToken := override
		if idToken == "" {
			now := time.Now().UTC().Unix()
			claims := map[string]any{
				"iss":            m.srv.URL,
				"aud":            m.clientID,
				"sub":            "oidc-default-sub",
				"nonce":          entry.Nonce,
				"iat":            now,
				"exp":            now + 300,
				"email_verified": true,
			}
			for k, v := range extra {
				claims[k] = v
			}
			idToken = m.signRS256(t, claims)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-" + code, "token_type": "Bearer", "id_token": idToken})
	})
	m.srv = httptest.NewServer(mux)
	t.Cleanup(m.srv.Close)
	return m
}

func (m *mockOIDC) signRS256(t *testing.T, claims map[string]any) string {
	t.Helper()
	hdrRaw, _ := json.Marshal(map[string]any{"alg": "RS256", "typ": "JWT", "kid": m.kid})
	payRaw, _ := json.Marshal(claims)
	signed := base64.RawURLEncoding.EncodeToString(hdrRaw) + "." + base64.RawURLEncoding.EncodeToString(payRaw)
	sum := sha256.Sum256([]byte(signed))
	sig, err := rsa.SignPKCS1v15(rand.Reader, m.key, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatal(err)
	}
	return signed + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func (m *mockOIDC) setClaims(claims map[string]any) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nextClaims = claims
	m.overrideID = ""
}

func (m *mockOIDC) setRawIDToken(tok string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.overrideID = tok
}

type mockSMTP struct {
	addr     string
	mu       sync.Mutex
	messages []string
	ln       net.Listener
}

func startMockSMTP(t *testing.T) *mockSMTP {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	s := &mockSMTP{addr: ln.Addr().String(), ln: ln}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go s.serveConn(conn)
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })
	return s
}

func (s *mockSMTP) serveConn(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	w := bufio.NewWriter(conn)
	writeLine := func(line string) {
		_, _ = w.WriteString(line + "\r\n")
		_ = w.Flush()
	}
	writeLine("220 mock-smtp.local ESMTP")
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		cmd := strings.TrimSpace(line)
		upper := strings.ToUpper(cmd)
		switch {
		case strings.HasPrefix(upper, "EHLO") || strings.HasPrefix(upper, "HELO"):
			writeLine("250-mock-smtp.local")
			writeLine("250 SIZE 10485760")
		case strings.HasPrefix(upper, "MAIL FROM:") || strings.HasPrefix(upper, "RCPT TO:"):
			writeLine("250 OK")
		case upper == "DATA":
			writeLine("354 End data with <CR><LF>.<CR><LF>")
			dot := textproto.NewReader(r)
			raw, err := dot.ReadDotBytes()
			if err != nil {
				return
			}
			s.mu.Lock()
			s.messages = append(s.messages, string(raw))
			s.mu.Unlock()
			writeLine("250 Queued")
		case upper == "QUIT":
			writeLine("221 Bye")
			return
		default:
			writeLine("250 OK")
		}
	}
}

func TestFase3Integration(t *testing.T) {
	if os.Getenv("HELPDESK_FASE3_TEST") != "1" {
		t.Skip("NOT_RUN: isolated PostgreSQL opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe database target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Second)
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
	adminConn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer adminConn.Close(ctx)

	// Mock external endpoints before NewApplication
	oidc := newMockOIDC(t)
	smtpMock := startMockSMTP(t)
	_, smtpPortStr, _ := net.SplitHostPort(smtpMock.addr)

	var tgMu sync.Mutex
	tgStatus := 200
	var tgMessages []map[string]any
	const tgSecretToken = "999888777:AAABBBCCCDDD_SUPER_SECRET_BOT_TOKEN"
	tgSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bot"+tgSecretToken+"/sendMessage" {
			http.NotFound(w, r)
			return
		}
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		tgMu.Lock()
		st := tgStatus
		if st == 200 {
			tgMessages = append(tgMessages, body)
		}
		tgMu.Unlock()
		w.WriteHeader(st)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer tgSrv.Close()

	uploadRoot := t.TempDir()
	t.Setenv("HELPDESK_UPLOAD_ROOT", uploadRoot)
	t.Setenv("HELPDESK_SCANNER", "127.0.0.1:1")
	t.Setenv("HELPDESK_NOTIFY_TELEGRAM_ENABLED", "1")
	t.Setenv("HELPDESK_TELEGRAM_BOT_TOKEN", tgSecretToken)
	t.Setenv("HELPDESK_TELEGRAM_API_BASE", tgSrv.URL)
	t.Setenv("HELPDESK_NOTIFY_SMTP_ENABLED", "1")
	t.Setenv("HELPDESK_SMTP_HOST", "127.0.0.1")
	t.Setenv("HELPDESK_SMTP_PORT", smtpPortStr)
	t.Setenv("HELPDESK_SMTP_FROM", "helpdesk@depok.go.id")
	t.Setenv("HELPDESK_SMTP_TLS", "0")

	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	prodKey := []byte("synthetic-fase3-prod-key-at-least-32-bytes!")
	runtime := NewApplication(pools, m1.Options{
		Lab:          false,
		PublicAuth:   true,
		PurgeEnabled: true,
		Key:          prodKey,
		Origin:       base,
		SSO: m1.SSOOptions{
			Enabled:       true,
			ProviderLabel: "SSO Uji Depok",
			Issuer:        oidc.srv.URL,
			ClientID:      oidc.clientID,
			ClientSecret:  oidc.secret,
			AuthURL:       oidc.srv.URL + "/authorize",
			TokenURL:      oidc.srv.URL + "/token",
			JWKSURL:       oidc.srv.URL + "/jwks.json",
		},
	})
	server.Config.Handler = runtime.Handler
	server.Start()
	defer server.Close()

	eq := func(got, want any) {
		t.Helper()
		if got != want {
			t.Fatalf("got %v (%T), want %v (%T)", got, got, want, want)
		}
	}
	drain := func() {
		t.Helper()
		for _, b := range runtime.Bindings {
			for i := 0; i < 250; i++ {
				err := delivery.Step(ctx, b.Source, b.Consumer, delivery.Hooks{})
				if errors.Is(err, delivery.ErrEmpty) {
					break
				}
				if err != nil {
					t.Fatalf("delivery to %s: %v", b.Source.ConsumerID, err)
				}
			}
		}
	}
	noRedirectClient := func(jar http.CookieJar) *http.Client {
		return &http.Client{
			Jar:     jar,
			Timeout: 10 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	ssoLogin := func(claims map[string]any, expectedDest string) testClient {
		t.Helper()
		oidc.setClaims(claims)
		jar, _ := cookiejar.New(nil)
		hc := noRedirectClient(jar)
		req1, _ := http.NewRequest("GET", base+"/api/v1/auth/sso/login", nil)
		r1, err := hc.Do(req1)
		if err != nil {
			t.Fatal(err)
		}
		r1.Body.Close()
		eq(r1.StatusCode, http.StatusFound)
		authLoc := r1.Header.Get("Location")
		r2, err := hc.Get(authLoc)
		if err != nil {
			t.Fatal(err)
		}
		r2.Body.Close()
		eq(r2.StatusCode, http.StatusFound)
		cbLoc := r2.Header.Get("Location")
		r3, err := hc.Get(cbLoc)
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := io.ReadAll(r3.Body)
		r3.Body.Close()
		if r3.StatusCode != http.StatusSeeOther {
			t.Fatalf("sso callback status=%d body=%s", r3.StatusCode, raw)
		}
		eq(r3.Header.Get("Location"), base+expectedDest)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	}

	const orgA = "10000000-0000-4000-8000-000000000001"
	const teamA = "50000000-0000-4000-8000-000000000001"
	const svcA = "30000000-0000-4000-8000-000000000001"
	const catA = "40000000-0000-4000-8000-000000000010"
	const reason = "Pengujian hardening produksi Fase 3"

	// Seed active non-lab accounts for SSO, operator/tech handling, and dual Super Admin approval.
	const asnID = "21000000-0000-4000-8000-000000000001"
	const opID = "21000000-0000-4000-8000-000000000002"
	const techProdID = "21000000-0000-4000-8000-000000000003"
	const sa1ID = "21000000-0000-4000-8000-000000000004"
	const sa2ID = "21000000-0000-4000-8000-000000000005"
	const adminOpdID = "21000000-0000-4000-8000-000000000006"
	const coordProdID = "21000000-0000-4000-8000-000000000007"

	seedNonLab := func(id, kind, extRef, name, role, email string, perms []string) {
		_, err := adminConn.Exec(ctx, `INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture,email,email_verified_at,auth_provider)
			VALUES($1,$2,$3,$4,$5,false,$6,now(),'LOCAL') ON CONFLICT DO NOTHING`,
			id, kind, extRef, name, role, email)
		if err != nil {
			t.Fatal(err)
		}
		_, err = adminConn.Exec(ctx, `INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until)
			VALUES($1,$2,$3,$4,ARRAY[]::text[],'2035-12-31T00:00:00Z') ON CONFLICT DO NOTHING`,
			web.ID(), id, orgA, perms)
		if err != nil {
			t.Fatal(err)
		}
	}
	seedNonLab(asnID, "ASN", "199001012020121001", "ASN Prod Diskominfo", "ASN", "asn.prod@depok.go.id",
		[]string{"session.read", "session.revoke", "ticket.create", "ticket.read", "ticket.comment", "ticket.attach", "ticket.confirm", "ticket.transition", "notification.read", "notification.binding", "operation.read"})
	seedNonLab(opID, "STAFF", "199102022020121002", "Operator Prod Diskominfo", "OPERATOR", "op.prod@depok.go.id",
		[]string{"ticket.read", "ticket.verify", "ticket.dispatch", "ticket.comment", "ticket.attach", "ticket.transition", "operation.read"})
	seedNonLab(techProdID, "STAFF", "199203032020121003", "Teknisi Prod Diskominfo", "TECHNICIAN", "tech.prod@depok.go.id",
		[]string{"ticket.read", "ticket.resolve", "ticket.comment", "ticket.attach", "ticket.transition", "ticket.worklog", "operation.read"})
	seedNonLab(sa1ID, "STAFF", "198501012015011001", "Super Admin Satu", "SUPER_ADMIN", "sa1.prod@depok.go.id",
		[]string{"identity.grant", "system.job", "system.health", "system.purge.request", "operation.read", "ticket.read", "ticket.archive"})
	seedNonLab(sa2ID, "STAFF", "198602022016011002", "Super Admin Dua", "SUPER_ADMIN", "sa2.prod@depok.go.id",
		[]string{"identity.grant", "system.job", "system.health", "system.purge.request", "operation.read", "ticket.read", "ticket.archive"})
	seedNonLab(adminOpdID, "STAFF", "198803032018011003", "Admin OPD Prod", "PLATFORM_ADMIN", "adminopd.prod@depok.go.id",
		[]string{"identity.grant", "system.job", "system.health", "operation.read", "ticket.read", "ticket.archive"})
	seedNonLab(coordProdID, "STAFF", "198904042019011004", "Koordinator OPD Prod", "COORDINATOR", "coord.prod@depok.go.id",
		[]string{"ticket.read", "ticket.dispatch", "ticket.archive", "operation.read", "report.read"})
	_, err = adminConn.Exec(ctx, `INSERT INTO assignment.rosters(id,subject_id,team_id,skills,available_from,available_until)
		VALUES($1,$2,$3,ARRAY['hardware','network'],'2020-01-01T00:00:00Z','2035-12-31T00:00:00Z') ON CONFLICT DO NOTHING`,
		web.ID(), techProdID, teamA)
	if err != nil {
		t.Fatal(err)
	}
	// Production mode requires explicit M6 SLA policy targets per service (DEC-M04; no lab fallback).
	_, err = adminConn.Exec(ctx, `INSERT INTO sla.targets(id,service_id,calendar_id,policy_version,stage,priority,target_minutes)
		SELECT fixture.id::uuid,$1,c.id,1,fixture.stage,fixture.priority,fixture.minutes
		FROM sla.calendars c CROSS JOIN (VALUES
		  ('62100000-0000-4000-8000-000000000001','RESPONSE','LOW',60),
		  ('62100000-0000-4000-8000-000000000002','RESOLUTION','LOW',1440),
		  ('62100000-0000-4000-8000-000000000003','RESPONSE','NORMAL',30),
		  ('62100000-0000-4000-8000-000000000004','RESOLUTION','NORMAL',480),
		  ('62100000-0000-4000-8000-000000000005','RESPONSE','HIGH',15),
		  ('62100000-0000-4000-8000-000000000006','RESOLUTION','HIGH',240),
		  ('62100000-0000-4000-8000-000000000007','RESPONSE','CRITICAL',10),
		  ('62100000-0000-4000-8000-000000000008','RESOLUTION','CRITICAL',120)
		) AS fixture(id,stage,priority,minutes)
		WHERE c.code='CAL-247' AND c.calendar_version=1
		ON CONFLICT(id) DO NOTHING`, svcA)
	if err != nil {
		t.Fatal(err)
	}

	var anon, citizen, asnClient, opClient, techClient, sa1Client, sa2Client, platformAdminClient, coordClient testClient

	t.Log("1-prod-auth-gate-and-registration")
	{
		jar0, _ := cookiejar.New(nil)
		anon = testClient{t, base, &http.Client{Jar: jar0, Timeout: 10 * time.Second}}
		anon.request("GET", "/auth/bootstrap", nil, 403, "", nil)

		cfgResp := anon.request("GET", "/auth/config", nil, 200, "", nil)
		eq(cfgResp["mode"], "PRODUCTION")
		eq(cfgResp["lab_auth_enabled"], false)
		eq(cfgResp["public_auth_enabled"], true)
		eq(cfgResp["sso_enabled"], true)
		eq(cfgResp["purge_enabled"], true)
		nonce := cfgResp["csrf_token"].(string)

		// Lab quick login must fail in production mode
		anon.request("POST", "/auth/sessions", map[string]any{
			"lab_subject_id": "20000000-0000-4000-8000-000000000001", "csrf_token": nonce,
		}, 403, "", map[string]string{"X-CSRF-Token": nonce})

		// Citizen self-registration + email verification update + logout + credential login
		jarC, _ := cookiejar.New(nil)
		citizen = testClient{t, base, &http.Client{Jar: jarC, Timeout: 10 * time.Second}}
		cfgC := citizen.request("GET", "/auth/config", nil, 200, "", nil)
		regNonce := cfgC["csrf_token"].(string)
		reg := citizen.request("POST", "/auth/register", map[string]any{
			"nik":        "3276010101950009",
			"name":       "Warga Depok Fase Tiga",
			"email":      "warga.fase3@example.com",
			"phone":      "081234567890",
			"password":   "SandiwargaDepok#2026!",
			"csrf_token": regNonce,
		}, 201, "", map[string]string{"X-CSRF-Token": regNonce})
		citizenID := reg["subject_id"].(string)
		// Mark verified email on the non-lab registered user to emulate verified citizen contact
		if _, err := adminConn.Exec(ctx, `UPDATE identity.subjects SET email_verified_at=now() WHERE id=$1`, citizenID); err != nil {
			t.Fatal(err)
		}
		citizen.request("POST", "/auth/logout", map[string]any{
			"expected_version": 1, "reason": "Logout warga fase 3",
		}, 200, "", nil)
		// Wrong password -> 401
		cfgC2 := citizen.request("GET", "/auth/config", nil, 200, "", nil)
		n2 := cfgC2["csrf_token"].(string)
		citizen.request("POST", "/auth/sessions", map[string]any{
			"identifier": "warga.fase3@example.com", "password": "SalahPassword123!", "csrf_token": n2,
		}, 401, "", map[string]string{"X-CSRF-Token": n2})
		// Valid password -> 201
		citizen.request("POST", "/auth/sessions", map[string]any{
			"identifier": "warga.fase3@example.com", "password": "SandiwargaDepok#2026!", "csrf_token": n2,
		}, 201, "", map[string]string{"X-CSRF-Token": n2})
		sess := citizen.request("GET", "/auth/me", nil, 200, "", nil)
		eq(sess["mode"], "PRODUCTION_LOCAL")
		eq(sess["subject_id"], citizenID)

		// Verify a lab_fixture session token inserted out-of-band is rejected by Authenticate when !Lab
		labRawTok := strings.Repeat("a", 64)
		sum := sha256.Sum256([]byte(labRawTok))
		_, err := adminConn.Exec(ctx, `INSERT INTO identity.sessions(id,subject_id,token_hash,csrf_hash,expires_at)
			VALUES($1,'20000000-0000-4000-8000-000000000001',$2,$2,now()+interval '1 hour')`, web.ID(), sum[:])
		if err != nil {
			t.Fatal(err)
		}
		reqLab, _ := http.NewRequest("GET", base+"/api/v1/auth/me", nil)
		reqLab.AddCookie(&http.Cookie{Name: "helpdesk_session", Value: labRawTok})
		respLab, err := (&http.Client{Timeout: 5 * time.Second}).Do(reqLab)
		if err != nil {
			t.Fatal(err)
		}
		respLab.Body.Close()
		if respLab.StatusCode != 401 && respLab.StatusCode != 403 {
			t.Fatalf("expected lab session rejection, got %d", respLab.StatusCode)
		}
	}

	t.Log("2-oidc-pkce-jwks-sso")
	{
		// Negative: unknown identity -> 403
		oidc.setClaims(map[string]any{
			"sub":                "oidc-unknown-999",
			"preferred_username": "unknown-asn",
			"email":              "unknown@depok.go.id",
		})
		jarBad, _ := cookiejar.New(nil)
		hcBad := noRedirectClient(jarBad)
		r1, _ := hcBad.Get(base + "/api/v1/auth/sso/login")
		r1.Body.Close()
		r2, _ := hcBad.Get(r1.Header.Get("Location"))
		r2.Body.Close()
		r3, _ := hcBad.Get(r2.Header.Get("Location"))
		r3.Body.Close()
		eq(r3.StatusCode, 403)

		// Negative: mismatched state -> 403
		rStateBad, _ := hcBad.Get(base + "/api/v1/auth/sso/callback?state=forged&code=forged")
		rStateBad.Body.Close()
		if rStateBad.StatusCode != 401 && rStateBad.StatusCode != 403 {
			t.Fatalf("expected state mismatch 401/403, got %d", rStateBad.StatusCode)
		}

		// Negative: alg=none unsigned JWT -> 401
		hdrNone := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
		payNone := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"` + oidc.srv.URL + `","sub":"x","aud":"` + oidc.clientID + `"}`))
		oidc.setRawIDToken(hdrNone + "." + payNone + ".")
		jarNone, _ := cookiejar.New(nil)
		hcNone := noRedirectClient(jarNone)
		n1, _ := hcNone.Get(base + "/api/v1/auth/sso/login")
		n1.Body.Close()
		n2, _ := hcNone.Get(n1.Header.Get("Location"))
		n2.Body.Close()
		n3, _ := hcNone.Get(n2.Header.Get("Location"))
		n3.Body.Close()
		eq(n3.StatusCode, 401)

		// Negative: lab_fixture ASN account cannot SSO when !Lab -> 403
		_, err := adminConn.Exec(ctx, `UPDATE identity.subjects SET email='lab.asn3@depok.go.id', email_verified_at=now() WHERE id='20000000-0000-4000-8000-000000000003'`)
		if err != nil {
			t.Fatal(err)
		}
		oidc.setClaims(map[string]any{
			"sub":   "oidc-lab-blocked",
			"nip":   "LAB-SUBJECT-3",
			"email": "lab.asn3@depok.go.id",
		})
		jarLabSSO, _ := cookiejar.New(nil)
		hcLabSSO := noRedirectClient(jarLabSSO)
		l1, _ := hcLabSSO.Get(base + "/api/v1/auth/sso/login")
		l1.Body.Close()
		l2, _ := hcLabSSO.Get(l1.Header.Get("Location"))
		l2.Body.Close()
		l3, _ := hcLabSSO.Get(l2.Header.Get("Location"))
		l3.Body.Close()
		eq(l3.StatusCode, 403)

		// Positive: First login links OIDC subject to active non-lab ASN, redirects /tiket.html
		asnClient = ssoLogin(map[string]any{
			"sub":   "oidc-sub-asn-001",
			"nip":   "199001012020121001",
			"email": "asn.prod@depok.go.id",
		}, "/tiket.html")
		var linkedSub string
		if err := adminConn.QueryRow(ctx, `SELECT COALESCE(oidc_subject,'') FROM identity.subjects WHERE id=$1`, asnID).Scan(&linkedSub); err != nil {
			t.Fatal(err)
		}
		eq(linkedSub, "oidc-sub-asn-001")

		// Positive: Second login resolves by linked (oidc_issuer, oidc_subject) directly
		asnClient = ssoLogin(map[string]any{
			"sub": "oidc-sub-asn-001",
		}, "/tiket.html")

		// Non-lab STAFF SSO logins redirect to admin dashboard
		opClient = ssoLogin(map[string]any{"sub": "oidc-sub-op-002", "nip": "199102022020121002", "email": "op.prod@depok.go.id"}, "/admin/app/dashboard/index.html")
		techClient = ssoLogin(map[string]any{"sub": "oidc-sub-tech-003", "nip": "199203032020121003", "email": "tech.prod@depok.go.id"}, "/admin/app/dashboard/index.html")
		sa1Client = ssoLogin(map[string]any{"sub": "oidc-sub-sa-004", "nip": "198501012015011001", "email": "sa1.prod@depok.go.id"}, "/admin/app/dashboard/index.html")
		sa2Client = ssoLogin(map[string]any{"sub": "oidc-sub-sa-005", "nip": "198602022016011002", "email": "sa2.prod@depok.go.id"}, "/admin/app/dashboard/index.html")
		platformAdminClient = ssoLogin(map[string]any{"sub": "oidc-sub-adm-006", "nip": "198803032018011003", "email": "adminopd.prod@depok.go.id"}, "/admin/app/dashboard/index.html")
		coordClient = ssoLogin(map[string]any{"sub": "oidc-sub-coord-007", "nip": "198904042019011004", "email": "coord.prod@depok.go.id"}, "/admin/app/dashboard/index.html")

		// GET /api/v1/admin/subjects must NOT include lab_fixture=true seeded subjects when Lab=false
		citizen.request("GET", "/admin/subjects", nil, 403, "", nil)
		subjList := items(sa1Client.request("GET", "/admin/subjects?limit=100", nil, 200, "", nil))
		for _, item := range subjList {
			id := item.(map[string]any)["id"].(string)
			if strings.HasPrefix(id, "20000000-") {
				t.Fatalf("lab fixture leaked into /admin/subjects in production mode: %s", id)
			}
		}
	}

	var citizenTicketID string
	var citizenAttemptID string
	var citizenTicketVersion float64
	var blobKeyPath string

	t.Log("3-m9-production-delivery-and-replay")
	{
		// PUBLIC citizen cannot bind Telegram organization scope
		citizen.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version": 1, "scope_org_id": orgA, "channel": "TELEGRAM", "verification_code": "123456", "chat_ref": "998877665",
		}, 400, "", nil)

		// ASN binds verified TELEGRAM channel
		ch := asnClient.request("POST", "/notifications/sink-challenges", map[string]any{"scope_org_id": orgA}, 201, "", nil)
		bind := asnClient.request("POST", "/notifications/telegram-bindings", map[string]any{
			"expected_version":  1,
			"scope_org_id":      orgA,
			"channel":           "TELEGRAM",
			"verification_code": ch["code"],
			"chat_ref":          "998877665",
		}, 201, "", nil)
		if bind["id"] == "" {
			t.Fatal("expected telegram binding receipt")
		}

		resolveTicket := func(requester testClient, withAttachment bool) (string, string, float64) {
			created := requester.request("POST", "/tickets", map[string]any{
				"service_id": svcA, "service_version": 1, "form_version": 1, "policy_version": 1,
				"title": "Tiket Pengiriman Produksi Fase 3", "description": reason,
				"answers": map[string]string{"ringkasan": "Butuh bantuan jaringan produksi"},
			}, 201, "", nil)
			tid := created["id"].(string)
			tp := "/tickets/" + tid
			ver := created["version"]

			if withAttachment {
				var imgBuf bytes.Buffer
				img := image.NewRGBA(image.Rect(0, 0, 2, 2))
				img.Set(0, 0, color.RGBA{R: 12, G: 34, B: 56, A: 255})
				if err := png.Encode(&imgBuf, img); err != nil {
					t.Fatal(err)
				}
				reqUp, _ := http.NewRequest("POST", base+"/api/v1/tickets/"+tid+"/attachments", bytes.NewReader(imgBuf.Bytes()))
				reqUp.Header.Set("Content-Type", "application/octet-stream")
				reqUp.Header.Set("Origin", base)
				reqUp.Header.Set("X-CSRF-Token", requester.csrf())
				reqUp.Header.Set("Idempotency-Key", web.ID())
				reqUp.Header.Set("X-Expected-Version", fmt.Sprintf("%v", ver))
				reqUp.Header.Set("X-Filename", "bukti-purge.png")
				reqUp.Header.Set("X-File-Mime", "image/png")
				reqUp.Header.Set("X-Attachment-Audience", "REQUESTER")
				respUp, err := requester.http.Do(reqUp)
				if err != nil {
					t.Fatal(err)
				}
				rawUp, _ := io.ReadAll(respUp.Body)
				respUp.Body.Close()
				if respUp.StatusCode != 201 {
					t.Fatalf("upload failed status=%d body=%s", respUp.StatusCode, rawUp)
				}
				var sk string
				if err := adminConn.QueryRow(ctx, `SELECT storage_key FROM intake.attachments WHERE ticket_id=$1 LIMIT 1`, tid).Scan(&sk); err != nil {
					t.Fatal(err)
				}
				blobKeyPath = filepath.Join(uploadRoot, filepath.FromSlash(sk))
				if _, err := os.Stat(blobKeyPath); err != nil {
					t.Fatalf("expected uploaded blob on disk at %s: %v", blobKeyPath, err)
				}
				// Re-read ticket version after attachment bump
				cur := requester.request("GET", tp, nil, 200, "", nil)
				ver = cur["version"]
			}

			v := opClient.request("POST", tp+"/verify", map[string]any{
				"expected_version": ver, "category_id": catA, "priority": "NORMAL", "classifier_version": 2, "reason": reason,
			}, 200, "", nil)
			prop := opClient.request("GET", tp+"/dispatch-proposal?tier=L1", nil, 200, "", nil)
			v = opClient.request("POST", tp+"/dispatch", map[string]any{
				"expected_version": v["version"], "team_id": teamA, "assignee_id": techProdID,
				"proposal_version": v["version"], "proposal_digest": prop["digest"], "tier": "L1", "reason": reason,
			}, 200, "", nil)
			v = techClient.request("POST", tp+"/transitions", map[string]any{
				"expected_version": v["version"], "action": "START", "reason": reason,
			}, 200, "", nil)
			res := techClient.request("POST", tp+"/resolve", map[string]any{
				"expected_version": v["version"], "summary": reason,
			}, 200, "", nil)
			return tid, res["active_attempt_id"].(string), res["version"].(float64)
		}

		// A) Telegram delivery with 502 -> DEAD_LETTER -> admin list + replay -> ACKED
		tgMu.Lock()
		tgStatus = 502
		tgMu.Unlock()
		_, _, _ = resolveTicket(asnClient, false)
		drain()

		for attempt := 0; attempt < 5; attempt++ {
			if _, err := adminConn.Exec(ctx, `UPDATE notify_audit.delivery_jobs SET next_attempt_at=now()-interval '1 second' WHERE channel='TELEGRAM' AND state IN ('PENDING','FAILED')`); err != nil {
				t.Fatal(err)
			}
			processed, err := runtime.Notify.ProcessDeliveryBatch(ctx, 20)
			if err != nil {
				t.Fatal(err)
			}
			if processed == 0 {
				t.Fatal("expected telegram delivery attempt processed")
			}
		}

		// Negative: citizen cannot inspect admin delivery queue
		citizen.request("GET", "/admin/delivery-jobs", nil, 403, "", nil)
		dlList := items(sa1Client.request("GET", "/admin/delivery-jobs?state=DEAD_LETTER", nil, 200, "", nil))
		if len(dlList) != 1 {
			t.Fatalf("expected 1 dead-letter telegram job, got %d", len(dlList))
		}
		dlJob := dlList[0].(map[string]any)
		dlID := dlJob["id"].(string)
		eq(dlJob["channel"], "TELEGRAM")
		eq(dlJob["state"], "DEAD_LETTER")
		if strings.Contains(dlJob["last_error_code"].(string), tgSecretToken) || strings.Contains(dlJob["last_error_code"].(string), "AAABBB") {
			t.Fatalf("telegram secret leaked into error code: %s", dlJob["last_error_code"])
		}

		// Negative replay checks: missing Idempotency-Key (400), stale version (409)
		sa1Client.request("POST", "/admin/delivery-jobs/"+dlID+"/replay", map[string]any{
			"expected_version": dlJob["version"], "reason": "Replay uji 409/400",
		}, 400, "short", nil)
		sa1Client.request("POST", "/admin/delivery-jobs/"+dlID+"/replay", map[string]any{
			"expected_version": 999, "reason": "Replay uji versi usang",
		}, 409, "", nil)

		// Positive replay + successful Telegram delivery
		tgMu.Lock()
		tgStatus = 200
		tgMu.Unlock()
		replayed := sa1Client.request("POST", "/admin/delivery-jobs/"+dlID+"/replay", map[string]any{
			"expected_version": dlJob["version"], "reason": "Bot Telegram pulih",
		}, 200, "", nil)
		eq(replayed["state"], "PENDING")
		nProcessed, err := runtime.Notify.ProcessDeliveryBatch(ctx, 20)
		if err != nil || nProcessed < 1 {
			t.Fatalf("telegram replay delivery failed: n=%d err=%v", nProcessed, err)
		}
		tgMu.Lock()
		tgCount := len(tgMessages)
		var sentChat any
		if tgCount > 0 {
			sentChat = tgMessages[0]["chat_id"]
		}
		tgMu.Unlock()
		if tgCount != 1 || sentChat != "998877665" {
			t.Fatalf("unexpected telegram dispatches count=%d chat=%v", tgCount, sentChat)
		}

		// B) Email SMTP delivery for non-lab citizen without Telegram binding
		citizenTicketID, citizenAttemptID, citizenTicketVersion = resolveTicket(citizen, true)
		drain()
		nMail, err := runtime.Notify.ProcessDeliveryBatch(ctx, 20)
		if err != nil || nMail < 1 {
			t.Fatalf("email delivery failed: n=%d err=%v", nMail, err)
		}
		smtpMock.mu.Lock()
		mailCount := len(smtpMock.messages)
		var mailBody string
		if mailCount > 0 {
			mailBody = smtpMock.messages[0]
		}
		smtpMock.mu.Unlock()
		if mailCount != 1 || !strings.Contains(mailBody, "To: warga.fase3@example.com") {
			t.Fatalf("expected 1 SMTP message to warga.fase3@example.com, got count=%d body=%q", mailCount, mailBody)
		}
		// Verify delivered EMAIL job target is masked in admin view
		ackedList := items(sa1Client.request("GET", "/admin/delivery-jobs?state=ACKED", nil, 200, "", nil))
		foundMaskedMail := false
		for _, raw := range ackedList {
			j := raw.(map[string]any)
			if j["channel"] == "EMAIL" {
				foundMaskedMail = true
				eq(j["target_masked"], "w***@example.com")
			}
		}
		if !foundMaskedMail {
			t.Fatal("expected ACKED EMAIL delivery job in /admin/delivery-jobs")
		}
	}

	t.Log("4-m1-m3-retention-and-controlled-purge")
	{
		// Verify PURGE_REQUEST records DISABLED when PurgeEnabled=false
		disSrv := httptest.NewUnstartedServer(nil)
		disBase := "http://" + disSrv.Listener.Addr().String()
		disabledRuntime := NewApplication(pools, m1.Options{Lab: false, PublicAuth: true, PurgeEnabled: false, Key: prodKey, Origin: disBase})
		disSrv.Config.Handler = disabledRuntime.Handler
		disSrv.Start()
		defer disSrv.Close()
		uBase, _ := url.Parse(base)
		disURL, _ := url.Parse(disBase)
		jarDis, _ := cookiejar.New(nil)
		jarDis.SetCookies(disURL, sa1Client.http.Jar.Cookies(uBase))
		disSA := testClient{t, disBase, &http.Client{Jar: jarDis, Timeout: 10 * time.Second}}
		disJob := disSA.request("POST", "/admin/purge-requests", map[string]any{
			"target_id": citizenTicketID, "reason": reason,
		}, 202, "", nil)
		eq(disJob["state"], "DISABLED")

		// Confirm resolution so citizenTicket enters CLOSED
		closed := citizen.request("POST", "/tickets/"+citizenTicketID+"/confirmation", map[string]any{
			"expected_version": citizenTicketVersion,
			"attempt_id":       citizenAttemptID,
			"decision":         "ACCEPT",
		}, 200, "", nil)
		eq(closed["state"], "CLOSED")
		ver := closed["version"]

		// Non-archived ticket -> preflight 409
		sa1Client.request("POST", "/admin/purge-requests", map[string]any{
			"target_id": citizenTicketID, "reason": reason,
		}, 409, "", nil)

		// Separation of duties: Super Admin cannot read/archive operational ticket (404); Coordinator archives & configures retention
		sa1Client.request("POST", "/tickets/"+citizenTicketID+"/archive", map[string]any{
			"expected_version": ver, "reason": reason,
		}, 404, "", nil)

		arch := coordClient.request("POST", "/tickets/"+citizenTicketID+"/archive", map[string]any{
			"expected_version": ver, "reason": reason,
		}, 200, "", nil)
		ver = arch["version"]

		// Legal hold blocks purge -> 409
		retHold := coordClient.request("POST", "/tickets/"+citizenTicketID+"/retention", map[string]any{
			"expected_version": ver, "legal_hold": true, "retention_until": time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339), "reason": reason,
		}, 200, "", nil)
		ver = retHold["version"]
		sa1Client.request("POST", "/admin/purge-requests", map[string]any{
			"target_id": citizenTicketID, "reason": reason,
		}, 409, "", nil)

		// Future retention_until blocks purge -> 409
		retFuture := coordClient.request("POST", "/tickets/"+citizenTicketID+"/retention", map[string]any{
			"expected_version": ver, "legal_hold": false, "retention_until": time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339), "reason": reason,
		}, 200, "", nil)
		ver = retFuture["version"]
		sa1Client.request("POST", "/admin/purge-requests", map[string]any{
			"target_id": citizenTicketID, "reason": reason,
		}, 409, "", nil)

		// Stale version -> 409; valid past retention_until -> 200
		coordClient.request("POST", "/tickets/"+citizenTicketID+"/retention", map[string]any{
			"expected_version": 999, "legal_hold": false, "retention_until": time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339), "reason": reason,
		}, 409, "", nil)
		retReady := coordClient.request("POST", "/tickets/"+citizenTicketID+"/retention", map[string]any{
			"expected_version": ver, "legal_hold": false, "retention_until": time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339), "reason": reason,
		}, 200, "", nil)
		ver = retReady["version"]

		// Create purge job -> REQUESTED
		pj := sa1Client.request("POST", "/admin/purge-requests", map[string]any{
			"target_id": citizenTicketID, "reason": reason,
		}, 202, "", nil)
		eq(pj["state"], "REQUESTED")
		pjID := pj["id"].(string)

		// Same Super Admin cannot approve own purge -> 403; non-Super Admin PLATFORM_ADMIN cannot approve -> 403
		sa1Client.request("POST", "/admin/operations/"+pjID+"/approve", map[string]any{
			"expected_version": pj["version"], "reason": reason,
		}, 403, "", nil)
		platformAdminClient.request("POST", "/admin/operations/"+pjID+"/approve", map[string]any{
			"expected_version": pj["version"], "reason": reason,
		}, 403, "", nil)

		// Second Super Admin approves -> APPROVED
		approved := sa2Client.request("POST", "/admin/operations/"+pjID+"/approve", map[string]any{
			"expected_version": pj["version"], "reason": reason,
		}, 200, "", nil)
		eq(approved["state"], "APPROVED")

		// Execute purge -> SUCCEEDED + blob removed
		executed := sa1Client.request("POST", "/admin/operations/"+pjID+"/execute", map[string]any{
			"expected_version": approved["version"], "reason": reason,
		}, 200, "", nil)
		eq(executed["state"], "SUCCEEDED")
		rcpt := executed["execution_receipt"].(map[string]any)
		eq(rcpt["status"], "PURGED")
		eq(rcpt["blobs_removed"], float64(1))

		// Verify DB redaction, attachments deleted, disk blob deleted, history & audit preserved, restore-archive blocked
		var title string
		var purged bool
		if err := adminConn.QueryRow(ctx, `SELECT title,(purged_at IS NOT NULL) FROM intake.tickets WHERE id=$1`, citizenTicketID).Scan(&title, &purged); err != nil {
			t.Fatal(err)
		}
		eq(title, "[DIMUSNAHKAN SESUAI RETENSI]")
		eq(purged, true)

		var attachCount int
		if err := adminConn.QueryRow(ctx, `SELECT count(*) FROM intake.attachments WHERE ticket_id=$1`, citizenTicketID).Scan(&attachCount); err != nil {
			t.Fatal(err)
		}
		eq(attachCount, 0)
		if _, err := os.Stat(blobKeyPath); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("expected purged blob %s deleted from disk, stat err=%v", blobKeyPath, err)
		}

		// History & M9 audit must survive purge
		var histCount int
		if err := adminConn.QueryRow(ctx, `SELECT count(*) FROM intake.ticket_versions WHERE ticket_id=$1 AND action='PurgeRetentionTicket'`, citizenTicketID).Scan(&histCount); err != nil {
			t.Fatal(err)
		}
		eq(histCount, 1)

		drain()
		coordClient.request("POST", "/tickets/"+citizenTicketID+"/restore-archive", map[string]any{
			"expected_version": int64(ver.(float64)) + 1, "reason": reason,
		}, 409, "", nil)
	}
}
