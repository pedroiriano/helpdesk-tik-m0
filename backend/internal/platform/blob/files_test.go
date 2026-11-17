package blob

import (
	"bytes"
	"context"
	"helpdesk.local/m0/internal/platform/web"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestPrivateBoundedStorage(t *testing.T) {
	f := Files{Root: t.TempDir()}
	for _, name := range []string{"../bad", "a\\b", "bad\r\nname", "."} {
		if ValidName(name) {
			t.Fatal("unsafe filename accepted")
		}
	}
	if _, _, e := f.Put(context.Background(), "../../x", bytes.NewReader([]byte("x")), 10); e == nil {
		t.Fatal("unsafe key")
	}
	id := web.ID()
	if _, _, e := f.Put(context.Background(), id, bytes.NewReader([]byte("123")), 2); e == nil {
		t.Fatal("overlimit")
	}
	if _, _, e := f.Put(context.Background(), id, bytes.NewReader([]byte("123")), 3); e != nil {
		t.Fatal(e)
	}
	data, e := f.Read(id)
	if e != nil || string(data) != "123" {
		t.Fatal("storage mismatch")
	}
	p, _ := f.path(id)
	info, _ := os.Stat(p)
	if runtime.GOOS != "windows" && info.Mode().Perm()&0077 != 0 {
		t.Fatal("private permissions missing")
	}
	if Validate(data, "image/png") == nil {
		t.Fatal("fake MIME accepted")
	}
}
func TestFailedStorageAndScannerTimeout(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "not-a-directory")
	if e := os.WriteFile(file, []byte("fixture"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, _, e := (Files{Root: file}).Put(context.Background(), web.ID(), bytes.NewReader([]byte("x")), 1); e == nil {
		t.Fatal("write failure ignored")
	}
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer listener.Close()
	go func() {
		c, e := listener.Accept()
		if e == nil {
			defer c.Close()
			time.Sleep(150 * time.Millisecond)
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, e := (Files{Scanner: listener.Addr().String()}).Scan(ctx, []byte("fixture")); e == nil {
		t.Fatal("scan timeout ignored")
	}
}
func TestBackupManifestStorageAndVerification(t *testing.T) {
	f := Files{Root: t.TempDir()}
	blobID := web.ID()
	payload := []byte("verified-private-attachment")
	if _, _, e := f.Put(context.Background(), blobID, bytes.NewReader(payload), 1024); e != nil {
		t.Fatal(e)
	}
	ok, missing, e := f.VerifySHA256(blobID, Checksum(payload))
	if e != nil || !ok || missing {
		t.Fatalf("expected verified blob, got ok=%v missing=%v err=%v", ok, missing, e)
	}
	ok, missing, e = f.VerifySHA256(blobID, Checksum([]byte("tampered")))
	if e != nil || ok || missing {
		t.Fatalf("expected mismatch, got ok=%v missing=%v err=%v", ok, missing, e)
	}
	ok, missing, e = f.VerifySHA256(web.ID(), Checksum(payload))
	if e != nil || ok || !missing {
		t.Fatalf("expected missing blob, got ok=%v missing=%v err=%v", ok, missing, e)
	}
	manifestID := web.ID()
	manifest := []byte(`{"manifest_version":1,"status":"SUCCEEDED"}`)
	if e := f.PutManifest(context.Background(), "../bad", manifest); e == nil {
		t.Fatal("unsafe manifest key accepted")
	}
	if e := f.PutManifest(context.Background(), manifestID, manifest); e != nil {
		t.Fatal(e)
	}
	got, e := f.ReadManifest(manifestID)
	if e != nil || string(got) != string(manifest) {
		t.Fatalf("manifest readback mismatch: %v", e)
	}
	// VisitOrphans must never remove manifest artifacts inside manifests/.
	orphans := 0
	if e := f.VisitOrphans(context.Background(), time.Now().Add(time.Minute), func(string) error {
		orphans++
		return nil
	}); e != nil || orphans != 1 {
		t.Fatalf("expected only 1 raw blob visited (not manifests dir), got orphans=%d err=%v", orphans, e)
	}
}
