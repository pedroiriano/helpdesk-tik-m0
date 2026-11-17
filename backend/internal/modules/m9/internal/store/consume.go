package store

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
	"time"
)

type Store struct {
	Pool       *pgxpool.Pool
	CheckScope func(context.Context, string, []string) ([]string, error)
}

func (s Store) Consume(ctx context.Context, v delivery.Event) error {
	hash, e := delivery.Digest(v.Payload)
	if e != nil || !hmac.Equal(hash, v.Digest) || !web.UUID(v.ID) || !web.UUID(v.Aggregate) || v.Version < 1 || v.SchemaVersion != 1 {
		return delivery.ErrIntegrity
	}
	valid := (v.Type == "AuditRecorded" && (v.Producer == "M1" || v.Producer == "M2" || v.Producer == "M3" || v.Producer == "M4" || v.Producer == "M5" || v.Producer == "M8")) || ((v.Type == "TicketCreated" || v.Type == "TicketVerified" || v.Type == "AssignmentChanged" || v.Type == "TicketStateChanged" || v.Type == "MediaScanCompleted" || v.Type == "ResolutionProposed" || v.Type == "ConfirmationRecorded" || v.Type == "VendorCaseRecorded" || v.Type == "PauseChanged" || v.Type == "HandoffAccepted" || v.Type == "EscalationRequested") && v.Producer == "M3") || (v.Type == "ContentPublished" && v.Producer == "M8")
	if !valid {
		return delivery.ErrIntegrity
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	_, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, v.ID)
	if e != nil {
		return e
	}
	var old []byte
	var oldAggregate string
	var oldVersion int64
	e = tx.QueryRow(ctx, `SELECT digest,aggregate_id::text,aggregate_version FROM notify_audit.inbox WHERE consumer_id='M9' AND event_id=$1`, v.ID).Scan(&old, &oldAggregate, &oldVersion)
	if e == nil {
		if !hmac.Equal(old, v.Digest) || oldAggregate != v.Aggregate || oldVersion != v.Version {
			return delivery.ErrIntegrity
		}
		return tx.Commit(ctx)
	}
	if e != pgx.ErrNoRows {
		return e
	}
	e = nil
	if v.Type == "AuditRecorded" {
		var p struct {
			Actor   string `json:"actor_id"`
			Action  string `json:"action"`
			Object  string `json:"object_id"`
			Scope   string `json:"scope"`
			Reason  string `json:"reason"`
			Outcome string `json:"outcome"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.Actor) || !web.UUID(p.Object) || p.Action == "" || p.Reason == "" || p.Outcome != "SUCCESS" {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id,source_event_id,actor_id,action,object_id,scope,reason,outcome,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, web.ID(), v.ID, p.Actor, p.Action, p.Object, p.Scope, p.Reason, p.Outcome, v.Correlation)
	} else if v.Type == "TicketCreated" || v.Type == "TicketStateChanged" {
		var p struct {
			Requester string     `json:"requester_id"`
			Org       string     `json:"service_owner_org_id"`
			Accepted  time.Time  `json:"accepted_at"`
			State     string     `json:"state"`
			Policy    int64      `json:"policy_version"`
			Episode   *string    `json:"episode_id"`
			Resolved  *time.Time `json:"resolution_endpoint"`
			Clock     *struct {
				Due    time.Time `json:"resolution_due_at"`
				Gross  int64     `json:"gross_seconds"`
				Net    int64     `json:"net_seconds"`
				Source string    `json:"policy_source"`
			} `json:"sla_clock"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.Requester) || !web.UUID(p.Org) || p.Policy < 1 || p.Accepted.IsZero() || p.State == "" {
			return delivery.ErrIntegrity
		}
		var due *time.Time
		var gross, net *int64
		if p.Clock != nil && p.Clock.Source != "LEGACY" {
			if p.Clock.Due.IsZero() || p.Clock.Gross < 0 || p.Clock.Net < 0 || p.Clock.Net > p.Clock.Gross {
				return delivery.ErrIntegrity
			}
			due, gross, net = &p.Clock.Due, &p.Clock.Gross, &p.Clock.Net
		}
		factAt := v.Occurred
		if factAt.IsZero() {
			factAt = time.Now().UTC()
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.report_facts(id,ticket_id,requester_id,source_version,org_id,accepted_at,state,policy_version,episode_id,resolved_at,resolution_due_at,gross_seconds,net_seconds,fact_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT(ticket_id) DO UPDATE SET source_version=EXCLUDED.source_version,org_id=EXCLUDED.org_id,
             state=EXCLUDED.state,policy_version=EXCLUDED.policy_version,episode_id=EXCLUDED.episode_id,
             resolved_at=EXCLUDED.resolved_at,resolution_due_at=EXCLUDED.resolution_due_at,
             gross_seconds=EXCLUDED.gross_seconds,net_seconds=EXCLUDED.net_seconds,fact_at=EXCLUDED.fact_at,
             updated_at=now()
            WHERE notify_audit.report_facts.source_version<EXCLUDED.source_version`,
			web.ID(), v.Aggregate, p.Requester, v.Version, p.Org, p.Accepted, p.State, p.Policy, p.Episode, p.Resolved, due, gross, net, factAt)
	} else if v.Type == "TicketVerified" {
		var p struct {
			Verification string `json:"verification"`
			CategoryID   string `json:"category_id"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || p.Verification != "VERIFIED" || !web.UUID(p.CategoryID) {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id,source_event_id,actor_id,action,object_id,scope,reason,outcome,correlation_id) VALUES($1,$2,'00000000-0000-4000-8000-000000000000','TicketVerified',$3,'M3.ticket','Verifikasi tiket disahkan','SUCCESS',$4)`, web.ID(), v.ID, v.Aggregate, v.Correlation)
	} else if v.Type == "AssignmentChanged" {
		var p struct {
			TeamID     string `json:"team_id"`
			AssigneeID string `json:"assignee_id"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.TeamID) || !web.UUID(p.AssigneeID) {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id,source_event_id,actor_id,action,object_id,scope,reason,outcome,correlation_id) VALUES($1,$2,$3,'AssignmentChanged',$4,'M3.ticket','Penugasan teknisi tiket diperbarui','SUCCESS',$5)`, web.ID(), v.ID, p.AssigneeID, v.Aggregate, v.Correlation)
	} else if v.Type == "ResolutionProposed" {
		var p struct {
			AttemptID         string    `json:"attempt_id"`
			ConfirmationDueAt time.Time `json:"confirmation_due_at"`
			Recipient         string    `json:"requester_id"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.AttemptID) || p.ConfirmationDueAt.IsZero() {
			return delivery.ErrIntegrity
		}
		recipientID := p.Recipient
		if recipientID == "" {
			if err := tx.QueryRow(ctx, `SELECT requester_id::text FROM notify_audit.report_facts WHERE ticket_id=$1`, v.Aggregate).Scan(&recipientID); err != nil {
				return err
			}
		}
		if !web.UUID(recipientID) {
			return delivery.ErrIntegrity
		}

		notifID := web.ID()
		now := time.Now().UTC()
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.notifications(id, version, recipient_id, ticket_id, attempt_id, source_event_id, template_version, title, stored_at)
			VALUES($1, 1, $2, $3, $4, $5, 1, 'Tiket Selesai: Konfirmasi Diperlukan', $6)
			ON CONFLICT(source_event_id, recipient_id) DO NOTHING`,
			notifID, recipientID, v.Aggregate, p.AttemptID, v.ID, now)
		if e != nil {
			return e
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.delivery_jobs(id, version, notification_id, channel, state, attempts)
			VALUES($1, 1, $2, 'SINK', 'ACKED', 1)`,
			web.ID(), notifID)
		if e != nil {
			return e
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'ResolutionProposed', $3, 'M3.ticket', 'Notifikasi konfirmasi resolusi disimpan durable', 'SUCCESS', $4)`,
			web.ID(), v.ID, v.Aggregate, v.Correlation)
		if e != nil {
			return e
		}
		// Terbitkan event balik NotificationStored ke outbox M9 untuk target consumer M3
		edgePayload := map[string]any{
			"ticket_id":  v.Aggregate,
			"attempt_id": p.AttemptID,
		}
		rawEdge, errMarshal := json.Marshal(edgePayload)
		if errMarshal != nil {
			return errMarshal
		}
		digestEdge, errDigest := delivery.Digest(rawEdge)
		if errDigest != nil {
			return errDigest
		}
		edgeID := web.ID()
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.outbox(event_id, event_type, schema_version, aggregate_id, aggregate_version, occurred_at, correlation_id, payload, digest)
			VALUES($1, 'NotificationStored', 1, $2, 1, $3, $4, $5, $6)`,
			edgeID, notifID, now, v.Correlation, rawEdge, digestEdge)
		if e != nil {
			return e
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.outbox_delivery(event_id, consumer_id, state)
			VALUES($1, 'M3', 'PENDING')`,
			edgeID)
		if e != nil {
			return e
		}
	} else if v.Type == "ConfirmationRecorded" {
		var p struct {
			AttemptID string `json:"attempt_id"`
			Decision  string `json:"decision"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.AttemptID) || p.Decision == "" {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'ConfirmationRecorded', $3, 'M3.ticket', 'Konfirmasi pemohon dicatat: ' || $4, 'SUCCESS', $5)`,
			web.ID(), v.ID, v.Aggregate, p.Decision, v.Correlation)
	} else if v.Type == "VendorCaseRecorded" {
		var p struct {
			CaseID         string    `json:"case_id"`
			InternalPICID  string    `json:"internal_pic_id"`
			NextFollowupAt time.Time `json:"next_followup_at"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.CaseID) || !web.UUID(p.InternalPICID) {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, $3, 'VendorCaseRecorded', $4, 'M3.ticket', 'Kasus vendor dicatat dengan PIC internal', 'SUCCESS', $5)`,
			web.ID(), v.ID, p.InternalPICID, v.Aggregate, v.Correlation)
	} else if v.Type == "PauseChanged" {
		var p struct {
			PauseID       string `json:"pause_id"`
			PolicyVersion int64  `json:"policy_version"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.PauseID) {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'PauseChanged', $3, 'M3.ticket', 'Jeda penanganan berizin disetujui koordinator', 'SUCCESS', $4)`,
			web.ID(), v.ID, v.Aggregate, v.Correlation)
	} else if v.Type == "HandoffAccepted" {
		var p struct {
			FromOrgID string `json:"from_org_id"`
			ToOrgID   string `json:"to_org_id"`
			TeamID    string `json:"team_id"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.FromOrgID) || !web.UUID(p.ToOrgID) || !web.UUID(p.TeamID) {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'HandoffAccepted', $3, 'M3.ticket', 'Handoff antar-OPD diterima resmi', 'SUCCESS', $4)`,
			web.ID(), v.ID, v.Aggregate, v.Correlation)
	} else if v.Type == "EscalationRequested" {
		var p struct {
			OperationID string `json:"operation_id"`
			Level       string `json:"level"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.OperationID) || p.Level == "" {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'EscalationRequested', $3, 'M3.ticket', 'Eskalasi berjenjang tingkat ' || $4 || ' diajukan', 'SUCCESS', $5)`,
			web.ID(), v.ID, v.Aggregate, p.Level, v.Correlation)
	} else if v.Type == "ContentPublished" {
		var p struct {
			RevisionID string `json:"revision_id"`
			Audience   string `json:"audience"`
		}
		if e = json.Unmarshal(v.Payload, &p); e != nil || !web.UUID(p.RevisionID) || p.Audience == "" {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id, source_event_id, actor_id, action, object_id, scope, reason, outcome, correlation_id)
			VALUES($1, $2, '00000000-0000-4000-8000-000000000000', 'ContentPublished', $3, 'M8.content', 'Konten berhasil dipublikasikan untuk audience ' || $4, 'SUCCESS', $5)`,
			web.ID(), v.ID, v.Aggregate, p.Audience, v.Correlation)
	} else {
		var p struct {
			Status string `json:"status"`
			SHA    string `json:"sha256"`
		}
		if json.Unmarshal(v.Payload, &p) != nil || len(p.SHA) != 64 || (p.Status != "CLEAN" && p.Status != "REJECTED") {
			return delivery.ErrIntegrity
		}
		_, e = tx.Exec(ctx, `INSERT INTO notify_audit.audit_entries(id,source_event_id,actor_id,action,object_id,scope,reason,outcome,correlation_id) VALUES($1,$2,'00000000-0000-4000-8000-000000000000','MediaScanCompleted',$3,'M3.private_media',$4,'SUCCESS',$5)`, web.ID(), v.ID, v.Aggregate, "Pemeriksaan lampiran "+p.Status, v.Correlation)
	}
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `INSERT INTO notify_audit.inbox(consumer_id,event_id,digest,aggregate_id,aggregate_version) VALUES('M9',$1,$2,$3,$4)`, v.ID, v.Digest, v.Aggregate, v.Version)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
