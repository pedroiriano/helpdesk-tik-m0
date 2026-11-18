package app

import (
	"context"
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/modules/m9/internal/domain"
	"helpdesk.local/m0/internal/modules/m9/internal/store"
	"helpdesk.local/m0/internal/platform/web"
)

type Service struct {
	Lab      bool
	Delivery DeliveryOptions
	store    store.Store
}

func NewService(st store.Store) *Service {
	return &Service{store: st}
}

func (s *Service) ListNotifications(ctx context.Context, recipientID string, limit int, cursor string) ([]api.Notification, *string, error) {
	return s.store.ListNotifications(ctx, recipientID, limit, cursor)
}

func (s *Service) MarkNotificationRead(ctx context.Context, id, recipientID string, expectedVersion int64, reason string) (*api.Receipt, error) {
	return s.store.MarkNotificationRead(ctx, id, recipientID, expectedVersion, reason)
}

func (s *Service) IssueSinkChallenge(ctx context.Context, subject, kind string, orgs []string, org string) (*api.SinkChallenge, error) {
	if !s.Lab && !s.Delivery.TelegramEnabled {
		return nil, web.Fail(503, "Enrollment saluran notifikasi belum diaktifkan (DEC-M09)")
	}
	if err := domain.ValidateTelegramBinding(org, kind, orgs, "SINK", "challenge"); err != nil {
		return nil, err
	}
	return s.store.IssueSinkChallenge(ctx, subject, org)
}

func (s *Service) VerifyTelegramBinding(ctx context.Context, subjectID, actorKind string, actorOrgs []string, in api.TelegramBindingInput) (*api.Receipt, error) {
	if s.Lab {
		if err := domain.ValidateTelegramBinding(in.ScopeOrgID, actorKind, actorOrgs, in.Channel, in.VerificationCode); err != nil {
			return nil, err
		}
		return s.store.CreateTelegramBinding(ctx, subjectID, in.ScopeOrgID, in.VerificationCode, in.Channel)
	}
	if !s.Delivery.TelegramEnabled {
		return nil, web.Fail(503, "Saluran Telegram produksi belum diaktifkan oleh pengelola layanan (DEC-M09)")
	}
	if in.Channel == "SINK" {
		return nil, web.Fail(400, "Channel SINK tidak tersedia di luar mode lab")
	}
	if err := domain.ValidateChannelBinding(in.ScopeOrgID, actorKind, actorOrgs, in.Channel, in.VerificationCode, in.ChatRef, true); err != nil {
		return nil, err
	}
	masked := domain.MaskSecret(in.ChatRef)
	return s.store.CreateChannelBinding(ctx, subjectID, in.ScopeOrgID, in.VerificationCode, "TELEGRAM", masked, strings.TrimSpace(in.ChatRef))
}

func (s *Service) RevokeTelegramBinding(ctx context.Context, id, subjectID string, orgs []string, expectedVersion int64, reason string) (*api.Receipt, error) {
	return s.store.RevokeTelegramBinding(ctx, id, subjectID, orgs, expectedVersion, reason)
}

func (s *Service) ReadScopedReport(ctx context.Context, from, to time.Time, orgID string) (*api.Report, error) {
	return s.store.ReadScopedReport(ctx, from, to, orgID)
}

func (s *Service) RequestReportExport(ctx context.Context, principalID, orgID string, query api.ReportQuery) (*api.Operation, error) {
	return s.store.CreateExportJob(ctx, principalID, orgID, query)
}

func (s *Service) ReadReportExport(ctx context.Context, id, principalID string, orgs []string) (*api.Operation, error) {
	return s.store.ReadExportJob(ctx, id, principalID, orgs)
}

func (s *Service) DownloadReportExport(ctx context.Context, id, principalID string, orgs []string) (*api.Download, error) {
	return s.store.GetExportDownload(ctx, id, principalID, orgs)
}

func (s *Service) ExportFile(ctx context.Context, id, principalID string, orgs []string) ([]byte, string, error) {
	return s.store.ExportFile(ctx, id, principalID, orgs)
}

func (s *Service) ListAudit(ctx context.Context, limit int, cursor string) ([]api.Audit, *string, error) {
	return s.store.ListAudit(ctx, limit, cursor)
}
