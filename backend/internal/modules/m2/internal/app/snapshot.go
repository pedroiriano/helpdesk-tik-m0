package app

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) Snapshot(ctx context.Context, c identity.Credentials, id string) (api.Snapshot, error) {
	actor, err := s.actor(ctx, c, false)
	if err != nil {
		return api.Snapshot{}, err
	}
	v, err := s.Store.Snapshot(ctx, id, actor.Kind, actor.Orgs(""))
	if errors.Is(err, pgx.ErrNoRows) {
		err = web.Fail(404, "Layanan tidak tersedia")
	}
	return v, err
}

// VerificationCategories is an owner-scoped read for the trusted M3 use case.
func (s *Service) VerificationCategories(ctx context.Context, org string) ([]api.Category, error) {
	if !web.UUID(org) {
		return nil, web.Fail(422, "Organisasi kategori tidak valid")
	}
	return s.Store.ActiveCategories(ctx, org)
}

func (s *Service) AdminService(ctx context.Context, c identity.Credentials, id string) (api.Service, error) {
	return s.Read(ctx, c, id, true)
}
