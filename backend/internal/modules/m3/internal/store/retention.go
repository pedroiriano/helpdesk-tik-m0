package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
)

type purgeCandidate struct {
	OwnerOrg       string
	Version        int64
	State          string
	Archived       bool
	LegalHold      bool
	RetentionUntil sql.NullTime
	PurgedAt       sql.NullTime
}

func (s Store) readPurgeCandidate(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, id string) (purgeCandidate, error) {
	var c purgeCandidate
	err := q.QueryRow(ctx, `SELECT service_owner_org_id::text,version,state,(archived_at IS NOT NULL),legal_hold,retention_until,purged_at
		FROM intake.tickets WHERE id=$1`, id).
		Scan(&c.OwnerOrg, &c.Version, &c.State, &c.Archived, &c.LegalHold, &c.RetentionUntil, &c.PurgedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, web.Fail(404, "Tiket target retensi tidak ditemukan")
	}
	return c, err
}

func validatePurgeEligibility(c purgeCandidate, now time.Time) error {
	if c.PurgedAt.Valid {
		return web.Fail(409, "Tiket sudah dimusnahkan sebelumnya")
	}
	if !c.Archived || (c.State != "CLOSED" && c.State != "CANCELLED") {
		return web.Fail(409, "Hanya tiket terminal (CLOSED/CANCELLED) yang sudah diarsipkan dapat dimusnahkan")
	}
	if c.LegalHold {
		return web.Fail(409, "Pemusnahan ditolak: tiket berada dalam status legal hold")
	}
	if !c.RetentionUntil.Valid || c.RetentionUntil.Time.After(now) {
		return web.Fail(409, "Masa retensi tiket belum berakhir")
	}
	return nil
}

func (s Store) PreflightRetentionPurge(ctx context.Context, id string, now time.Time) (string, error) {
	c, err := s.readPurgeCandidate(ctx, s.Pool, id)
	if err != nil {
		return "", err
	}
	if err := validatePurgeEligibility(c, now); err != nil {
		return "", err
	}
	var pendingRefs int64
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM intake.handoff_requests WHERE ticket_id=$1 AND state='PENDING'`, id).Scan(&pendingRefs); err != nil {
		return "", err
	}
	if pendingRefs > 0 {
		return "", web.Fail(409, "Masih terdapat handoff PENDING aktif pada tiket ini")
	}
	return c.OwnerOrg, nil
}

func (s Store) SetRetention(ctx context.Context, tx pgx.Tx, id, actor string, in api.RetentionInput, now time.Time) (api.RetentionStatus, error) {
	var st api.RetentionStatus
	c, err := s.readPurgeCandidate(ctx, tx, id)
	if err != nil {
		return st, err
	}
	if c.PurgedAt.Valid {
		return st, web.Fail(409, "Tiket sudah dimusnahkan")
	}
	if in.ExpectedVersion != c.Version {
		return st, web.Fail(409, "Versi tiket berubah")
	}
	var retUntil any
	if in.RetentionUntil != nil {
		retUntil = in.RetentionUntil.UTC()
	}
	var nextVer int64
	var outUntil sql.NullTime
	var outPurged sql.NullTime
	err = tx.QueryRow(ctx, `UPDATE intake.tickets
		SET legal_hold=$1,
		    retention_until=COALESCE($2, retention_until),
		    version=version+1,
		    updated_at=$3
		WHERE id=$4 AND version=$5
		RETURNING version, retention_until, purged_at`,
		in.LegalHold, retUntil, now, id, in.ExpectedVersion).Scan(&nextVer, &outUntil, &outPurged)
	if err != nil {
		return st, err
	}
	actionDesc := fmt.Sprintf("Kebijakan retensi diperbarui (legal_hold=%t): %s", in.LegalHold, in.Reason)
	if err := History(ctx, tx, id, nextVer, actor, "ConfigureRetention", actionDesc); err != nil {
		return st, err
	}
	st = api.RetentionStatus{TicketID: id, Version: nextVer, LegalHold: in.LegalHold}
	if outUntil.Valid {
		t := outUntil.Time
		st.RetentionUntil = &t
	}
	if outPurged.Valid {
		t := outPurged.Time
		st.PurgedAt = &t
	}
	return st, nil
}

func (s Store) PurgeTicketData(ctx context.Context, tx pgx.Tx, id, actor, reason string, now time.Time) (ownerOrg string, removedKeys []string, nextVersion int64, err error) {
	c, err := s.readPurgeCandidate(ctx, tx, id)
	if err != nil {
		return "", nil, 0, err
	}
	if err := validatePurgeEligibility(c, now); err != nil {
		return "", nil, 0, err
	}
	err = tx.QueryRow(ctx, `UPDATE intake.tickets
		SET title='[DIMUSNAHKAN SESUAI RETENSI]',
		    description='[KONTEN DIMUSNAHKAN]',
		    purged_at=$1,
		    purge_reason=$2,
		    version=version+1,
		    updated_at=$1
		WHERE id=$3 AND purged_at IS NULL
		RETURNING version`,
		now, reason, id).Scan(&nextVersion)
	if err != nil {
		return "", nil, 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE intake.guest_capabilities SET revoked_at=COALESCE(revoked_at, $1) WHERE ticket_id=$2`, now, id); err != nil {
		return "", nil, 0, err
	}
	rows, err := tx.Query(ctx, `DELETE FROM intake.attachments WHERE ticket_id=$1 RETURNING storage_key`, id)
	if err != nil {
		return "", nil, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return "", nil, 0, err
		}
		removedKeys = append(removedKeys, key)
	}
	if err := rows.Err(); err != nil {
		return "", nil, 0, err
	}
	if err := History(ctx, tx, id, nextVersion, actor, "PurgeRetentionTicket", fmt.Sprintf("Data tiket dimusnahkan sesuai kebijakan retensi: %s", reason)); err != nil {
		return "", nil, 0, err
	}
	return c.OwnerOrg, removedKeys, nextVersion, nil
}
