"""Emit additive owner DDL and its manifest/checksum lock. Never rewrites foundation."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def table(name, columns, append_only=False):
    return name, columns, append_only


TABLES = {
 "M1": [
  table("organizations", "code text NOT NULL UNIQUE, name text NOT NULL, active boolean NOT NULL DEFAULT true"),
  table("subjects", "kind text NOT NULL CHECK(kind IN ('PUBLIC','ASN','STAFF','VENDOR','SERVICE')), external_ref text UNIQUE, active boolean NOT NULL DEFAULT true"),
  table("teams", "org_id uuid NOT NULL REFERENCES identity.organizations(id), name text NOT NULL, active boolean NOT NULL DEFAULT true"),
  table("memberships", "subject_id uuid NOT NULL REFERENCES identity.subjects(id), org_id uuid NOT NULL REFERENCES identity.organizations(id), team_id uuid REFERENCES identity.teams(id), permissions text[] NOT NULL, valid_until timestamptz NOT NULL, revoked_at timestamptz, UNIQUE(subject_id,org_id,team_id)"),
  table("sessions", "subject_id uuid NOT NULL REFERENCES identity.subjects(id), token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32), csrf_hash bytea NOT NULL CHECK(octet_length(csrf_hash)=32), expires_at timestamptz NOT NULL, revoked_at timestamptz"),
  table("delegations", "grantor_id uuid NOT NULL REFERENCES identity.subjects(id), grantee_id uuid NOT NULL REFERENCES identity.subjects(id), org_id uuid NOT NULL REFERENCES identity.organizations(id), permissions text[] NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, reason text NOT NULL"),
  table("api_clients", "name text NOT NULL, credential_ref text NOT NULL, scopes text[] NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz"),
  table("maintenance_policies", "org_id uuid REFERENCES identity.organizations(id), mode text NOT NULL CHECK(mode IN ('READ_ONLY','DRAIN')), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, message text NOT NULL, CHECK(ends_at>starts_at)"),
  table("system_operation_requests", "kind text NOT NULL CHECK(kind IN ('BACKUP_MANIFEST','HEALTH_REPORT','PURGE_REQUEST')), requested_by uuid NOT NULL REFERENCES identity.subjects(id), target_id uuid NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','DISABLED')), reason text NOT NULL, approved_by uuid REFERENCES identity.subjects(id), CHECK(approved_by IS NULL OR approved_by<>requested_by)")],
 "M2": [
  table("categories", "code text NOT NULL UNIQUE, name text NOT NULL, active boolean NOT NULL DEFAULT true"),
  table("services", "code text NOT NULL UNIQUE, name text NOT NULL, owner_org_id uuid NOT NULL, access_mode text NOT NULL CHECK(access_mode IN ('PUBLIC_GUEST','PUBLIC_AUTH','ASN_AUTH','STAFF_ONLY')), category_id uuid REFERENCES catalog.categories(id), active boolean NOT NULL DEFAULT true"),
  table("service_forms", "service_id uuid NOT NULL REFERENCES catalog.services(id), form_version integer NOT NULL CHECK(form_version>0), fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='array'), UNIQUE(service_id,form_version)"),
  table("policies", "service_id uuid NOT NULL REFERENCES catalog.services(id), policy_version integer NOT NULL CHECK(policy_version>0), upload_max_bytes bigint NOT NULL CHECK(upload_max_bytes BETWEEN 1 AND 10485760), allowed_mime text[] NOT NULL, audience_org_ids uuid[] NOT NULL, effective_at timestamptz NOT NULL, UNIQUE(service_id,policy_version)"),
  table("portal_navigation", "route text NOT NULL CHECK(route ~ '^/[^/]' OR route='/'), label text NOT NULL, audience text NOT NULL CHECK(audience IN ('PUBLIC_GUEST','PUBLIC_AUTH','ASN_AUTH','STAFF_ONLY')), position integer NOT NULL CHECK(position>=0), feature_code text NOT NULL"),
  table("feature_registry", "code text NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT false, permission text NOT NULL")],
 "M3": [
  table("tickets", "number text NOT NULL UNIQUE, service_id uuid NOT NULL, form_version integer NOT NULL CHECK(form_version>0), policy_version integer NOT NULL CHECK(policy_version>0), requester_kind text NOT NULL CHECK(requester_kind IN ('GUEST','PUBLIC','ASN')), requester_id uuid NOT NULL, requester_org_id uuid, service_owner_org_id uuid NOT NULL, handling_team_id uuid, assignee_id uuid, state text NOT NULL CHECK(state IN ('OPEN','TRIAGED','NEEDS_INFORMATION','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')), verification text NOT NULL DEFAULT 'PENDING' CHECK(verification IN ('PENDING','VERIFIED')), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), description text NOT NULL CHECK(length(description) BETWEEN 1 AND 4000), accepted_at timestamptz NOT NULL, active_attempt_id uuid, episode_id uuid NOT NULL, archived_at timestamptz, CHECK(state NOT IN ('TRIAGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED') OR verification='VERIFIED'), CHECK(state NOT IN ('RESOLVED','CLOSED') OR active_attempt_id IS NOT NULL), CHECK(requester_kind<>'ASN' OR requester_org_id IS NOT NULL)"),
  table("ticket_versions", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), ticket_version bigint NOT NULL CHECK(ticket_version>0), actor_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL, public_summary text NOT NULL, correlation_id uuid NOT NULL, UNIQUE(ticket_id,ticket_version)", True),
  table("comments", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), author_id uuid NOT NULL, visibility text NOT NULL CHECK(visibility IN ('REQUESTER','INTERNAL')), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000)", True),
  table("attachments", "ticket_id uuid REFERENCES intake.tickets(id), principal_id uuid NOT NULL, storage_key text NOT NULL UNIQUE, status text NOT NULL CHECK(status IN ('PENDING','QUARANTINED','CLEAN','REJECTED','MISSING')), visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility='PRIVATE'), mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','application/pdf')), size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760), sha256 bytea NOT NULL CHECK(octet_length(sha256)=32), alt text NOT NULL, license text NOT NULL, provenance_id uuid"),
  table("guest_capabilities", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), capability_hash bytea NOT NULL UNIQUE CHECK(octet_length(capability_hash)=32), scopes text[] NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz"),
  table("ticket_verifications", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), verified_by uuid NOT NULL, proposed_category uuid, confirmed_category uuid NOT NULL, confidence numeric CHECK(confidence BETWEEN 0 AND 1), classifier_version integer NOT NULL CHECK(classifier_version>0), explanation text NOT NULL, override_reason text NOT NULL, evidence_digest bytea NOT NULL CHECK(octet_length(evidence_digest)=32)", True),
  table("resolution_attempts", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), episode_id uuid NOT NULL, resolved_by uuid NOT NULL, summary text NOT NULL, resolved_at timestamptz NOT NULL, confirmation_due_at timestamptz NOT NULL, outcome text NOT NULL CHECK(outcome IN ('PENDING','REVIEW_REQUIRED','ACCEPTED','REJECTED','AUTO_NO_RESPONSE')), CHECK(confirmation_due_at=resolved_at+interval '24 hours'), UNIQUE(ticket_id,id)"),
  table("confirmation_events", "ticket_id uuid NOT NULL, attempt_id uuid NOT NULL, actor_id uuid NOT NULL, decision text NOT NULL CHECK(decision IN ('ACCEPT','REJECT','FEEDBACK','AUTO_NO_RESPONSE')), FOREIGN KEY(ticket_id,attempt_id) REFERENCES intake.resolution_attempts(ticket_id,id)", True),
  table("confirmation_notifications", "ticket_id uuid NOT NULL, attempt_id uuid NOT NULL, notification_id uuid NOT NULL UNIQUE, event_id uuid NOT NULL UNIQUE, stored_at timestamptz NOT NULL, FOREIGN KEY(ticket_id,attempt_id) REFERENCES intake.resolution_attempts(ticket_id,id), UNIQUE(ticket_id,attempt_id,notification_id)", True),
  table("work_logs", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), actor_id uuid NOT NULL, started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL, summary text NOT NULL, CHECK(ended_at>=started_at)", True),
  table("vendor_cases", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), vendor_id uuid NOT NULL, internal_pic_id uuid NOT NULL, external_reference text NOT NULL, contract_reference text NOT NULL, evidence_ids uuid[] NOT NULL, acknowledged_at timestamptz, expected_return_at timestamptz NOT NULL, next_followup_at timestamptz NOT NULL"),
  table("handoff_requests", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), from_org_id uuid NOT NULL, target_org_id uuid NOT NULL, target_team_id uuid NOT NULL, requested_by uuid NOT NULL, accepted_by uuid, accepted_at timestamptz, reason text NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','ACCEPTED','REJECTED')), CHECK(from_org_id<>target_org_id), CHECK((state='ACCEPTED')=(accepted_at IS NOT NULL AND accepted_by IS NOT NULL))"),
  table("pause_intervals", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, approved_by uuid NOT NULL, policy_version integer NOT NULL CHECK(policy_version>0), reason text NOT NULL, CHECK(ends_at>starts_at)"),
  table("drafts", "principal_id uuid NOT NULL, form_version integer NOT NULL CHECK(form_version>0), title text NOT NULL, description text NOT NULL, expires_at timestamptz NOT NULL"),
  table("draft_attachment_refs", "draft_id uuid NOT NULL REFERENCES intake.drafts(id), attachment_id uuid NOT NULL REFERENCES intake.attachments(id), UNIQUE(draft_id,attachment_id)"),
  table("escalation_marks", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), episode_id uuid NOT NULL, level text NOT NULL CHECK(level IN ('L2','COORDINATOR','LEADERSHIP')), rule_version integer NOT NULL CHECK(rule_version>0), reason text NOT NULL", True),
  table("operations", "ticket_id uuid NOT NULL REFERENCES intake.tickets(id), principal_id uuid NOT NULL, kind text NOT NULL CHECK(kind='ESCALATE'), state text NOT NULL CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','FAILED')), reason text NOT NULL")],
 "M4": [table("rules", "code text NOT NULL UNIQUE, rule_version integer NOT NULL CHECK(rule_version>0), dictionary jsonb NOT NULL, active boolean NOT NULL DEFAULT true"), table("classification_proposals", "ticket_id uuid NOT NULL, classifier_version integer NOT NULL CHECK(classifier_version>0), category_id uuid, confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1), explanation text NOT NULL", True)],
 "M5": [table("routing_rules", "service_id uuid NOT NULL, team_id uuid NOT NULL, level text NOT NULL CHECK(level IN ('L1','L2')), required_skills text[] NOT NULL, active boolean NOT NULL DEFAULT true"), table("rosters", "subject_id uuid NOT NULL, team_id uuid NOT NULL, skills text[] NOT NULL, available_from timestamptz NOT NULL, available_until timestamptz NOT NULL, CHECK(available_until>available_from)"), table("load_projection", "ticket_id uuid NOT NULL UNIQUE, source_version bigint NOT NULL CHECK(source_version>0), assignee_id uuid, state text NOT NULL"), table("assignment_proposals", "ticket_id uuid NOT NULL, ticket_version bigint NOT NULL CHECK(ticket_version>0), assignee_id uuid NOT NULL, team_id uuid NOT NULL, explanation text NOT NULL", True)],
 "M6": [table("calendars", "code text NOT NULL, calendar_version integer NOT NULL CHECK(calendar_version>0), timezone text NOT NULL CHECK(timezone='Asia/Jakarta'), work_days integer[] NOT NULL, work_start time NOT NULL, work_end time NOT NULL, CHECK(work_end>work_start), UNIQUE(code,calendar_version)"), table("holidays", "calendar_id uuid NOT NULL REFERENCES sla.calendars(id), holiday date NOT NULL, label text NOT NULL, UNIQUE(calendar_id,holiday)"), table("targets", "service_id uuid NOT NULL, calendar_id uuid NOT NULL REFERENCES sla.calendars(id), policy_version integer NOT NULL CHECK(policy_version>0), stage text NOT NULL, target_minutes integer NOT NULL CHECK(target_minutes>0)"), table("clock_projection", "ticket_id uuid NOT NULL UNIQUE, source_version bigint NOT NULL CHECK(source_version>0), accepted_at timestamptz NOT NULL, due_at timestamptz NOT NULL, gross_seconds bigint NOT NULL CHECK(gross_seconds>=0), net_seconds bigint NOT NULL CHECK(net_seconds>=0 AND net_seconds<=gross_seconds), policy_version integer NOT NULL CHECK(policy_version>0)")],
 "M7": [table("rules", "code text NOT NULL UNIQUE, level text NOT NULL, delay_seconds integer NOT NULL CHECK(delay_seconds>=0), active boolean NOT NULL DEFAULT true"), table("jobs", "ticket_id uuid NOT NULL, attempt_id uuid, expected_version bigint NOT NULL CHECK(expected_version>0), kind text NOT NULL CHECK(kind IN ('AUTO_CLOSE','FOLLOWUP','REMINDER','ESCALATE')), idempotency_key text NOT NULL UNIQUE, due_at timestamptz NOT NULL, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), state text NOT NULL CHECK(state IN ('PENDING','LEASED','ACKED','DEAD_LETTER')), last_error_code text, CHECK(kind<>'AUTO_CLOSE' OR attempt_id IS NOT NULL)")],
 "M8": [table("content", "kind text NOT NULL CHECK(kind IN ('ARTICLE','PAGE')), slug text NOT NULL UNIQUE, title text NOT NULL, audience text NOT NULL CHECK(audience IN ('PUBLIC_GUEST','PUBLIC_AUTH','ASN_AUTH','STAFF_ONLY')), state text NOT NULL CHECK(state IN ('DRAFT','REVIEW','PUBLISHED','ARCHIVED')), org_id uuid, principal_id uuid NOT NULL"), table("revisions", "content_id uuid NOT NULL REFERENCES knowledge.content(id), revision integer NOT NULL CHECK(revision>0), sanitized_body text NOT NULL, author_id uuid NOT NULL, UNIQUE(content_id,revision)", True), table("media", "principal_id uuid NOT NULL, storage_key text NOT NULL UNIQUE, status text NOT NULL CHECK(status IN ('PENDING','QUARANTINED','CLEAN','REJECTED','MISSING')), visibility text NOT NULL CHECK(visibility IN ('PRIVATE','PUBLIC')), mime text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760), sha256 bytea NOT NULL CHECK(octet_length(sha256)=32), alt text NOT NULL, caption text NOT NULL, license text NOT NULL, source text NOT NULL, sanitized_from_id uuid, approved_by uuid"), table("content_media_refs", "content_id uuid NOT NULL REFERENCES knowledge.content(id), media_id uuid NOT NULL REFERENCES knowledge.media(id), UNIQUE(content_id,media_id)"), table("drafts", "principal_id uuid NOT NULL, form_version integer NOT NULL CHECK(form_version>0), title text NOT NULL, description text NOT NULL, expires_at timestamptz NOT NULL")],
 "M9": [table("notifications", "recipient_id uuid NOT NULL, ticket_id uuid, attempt_id uuid, source_event_id uuid NOT NULL, template_version integer NOT NULL CHECK(template_version>0), title text NOT NULL, read_at timestamptz, stored_at timestamptz NOT NULL, UNIQUE(source_event_id,recipient_id)"), table("delivery_jobs", "notification_id uuid NOT NULL REFERENCES notify_audit.notifications(id), channel text NOT NULL CHECK(channel='SINK'), state text NOT NULL CHECK(state IN ('PENDING','LEASED','ACKED','DEAD_LETTER')), attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), lease_until timestamptz, error_code text"), table("telegram_bindings", "subject_id uuid NOT NULL, org_id uuid NOT NULL, chat_ref text NOT NULL, verified_at timestamptz NOT NULL, revoked_at timestamptz, channel text NOT NULL CHECK(channel='SINK')"), table("audit_entries", "source_event_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL, action text NOT NULL, object_id uuid NOT NULL, scope text NOT NULL, reason text NOT NULL, outcome text NOT NULL CHECK(outcome IN ('SUCCESS','DENIED','FAILED')), correlation_id uuid NOT NULL", True), table("report_facts", "ticket_id uuid NOT NULL UNIQUE, requester_id uuid NOT NULL, source_version bigint NOT NULL CHECK(source_version>0), org_id uuid NOT NULL, accepted_at timestamptz NOT NULL, resolved_at timestamptz, state text NOT NULL, policy_version integer NOT NULL CHECK(policy_version>0)"), table("export_jobs", "principal_id uuid NOT NULL, scope_org_ids uuid[] NOT NULL, filter_snapshot jsonb NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','FAILED')), expires_at timestamptz NOT NULL, storage_key text"), table("visitor_aggregates", "period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, bot_policy_version integer NOT NULL CHECK(bot_policy_version>0), session_count bigint NOT NULL CHECK(session_count>=0), CHECK(period_end>period_start)")]
}


def render(owner, schema):
    role = 'helpdesk_' + owner.lower()
    statements = [f'-- {owner} contract DDL v1. Cross-owner UUIDs are references, never foreign keys.', "SET LOCAL timezone = 'UTC';"]
    for name, cols, append_only in TABLES[owner]:
        statements += [f'CREATE TABLE {schema}.{name} (id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), {cols});',
                       f'GRANT SELECT, INSERT{", UPDATE" if not append_only else ""} ON {schema}.{name} TO {role};']
    statements += [f"CREATE TABLE {schema}.idempotency_records (actor_scope text NOT NULL, command text NOT NULL, target text NOT NULL, key text NOT NULL CHECK(length(key) BETWEEN 16 AND 128), payload_digest bytea NOT NULL CHECK(octet_length(payload_digest)=32), response_status integer NOT NULL CHECK(response_status BETWEEN 200 AND 299), response_body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, PRIMARY KEY(actor_scope,command,target,key));",
                   f"CREATE TABLE {schema}.outbox (event_id uuid PRIMARY KEY, event_type text NOT NULL, schema_version integer NOT NULL CHECK(schema_version>0), aggregate_id uuid NOT NULL, aggregate_version bigint NOT NULL CHECK(aggregate_version>0), occurred_at timestamptz NOT NULL, correlation_id uuid NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), digest bytea NOT NULL CHECK(octet_length(digest)=32));",
                   f"CREATE TABLE {schema}.outbox_delivery (event_id uuid NOT NULL REFERENCES {schema}.outbox(event_id), consumer_id text NOT NULL CHECK(consumer_id ~ '^M[1-9]$'), state text NOT NULL CHECK(state IN ('PENDING','LEASED','ACKED','DEAD_LETTER')), attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), lease_until timestamptz, acked_at timestamptz, last_error_code text, PRIMARY KEY(event_id,consumer_id), CHECK((state='ACKED')=(acked_at IS NOT NULL)));",
                   f"CREATE TABLE {schema}.inbox (consumer_id text NOT NULL, event_id uuid NOT NULL, digest bytea NOT NULL CHECK(octet_length(digest)=32), aggregate_id uuid NOT NULL, aggregate_version bigint NOT NULL CHECK(aggregate_version>0), received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(consumer_id,event_id));",
                   f"CREATE TABLE {schema}.audit_intents (id uuid PRIMARY KEY, actor_id uuid NOT NULL, action text NOT NULL, object_id uuid NOT NULL, scope text NOT NULL, reason text NOT NULL, outcome text NOT NULL, correlation_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now());",
                   f"GRANT SELECT, INSERT ON {schema}.idempotency_records, {schema}.outbox, {schema}.inbox, {schema}.audit_intents TO {role};",
                   f"GRANT SELECT, INSERT, UPDATE ON {schema}.outbox_delivery TO {role};",
                   f"CREATE INDEX ON {schema}.outbox_delivery (state, lease_until, event_id) WHERE state<>'ACKED';"]
    if owner == 'M3':
        statements += ["ALTER TABLE intake.tickets ADD CONSTRAINT active_attempt_owner FOREIGN KEY(id,active_attempt_id) REFERENCES intake.resolution_attempts(ticket_id,id) DEFERRABLE INITIALLY DEFERRED;",
                       "CREATE INDEX ON intake.tickets (requester_id, updated_at DESC, id DESC);",
                       "CREATE INDEX ON intake.tickets (service_owner_org_id, state, updated_at DESC, id DESC);",
                       "CREATE INDEX ON intake.comments (ticket_id, visibility, created_at, id);",
                       "CREATE INDEX ON intake.drafts (principal_id, updated_at DESC, id DESC);"]
    if owner == 'M8':
        statements += ["CREATE INDEX ON knowledge.content (audience,state,updated_at DESC,id DESC);", "CREATE INDEX ON knowledge.media (principal_id,updated_at DESC,id DESC);"]
    if owner == 'M9':
        statements += ["CREATE INDEX ON notify_audit.notifications (recipient_id,created_at DESC,id DESC);", "CREATE INDEX ON notify_audit.report_facts (org_id,accepted_at,id);"]
    statements += [f'REVOKE ALL ON ALL TABLES IN SCHEMA {schema} FROM PUBLIC;']
    return '\n'.join(statements)+'\n'


def artifacts():
    registry = list(csv.DictReader((ROOT/'contracts/module_registry.csv').open(encoding='utf-8-sig')))
    foundation = 'infra/postgres/001-foundation.sql'
    digest = hashlib.sha256((ROOT/foundation).read_bytes()).hexdigest()
    if digest != '9d87f326cbec57bdf8950337bb7646a8fef04ccfcfba06b3491f2d7cecbfb3b9':
        raise SystemExit('FAIL immutable foundation checksum drift')
    manifest = [{'id': '001', 'path': foundation, 'owner': 'lab migrator (postgres)', 'scope': 'schema, runtime roles and read-only version markers M1-M9', 'sha256': digest}]
    outputs = {}
    for i,row in enumerate(registry,2):
        path = f'migrations/{row["module_id"].lower()}/{i:03d}-contracts.sql'
        data = render(row['module_id'], row['schema'])
        outputs[path] = data
        manifest.append({'id': f'{i:03d}', 'path': path, 'owner': row['module_id'], 'scope': 'business contract tables, local references, idempotency and durable event metadata', 'sha256': hashlib.sha256(data.encode()).hexdigest()})
    # Previously published source hashes are immutable, even if the generator changes.
    previous = json.loads((ROOT/'migrations/manifest.json').read_text(encoding='utf-8'))['migrations']
    for old in previous:
        if int(old['id']) <= 10:
            current = next(m for m in manifest if m['id']==old['id'])
            if current['sha256'] != old['sha256']:
                raise SystemExit('FAIL historical migration rewrite: '+old['id'])
    for id,owner,name in [('011','M1','identity'),('012','M2','catalog'),('013','M3','tickets'),('014','M1','delivery'),('015','M2','delivery'),('016','M9','delivery'),('017','M3','scan-queue')]:
        path=f'migrations/{owner.lower()}/{id}-{name}.sql'
        digest=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
        old=next((m for m in previous if m['id']==id),None)
        if old and old['sha256']!=digest:raise SystemExit('FAIL historical migration rewrite: '+id)
        manifest.append({'id':id,'path':path,'owner':owner,'scope':'M0-03 metadata, immutable versions and domain readiness' if int(id)<=12 else 'M0-04 owner-scoped ticket, lease, scan queue and readiness metadata','sha256':digest})
    outputs['migrations/manifest.json'] = json.dumps({'migrations': manifest},indent=2)+'\n'
    outputs['migrations/checksums.sha256'] = ''.join(f'{m["sha256"]}  {m["path"]}\n' for m in manifest)
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for relative,data in artifacts().items():
        path = ROOT/relative
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != data:
                raise SystemExit('FAIL generated migration drift: '+relative)
        else:
            path.write_text(data,encoding='utf-8',newline='\n')
    print('PASS owner migration generation'+(' consistency' if args.check else ''))
