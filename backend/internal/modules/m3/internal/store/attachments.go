package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m2/api"
	tickets "helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

type File struct {
	View              tickets.Attachment
	Key, Ticket, Hash string
	Attempts          int
}

func (s Store) AttachmentPolicy(ctx context.Context, id string) (v api.Policy, err error) {
	var raw []byte
	err = s.Pool.QueryRow(ctx, `SELECT service_snapshot->'policy' FROM intake.tickets WHERE id=$1`, id).Scan(&raw)
	if err == nil {
		err = json.Unmarshal(raw, &v)
	}
	return
}
func (s Store) AddFile(ctx context.Context, tx pgx.Tx, ticket, actor, key, name, mime, audience string, size int64, hash []byte, expected int64) (map[string]any, error) {
	next, e := Bump(ctx, tx, ticket, expected)
	if e != nil {
		return nil, e
	}
	var count, total int64
	e = tx.QueryRow(ctx, `SELECT count(*),COALESCE(sum(size_bytes),0) FROM intake.attachments WHERE ticket_id=$1`, ticket).Scan(&count, &total)
	if e != nil {
		return nil, e
	}
	if count >= 25 || total+size > 52428800 {
		return nil, web.Fail(422, "Quota lampiran tiket tercapai")
	}
	_, e = tx.Exec(ctx, `INSERT INTO intake.attachments(id,ticket_id,principal_id,storage_key,status,mime,size_bytes,sha256,alt,license,display_name,audience) VALUES($1::uuid,$2,$3,$1::text,'PENDING',$4,$5,$6,'Lampiran tiket privat','PRIVATE',$7,$8)`, key, ticket, actor, mime, size, hash, name, audience)
	if e != nil {
		return nil, e
	}
	summary := "Lampiran ditambahkan; menunggu pemeriksaan"
	if audience == "INTERNAL" {
		summary = "Aktivitas internal"
	}
	e = History(ctx, tx, ticket, next, actor, "UploadTicketAttachment", summary)
	return map[string]any{"id": ticket, "version": next}, e
}
func scanFile(row pgx.Row) (v File, e error) {
	e = row.Scan(&v.View.ID, &v.View.Version, &v.View.Name, &v.View.MIME, &v.View.Size, &v.View.Status, &v.View.Audience, &v.View.Scan, &v.Key, &v.Ticket, &v.Hash, &v.Attempts)
	return
}

const fileCols = `id::text,version,display_name,mime,size_bytes,status,audience,scan_detail,storage_key,ticket_id::text,encode(sha256,'hex'),scan_attempts`

func (s Store) File(ctx context.Context, ticket, id string, internal bool) (File, error) {
	v, e := scanFile(s.Pool.QueryRow(ctx, `SELECT `+fileCols+` FROM intake.attachments WHERE ticket_id=$1 AND id=$2 AND (audience='REQUESTER' OR $3)`, ticket, id, internal))
	if e == pgx.ErrNoRows {
		e = web.Fail(404, "Lampiran tidak ditemukan")
	}
	return v, e
}
func (s Store) Files(ctx context.Context, ticket string, internal bool, p web.Page) ([]tickets.Attachment, error) {
	rows, e := s.Pool.Query(ctx, `SELECT `+fileCols+` FROM intake.attachments WHERE ticket_id=$1 AND (audience='REQUESTER' OR $2) AND ($3='' OR id::text>$3) ORDER BY id LIMIT $4`, ticket, internal, p.Cursor, p.Limit+1)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []tickets.Attachment{}
	for rows.Next() {
		v, e := scanFile(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, v.View)
	}
	return out, rows.Err()
}
func (s Store) PendingFile(ctx context.Context) (File, error) {
	return scanFile(s.Pool.QueryRow(ctx, `SELECT `+fileCols+` FROM intake.attachments WHERE status IN ('PENDING','QUARANTINED') AND scan_attempts<8 AND next_scan_at<=now() ORDER BY next_scan_at,id LIMIT 1`))
}
func (s Store) ScanResult(ctx context.Context, v File, status, detail string) error {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	tag, e := tx.Exec(ctx, `UPDATE intake.attachments SET status=$1,scan_detail=$2,scan_attempts=scan_attempts+1,next_scan_at=now()+$3::interval,version=version+1,updated_at=now() WHERE id=$4 AND version=$5`, status, detail, time.Duration(1<<min(v.Attempts+1, 8)*int(time.Second)).String(), v.View.ID, v.View.Version)
	if e != nil {
		return e
	}
	if tag.RowsAffected() != 1 {
		return web.Fail(409, "Scan diperbarui proses lain")
	}
	if status == "CLEAN" || status == "REJECTED" {
		e = Event(ctx, tx, "MediaScanCompleted", v.View.ID, v.View.Version+1, map[string]any{"status": status, "sha256": v.Hash}, []string{"M9"})
		if e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}
func (s Store) Referenced(ctx context.Context, key string) (bool, error) {
	var found bool
	e := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM intake.attachments WHERE storage_key=$1)`, key).Scan(&found)
	return found, e
}
