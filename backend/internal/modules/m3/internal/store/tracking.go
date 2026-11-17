package store

import (
	"context"
	"crypto/hmac"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
)

type TrackingAuth struct {
	View         api.Tracking
	CapabilityID string
	CSRF         []byte
	Scopes       []string
}

func (s Store) Track(ctx context.Context, hash []byte) (v TrackingAuth, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT s.id::text,c.ticket_id::text,s.expires_at,s.capability_id::text,s.csrf_hash,c.scopes FROM intake.tracking_sessions s JOIN intake.guest_capabilities c ON c.id=s.capability_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND c.revoked_at IS NULL AND c.expires_at>now() AND 'ticket.read'=ANY(c.scopes)`, hash).Scan(&v.View.ID, &v.View.TicketID, &v.View.Expires, &v.CapabilityID, &v.CSRF, &v.Scopes)
	v.View.Version = 1
	if err == pgx.ErrNoRows {
		err = web.Fail(401, "Sesi pelacakan berakhir atau tidak berlaku")
	}
	return
}
func (s Store) Capability(ctx context.Context, hash []byte) (id, ticket string, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT id::text,ticket_id::text FROM intake.guest_capabilities WHERE capability_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND 'ticket.read'=ANY(scopes)`, hash).Scan(&id, &ticket)
	if err == pgx.ErrNoRows {
		err = web.Fail(401, "Kunci pelacakan tidak berlaku")
	}
	return
}
func (s Store) Exchange(ctx context.Context, tx pgx.Tx, cid, id string, token, csrf []byte) (api.Tracking, error) {
	var v api.Tracking
	v.Version = 1
	err := tx.QueryRow(ctx, `INSERT INTO intake.tracking_sessions(id,capability_id,token_hash,csrf_hash,expires_at) SELECT $1,id,$3,$4,LEAST(expires_at,now()+interval '30 minutes') FROM intake.guest_capabilities WHERE id=$2 AND revoked_at IS NULL AND expires_at>now() RETURNING id::text,(SELECT ticket_id::text FROM intake.guest_capabilities WHERE id=$2),expires_at`, id, cid, token, csrf).Scan(&v.ID, &v.TicketID, &v.Expires)
	if err == pgx.ErrNoRows {
		err = web.Fail(401, "Kunci pelacakan tidak berlaku")
	}
	return v, err
}
func (s Store) EndTrack(ctx context.Context, tx pgx.Tx, id string, revoke bool) error {
	if revoke {
		_, e := tx.Exec(ctx, `UPDATE intake.guest_capabilities SET revoked_at=now(),version=version+1 WHERE id=$1`, id)
		return e
	}
	_, e := tx.Exec(ctx, `UPDATE intake.tracking_sessions SET revoked_at=now() WHERE id=$1`, id)
	return e
}
func ValidCSRF(value []byte, hash []byte) bool { return len(value) == 32 && hmac.Equal(value, hash) }
