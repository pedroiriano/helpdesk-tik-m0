package app

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m1/internal/domain"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type SSOOptions struct {
	Enabled       bool
	ProviderLabel string
	Issuer        string
	ClientID      string
	ClientSecret  string
	AuthURL       string
	TokenURL      string
	JWKSURL       string
	RedirectURL   string
}

type AuthConfigView struct {
	Mode              string        `json:"mode"`
	CSRFToken         string        `json:"csrf_token"`
	LabAuthEnabled    bool          `json:"lab_auth_enabled"`
	PublicAuthEnabled bool          `json:"public_auth_enabled"`
	SSOEnabled        bool          `json:"sso_enabled"`
	SSOProviderLabel  string        `json:"sso_provider_label"`
	SSOLoginURL       string        `json:"sso_login_url"`
	PurgeEnabled      bool          `json:"purge_enabled"`
	Subjects          []api.Subject `json:"subjects,omitempty"`
}

func (s *Service) IssueAuthChallenge(ctx context.Context) (AuthConfigView, string, error) {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return AuthConfigView{}, "", err
	}
	token := hex.EncodeToString(nonce)
	mode := "PRODUCTION"
	var subjects []api.Subject
	if s.Options.Lab {
		mode = "SYNTHETIC_LAB"
		users, err := s.Subjects(ctx)
		if err != nil {
			return AuthConfigView{}, "", err
		}
		subjects = users
	}
	label := strings.TrimSpace(s.Options.SSO.ProviderLabel)
	if label == "" {
		label = "SSO ASN Pemerintah Kota Depok"
	}
	return AuthConfigView{
		Mode:              mode,
		CSRFToken:         token,
		LabAuthEnabled:    s.Options.Lab,
		PublicAuthEnabled: s.Options.Lab || s.Options.PublicAuth,
		SSOEnabled:        s.Options.SSO.Enabled && s.validSSOConfig(),
		SSOProviderLabel:  label,
		SSOLoginURL:       "/api/v1/auth/sso/login",
		PurgeEnabled:      s.Options.PurgeEnabled,
		Subjects:          subjects,
	}, token, nil
}

func (s *Service) AdminSubjects(ctx context.Context, c api.Credentials, includeInactive bool, limit int) ([]api.Subject, error) {
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return nil, err
	}
	if actor.Kind != "STAFF" || !s.hasPermission(actor, "identity.grant") {
		return nil, web.Fail(403, "Izin identity.grant diperlukan untuk melihat daftar akun")
	}
	return s.Store.ListSubjectsAdmin(ctx, s.Options.Lab, includeInactive, limit)
}

func validSubjectRoleForKind(kind, role string) bool {
	switch kind {
	case "PUBLIC":
		return role == "PUBLIC"
	case "ASN":
		return role == "ASN"
	case "STAFF":
		return role == "SUPER_ADMIN" || editableRole(role)
	}
	return false
}

func (s *Service) SaveSubject(ctx context.Context, c api.Credentials, id, key string, in api.SubjectWriteInput) (database.Result, error) {
	c.Write = true
	actor, err := s.Authenticate(ctx, c)
	if err != nil {
		return database.Result{}, err
	}
	if actor.Kind != "STAFF" || !s.hasPermission(actor, "identity.grant") {
		return database.Result{}, web.Fail(403, "Izin identity.grant diperlukan untuk mengelola akun")
	}

	create := id == ""
	if create {
		id = web.ID()
	} else {
		if !web.UUID(id) {
			return database.Result{}, web.Fail(404, "Akun pengguna tidak ditemukan")
		}
		if in.ExpectedVersion < 1 {
			return database.Result{}, web.Fail(422, "Expected version diperlukan")
		}
	}

	in.Name = strings.TrimSpace(in.Name)
	in.Kind = strings.TrimSpace(in.Kind)
	in.Role = strings.TrimSpace(in.Role)
	in.ExternalRef = strings.TrimSpace(in.ExternalRef)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Phone = strings.TrimSpace(in.Phone)

	if utf8.RuneCountInString(in.Name) < 2 || utf8.RuneCountInString(in.Name) > 200 {
		return database.Result{}, web.Fail(422, "Nama lengkap akun harus 2–200 karakter")
	}
	if !validSubjectRoleForKind(in.Kind, in.Role) {
		return database.Result{}, web.Fail(422, "Kombinasi jenis akun dan peran tidak valid")
	}
	if (in.Role == "SUPER_ADMIN" || in.Role == "PLATFORM_ADMIN") && actor.Role != "SUPER_ADMIN" && !(actor.Role == "PLATFORM_ADMIN" && in.Role == "PLATFORM_ADMIN") {
		return database.Result{}, web.Fail(403, "Hanya Super Admin yang berwenang menetapkan peran ini")
	}
	if utf8.RuneCountInString(in.ExternalRef) > 120 {
		return database.Result{}, web.Fail(422, "NIP/NIK/ID referensi maksimal 120 karakter")
	}
	if in.Email != "" {
		addr, err := mail.ParseAddress(in.Email)
		if err != nil || addr.Address != in.Email || len(in.Email) > 200 {
			return database.Result{}, web.Fail(422, "Alamat email tidak valid")
		}
	}
	if in.Phone != "" && (len(in.Phone) > 40 || !digits(strings.TrimPrefix(in.Phone, "+"))) {
		return database.Result{}, web.Fail(422, "Nomor telepon hanya boleh berisi angka dan awalan +")
	}

	var passwordHash *string
	if in.Password != "" {
		if len(in.Password) < 8 || len(in.Password) > 128 {
			return database.Result{}, web.Fail(422, "Kata sandi harus 8–128 karakter")
		}
		hashed, err := domain.HashPassword(in.Password)
		if err != nil {
			return database.Result{}, web.Fail(422, err.Error())
		}
		passwordHash = &hashed
	}

	if !create {
		existing, _, err := s.Store.ReadSubjectAdmin(ctx, id)
		if err != nil {
			return database.Result{}, err
		}
		if (existing.Role == "SUPER_ADMIN" || (existing.Role == "PLATFORM_ADMIN" && actor.Role == "ADMIN_OPD")) && actor.Role != "SUPER_ADMIN" {
			return database.Result{}, web.Fail(403, "Anda tidak berwenang mengubah akun dengan peran lebih tinggi")
		}
		if id == actor.ID && !in.Active {
			return database.Result{}, web.Fail(422, "Anda tidak dapat menonaktifkan akun Anda sendiri")
		}
	}

	cmd := "UpdateSubject"
	target := id
	statusCode := 200
	if create {
		cmd = "CreateSubject"
		target = "new"
		statusCode = 201
	}
	auditPayload := map[string]any{
		"name":         in.Name,
		"kind":         in.Kind,
		"role":         in.Role,
		"external_ref": in.ExternalRef,
		"email":        in.Email,
		"active":       in.Active,
		"has_password": passwordHash != nil,
	}
	return database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner:   "M1",
		Actor:   actor.ID,
		Command: cmd,
		Target:  target,
		Key:     key,
		Scope:   "subjects",
		Reason:  "Pengelolaan master akun pengguna",
		Payload: auditPayload,
	}, func(tx pgx.Tx) (database.Result, error) {
		version, e := s.Store.SaveSubject(ctx, tx, id, create, in, passwordHash)
		if e != nil {
			return database.Result{}, e
		}
		return database.Response(statusCode, map[string]any{"id": id, "version": version})
	})
}

func (s *Service) ContactEmail(ctx context.Context, subjectID string) (string, bool, error) {
	return s.Store.SubjectContactEmail(ctx, subjectID)
}

func validSSOEndpoint(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" || u.User != nil {
		return false
	}
	if u.Scheme == "https" {
		return true
	}
	return u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "::1" || u.Hostname() == "localhost")
}

func (s *Service) validSSOConfig() bool {
	cfg := s.Options.SSO
	if len(s.Options.Key) < 32 || strings.TrimSpace(cfg.Issuer) == "" || strings.TrimSpace(cfg.ClientID) == "" {
		return false
	}
	if !validSSOEndpoint(cfg.AuthURL) || !validSSOEndpoint(cfg.TokenURL) || !validSSOEndpoint(cfg.JWKSURL) {
		return false
	}
	expectedRedirect := strings.TrimRight(s.Options.Origin, "/") + "/api/v1/auth/sso/callback"
	return cfg.RedirectURL == "" || cfg.RedirectURL == expectedRedirect
}

func (s *Service) ssoRedirectURI() string {
	if s.Options.SSO.RedirectURL != "" {
		return s.Options.SSO.RedirectURL
	}
	return strings.TrimRight(s.Options.Origin, "/") + "/api/v1/auth/sso/callback"
}

type ssoCookieState struct {
	State     string `json:"state"`
	Nonce     string `json:"nonce"`
	Verifier  string `json:"verifier"`
	ExpiresAt int64  `json:"expires_at"`
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func randomPKCEVerifier() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) sealSSOState(st ssoCookieState) (string, error) {
	raw, err := json.Marshal(st)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(raw)
	sig := domain.Derive(s.Options.Key, "sso-cookie-state", body)
	return body + "." + sig, nil
}

func (s *Service) unsealSSOState(cookieVal string) (ssoCookieState, error) {
	var zero ssoCookieState
	parts := strings.Split(cookieVal, ".")
	if len(parts) != 2 || parts[0] == "" || len(parts[1]) != 64 {
		return zero, web.Fail(403, "Keadaan SSO tidak valid")
	}
	expected := domain.Derive(s.Options.Key, "sso-cookie-state", parts[0])
	if !hmac.Equal([]byte(parts[1]), []byte(expected)) {
		return zero, web.Fail(403, "Tanda tangan sesi SSO tidak valid")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return zero, web.Fail(403, "Payload sesi SSO tidak valid")
	}
	var st ssoCookieState
	if err := json.Unmarshal(raw, &st); err != nil || time.Now().UTC().Unix() > st.ExpiresAt {
		return zero, web.Fail(403, "Sesi SSO kedaluwarsa")
	}
	return st, nil
}

func (s *Service) StartSSOLogin() (string, string, error) {
	if !s.Options.SSO.Enabled {
		return "", "", web.Fail(503, "SSO kedinasan belum diaktifkan oleh pemilik layanan (DEC-M02)")
	}
	if !s.validSSOConfig() {
		return "", "", web.Fail(503, "Konfigurasi penyedia SSO kedinasan belum lengkap atau tidak valid")
	}
	state, err := randomHex(24)
	if err != nil {
		return "", "", err
	}
	nonce, err := randomHex(24)
	if err != nil {
		return "", "", err
	}
	verifier, err := randomPKCEVerifier()
	if err != nil {
		return "", "", err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	sealed, err := s.sealSSOState(ssoCookieState{
		State:     state,
		Nonce:     nonce,
		Verifier:  verifier,
		ExpiresAt: time.Now().UTC().Add(5 * time.Minute).Unix(),
	})
	if err != nil {
		return "", "", err
	}
	authURL, _ := url.Parse(s.Options.SSO.AuthURL)
	q := authURL.Query()
	q.Set("response_type", "code")
	q.Set("client_id", s.Options.SSO.ClientID)
	q.Set("redirect_uri", s.ssoRedirectURI())
	q.Set("scope", "openid profile email")
	q.Set("state", state)
	q.Set("nonce", nonce)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	authURL.RawQuery = q.Encode()
	return authURL.String(), sealed, nil
}

func ssoHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type oidcClaims struct {
	Iss               string          `json:"iss"`
	Sub               string          `json:"sub"`
	Aud               json.RawMessage `json:"aud"`
	Exp               int64           `json:"exp"`
	Iat               int64           `json:"iat"`
	Nbf               int64           `json:"nbf"`
	Nonce             string          `json:"nonce"`
	Email             string          `json:"email"`
	EmailVerified     bool            `json:"email_verified"`
	PreferredUsername string          `json:"preferred_username"`
	NIP               string          `json:"nip"`
}

func (c oidcClaims) audMatches(clientID string) bool {
	var single string
	if json.Unmarshal(c.Aud, &single) == nil {
		return single == clientID
	}
	var list []string
	if json.Unmarshal(c.Aud, &list) == nil {
		for _, item := range list {
			if item == clientID {
				return true
			}
		}
	}
	return false
}

func (c oidcClaims) externalID() string {
	if s := strings.TrimSpace(c.NIP); s != "" {
		return s
	}
	return strings.TrimSpace(c.PreferredUsername)
}

func verifyJWTWithJWK(token string, keys []jwkKey) (oidcClaims, error) {
	var zero oidcClaims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return zero, web.Fail(401, "Format ID token SSO tidak valid")
	}
	hdrBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return zero, web.Fail(401, "Header ID token SSO tidak valid")
	}
	var hdr struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if json.Unmarshal(hdrBytes, &hdr) != nil || (hdr.Alg != "RS256" && hdr.Alg != "ES256") {
		return zero, web.Fail(401, "Algoritma ID token SSO tidak didukung")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return zero, web.Fail(401, "Klaim ID token SSO tidak valid")
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return zero, web.Fail(401, "Tanda tangan ID token SSO tidak valid")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	verified := false
	for _, k := range keys {
		if hdr.Kid != "" && k.Kid != hdr.Kid {
			continue
		}
		if k.Use != "" && k.Use != "sig" {
			continue
		}
		switch {
		case hdr.Alg == "RS256" && k.Kty == "RSA":
			if verifyRSAJWK(k, digest[:], sig) == nil {
				verified = true
			}
		case hdr.Alg == "ES256" && k.Kty == "EC":
			if verifyECJWK(k, digest[:], sig) == nil {
				verified = true
			}
		}
		if verified {
			break
		}
	}
	if !verified {
		return zero, web.Fail(401, "Verifikasi tanda tangan ID token SSO gagal")
	}
	if err := json.Unmarshal(payloadBytes, &zero); err != nil {
		return zero, web.Fail(401, "Payload klaim ID token SSO tidak valid")
	}
	return zero, nil
}

func verifyRSAJWK(k jwkKey, digest, sig []byte) error {
	nb, err1 := base64.RawURLEncoding.DecodeString(k.N)
	eb, err2 := base64.RawURLEncoding.DecodeString(k.E)
	if err1 != nil || err2 != nil || len(nb) < 128 || len(eb) == 0 {
		return errors.New("invalid rsa jwk")
	}
	e := 0
	for _, b := range eb {
		e = (e << 8) | int(b)
	}
	if e < 3 {
		return errors.New("invalid exponent")
	}
	pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nb), E: e}
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest, sig)
}

func verifyECJWK(k jwkKey, digest, sig []byte) error {
	if k.Crv != "P-256" || len(sig) != 64 {
		return errors.New("invalid ec jwk")
	}
	xb, err1 := base64.RawURLEncoding.DecodeString(k.X)
	yb, err2 := base64.RawURLEncoding.DecodeString(k.Y)
	if err1 != nil || err2 != nil || len(xb) != 32 || len(yb) != 32 {
		return errors.New("invalid ec coordinates")
	}
	pub := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xb),
		Y:     new(big.Int).SetBytes(yb),
	}
	if !pub.Curve.IsOnCurve(pub.X, pub.Y) {
		return errors.New("point not on P-256")
	}
	r := new(big.Int).SetBytes(sig[:32])
	s := new(big.Int).SetBytes(sig[32:])
	if !ecdsa.Verify(pub, digest, r, s) {
		return errors.New("invalid ec signature")
	}
	return nil
}

func (s *Service) CompleteSSOCallback(ctx context.Context, cookieVal, stateParam, codeParam, errParam string) (destination, token, csrf string, err error) {
	if !s.Options.SSO.Enabled {
		return "", "", "", web.Fail(503, "SSO kedinasan belum diaktifkan oleh pemilik layanan (DEC-M02)")
	}
	if !s.validSSOConfig() {
		return "", "", "", web.Fail(503, "Konfigurasi penyedia SSO kedinasan tidak valid")
	}
	if strings.TrimSpace(errParam) != "" {
		return "", "", "", web.Fail(401, "Autentikasi SSO dibatalkan atau ditolak oleh penyedia identitas")
	}
	st, err := s.unsealSSOState(cookieVal)
	if err != nil {
		return "", "", "", err
	}
	if stateParam == "" || codeParam == "" || subtle.ConstantTimeCompare([]byte(stateParam), []byte(st.State)) != 1 {
		return "", "", "", web.Fail(403, "Parameter state atau kode otorisasi SSO tidak cocok")
	}

	client := ssoHTTPClient()
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", codeParam)
	form.Set("redirect_uri", s.ssoRedirectURI())
	form.Set("client_id", s.Options.SSO.ClientID)
	form.Set("code_verifier", st.Verifier)
	if s.Options.SSO.ClientSecret != "" {
		form.Set("client_secret", s.Options.SSO.ClientSecret)
	}
	tokReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.Options.SSO.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", "", err
	}
	tokReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokResp, err := client.Do(tokReq)
	if err != nil {
		return "", "", "", web.Fail(502, "Penyedia SSO tidak dapat dijangkau saat menukar kode")
	}
	defer tokResp.Body.Close()
	tokRaw, err := io.ReadAll(io.LimitReader(tokResp.Body, 512*1024))
	if err != nil || tokResp.StatusCode != 200 {
		return "", "", "", web.Fail(401, "Penukaran kode otorisasi SSO ditolak")
	}
	var tokBody struct {
		IDToken string `json:"id_token"`
	}
	if json.Unmarshal(tokRaw, &tokBody) != nil || tokBody.IDToken == "" {
		return "", "", "", web.Fail(401, "ID token SSO tidak tersedia dari penyedia identitas")
	}

	jwksReq, err := http.NewRequestWithContext(ctx, http.MethodGet, s.Options.SSO.JWKSURL, nil)
	if err != nil {
		return "", "", "", err
	}
	jwksResp, err := client.Do(jwksReq)
	if err != nil {
		return "", "", "", web.Fail(502, "Kunci publik JWKS SSO tidak dapat dijangkau")
	}
	defer jwksResp.Body.Close()
	jwksRaw, err := io.ReadAll(io.LimitReader(jwksResp.Body, 512*1024))
	if err != nil || jwksResp.StatusCode != 200 {
		return "", "", "", web.Fail(502, "Kunci publik JWKS SSO tidak valid")
	}
	var jwks struct {
		Keys []jwkKey `json:"keys"`
	}
	if json.Unmarshal(jwksRaw, &jwks) != nil || len(jwks.Keys) == 0 {
		return "", "", "", web.Fail(502, "Daftar kunci JWKS SSO kosong")
	}

	claims, err := verifyJWTWithJWK(tokBody.IDToken, jwks.Keys)
	if err != nil {
		return "", "", "", err
	}
	now := time.Now().UTC().Unix()
	if claims.Iss != s.Options.SSO.Issuer || !claims.audMatches(s.Options.SSO.ClientID) || claims.Sub == "" {
		return "", "", "", web.Fail(401, "Klaim penerbit atau audiens ID token SSO tidak sesuai")
	}
	if claims.Exp == 0 || now-30 > claims.Exp || (claims.Iat > 0 && claims.Iat > now+60) || (claims.Nbf > 0 && now+30 < claims.Nbf) {
		return "", "", "", web.Fail(401, "ID token SSO belum aktif atau sudah kedaluwarsa")
	}
	if subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(st.Nonce)) != 1 {
		return "", "", "", web.Fail(403, "Nonce ID token SSO tidak cocok")
	}

	rawToken, err := randomHex(32)
	if err != nil {
		return "", "", "", err
	}
	csrfToken, err := randomHex(32)
	if err != nil {
		return "", "", "", err
	}
	sessionID := web.ID()
	idemKey := "sso-" + stateParam[:min(len(stateParam), 48)]
	var resolved api.Subject
	_, err = database.Mutate(ctx, s.Store.Pool, database.Mutation{
		Owner:   "M1",
		Actor:   "00000000-0000-4000-8000-000000000000",
		Command: "CreateSSOSession",
		Target:  sessionID,
		Key:     idemKey,
		Scope:   "OIDC_SSO",
		Reason:  "Autentikasi SSO kedinasan terverifikasi",
		Payload: map[string]any{"issuer": claims.Iss, "sub": claims.Sub},
	}, func(tx pgx.Tx) (database.Result, error) {
		subj, err := s.Store.FindOrLinkSSOSubject(ctx, tx, s.Options.SSO.Issuer, claims.Sub, claims.externalID(), claims.Email, claims.EmailVerified)
		if err != nil {
			return database.Result{}, err
		}
		resolved = subj
		expires := time.Now().UTC().Add(2 * time.Hour)
		if err := s.Store.CreateSession(ctx, tx, sessionID, subj.ID, domain.Digest(rawToken), domain.Digest(csrfToken), expires); err != nil {
			return database.Result{}, err
		}
		return database.Response(201, map[string]any{"session_id": sessionID, "subject_id": subj.ID})
	})
	if err != nil {
		return "", "", "", err
	}
	if _, err := s.Authenticate(ctx, api.Credentials{Token: rawToken}); err != nil {
		return "", "", "", err
	}
	dest := "/tiket.html"
	if resolved.Kind == "STAFF" {
		dest = "/admin/app/dashboard/index.html"
	}
	return dest, rawToken, csrfToken, nil
}
