// Package blob implements bounded private file IO and the clamd INSTREAM protocol.
package blob

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"helpdesk.local/m0/internal/platform/web"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Files struct{ Root, Scanner string }

func ValidName(v string) bool {
	if v == "" || len(v) > 200 || strings.ContainsAny(v, "/\\\r\n\x00") {
		return false
	}
	for _, r := range v {
		if r < 32 || r == 127 {
			return false
		}
	}
	return v != "." && v != ".."
}
func Validate(data []byte, mime string) error {
	if len(data) == 0 || len(data) > 10485760 {
		return web.Fail(422, "Ukuran file tidak valid")
	}
	if mime == "image/png" || mime == "image/jpeg" {
		cfg, format, e := image.DecodeConfig(bytes.NewReader(data))
		want := "png"
		if mime == "image/jpeg" {
			want = "jpeg"
		}
		if e != nil || format != want || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 10000 || cfg.Height > 10000 || int64(cfg.Width)*int64(cfg.Height) > 20000000 {
			return web.Fail(422, "Signature/dimensi gambar tidak valid")
		}
		if _, _, e = image.Decode(bytes.NewReader(data)); e != nil {
			return web.Fail(422, "Gambar rusak")
		}
		return nil
	}
	if mime == "application/pdf" && bytes.HasPrefix(data, []byte("%PDF-")) && bytes.Contains(data[max(0, len(data)-1024):], []byte("%%EOF")) {
		return nil
	}
	return web.Fail(422, "Signature/type file tidak sesuai policy")
}
func (f Files) path(key string) (string, error) {
	if !web.UUID(key) {
		return "", errors.New("invalid storage key")
	}
	root, e := filepath.Abs(f.Root)
	if e != nil || f.Root == "" {
		return "", errors.New("private storage unavailable")
	}
	return filepath.Join(root, key), nil
}
func (f Files) Put(ctx context.Context, key string, r io.Reader, maxBytes int64) ([]byte, int64, error) {
	p, e := f.path(key)
	if e != nil {
		return nil, 0, e
	}
	if e = ctx.Err(); e != nil {
		return nil, 0, e
	}
	if e = os.MkdirAll(filepath.Dir(p), 0700); e != nil {
		return nil, 0, e
	}
	data, e := io.ReadAll(io.LimitReader(r, maxBytes+1))
	if e != nil {
		var limit *http.MaxBytesError
		if errors.As(e, &limit) {
			return nil, 0, web.Fail(422, "File melampaui batas policy")
		}
		return nil, 0, e
	}
	if int64(len(data)) > maxBytes {
		return nil, 0, web.Fail(422, "File melampaui batas policy")
	}
	file, e := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if e != nil {
		return nil, 0, e
	}
	_, e = file.Write(data)
	if e == nil {
		e = file.Sync()
	}
	closeErr := file.Close()
	if e == nil {
		e = closeErr
	}
	if e != nil {
		_ = os.Remove(p)
		return nil, 0, e
	}
	return data, int64(len(data)), nil
}
func (f Files) Read(key string) ([]byte, error) {
	p, e := f.path(key)
	if e != nil {
		return nil, e
	}
	file, e := os.Open(p)
	if e != nil {
		return nil, e
	}
	defer file.Close()
	return io.ReadAll(io.LimitReader(file, 10485761))
}
func (f Files) Remove(key string) error {
	p, e := f.path(key)
	if e != nil {
		return e
	}
	return os.Remove(p)
}
func (f Files) VisitOrphans(ctx context.Context, before time.Time, visit func(string) error) error {
	directory, e := os.Open(f.Root)
	if os.IsNotExist(e) {
		return nil
	}
	if e != nil {
		return e
	}
	defer directory.Close()
	for {
		entries, err := directory.ReadDir(100)
		if err != nil && err != io.EOF {
			return err
		}
		for _, entry := range entries {
			if e = ctx.Err(); e != nil {
				return e
			}
			if !entry.IsDir() && web.UUID(entry.Name()) {
				info, e := entry.Info()
				if e == nil && info.ModTime().Before(before) {
					if e = visit(entry.Name()); e != nil {
						return e
					}
				}
			}
		}
		if err == io.EOF {
			return nil
		}
	}
}
func (f Files) VerifySHA256(key, wantHex string) (verified bool, missing bool, err error) {
	data, err := f.Read(key)
	if err != nil {
		if os.IsNotExist(err) {
			return false, true, nil
		}
		return false, false, err
	}
	return strings.EqualFold(Checksum(data), strings.TrimSpace(wantHex)), false, nil
}
func (f Files) manifestPath(id string) (string, error) {
	if !web.UUID(id) {
		return "", errors.New("invalid manifest key")
	}
	root, e := filepath.Abs(f.Root)
	if e != nil || f.Root == "" {
		return "", errors.New("private storage unavailable")
	}
	return filepath.Join(root, "manifests", id+".json"), nil
}
func (f Files) PutManifest(ctx context.Context, id string, data []byte) error {
	p, e := f.manifestPath(id)
	if e != nil {
		return e
	}
	if e = ctx.Err(); e != nil {
		return e
	}
	if len(data) == 0 || len(data) > 10485760 {
		return web.Fail(422, "Ukuran manifest melampaui batas policy")
	}
	dir := filepath.Dir(p)
	if e = os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	tmp, e := os.CreateTemp(dir, id+".tmp-*")
	if e != nil {
		return e
	}
	tmpName := tmp.Name()
	cleanup := func() { _ = tmp.Close(); _ = os.Remove(tmpName) }
	if e = tmp.Chmod(0600); e != nil {
		cleanup()
		return e
	}
	if _, e = tmp.Write(data); e != nil {
		cleanup()
		return e
	}
	if e = tmp.Sync(); e != nil {
		cleanup()
		return e
	}
	if e = tmp.Close(); e != nil {
		_ = os.Remove(tmpName)
		return e
	}
	if e = os.Rename(tmpName, p); e != nil {
		_ = os.Remove(tmpName)
		return e
	}
	return nil
}
func (f Files) ReadManifest(id string) ([]byte, error) {
	p, e := f.manifestPath(id)
	if e != nil {
		return nil, e
	}
	file, e := os.Open(p)
	if e != nil {
		return nil, e
	}
	defer file.Close()
	return io.ReadAll(io.LimitReader(file, 10485761))
}
func Checksum(data []byte) string { h := sha256.Sum256(data); return hex.EncodeToString(h[:]) }
func (f Files) Scan(ctx context.Context, data []byte) (string, error) {
	if len(data) > 10485760 {
		return "", errors.New("scan limit exceeded")
	}
	d := net.Dialer{Timeout: 2 * time.Second}
	conn, e := d.DialContext(ctx, "tcp", f.Scanner)
	if e != nil {
		return "", errors.New("scanner unavailable")
	}
	defer conn.Close()
	deadline := time.Now().Add(5 * time.Second)
	if v, ok := ctx.Deadline(); ok && v.Before(deadline) {
		deadline = v
	}
	_ = conn.SetDeadline(deadline)
	if _, e = io.WriteString(conn, "zINSTREAM\x00"); e != nil {
		return "", e
	}
	for offset := 0; offset < len(data); {
		end := min(offset+32768, len(data))
		var size [4]byte
		binary.BigEndian.PutUint32(size[:], uint32(end-offset))
		if _, e = conn.Write(size[:]); e != nil {
			return "", e
		}
		if _, e = io.Copy(conn, bytes.NewReader(data[offset:end])); e != nil {
			return "", e
		}
		offset = end
	}
	if _, e = conn.Write([]byte{0, 0, 0, 0}); e != nil {
		return "", e
	}
	reply, e := bufio.NewReader(io.LimitReader(conn, 1024)).ReadString(0)
	if e != nil {
		return "", e
	}
	reply = strings.TrimRight(reply, "\x00\r\n")
	if reply == "stream: OK" {
		return "CLEAN", nil
	}
	if strings.HasSuffix(reply, " FOUND") {
		return "REJECTED", nil
	}
	return "", fmt.Errorf("scan incomplete")
}
