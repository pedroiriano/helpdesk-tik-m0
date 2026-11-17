package app

import (
	"context"
	"helpdesk.local/m0/internal/modules/m8/api"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
	"strings"
)

func (s *Service) ApproveMedia(ctx context.Context, source api.MediaItem, in api.MediaApprovalInput, scope api.Scope, key string) (database.Result, error) {
	if source.Status != "CLEAN" || source.Version != in.ExpectedVersion || !web.UUID(in.SanitizedCopyID) || !web.UUID(in.TargetID) || len(strings.TrimSpace(in.Reason)) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Sumber/versi, salinan hasil redaksi, tujuan dan alasan tinjauan wajib valid")
	}
	return s.Store.ApproveMedia(ctx, source, in, scope, key)
}

func (s *Service) ReuseMedia(ctx context.Context, actorID string, source api.MediaItem, in api.ReuseMediaInput, scope api.Scope, key string) (database.Result, error) {
	if source.Status != "CLEAN" || source.Version != in.ExpectedVersion || in.TargetOwner != "M8" || in.ApprovalID == nil || in.SanitizedCopyID == nil || !web.UUID(*in.ApprovalID) || !web.UUID(*in.SanitizedCopyID) || !web.UUID(in.TargetID) || len(strings.TrimSpace(in.Reason)) < 5 || len(in.Reason) > 2000 {
		return database.Result{}, web.Fail(422, "Reuse memerlukan approval server dan salinan hasil redaksi yang valid")
	}
	return s.Store.PublishMedia(ctx, source, in, scope, key)
}
