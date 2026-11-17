package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"io"
	"time"
)

type FilePort interface {
	Put(context.Context, string, io.Reader, int64) ([]byte, int64, error)
	Read(string) ([]byte, error)
	Remove(string) error
	Scan(context.Context, []byte) (string, error)
	VisitOrphans(context.Context, time.Time, func(string) error) error
}

func (s *Service) Upload(ctx context.Context, c Credentials, id, key, name, mime, audience string, version int64, body io.Reader) (database.Result, error) {
	v, scope, a, e := s.authorized(ctx, c, id, true)
	if e != nil {
		return database.Result{}, e
	}
	if !writeAllowed(a, scope, v, "ticket.attach") {
		return database.Result{}, web.Fail(403, "Unggah tidak diizinkan")
	}
	if !blob.ValidName(name) || (audience != "REQUESTER" && audience != "INTERNAL") || version < 1 {
		return database.Result{}, web.Fail(422, "Nama, audience atau versi tidak valid")
	}
	if audience == "INTERNAL" && !scope.Internal {
		return database.Result{}, web.Fail(403, "Lampiran internal tidak diizinkan")
	}
	policy, e := s.Store.AttachmentPolicy(ctx, id)
	if e != nil {
		return database.Result{}, e
	}
	allowed := false
	for _, m := range policy.AllowedMIME {
		if m == mime {
			allowed = true
		}
	}
	if !allowed || policy.UploadMax < 1 || policy.UploadMax > 10485760 {
		return database.Result{}, web.Fail(422, "Type file tidak diizinkan policy")
	}
	select {
	case s.UploadSlots <- struct{}{}:
		defer func() { <-s.UploadSlots }()
	default:
		return database.Result{}, web.Fail(429, "Dua unggahan sedang diproses; coba kembali sebentar lagi")
	}
	fileID := web.ID()
	data, size, e := s.Files.Put(ctx, fileID, body, policy.UploadMax)
	if e != nil {
		return database.Result{}, e
	}
	used := false
	defer func() {
		if !used {
			_ = s.Files.Remove(fileID)
		}
	}()
	if e = blob.Validate(data, mime); e != nil {
		return database.Result{}, e
	}
	hash := sha256.Sum256(data)
	result, e := database.Mutate(ctx, s.Store.Pool, database.Mutation{Owner: "M3", Actor: a.ID, Command: "UploadTicketAttachment", Target: id, Key: key, Scope: v.OwnerOrg, Reason: "Lampiran privat", Payload: map[string]any{"expected_version": version, "filename": name, "mime": mime, "audience": audience, "size": size, "sha256": hex.EncodeToString(hash[:])}}, func(tx pgx.Tx) (database.Result, error) {
		receipt, e := s.Store.AddFile(ctx, tx, id, a.ID, fileID, name, mime, audience, size, hash[:], version)
		if e != nil {
			return database.Result{}, e
		}
		used = true
		return database.Response(201, receipt)
	})
	// On an unknown commit never remove a possibly committed blob. Reconciliation handles genuine orphans.
	if e != nil && used {
		return database.Result{}, e
	}
	return result, e
}
func (s *Service) Download(ctx context.Context, c Credentials, ticket, id string) ([]byte, string, string, error) {
	_, scope, _, e := s.Read(ctx, c, ticket)
	if e != nil {
		return nil, "", "", e
	}
	v, e := s.Store.File(ctx, ticket, id, scope.Internal)
	if e != nil {
		return nil, "", "", e
	}
	if v.View.Status != "CLEAN" {
		return nil, "", "", web.Fail(409, "Lampiran belum bersih atau tidak tersedia")
	}
	data, e := s.Files.Read(v.Key)
	if e != nil || int64(len(data)) != v.View.Size || blob.Checksum(data) != v.Hash {
		_ = s.Store.ScanResult(ctx, v, "MISSING", "BLOB_MISSING_OR_CHANGED")
		return nil, "", "", web.Fail(503, "File lampiran tidak tersedia")
	}
	return data, v.View.Name, v.View.MIME, nil
}
func (s *Service) ScanOne(ctx context.Context) error {
	v, e := s.Store.PendingFile(ctx)
	if e != nil {
		return e
	}
	data, e := s.Files.Read(v.Key)
	if e != nil || int64(len(data)) != v.View.Size || blob.Checksum(data) != v.Hash {
		return s.Store.ScanResult(ctx, v, "MISSING", "BLOB_MISSING_OR_CHANGED")
	}
	status, e := s.Files.Scan(ctx, data)
	if e != nil {
		return s.Store.ScanResult(ctx, v, "QUARANTINED", "SCANNER_UNAVAILABLE")
	}
	return s.Store.ScanResult(ctx, v, status, "CLAMAV_"+status)
}
func (s *Service) Reconcile(ctx context.Context) error {
	return s.Files.VisitOrphans(ctx, s.now().Add(-24*time.Hour), func(key string) error {
		found, e := s.Store.Referenced(ctx, key)
		if e != nil {
			return e
		}
		if !found && s.SharedBlobReferences != nil {
			found, e = s.SharedBlobReferences(ctx, key)
			if e != nil {
				return e
			}
		}
		if !found {
			return s.Files.Remove(key)
		}
		return nil
	})
}
func (s *Service) RunFiles(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	round := 0
	for {
		step, cancel := context.WithTimeout(ctx, 7*time.Second)
		_ = s.ScanOne(step)
		cancel()
		if round%1800 == 0 {
			bounded, done := context.WithTimeout(ctx, 5*time.Second)
			_ = s.Reconcile(bounded)
			done()
		}
		round++
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
