package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/modules/m9/internal/domain"
	"helpdesk.local/m0/internal/platform/web"
)

const maxReportRows = 10000

type reportFact struct {
	Ticket    string     `json:"ticket_id"`
	Requester string     `json:"requester_id"`
	Org       string     `json:"org_id"`
	State     string     `json:"state"`
	Accepted  time.Time  `json:"accepted_at"`
	Resolved  *time.Time `json:"resolved_at"`
	Policy    int64      `json:"policy_version"`
	Episode   *string    `json:"episode_id"`
	Due       *time.Time `json:"resolution_due_at"`
	Gross     *int64     `json:"gross_seconds"`
	Net       *int64     `json:"net_seconds"`
	Observed  time.Time  `json:"-"`
}

func (s Store) authorizedReportIDs(ctx context.Context, org string, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if s.CheckScope == nil {
		return nil, web.Fail(503, "Verifikasi pemilik tiket tidak tersedia")
	}
	return s.CheckScope(ctx, org, ids)
}

func (s Store) requireScope(ctx context.Context, org string, ids []string) error {
	owned, err := s.authorizedReportIDs(ctx, org, ids)
	if err != nil {
		return err
	}
	if len(owned) != len(ids) {
		return web.Fail(409, "Kepemilikan tiket berubah; buat ulang ekspor")
	}
	return nil
}

func (s Store) loadReport(ctx context.Context, q api.ReportQuery) ([]reportFact, []string, *time.Time, error) {
	if q.From.IsZero() || !q.To.After(q.From) || q.To.Sub(q.From) > 366*24*time.Hour {
		return nil, nil, nil, web.Fail(422, "Periode laporan harus positif dan paling lama 366 hari")
	}
	rows, err := s.Pool.Query(ctx, `
  SELECT ticket_id::text,requester_id::text,org_id::text,state,accepted_at,resolved_at,policy_version,
         episode_id::text,resolution_due_at,gross_seconds,net_seconds,COALESCE(fact_at,updated_at)
  FROM notify_audit.report_facts
  WHERE org_id=$1 AND CASE
   WHEN $4='RESOLVED' THEN resolved_at >= $2 AND resolved_at < $3 AND state IN ('RESOLVED','CLOSED')
   WHEN $4='OPEN' THEN accepted_at >= $2 AND accepted_at < $3 AND state NOT IN ('RESOLVED','CLOSED','CANCELLED')
   ELSE accepted_at >= $2 AND accepted_at < $3 END
  ORDER BY accepted_at,ticket_id LIMIT $5`, q.OrganizationID, q.From, q.To, q.Cohort, maxReportRows+1)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()
	facts := make([]reportFact, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var f reportFact
		if err := rows.Scan(&f.Ticket, &f.Requester, &f.Org, &f.State, &f.Accepted, &f.Resolved, &f.Policy, &f.Episode, &f.Due, &f.Gross, &f.Net, &f.Observed); err != nil {
			return nil, nil, nil, err
		}
		if len(facts) == maxReportRows {
			return nil, nil, nil, web.Fail(422, "Periode melebihi batas baris; persempit rentang laporan")
		}
		facts, ids = append(facts, f), append(ids, f.Ticket)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, nil, err
	}
	rows.Close()
	owned, err := s.authorizedReportIDs(ctx, q.OrganizationID, ids)
	if err != nil {
		return nil, nil, nil, err
	}
	allowed := make(map[string]bool, len(owned))
	for _, id := range owned {
		allowed[id] = true
	}
	scoped := facts[:0]
	ids = ids[:0]
	var watermark *time.Time
	for _, f := range facts {
		if !allowed[f.Ticket] {
			continue
		}
		scoped, ids = append(scoped, f), append(ids, f.Ticket)
		if watermark == nil || f.Observed.After(*watermark) {
			observed := f.Observed
			watermark = &observed
		}
	}
	return scoped, ids, watermark, nil
}

func (s Store) ReadScopedReport(ctx context.Context, from, to time.Time, org string) (*api.Report, error) {
	facts, _, watermark, err := s.loadReport(ctx, api.ReportQuery{OrganizationID: org, From: from, To: to, Cohort: "ACCEPTED"})
	if err != nil {
		return nil, err
	}
	return summarizeReport(facts, watermark), nil
}

func summarizeReport(facts []reportFact, watermark *time.Time) *api.Report {
	report := api.Report{AsOf: time.Now().UTC(), Watermark: watermark, Timezone: "Asia/Jakarta", Measure: "SLA", Accepted: int64(len(facts))}
	policies := make(map[int64]bool)
	for _, f := range facts {
		switch reportState(f.State) {
		case "completed":
			report.Completed++
			if f.Resolved == nil || f.Due == nil {
				report.Unmeasured++
				continue
			}
			policies[f.Policy] = true
			report.Denominator++
			if f.Resolved.After(*f.Due) {
				report.Breached++
			} else {
				report.Count++
			}
			if f.Gross != nil && f.Net != nil {
				report.GrossSeconds += *f.Gross
				report.NetSeconds += *f.Net
			}
		case "cancelled":
			report.Cancelled++
		default:
			report.Backlog++
		}
	}
	if len(policies) == 1 {
		for v := range policies {
			report.PolicyVersion = &v
		}
	}
	if report.Denominator > 0 {
		pct := 100 * float64(report.Count) / float64(report.Denominator)
		report.SLAPercent = &pct
	}
	return &report
}

func exportBytes(format string, facts []reportFact) ([]byte, error) {
	if format == "JSON" {
		return json.Marshal(facts)
	}
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	if err := w.Write([]string{"ticket_id", "requester_id", "org_id", "state", "accepted_at", "resolved_at", "policy_version", "episode_id", "resolution_due_at", "gross_seconds", "net_seconds"}); err != nil {
		return nil, err
	}
	stamp := func(t *time.Time) string {
		if t == nil {
			return ""
		}
		return t.UTC().Format(time.RFC3339Nano)
	}
	duration := func(v *int64) string {
		if v == nil {
			return ""
		}
		return strconv.FormatInt(*v, 10)
	}
	for _, f := range facts {
		episode := ""
		if f.Episode != nil {
			episode = *f.Episode
		}
		row := []string{f.Ticket, f.Requester, f.Org, f.State, stamp(&f.Accepted), stamp(f.Resolved), strconv.FormatInt(f.Policy, 10), episode, stamp(f.Due), duration(f.Gross), duration(f.Net)}
		for i, val := range row {
			row[i] = domain.SanitizeCSV(val)
		}
		if err := w.Write(row); err != nil {
			return nil, err
		}
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func (s Store) CreateExportJob(ctx context.Context, principal, org string, q api.ReportQuery) (*api.Operation, error) {
	if q.OrganizationID != org {
		return nil, web.Fail(403, "Scope ekspor berbeda dari filter")
	}
	facts, ids, watermark, err := s.loadReport(ctx, q)
	if err != nil {
		return nil, err
	}
	payload, err := exportBytes(q.Format, facts)
	if err != nil {
		return nil, err
	}
	filter, err := json.Marshal(q)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	id := web.ID()
	digest := sha256.Sum256(payload)
	_, err = s.Pool.Exec(ctx, `INSERT INTO notify_audit.export_jobs(id,principal_id,scope_org_ids,filter_snapshot,state,expires_at,snapshot_payload,snapshot_tickets,snapshot_watermark,snapshot_digest)
  VALUES($1,$2,ARRAY[$3::uuid],$4,'SUCCEEDED',$5,$6,$7::uuid[],$8,$9)`,
		id, principal, org, filter, now.Add(24*time.Hour), payload, ids, watermark, hex.EncodeToString(digest[:]))
	if err != nil {
		return nil, err
	}
	return &api.Operation{ID: id, Version: 1, State: "SUCCEEDED", Kind: "REPORT_EXPORT", UpdatedAt: now}, nil
}

type exportSnapshot struct {
	op      api.Operation
	expires time.Time
	format  string
	payload []byte
}

func (s Store) getExport(ctx context.Context, id, principal string, orgs []string, includePayload bool) (exportSnapshot, error) {
	var item exportSnapshot
	var owner, org string
	var ids []string
	var digest *string
	err := s.Pool.QueryRow(ctx, `SELECT id::text,version,state,updated_at,expires_at,principal_id::text,
  scope_org_ids[1]::text,filter_snapshot->>'format',snapshot_tickets::text[],snapshot_digest,
  CASE WHEN $3 THEN snapshot_payload ELSE NULL END
  FROM notify_audit.export_jobs WHERE id=$1 AND cardinality(scope_org_ids)=1 AND scope_org_ids <@ $2::uuid[]`,
		id, orgs, includePayload).Scan(&item.op.ID, &item.op.Version, &item.op.State, &item.op.UpdatedAt, &item.expires, &owner, &org, &item.format, &ids, &digest, &item.payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return item, web.Fail(404, "Job ekspor tidak ditemukan")
	}
	if err != nil {
		return item, err
	}
	if owner != principal {
		return item, web.Fail(403, "Bukan pemilik job ekspor")
	}
	if !time.Now().Before(item.expires) {
		return item, web.Fail(410, "Masa berlaku ekspor telah berakhir")
	}
	if item.op.State != "SUCCEEDED" || digest == nil {
		return item, web.Fail(409, "Snapshot ekspor belum tersedia; ajukan ekspor baru")
	}
	if err := s.requireScope(ctx, org, ids); err != nil {
		return item, err
	}
	if includePayload {
		sum := sha256.Sum256(item.payload)
		if hex.EncodeToString(sum[:]) != *digest {
			return item, web.Fail(503, "Integritas snapshot ekspor gagal")
		}
	}
	item.op.Kind = "REPORT_EXPORT"
	return item, nil
}

func (s Store) ReadExportJob(ctx context.Context, id, principal string, orgs []string) (*api.Operation, error) {
	item, err := s.getExport(ctx, id, principal, orgs, false)
	return &item.op, err
}

func (s Store) GetExportDownload(ctx context.Context, id, principal string, orgs []string) (*api.Download, error) {
	item, err := s.getExport(ctx, id, principal, orgs, false)
	if err != nil {
		return nil, err
	}
	return &api.Download{ID: id, ExpiresAt: item.expires, DownloadPath: fmt.Sprintf("/api/v1/reports/exports/%s/file", id)}, nil
}

func (s Store) ExportFile(ctx context.Context, id, principal string, orgs []string) ([]byte, string, error) {
	item, err := s.getExport(ctx, id, principal, orgs, true)
	return item.payload, item.format, err
}
