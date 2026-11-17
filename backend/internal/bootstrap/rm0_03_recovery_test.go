package bootstrap

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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
)

func TestRM003RecoveryRead(t *testing.T) {
	if os.Getenv("HELPDESK_RM003_RECOVERY") != "1" {
		t.Skip("NOT_RUN: isolated recovery opt-in required")
	}
	host, password := os.Getenv("HELPDESK_TEST_DB_HOST"), os.Getenv("HELPDESK_TEST_PASSWORD")
	if !strings.HasPrefix(host, "helpdesk-m0-contract-") || len(password) < 32 {
		t.Fatal("unsafe recovery target")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
	if err := pools.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HELPDESK_UPLOAD_ROOT", "/restore-fixture")
	server := httptest.NewUnstartedServer(nil)
	base := "http://" + server.Listener.Addr().String()
	server.Config.Handler = Application(pools, m1.Options{Lab: true, Origin: base, Key: []byte("synthetic-rm003-recovery-no-production-secret")})
	server.Start()
	defer server.Close()
	login := func(n int) testClient {
		jar, _ := cookiejar.New(nil)
		c := testClient{t, base, &http.Client{Jar: jar, Timeout: 10 * time.Second}}
		c.login(n)
		return c
	}
	const path = "/tickets/91000000-0000-4000-8000-000000000001"
	const download = path + "/attachments/91000000-0000-4000-8000-000000000003/download"
	owner := login(1)
	row := owner.request("GET", path, nil, 200, "", nil)
	if row["number"] != "HD-RM003-RECOVERY" {
		t.Fatal("restored ticket missing")
	}
	response, err := owner.http.Get(base + "/api/v1" + download)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 1024))
	sum := sha256.Sum256(raw)
	if err != nil || response.StatusCode != 200 || hex.EncodeToString(sum[:]) != os.Getenv("HELPDESK_TEST_BLOB_DIGEST") {
		t.Fatalf("restored attachment failed access/hash, HTTP %d", response.StatusCode)
	}
	login(12).request("GET", download, nil, 404, "", nil)
}
