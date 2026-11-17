package app

import (
	"context"
	m3api "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/modules/m3/internal/domain"
	"helpdesk.local/m0/internal/modules/m3/internal/store"
	"helpdesk.local/m0/internal/platform/web"
)

func (s *Service) resolvePrincipal(ctx context.Context, c Credentials, write bool) (string, bool, error) {
	actor, scope, err := s.actor(ctx, c, write)
	if err == nil {
		isStaff := scope.Internal || actor.Kind == "STAFF"
		return actor.ID, isStaff, nil
	}
	if c.Identity.Token == "" && !write && domain.Secret(c.Capability) {
		cid, _, e := s.Store.Capability(ctx, domain.Hash(c.Capability))
		return cid, false, e
	}

	return "", false, err
}

func (s *Service) ListDrafts(ctx context.Context, c Credentials, limit int, cursor string) ([]m3api.DraftItem, *string, error) {
	principal, _, err := s.resolvePrincipal(ctx, c, false)
	if err != nil {
		return nil, nil, err
	}
	return s.Store.ListDrafts(ctx, principal, limit, cursor)
}

func (s *Service) GetDraft(ctx context.Context, c Credentials, id string) (m3api.DraftItem, error) {
	principal, _, err := s.resolvePrincipal(ctx, c, false)
	if err != nil {
		return m3api.DraftItem{}, err
	}
	return s.Store.GetDraft(ctx, id, principal)
}

func (s *Service) SaveDraft(ctx context.Context, c Credentials, id string, in m3api.DraftWriteInput) (m3api.DraftItem, error) {
	principal, _, err := s.resolvePrincipal(ctx, c, true)
	if err != nil {
		return m3api.DraftItem{}, err
	}
	exp, err := domain.ValidateDraft(in)
	if err != nil {
		return m3api.DraftItem{}, err
	}
	return s.Store.SaveDraft(ctx, id, principal, in, exp)
}

func (s *Service) DeleteDraft(ctx context.Context, c Credentials, id string) error {
	principal, _, err := s.resolvePrincipal(ctx, c, true)
	if err != nil {
		return err
	}
	return s.Store.DeleteDraft(ctx, id, principal)
}

func (s *Service) mediaScope(ctx context.Context, c Credentials) (store.Scope, error) {
	_, scope, err := s.actor(ctx, c, false)
	if c.Identity.Token != "" && err != nil {
		return store.Scope{}, err
	}
	if c.Capability != "" {
		if !domain.Secret(c.Capability) {
			return store.Scope{}, web.Fail(401, "Kunci pelacakan tidak berlaku")
		}
		cid, ticket, e := s.Store.Capability(ctx, domain.Hash(c.Capability))
		return store.Scope{ID: cid, TicketID: ticket, Role: "GUEST", Orgs: []string{}}, e
	}
	return scope, err
}

func (s *Service) ListMediaM3(ctx context.Context, c Credentials, limit int, cursor string, onlyClean bool, search string) ([]m3api.MediaItem, *string, error) {
	scope, err := s.mediaScope(ctx, c)
	if err != nil {
		return nil, nil, err
	}
	return s.Store.ListMediaM3(ctx, scope.ID, scope.Internal, limit, cursor, onlyClean, search, scope)
}
func (s *Service) GetMediaM3(ctx context.Context, c Credentials, id string) (m3api.MediaItem, error) {
	scope, err := s.mediaScope(ctx, c)
	if err != nil {
		return m3api.MediaItem{}, err
	}
	return s.Store.GetMediaM3(ctx, id, scope)
}
