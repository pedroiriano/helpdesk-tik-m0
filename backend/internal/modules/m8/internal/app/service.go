package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/modules/m8/internal/domain"
	"helpdesk.local/m0/internal/modules/m8/internal/store"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/web"
)

type FilePort interface {
	Put(context.Context, string, io.Reader, int64) ([]byte, int64, error)
	Read(string) ([]byte, error)
	Remove(string) error
	Scan(context.Context, []byte) (string, error)
}

type Service struct {
	Store *store.Store
	Files FilePort
}

func NewService(st *store.Store, files FilePort) *Service {
	return &Service{
		Store: st,
		Files: files,
	}
}

func (s *Service) ListMedia(ctx context.Context, principalID string, isStaff bool, limit int, cursor string, onlyClean bool, search string, scopes ...api.Scope) ([]api.MediaItem, *string, error) {
	return s.Store.ListMedia(ctx, principalID, isStaff, limit, cursor, onlyClean, search, scopes...)
}

func (s *Service) GetMedia(ctx context.Context, id string) (api.MediaItem, error) {
	return s.Store.GetMedia(ctx, id)
}

func (s *Service) UploadMedia(ctx context.Context, actorID string, in api.MediaUploadInput, keys ...string) (api.MediaItem, error) {
	if in.HeroCandidate && in.MIME != "image/png" && in.MIME != "image/jpeg" {
		return api.MediaItem{}, web.Fail(422, "Banner memerlukan gambar PNG atau JPEG")
	}
	if !blob.ValidName(in.Filename) || in.ExpectedVersion != 1 || in.OrgID == nil {
		return api.MediaItem{}, web.Fail(422, "Nama, versi awal atau organisasi unggahan tidak valid")
	}
	if err := domain.ValidateMediaUpload(in); err != nil {
		return api.MediaItem{}, err
	}
	rawSHA, err := hex.DecodeString(in.SHA256)
	if err != nil || len(rawSHA) != 32 {
		return api.MediaItem{}, web.Fail(422, "SHA256 digest tidak valid")
	}

	id := web.ID()
	now := time.Now().UTC()
	item := api.MediaItem{
		ID:          id,
		Version:     1,
		Owner:       "M8",
		PrincipalID: actorID,
		OrgID:       in.OrgID,
		StorageKey:  id,
		Status:      "PENDING",
		Visibility:  "PRIVATE",
		MIME:        in.MIME,
		SizeBytes:   in.SizeBytes,
		SHA256:      in.SHA256,
		Alt:         in.Alt,
		Caption:     in.Caption,
		License:     in.License,
		Source:      in.Source,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	key := ""
	if len(keys) == 1 {
		key = keys[0]
	}
	result, err := s.Store.CreateMedia(ctx, item, rawSHA, in, key)
	if err != nil {
		return api.MediaItem{}, err
	}
	var created api.MediaItem
	if err = json.Unmarshal(result.Body, &created); err != nil {
		return api.MediaItem{}, err
	}
	created.DownloadPath = "/api/v1/media/" + created.ID + "/download"
	return created, nil

}

func (s *Service) StoreQuarantineBlob(ctx context.Context, id string, body io.Reader) (api.MediaItem, error) {
	item, err := s.Store.GetMedia(ctx, id)
	if err != nil {
		return api.MediaItem{}, err
	}
	if item.Status == "CLEAN" {
		data, err := io.ReadAll(io.LimitReader(body, 10485761))
		if err != nil {
			return api.MediaItem{}, err
		}
		hash := sha256.Sum256(data)
		if int64(len(data)) != item.SizeBytes || hex.EncodeToString(hash[:]) != item.SHA256 {
			return api.MediaItem{}, web.Fail(409, "Isi upload berbeda dari berkas yang telah disimpan")
		}
		return item, nil
	}
	key := web.ID()
	if err = s.Store.ClaimUpload(ctx, id, item.Version, key); err != nil {
		return api.MediaItem{}, err
	}
	data, size, err := s.Files.Put(ctx, key, body, 10485760)
	status := "PENDING"
	if err == nil {
		status = "REJECTED"
		err = blob.Validate(data, item.MIME)
	}
	if err == nil {
		hash := sha256.Sum256(data)
		if hex.EncodeToString(hash[:]) != item.SHA256 || size != item.SizeBytes {
			err = web.Fail(422, "Ukuran atau hash berkas tidak sesuai metadata")
		}
	}
	if err == nil {
		var scanned string
		scanned, err = s.Files.Scan(ctx, data)
		if err != nil || scanned != "CLEAN" {
			status = "QUARANTINED"
			if scanned == "REJECTED" {
				status = "REJECTED"
			}
			err = web.Fail(422, "Berkas tetap dalam karantina karena pemindaian belum bersih")
		} else {
			status = "CLEAN"
		}
	}
	finishCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	finishErr := s.Store.FinishUpload(finishCtx, id, key, status)
	// An unknown commit can already reference this key: preserve it for reconciliation.
	if finishErr == nil && status != "CLEAN" {
		_ = s.Files.Remove(key)
	}
	if finishErr != nil {
		return api.MediaItem{}, finishErr
	}
	if err != nil {
		return api.MediaItem{}, err
	}
	return s.Store.GetMedia(ctx, id)
}

func (s *Service) DownloadCleanBlob(ctx context.Context, id string) ([]byte, api.MediaItem, error) {
	item, err := s.Store.GetMedia(ctx, id)
	if err != nil {
		return nil, api.MediaItem{}, err
	}
	if item.Status != "CLEAN" {
		return nil, api.MediaItem{}, web.Fail(403, "Berkas belum berstatus CLEAN atau berada di karantina")
	}
	data, err := s.Files.Read(item.StorageKey)
	if err != nil {
		return nil, api.MediaItem{}, web.Fail(404, "Berkas fisik media tidak ditemukan di storage")
	}
	return data, item, nil
}

func (s *Service) ListDrafts(ctx context.Context, principalID string, limit int, cursor string) ([]api.DraftItem, *string, error) {
	return s.Store.ListDrafts(ctx, principalID, limit, cursor)
}

func (s *Service) GetDraft(ctx context.Context, id, principalID string) (api.DraftItem, error) {
	return s.Store.GetDraft(ctx, id, principalID)
}

func (s *Service) SaveDraft(ctx context.Context, id, principalID string, in api.DraftWriteInput) (api.DraftItem, error) {
	exp, err := domain.ValidateDraft(in)
	if err != nil {
		return api.DraftItem{}, err
	}
	return s.Store.SaveDraft(ctx, id, principalID, in, exp)
}

func (s *Service) DeleteDraft(ctx context.Context, id, principalID string) error {
	return s.Store.DeleteDraft(ctx, id, principalID)
}

func (s *Service) CreateContent(ctx context.Context, actorID string, kind string, in api.ContentWriteInput) (api.ContentItem, error) {
	if err := domain.ValidateContentWrite(in); err != nil {
		return api.ContentItem{}, err
	}
	cleanBody, err := domain.SanitizeContentBody(in.Body)
	if err != nil {
		return api.ContentItem{}, err
	}
	cat := strings.TrimSpace(in.CategoryLabel)
	if cat == "" {
		cat = "Umum"
	}
	order := 100
	if in.SortOrder != nil {
		order = *in.SortOrder
	}
	id := web.ID()
	now := time.Now().UTC()
	item := api.ContentItem{
		ID:            id,
		Version:       1,
		Kind:          kind,
		Slug:          in.Slug,
		Title:         in.Title,
		Body:          cleanBody,
		Audience:      in.Audience,
		State:         "DRAFT",
		CategoryLabel: cat,
		SortOrder:     order,
		OrgID:         in.OrgID,
		PrincipalID:   actorID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.Store.InsertContent(ctx, item, cleanBody); err != nil {
		return api.ContentItem{}, err
	}
	return item, nil
}

func (s *Service) GetContent(ctx context.Context, idOrSlug string, viewerAudience string, isStaff bool, scopes ...api.Scope) (api.ContentItem, error) {
	return s.Store.GetContent(ctx, idOrSlug, viewerAudience, isStaff, scopes...)
}

func (s *Service) ListContent(ctx context.Context, kind string, viewerAudience string, isStaff bool, limit int, cursor, search string, scopes ...api.Scope) ([]api.ContentItem, *string, error) {
	return s.Store.ListContent(ctx, kind, viewerAudience, isStaff, limit, cursor, search, scopes...)
}

func (s *Service) UpdateContent(ctx context.Context, id string, in api.ContentWriteInput, authorID string, scopes ...api.Scope) (api.ContentItem, error) {
	if err := domain.ValidateContentWrite(in); err != nil {
		return api.ContentItem{}, err
	}
	cleanBody, err := domain.SanitizeContentBody(in.Body)
	if err != nil {
		return api.ContentItem{}, err
	}
	in.Body = cleanBody
	return s.Store.UpdateContent(ctx, id, in, authorID, scopes...)
}

func (s *Service) TransitionContent(ctx context.Context, id string, in api.EditorialTransitionInput, actorID string, hasPublishPerm bool, scopes ...api.Scope) (api.ContentItem, error) {
	if in.ExpectedVersion < 1 {
		return api.ContentItem{}, web.Fail(400, "expected_version wajib >= 1")
	}
	cur, err := s.Store.GetContent(ctx, id, "STAFF_ONLY", true, scopes...)
	if err != nil {
		return api.ContentItem{}, err
	}
	nextState, err := domain.ValidateTransition(cur.State, in.Action)
	if err != nil {
		return api.ContentItem{}, err
	}
	needsPublish := in.Action == "PUBLISH" || in.Action == "ARCHIVE" || in.Action == "RESTORE"
	if needsPublish && !hasPublishPerm {
		return api.ContentItem{}, web.Fail(403, "Izin content.publish diperlukan untuk mengubah status publikasi konten")
	}
	scope := api.ScopeValue(scopes)
	if !scope.WriteContent(cur, needsPublish) {
		return api.ContentItem{}, web.Fail(404, "Konten tidak ditemukan")
	}
	return s.Store.TransitionContent(ctx, id, in.ExpectedVersion, nextState, in.Reason, actorID, scope)
}

func (s *Service) SearchArticles(ctx context.Context, query string, audience string, isStaff bool, limit int, after string, scopes ...api.Scope) ([]api.SearchHit, error) {
	return s.Store.SearchArticles(ctx, query, audience, isStaff, limit, after, scopes...)
}
