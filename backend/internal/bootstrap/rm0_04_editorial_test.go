package bootstrap

import (
	"context"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"helpdesk.local/m0/internal/modules/m1"
	"helpdesk.local/m0/internal/platform/database"
)

func TestRM004Editorial(t *testing.T) {
	if os.Getenv("HELPDESK_RM004_TEST") != "1" {
		t.Skip("disposable PostgreSQL opt-in required")
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
	srv := httptest.NewUnstartedServer(nil)
	base := "http://" + srv.Listener.Addr().String()
	srv.Config.Handler = Application(pools, m1.Options{Lab: true, Key: []byte("synthetic-rm004-editorial-key-no-production-credentials"), Origin: base})
	srv.Start()
	defer srv.Close()
	client := func() testClient {
		jar, _ := cookiejar.New(nil)
		return testClient{t, base, &http.Client{Jar: jar, Timeout: 8 * time.Second}}
	}
	guest, editor, publisher := client(), client(), client()
	editor.login(14)
	publisher.login(15)
	const list = "/knowledge/articles"
	const published = "?view=published"
	const query = published + "&q=rm004-editorial&limit=1"
	editorial := func(slug string) map[string]any {
		return map[string]any{
			"expected_version": 1, "title": slug, "slug": slug, "body": "<p>Konten sintetis RM0-04</p>", "audience": "PUBLIC_GUEST",
		}
	}
	transition := func(actor testClient, id string, version any, action string, status int) map[string]any {
		return actor.request("POST", list+"/"+id+"/transitions", map[string]any{
			"expected_version": version, "action": action, "reason": "Fixture sintetis RM0-04",
		}, status, "", nil)
	}
	form := editorial("rm004-editorial-a")
	draft := editor.request("POST", list, form, 201, "", nil)
	id := draft["id"].(string)
	detail := list + "/rm004-editorial-a" + published
	editor.request("GET", list+"/"+id, nil, 200, "", nil)
	editor.request("GET", detail, nil, 404, "", nil)
	guest.request("GET", detail, nil, 404, "", nil)
	if len(items(editor.request("GET", list+query, nil, 200, "", nil))) != 0 {
		t.Fatal("draft leaked into published view")
	}
	transition(editor, id, draft["version"], "PUBLISH", 403)
	article := transition(publisher, id, draft["version"], "PUBLISH", 200)
	second := editor.request("POST", list, editorial("rm004-editorial-b"), 201, "", nil)
	transition(publisher, second["id"].(string), second["version"], "PUBLISH", 200)
	first := guest.request("GET", list+query, nil, 200, "", nil)
	if len(items(first)) != 1 || first["next_cursor"] == nil {
		t.Fatal("expected first published page and cursor")
	}
	next := guest.request("GET", list+query+"&cursor="+url.QueryEscape(first["next_cursor"].(string)), nil, 200, "", nil)
	if len(items(next)) != 1 || next["next_cursor"] != nil || items(first)[0].(map[string]any)["id"] == items(next)[0].(map[string]any)["id"] {
		t.Fatal("expected distinct final published page")
	}
	resp, err := guest.http.Get(base + "/api/v1" + detail)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 || resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("published detail must disable response caching")
	}
	guest.request("GET", "/portal/pages/rm004-editorial-a"+published, nil, 404, "", nil)

	form["expected_version"] = article["version"]
	form["body"] = "<script>alert(1)</script>"
	publisher.request("PUT", list+"/"+id, form, 422, "", nil)
	form["body"] = "<p>Revisi editorial RM0-04</p>"
	edited := publisher.request("PUT", list+"/"+id, form, 200, "", nil)
	current := guest.request("GET", detail, nil, 200, "", nil)
	if current["body"] != form["body"] || current["version"] != edited["version"] {
		t.Fatal("published view did not see current revision")
	}
	publisher.request("PUT", list+"/"+id, form, 409, "", nil)

	archive := transition(publisher, id, edited["version"], "ARCHIVE", 200)
	guest.request("GET", detail, nil, 404, "", nil)
	publisher.request("GET", detail, nil, 404, "", nil)
	publisher.request("GET", list+"/"+id, nil, 200, "", nil)
	if len(items(guest.request("GET", list+published+"&q=rm004-editorial-a", nil, 200, "", nil))) != 0 {
		t.Fatal("archived article leaked through search")
	}
	restored := transition(publisher, id, archive["version"], "RESTORE", 200)
	if restored["state"] != "DRAFT" {
		t.Fatal("restore must return the article to draft")
	}
	guest.request("GET", detail, nil, 404, "", nil)
	form["expected_version"] = restored["version"]
	form["audience"] = "STAFF_ONLY"
	restricted := publisher.request("PUT", list+"/"+id, form, 200, "", nil)
	transition(publisher, id, restricted["version"], "PUBLISH", 200)
	guest.request("GET", detail, nil, 404, "", nil)
	publisher.request("GET", detail, nil, 200, "", nil)
	t.Run("media_filters_before_cursor_and_preserves_scope", func(t *testing.T) {
		const filter = "/media?owner=M8&status=CLEAN&q=media-rm004&limit=1"
		page := editor.request("GET", filter, nil, 200, "", nil)
		if len(items(page)) != 1 || page["next_cursor"] == nil || items(page)[0].(map[string]any)["status"] != "CLEAN" {
			t.Fatal("expected first clean media and cursor")
		}
		last := editor.request("GET", filter+"&cursor="+url.QueryEscape(page["next_cursor"].(string)), nil, 200, "", nil)
		if len(items(last)) != 1 || last["next_cursor"] != nil || items(last)[0].(map[string]any)["status"] != "CLEAN" {
			t.Fatal("expected final clean page without quarantined media")
		}
		if len(items(guest.request("GET", filter, nil, 200, "", nil))) != 0 {
			t.Fatal("private media appeared in anonymous search")
		}
		if len(items(editor.request("GET", "/media?owner=M8&q=karantina-rm004", nil, 200, "", nil))) != 1 {
			t.Fatal("unfiltered editorial media did not retain quarantine visibility")
		}
		guest.request("GET", "/media?owner=M8&status=invalid", nil, 400, "", nil)
		operator := client()
		operator.login(4)
		operator.request("GET", "/media?owner=M3&status=CLEAN&q=media-rm004&limit=1", nil, 200, "", nil)
	})

	t.Run("portal_page_editorial_and_search", func(t *testing.T) {
		const pages = "/portal/pages"
		pForm := map[string]any{
			"expected_version": 1, "title": "Halaman Uji RM0-04", "slug": "halaman-uji-rm004",
			"body": "<p>Halaman portal resmi sintetis</p>", "audience": "PUBLIC_GUEST",
		}
		pDraft := editor.request("POST", pages, pForm, 201, "", nil)
		pID := pDraft["id"].(string)
		guest.request("GET", pages+"/halaman-uji-rm004"+published, nil, 404, "", nil)
		editor.request("POST", pages+"/"+pID+"/transitions", map[string]any{
			"expected_version": pDraft["version"], "action": "PUBLISH", "reason": "Tolak tanpa content.publish",
		}, 403, "", nil)
		pPub := publisher.request("POST", pages+"/"+pID+"/transitions", map[string]any{
			"expected_version": pDraft["version"], "action": "PUBLISH", "reason": "Publikasi halaman portal",
		}, 200, "", nil)
		pView := guest.request("GET", pages+"/halaman-uji-rm004"+published, nil, 200, "", nil)
		if pView["kind"] != "PAGE" {
			t.Fatalf("expected kind PAGE, got %#v", pView["kind"])
		}
		hits := items(guest.request("GET", "/search?owner=M8&q=halaman-portal", nil, 200, "", nil))
		foundPage := false
		for _, h := range hits {
			m := h.(map[string]any)
			if m["id"] == pID && m["kind"] == "PAGE" {
				foundPage = true
			}
		}
		if !foundPage {
			// Also try title match on query "Halaman Uji RM0-04"
			hits = items(guest.request("GET", "/search?owner=M8&q=Halaman", nil, 200, "", nil))
			for _, h := range hits {
				m := h.(map[string]any)
				if m["id"] == pID && m["kind"] == "PAGE" {
					foundPage = true
				}
			}
		}
		if !foundPage {
			t.Fatal("published PAGE missing or mislabeled in M8 search hits")
		}
		publisher.request("POST", pages+"/"+pID+"/transitions", map[string]any{
			"expected_version": pPub["version"], "action": "ARCHIVE", "reason": "Arsipkan halaman uji",
		}, 200, "", nil)
		guest.request("GET", pages+"/halaman-uji-rm004"+published, nil, 404, "", nil)
	})

}
