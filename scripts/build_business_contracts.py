"""Canonical contract definitions for M0-02. Outputs are checked with --check.

This emits specifications only; it does not install business HTTP handlers.
"""
import argparse
import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UUID = {"type": "string", "format": "uuid"}
UTC = {"type": "string", "format": "date-time", "pattern": "Z$"}
TEXT = {"type": "string", "minLength": 1, "maxLength": 4000}
VERSION = {"type": "integer", "minimum": 1}


def enum(*values):
    return {"type": "string", "enum": list(values)}


def obj(fields, optional=()):
    return {"type": "object", "properties": fields,
            "required": [k for k in fields if k not in optional], "additionalProperties": False}


def ref(name):
    return {"$ref": "#/components/schemas/" + name}


def arr(schema):
    return {"type": "array", "items": schema, "maxItems": 100}


STATES = enum("OPEN", "TRIAGED", "NEEDS_INFORMATION", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED")
NONNEG = {"type":"integer","minimum":0}
NULL_COUNT={"type":["integer","null"],"minimum":0}
NULL_DATE={"type":["string","null"],"format":"date-time"}
AUDIENCE = enum("PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY")
schemas = {
    "Error": obj({"code": enum("INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "VALIDATION_FAILED", "RATE_LIMITED", "DEPENDENCY_UNAVAILABLE"), "message": TEXT, "correlation_id": UUID, "details": arr(obj({"field": TEXT, "code": TEXT}))}),
    "Receipt": obj({"id": UUID, "version": VERSION}),
    "Operation": obj({"id": UUID, "version": VERSION, "state": enum("PENDING", "RUNNING", "SUCCEEDED", "FAILED"), "kind": TEXT, "updated_at": UTC}),
    "SessionCreate": {"oneOf": [obj({"lab_subject_id":UUID,"csrf_token":TEXT}),obj({"identifier":{**TEXT,"maxLength":254},"password":{"type":"string","minLength":1,"maxLength":1024,"writeOnly":True},"csrf_token":TEXT})]},
    "PublicRegistration": obj({"nik":{"type":"string","pattern":"^[0-9]{16}$"},"name":{**TEXT,"minLength":3,"maxLength":200},"email":{"type":"string","format":"email","maxLength":254},"phone":{"type":"string","pattern":"^\\+?[0-9]{10,16}$"},"password":{"type":"string","minLength":8,"maxLength":1024,"writeOnly":True},"csrf_token":TEXT}),
    "MediaApproval": obj({"expected_version":VERSION,"sanitized_copy_id":UUID,"target_id":UUID,"target_audience":AUDIENCE,"reason":{**TEXT,"minLength":5,"maxLength":2000}}),
    "Session": obj({"id": UUID, "version": VERSION, "subject_id": UUID, "expires_at": UTC, "permissions": arr(TEXT), "organization_ids": arr(UUID)}),
    "VersionedReason": obj({"expected_version": VERSION, "reason": TEXT}),
    "ServiceWrite": obj({"code": {"type": "string", "pattern": "^[A-Z0-9_-]{1,64}$"}, "name": TEXT, "access_mode": AUDIENCE, "owner_org_id": UUID, "form_version": VERSION, "active": {"type": "boolean"}}),
    "Service": obj({"id": UUID, "version": VERSION, "code": TEXT, "name": TEXT, "access_mode": AUDIENCE, "owner_org_id": UUID, "form_version": VERSION, "active": {"type": "boolean"}}),
    "Form": obj({"id": UUID, "version": VERSION, "fields": arr(obj({"key": TEXT, "label": TEXT, "kind": enum("text", "number", "date", "choice"), "required": {"type": "boolean"}, "options": arr(TEXT)}))}),
    "TicketCreate": obj({"service_id": UUID, "form_version": VERSION, "title": {**TEXT, "maxLength": 200}, "description": TEXT, "answers": {"type": "object", "maxProperties": 100, "additionalProperties": {"type": ["string", "number", "boolean", "null"], "maxLength": 4000}}}),
    "Ticket": obj({"id": UUID, "version": VERSION, "number": TEXT, "service_id": UUID, "requester_kind": enum("GUEST", "PUBLIC", "ASN"), "requester_id": UUID, "requester_org_id": {"type": ["string", "null"], "format": "uuid"}, "service_owner_org_id": UUID, "state": STATES, "verification": enum("PENDING", "VERIFIED"), "title": TEXT, "description": TEXT, "accepted_at": UTC, "updated_at": UTC, "policy_version": VERSION}),
    "Verification": obj({"expected_version": VERSION, "category_id": UUID, "priority": enum("LOW", "NORMAL", "HIGH", "CRITICAL"), "reason": TEXT, "classifier_version": VERSION, "evidence_digest": {"type": "string", "pattern": "^[a-f0-9]{64}$"}}),
    "Dispatch": obj({"expected_version": VERSION, "team_id": UUID, "assignee_id": UUID, "proposal_version": VERSION, "reason": TEXT}),
    "Transition": obj({"expected_version": VERSION, "action": enum("START", "REQUEST_INFORMATION", "SUPPLY_INFORMATION", "CANCEL", "REOPEN"), "reason": TEXT}),
    "ResolutionCreate": obj({"expected_version": VERSION, "summary": TEXT, "evidence_ids": arr(UUID)}),
    "Resolution": obj({"id": UUID, "version": VERSION, "ticket_id": UUID, "resolved_at": UTC, "confirmation_due_at": UTC, "summary": TEXT}),
    "Confirmation": obj({"expected_version": VERSION, "attempt_id": UUID, "decision": enum("ACCEPT", "REJECT", "FEEDBACK"), "reason": TEXT}),
    "CommentCreate": obj({"expected_version": VERSION, "body": TEXT, "visibility": enum("REQUESTER", "INTERNAL")}),
    "Comment": obj({"id": UUID, "version": VERSION, "body": TEXT, "visibility": enum("REQUESTER", "INTERNAL"), "created_at": UTC}),
    "Upload": obj({"expected_version": VERSION, "filename": {**TEXT, "maxLength": 200}, "mime": enum("image/png", "image/jpeg", "application/pdf"), "size_bytes": {"type": "integer", "minimum": 1, "maximum": 10485760}, "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"}, "alt": TEXT, "license": TEXT}),
    "Media": obj({"id": UUID, "version": VERSION, "owner": enum("M3", "M8"), "status": enum("PENDING", "QUARANTINED", "CLEAN", "REJECTED", "MISSING"), "visibility": enum("PRIVATE", "PUBLIC"), "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"}, "size_bytes": {"type": "integer", "minimum": 1}, "alt": TEXT}),
    "Download": obj({"id": UUID, "expires_at": UTC, "download_path": {"type": "string", "pattern": "^/api/v1/", "description": "Same-origin authorized download; authorization and scan state checked again when fetched."}}),
    "VendorCase": obj({"expected_version": VERSION, "vendor_id": UUID, "internal_pic_id": UUID, "external_reference": TEXT, "contract_reference": TEXT, "expected_return_at": UTC, "next_followup_at": UTC}),
    "Pause": obj({"expected_version": VERSION, "reason": TEXT, "policy_version": VERSION, "until": UTC}),
    "HandoffOffer": obj({"id":UUID,"ticket_id":UUID,"ticket_version":VERSION,"from_org_id":UUID,"target_org_id":UUID,"target_team_id":UUID}),
    "Handoff": obj({"expected_version": VERSION, "target_org_id": UUID, "target_team_id": UUID, "reason": TEXT}),
    "Escalate": obj({"expected_version": VERSION, "level": enum("L2", "COORDINATOR", "LEADERSHIP"), "reason": TEXT}),
    "DraftWrite": obj({"expected_version": VERSION, "form_version": VERSION, "title": TEXT, "description": TEXT, "expires_at": UTC}),
    "Draft": obj({"id": UUID, "version": VERSION, "form_version": VERSION, "title": TEXT, "description": TEXT, "updated_at": UTC, "expires_at": UTC}),
    "ContentWrite": obj({"expected_version": VERSION, "title": TEXT, "slug": {"type": "string", "pattern": "^[a-z0-9-]{1,100}$"}, "body": {**TEXT, "description": "Sanitized server-side; no script or arbitrary active HTML."}, "audience": AUDIENCE, "alt": TEXT}),
    "Content": obj({"id": UUID, "version": VERSION, "title": TEXT, "slug": TEXT, "body": TEXT, "audience": AUDIENCE, "state": enum("DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED")}),
    "EditorialTransition": obj({"expected_version": VERSION, "action": enum("REVIEW", "PUBLISH", "ARCHIVE", "RESTORE"), "reason": TEXT}),
    "Notification": obj({"id": UUID, "version": VERSION, "title": TEXT, "created_at": UTC, "read": {"type": "boolean"}, "delivery_state": enum("STORED", "SINK_ACCEPTED", "FAILED", "DEAD_LETTER")}),
    "SinkChallengeInput": obj({"scope_org_id":UUID}),
    "SinkChallenge": obj({"code":{"type":"string","minLength":48,"maxLength":48},"expires_at":UTC}),
    "SchedulerJob": obj({"id":UUID,"version":VERSION,"state":enum("PENDING","LEASED","ACKED","DEAD_LETTER"),
       "due_at":UTC,"retry_at":NULL_DATE,"attempts":NONNEG,"last_error_code":{"type":["string","null"]}}),
    "SchedulerReplay": obj({"id":UUID,"version":VERSION,"state":{"type":"string","const":"PENDING"}}),
    "TelegramBinding": obj({"expected_version": VERSION, "verification_code": {**TEXT, "maxLength": 128}, "scope_org_id": UUID, "channel": {"const": "SINK", "type": "string"}}),
    "ReportQuery": obj({"from": UTC, "to": UTC, "timezone": {"const": "Asia/Jakarta", "type": "string"}, "organization_id": UUID, "cohort": enum("ACCEPTED", "RESOLVED", "OPEN"), "format": enum("CSV", "JSON")}),
    "Report": obj({"as_of":UTC,"watermark":NULL_DATE,"timezone":{"const":"Asia/Jakarta","type":"string"},
       "policy_version":{"type":["integer","null"],"minimum":1},"denominator":NONNEG,"count":NONNEG,
       "measure":{"type":"string","const":"SLA"},"accepted":NONNEG,"backlog":NONNEG,"completed":NONNEG,
       "breached":NONNEG,"cancelled":NONNEG,"unmeasured":NONNEG,"gross_seconds":NONNEG,"net_seconds":NONNEG,
       "sla_percent":{"type":["number","null"],"minimum":0,"maximum":100}}),
    "Audit": obj({"id": UUID, "actor_id": UUID, "action": TEXT, "object_id": UUID, "scope": TEXT, "reason": TEXT, "outcome": enum("SUCCESS", "DENIED", "FAILED"), "correlation_id": UUID, "occurred_at": UTC}),
    "SearchHit": obj({"id": UUID, "owner": enum("M2", "M3", "M8"), "kind": enum("SERVICE", "TICKET", "ARTICLE", "PAGE", "MEDIA"), "title": TEXT, "snippet": TEXT}),
    "NavigationWrite": obj({"expected_version": VERSION, "route": {"type": "string", "pattern": "^/(?!/)[a-zA-Z0-9/_-]*$"}, "label": TEXT, "audience": AUDIENCE, "position": {"type": "integer", "minimum": 0}}),
    "MembershipWrite": obj({"expected_version": VERSION, "subject_id": UUID, "organization_id": UUID, "permissions": arr(TEXT), "expires_at": UTC, "reason": TEXT}),
    "RuleWrite": obj({"expected_version": VERSION, "code": TEXT, "rule_version": VERSION, "active": {"type": "boolean"}, "reason": TEXT}),
    "Maintenance": obj({"expected_version": VERSION, "organization_id": UUID, "starts_at": UTC, "ends_at": UTC, "mode": enum("READ_ONLY", "DRAIN"), "message": TEXT}),
    "SystemJob": obj({"kind": enum("BACKUP_MANIFEST","HEALTH_REPORT","PURGE_REQUEST"), "target_id": UUID, "reason": TEXT}),
    "PurgeRequest": obj({"expected_version": VERSION, "object_id": UUID, "retention_policy_version": VERSION, "reason": TEXT}),
    "HealthAdmin": obj({"status":enum("HEALTHY","DEGRADED","BUSY"),"modules":{"type":"object","additionalProperties":enum("HEALTHY","UNAVAILABLE")},
       "scanner":enum("HEALTHY","UNAVAILABLE"),"storage":enum("HEALTHY","UNAVAILABLE"),"worker":enum("HEALTHY","UNAVAILABLE"),
       "outbox_lag":NULL_COUNT,"inbox_lag":NULL_COUNT,"oldest_delivery_seconds":NULL_COUNT,"dead_letters":NULL_COUNT,"observed_at":UTC}),
    "SystemJobResult": obj({"id":UUID,"version":VERSION,"kind":TEXT,"requested_by":UUID,"target_id":UUID,
       "state":enum("PENDING","REQUESTED","APPROVED","QUEUED","RUNNING","SUCCEEDED","FAILED","DISABLED"),"reason":TEXT,
       "approved_by":UUID,"approved_at":UTC,"execution_receipt":{"type":"object"},"created_at":UTC,"updated_at":UTC},
       optional=("approved_by","approved_at","execution_receipt")),
    "WorkLog": obj({"expected_version": VERSION, "started_at": UTC, "ended_at": UTC, "summary": TEXT}),
    "BulkCommand": obj({"action": enum("ARCHIVE", "REASSIGN"), "targets": arr(obj({"id": UUID, "expected_version": VERSION})), "reason": TEXT}),
    "BulkResult": obj({"items": arr(obj({"id": UUID, "outcome": enum("SUCCESS", "FORBIDDEN", "NOT_FOUND", "CONFLICT"), "version": VERSION})), "as_of": UTC}),
    "SLAClock": obj({"ticket_id":UUID,"episode_id":UUID,"accepted_at":UTC,"episode_started_at":UTC,
       "resolution_due_at":UTC,"due_at":UTC,"resolution_endpoint":NULL_DATE,"gross_seconds":NONNEG,"net_seconds":NONNEG,
       "working_seconds":NONNEG,"policy_version":VERSION,"calendar_version":NONNEG,"as_of":UTC,
       "status":enum("ON_TRACK","AT_RISK","BREACHED","PAUSED","CANCELLED","UNAVAILABLE"),
       "policy_source":enum("SERVICE_SNAPSHOT","LAB_DEFAULT","LEGACY"),"response_due_at":UTC,"first_response_at":UTC},
       optional=("response_due_at","first_response_at","working_seconds")),
    "ReuseMedia": obj({"expected_version":VERSION,"target_owner":enum("M8"),"target_id":UUID,"target_audience":AUDIENCE,"sanitized_copy_id":UUID,"approval_id":UUID,"reason":TEXT},optional=("sanitized_copy_id","approval_id")),
}
schemas['Ticket']['properties'].update({k:UTC for k in ("episode_started_at","response_due_at","first_response_at")})
schemas['FormWrite'] = obj({'expected_version':VERSION,'form_version':VERSION,'fields':schemas['Form']['properties']['fields']})


def sample(schema):
    if "$ref" in schema:
        return sample(schemas[schema["$ref"].split("/")[-1]])
    if "const" in schema:
        return schema["const"]
    if "enum" in schema:
        return schema["enum"][0]
    typ = schema.get("type")
    if isinstance(typ, list):
        typ = typ[0]
    if typ == "object":
        return {k: sample(schema["properties"][k]) for k in schema.get("required", [])}
    if typ == "array":
        return []
    if typ in ("integer","number"):
        return schema.get("minimum", 1)
    if typ == "boolean":
        return True
    if schema.get("format") == "uuid":
        return "00000000-0000-4000-8000-000000000001"
    if schema.get("format") == "date-time":
        return "2026-11-04T03:00:00Z"
    pattern = schema.get("pattern", "")
    if "a-f0-9" in pattern:
        return "a" * 64
    if pattern.startswith("^/api"):
        return "/api/v1/media/00000000-0000-4000-8000-000000000001/content?owner=M3"
    if pattern.startswith("^/"):
        return "/layanan"
    if "a-z0-9-" in pattern:
        return "panduan"
    return "LAB"


operations = []


def operation(method, path, command, owner, permission, response="Receipt", request=None,
              status=200, fr="FR01", public=False, query=(), aliases=()):
    operations.append(dict(method=method, path="/api/v1" + path, command=command, owner=owner,
                           permission=permission, response=response, request=request, status=status,
                           fr=fr.split(), public=public, query=query, alias=False))
    for alias in aliases:
        copy = dict(operations[-1], path="/api/v1" + alias, alias=True)
        operations.append(copy)


operation("post", "/auth/sessions", "CreateLabSession", "M1", "session.create", "Session", "SessionCreate", 201, "FR29", True)
operation("post", "/auth/register", "RegisterPublicSubject", "M1", "session.create", "Session", "PublicRegistration", 201, "FR29", True)
operation("post", "/auth/logout", "RevokeSession", "M1", "session.revoke", request="VersionedReason", fr="FR29")
operation("get", "/auth/me", "ReadSession", "M1", "session.read", "Session", fr="FR29")
operation("post", "/guest/tracking-session", "ExchangeGuestCapability", "M3", "guest.exchange", "Session", status=201, fr="FR29", public=True)
operation("get", "/catalog/services", "ListServices", "M2", "catalog.read", "Service", fr="FR17", public=True)
operation("get", "/catalog/services/{id}", "ReadService", "M2", "catalog.read", "Service", fr="FR17", public=True)
operation("get", "/catalog/services/{id}/form", "ReadServiceForm", "M2", "catalog.read", "Form", fr="FR11", public=True)
operation("post", "/tickets", "CreateTicket", "M3", "ticket.create", "Ticket", "TicketCreate", 201, "FR11 FR29", True)
operation("get", "/tickets", "ListTickets", "M3", "ticket.read", "Ticket", fr="FR02 FR28 FR29")
operation("get", "/tickets/{id}", "ReadTicket", "M3", "ticket.read", "Ticket", fr="FR29")
operation("post", "/tickets/bulk", "BulkTicketCommand", "M3", "ticket.bulk", "BulkResult", "BulkCommand", fr="FR02")
operation("post", "/tickets/{id}/work-logs", "RecordWorkLog", "M3", "ticket.worklog", request="WorkLog", status=201, fr="FR27")
operation("get", "/tickets/{id}/scheduler-jobs/{job}", "ReadSchedulerJob", "M7", "system.job", "SchedulerJob", fr="FR18")
operation("post", "/tickets/{id}/scheduler-jobs/{job}/replay", "ReplaySchedulerJob", "M7", "system.job", "SchedulerReplay", "VersionedReason", 202, "FR18")
operation("get", "/tickets/{id}/sla", "ReadTicketSLA", "M3", "ticket.read", "SLAClock", fr="FR25")
operation("post", "/tickets/{id}/verify", "VerifyTicket", "M3", "ticket.verify", "Ticket", "Verification", fr="FR24", aliases=("/tickets/{id}/triage",))
operation("post", "/tickets/{id}/dispatch", "DispatchTicket", "M3", "ticket.dispatch", "Ticket", "Dispatch", fr="FR24", aliases=("/tickets/{id}/assign",))
operation("post", "/tickets/{id}/transitions", "TransitionTicket", "M3", "ticket.transition", "Ticket", "Transition", fr="FR25")
operation("post", "/tickets/{id}/resolution-attempts", "ResolveTicket", "M3", "ticket.resolve", "ResolveReceipt", "ResolutionCreate", 200, "FR25", aliases=("/tickets/{id}/resolve", "/tickets/{id}/transitions/resolve"))
operation("post", "/tickets/{id}/confirmation", "ConfirmResolution", "M3", "ticket.confirm", "ConfirmReceipt", "Confirmation", fr="FR25")
operation("post", "/tickets/{id}/close", "AcceptResolution", "M3", "ticket.confirm", "ConfirmReceipt", "Confirmation", fr="FR25")
operation("get", "/tickets/{id}/history", "ListTicketHistory", "M3", "ticket.read", "Comment", fr="FR15")
operation("get", "/tickets/{id}/comments", "ListComments", "M3", "ticket.read", "Comment", fr="FR15")
operation("post", "/tickets/{id}/comments", "AddComment", "M3", "ticket.comment", "Comment", "CommentCreate", 201, "FR15")
operation("post", "/tickets/{id}/attachments", "UploadTicketAttachment", "M3", "ticket.attach", "Media", "Upload", 201, "FR13 FR19")
operation("get", "/tickets/{id}/attachments/{attachment_id}/download", "DownloadTicketAttachment", "M3", "ticket.read", "Download", fr="FR19")
operation("post", "/tickets/{id}/vendor-cases", "RecordVendorCase", "M3", "ticket.vendor", request="VendorCase", status=201, fr="FR26")
operation("post", "/tickets/{id}/pauses", "ApprovePause", "M3", "ticket.pause", request="Pause", status=201, fr="FR26")
operation("post", "/tickets/{id}/handoffs", "RequestHandoff", "M3", "ticket.handoff", request="Handoff", status=201, fr="FR28")
operation("get", "/tickets/{id}/handoffs/{handoff_id}", "ReadHandoffOffer", "M3", "ticket.handoff.accept", "HandoffOffer", fr="FR28")
operation("post", "/tickets/{id}/handoffs/{handoff_id}/accept", "AcceptHandoff", "M3", "ticket.handoff.accept", "Ticket", "VersionedReason", fr="FR28")
operation("post", "/tickets/{id}/escalations", "RequestEscalation", "M3", "ticket.escalate", "Operation", "Escalate", 202, "FR26")
operation("get", "/operations/{id}", "ReadOperation", "M3", "operation.read", "Operation", fr="FR26")
operation("post", "/media/approvals/{id}/revoke", "RevokeMediaApproval", "M8", "content.publish", "Receipt", "VersionedReason", fr="FR19")
operation("post", "/media/{id}/approvals", "ApproveSanitizedMedia", "M8", "content.publish|ticket.read+media.reuse (source M3)", "Receipt", "MediaApproval", 201, "FR19")
operation("get", "/media", "ListMedia", "M3|M8", "media.read", "Media", fr="FR19", query=("owner", "status", "q"))
operation("post", "/media", "UploadMedia", "M3|M8", "media.write", "Media", "Upload", 201, "FR19", query=("owner",))
operation("put", "/media/{id}/content", "StoreQuarantineBlob", "M3|M8", "media.write", "Media", fr="FR13 FR19", query=("owner",))
operation("get", "/media/{id}/content", "DownloadCleanBlob", "M3|M8", "media.read", fr="FR19", query=("owner",))
operation("get", "/media/{id}/download", "DownloadMedia", "M3|M8", "media.read", "Download", fr="FR19", query=("owner",))
operation("post", "/media/{id}/reuse", "ReuseMedia", "M3|M8", "media.reuse", request="ReuseMedia", fr="FR19", query=("owner",))
operation("get", "/drafts", "ListDrafts", "M3|M8", "draft.read", "Draft", fr="FR10 FR22", query=("owner",))
operation("put", "/drafts/{id}", "SaveDraft", "M3|M8", "draft.write", "Draft", "DraftWrite", fr="FR10 FR22", query=("owner",))
for group in ("knowledge/articles", "portal/pages"):
    command = "Article" if "articles" in group else "PortalPage"
    operation("get", "/"+group, "List"+command, "M8", "content.read", "Content", fr="FR12 FR18", public=True, query=("view", "q"))
    operation("get", "/"+group+"/{id}", "Read"+command, "M8", "content.read", "Content", fr="FR12 FR18", public=True, query=("view",))
    operation("post", "/"+group, "Create"+command, "M8", "content.write", "Content", "ContentWrite", 201, "FR12 FR18")
    operation("put", "/"+group+"/{id}", "Update"+command, "M8", "content.write", "Content", "ContentWrite", fr="FR12 FR18")
    operation("post", "/"+group+"/{id}/transitions", "Transition"+command, "M8", "content.publish", "Content", "EditorialTransition", fr="FR12 FR18")
operation("get", "/search", "SearchScopedOwners", "M2|M3|M8", "search.read", "SearchHit", fr="FR06", query=("owner", "q"))
operation("get", "/notifications", "ListNotifications", "M9", "notification.read", "Notification", fr="FR21")
operation("post", "/notifications/{id}/read", "MarkNotificationRead", "M9", "notification.read", request="VersionedReason", fr="FR21")
operation("post", "/notifications/sink-challenges", "IssueSinkChallenge", "M9", "notification.binding", "SinkChallenge", "SinkChallengeInput", 201, "FR21")
operation("post", "/notifications/telegram-bindings", "VerifyTelegramBinding", "M9", "notification.binding", request="TelegramBinding", status=201, fr="FR21")
operation("post", "/notifications/telegram-bindings/{id}/revoke", "RevokeTelegramBinding", "M9", "notification.binding", request="VersionedReason", fr="FR21")
operation("get", "/reports", "ReadScopedReport", "M9", "report.read", "Report", fr="FR03 FR16 FR27", query=("from", "to", "organization_id"))
operation("post", "/reports/exports", "RequestReportExport", "M9", "report.export", "Operation", "ReportQuery", 202, "FR02 FR16 FR27")
operation("get", "/reports/exports/{id}", "ReadReportExport", "M9", "report.export", "Operation", fr="FR02")
operation("get", "/reports/exports/{id}/download", "DownloadReportExport", "M9", "report.export", "Download", fr="FR02")
operation("get", "/audit", "ListAudit", "M9", "audit.read", "Audit", fr="FR20")
operation("post", "/admin/services", "CreateService", "M2", "catalog.write", "Service", "ServiceWrite", 201, "FR17")
operation("put", "/admin/services/{id}", "UpdateService", "M2", "catalog.write", "Service", "ServiceWrite", fr="FR17")
operation("put", "/admin/services/{id}/form", "UpdateServiceForm", "M2", "catalog.write", "Form", "FormWrite", fr="FR11 FR17")
operation("post", "/admin/memberships", "GrantMembership", "M1", "identity.grant", request="MembershipWrite", status=201, fr="FR17 FR29")
operation("post", "/admin/navigation", "ConfigureNavigation", "M2", "catalog.write", request="NavigationWrite", status=201, fr="FR18")
for owner, suffix in (("M4", "classification"), ("M5", "routing"), ("M6", "sla"), ("M7", "escalation")):
    operation("post", "/admin/"+suffix+"-rules", "Configure"+suffix.title(), owner, "rules.write", request="RuleWrite", status=201, fr="FR17")
operation("post", "/admin/maintenance", "ConfigureMaintenance", "M1", "system.maintenance", request="Maintenance", fr="FR18")
operation("post", "/admin/operations", "RequestSystemJob", "M1", "system.job", "SystemJobResult", "SystemJob", 202, "FR18")
operation("get", "/admin/operations/{id}", "ReadSystemJob", "M1", "system.job", "SystemJobResult", fr="FR18")
operation("post", "/admin/operations/{id}/approve", "ApproveSystemJob", "M1", "system.job", "SystemJobResult", "VersionedReason", fr="FR18")
operation("post", "/admin/operations/{id}/execute", "ExecuteSystemJob", "M1", "system.job", "SystemJobResult", "VersionedReason", fr="FR18")
operation("get", "/admin/operations/{id}/artifact", "DownloadSystemJobArtifact", "M1", "system.job", "Download", fr="FR18")
operation("get", "/admin/health", "ReadRedactedHealth", "M1", "system.health", "HealthAdmin", fr="FR18")
operation("post", "/tickets/{id}/archive", "ArchiveTicket", "M3", "ticket.archive", request="VersionedReason", fr="FR22")
operation("post", "/tickets/{id}/restore-archive", "RestoreTicketArchive", "M3", "ticket.archive", request="VersionedReason", fr="FR22")
operation("post", "/admin/purge-requests", "RequestPurge", "M1", "system.purge.request", "SystemJobResult", "PurgeRequest", 202, "FR22")


# RM0-01 optional ownership and descriptive upload fields are accepted by the runtime.
schemas['Upload']['properties'].update(org_id=UUID,caption={"type":"string","maxLength":4000},source={"type":"string","maxLength":4000})
schemas['Media']['properties'].update(org_id=UUID,principal_id=UUID,mime=TEXT,license=TEXT,caption={"type":"string"},source={"type":"string"},download_path=TEXT)

from m0_03_contracts import extend, type_source
extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_04_contracts
m0_04_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_05_contracts
m0_05_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_06_contracts
m0_06_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_07_contracts
m0_07_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_08_contracts
m0_08_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_09_contracts
m0_09_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_10_contracts
m0_10_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)
import m0_11_contracts
m0_11_contracts.extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION)

import role_hero_contracts
role_hero_contracts.extend(schemas,operation,obj,arr,ref,UUID,TEXT)

RUNTIME_COMMANDS={'ListReportingDirectory','ListDivision','CreateDivision','UpdateDivision','RevokeMediaApproval','RegisterPublicSubject','ApproveSanitizedMedia','CreateLabSession','RevokeSession','ReadSession','ReadLabBootstrap','ListServices','ReadService','ReadServiceForm','CreateService','UpdateService','UpdateServiceForm','GrantMembership','ListOrganization','CreateOrganization','UpdateOrganization','ListTeam','CreateTeam','UpdateTeam','ListMembership','UpdateMembership','ListAdminServices','ReadAdminService','ReadAdminServiceForm','ListCategories','CreateCategory','UpdateCategory','ReadCatalogServicePolicy','ReadAdminServicePolicy','UpdateServicePolicy'}

def build_openapi():
    spec = {"openapi": "3.1.0", "info": {"title": "Helpdesk M0 business contract", "version": "1.2.0",
            "description": "M0-04 synthetic lab: IMPLEMENTED_M0_03 and IMPLEMENTED_M0_04 operations have runtime handlers; remaining business operations are NOT_IMPLEMENTED. Lab defaults are not official organizational policy."},
            "servers": [{"url": "/"}], "paths": {}, "components": {"schemas": schemas, "securitySchemes": {
                "SessionCookie": {"type": "apiKey", "in": "cookie", "name": "helpdesk_session"},
                "GuestCapability": {"type": "apiKey", "in": "header", "name": "X-Guest-Capability"}, "GuestTracking": {"type":"apiKey","in":"cookie","name":"helpdesk_tracking"}}}}
    for index, op in enumerate(operations):
        method, path = op["method"], op["path"]
        mutation = method != "get"
        response = ref(op["response"])
        listing = op['command'].startswith('List') or op['command'] == 'SearchScopedOwners'
        if listing:
            response = obj({"items": arr(response), "next_cursor": {"type": ["string", "null"], "maxLength": 512}, "as_of": UTC})
        params = [{"name": name, "in": "path", "required": True, "schema": enum("L1", "L2") if name=="tier" else TEXT if name=="role" else UUID} for name in __import__('re').findall(r"\{([^}]+)\}", path)]
        if mutation:
            params += [{"name": "Idempotency-Key", "in": "header", "required": True, "schema": {"type": "string", "minLength": 16, "maxLength": 128}, "description": "Bound to trusted actor/capability, command, target and canonical payload hash; replay same intent, 409 for changed intent."},
                       {"name": "X-CSRF-Token", "in": "header", "required": False, "schema": TEXT, "description": "Required for cookie-authenticated mutations; verified Origin and CSRF token."}]
        if listing:
            params += [{"name": "limit", "in": "query", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
                       {"name": "cursor", "in": "query", "schema": {"type": "string", "maxLength": 512}},
                       {"name": "sort", "in": "query", "schema": enum("id_asc"), "description": "Stable UUID ordering; scope filter before cursor/limit. Other sort modes are rejected."}]
        for query in op["query"]:
            shape = enum("M2", "M3", "M8") if query == "owner" and path.endswith("/search") else enum("M3", "M8") if query == "owner" else UTC if query in ("from", "to") else UUID if query.endswith("_id") else TEXT
            params.append({"name": query, "in": "query", "required": query not in ("tier","mode","view","q","status") or query == "q" and path.endswith("/search"), "schema": enum("L1","L2") if query=="tier" else enum("reassign") if query=="mode" else enum("published") if query=="view" else enum("CLEAN") if query=="status" and path.endswith("/media") else shape})
        if op["command"] in ("CreateTicket", "ExchangeGuestCapability"):
            params.append({"name": "X-Guest-Capability", "in": "header", "required": op["command"] == "ExchangeGuestCapability", "schema": {"type": "string", "pattern": "^[A-Za-z0-9_-]{43}$"}, "description": "Client generates >=256 random bits; secret never URL/log/draft. Required for unauthenticated guest create; hash only at rest."})
        body_name = op["request"]
        if body_name == "ServiceWrite" and "{id}" in path:
            body_name = "ServiceUpdate"
            schemas[body_name] = obj({"expected_version": VERSION, **schemas["ServiceWrite"]["properties"]})
        if op["command"] == "AcceptResolution":
            body_name = "AcceptResolution"
            schemas[body_name] = obj({"expected_version": VERSION, "attempt_id": UUID})
        entry = {"operationId": op["command"] + ("Alias"+str(index) if op["alias"] else ""), "summary": op["command"],
                 "x-command": op["command"], "x-owner": op["owner"], "x-permission": op["permission"], "x-requirements": op["fr"],
                 "x-runtime-status": "IMPLEMENTED_RM0_04" if op['command'] in role_hero_contracts.COMMANDS else "IMPLEMENTED_M0_11" if op['command'] in m0_11_contracts.COMMANDS else "IMPLEMENTED_M0_10" if op['command'] in m0_10_contracts.COMMANDS else "IMPLEMENTED_M0_09" if op['command'] in m0_09_contracts.COMMANDS else "IMPLEMENTED_M0_08" if op['command'] in m0_08_contracts.COMMANDS else "IMPLEMENTED_M0_07" if op['command'] in m0_07_contracts.COMMANDS else "IMPLEMENTED_M0_06" if op['command'] in m0_06_contracts.COMMANDS else "IMPLEMENTED_M0_05" if op['command'] in m0_05_contracts.COMMANDS else "IMPLEMENTED_M0_04" if op['command'] in m0_04_contracts.COMMANDS else "IMPLEMENTED_M0_03" if op['command'] in RUNTIME_COMMANDS else "NOT_IMPLEMENTED", "x-authorization": "Trusted principal, live object/scope/revocation checks. Hidden object 404; visible forbidden action 403; config admin has no implicit ticket read.",
                 "security": [{"SessionCookie": []}], "parameters": params,
                 "responses": {str(op["status"]): {"description": "Accepted job with scope-bound polling" if op["status"] == 202 else "Durable primary result; downstream delivery may still be pending", "content": {"application/json": {"schema": response, "example": sample(response)}}}}}
        if op["public"]:
            entry["security"] += [{}]
        if op['command']=='ReadLabBootstrap':
            entry['x-lab-gate']='SYNTHETIC_LAB plus explicit HELPDESK_LAB_AUTH; server allowlist, no production provider'
        if op['command'] in ('ReadServiceForm','ReadAdminServiceForm'):
            entry['parameters'].append({'name':'version','in':'query','schema':VERSION,'description':'Optional historical immutable form version, still subject to live service visibility.'})
        if op['command'] in ('ListTeam','ListCategories','ListOrganization','ListMembership','ListDivision','ListReportingDirectory','ListHandoffTargets'):
            entry['parameters'].append({'name':'organization_id','in':'query','schema':UUID,'description':'Optional organization filter intersected with live actor scope before pagination.'})
        if op['command']=='ListReportingDirectory':
            entry['parameters'].extend([{'name':'mode','in':'query','schema':enum('asn')},{'name':'q','in':'query','schema':{'type':'string','maxLength':120}}])
        if op['command'] in ('ReadRoutingRule','WriteRoutingRule'):
            entry['parameters'].append({'name':'category_id','in':'query','schema':UUID,'description':'Optional verified category override. Omit for the service default.'})
        if op["owner"].startswith("M3") and not op["public"]:
            entry["security"] += [{"GuestCapability": []}]
        if body_name:
            entry["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(body_name), "example": sample(ref(body_name))}}}
        if op['command'] == 'StoreQuarantineBlob':
            entry['requestBody'] = {'required': True, 'content': {'application/octet-stream': {'schema': {'type': 'string', 'format': 'binary', 'maxLength': 10485760}, 'example': 'synthetic-fixture-bytes'}}}
            entry['parameters'].append({'name':'X-Expected-Version','in':'header','required':True,'schema':VERSION})
            entry['x-upload-policy'] = 'Bound metadata owner/principal, actual streamed size <= policy/10MiB, MIME signature and checksum validation; quarantine only, CLEAN after scan; no arbitrary URL fetch.'
        if op['command'] == 'DownloadCleanBlob':
            entry['responses']['200']['content'] = {'application/octet-stream':{'schema':{'type':'string','format':'binary','maxLength':10485760},'example':'synthetic-fixture-bytes'}}
            entry['x-download-policy'] = 'Recheck live scope, revocation, CLEAN state, blob presence and metadata expiry; IDs/download paths do not grant access. nosniff and safe attachment filename.'
        if op['command'] == 'AcceptResolution':
            entry['x-command'] = 'ConfirmResolution'
        if op['command'] == 'BulkTicketCommand':
            entry['x-authorization'] += ' Each target rechecks action-specific permission, visibility and expected_version; return per-item partial failure, never grant by bulk permission alone.'
        if op['command'] == 'ReuseMedia':
            entry['x-authorization'] += ' Both source and target scope required. Private M3 media cannot be published by direct reference; require approved sanitized M8 copy with provenance.'
        for code, error in ((400,"INVALID_REQUEST"),(401,"UNAUTHENTICATED"),(403,"FORBIDDEN"),(404,"NOT_FOUND"),(409,"CONFLICT"),(422,"VALIDATION_FAILED"),(429,"RATE_LIMITED"),(503,"DEPENDENCY_UNAVAILABLE")):
            entry["responses"][str(code)] = {"description": error, "content": {"application/json": {"schema": ref("Error"), "example": {"code": error, "message": "Permintaan tidak dapat diproses", "correlation_id": sample(UUID), "details": []}}}}
        if op["status"] == 202:
            location = "/api/v1/reports/exports/{id}" if op["command"] == "RequestReportExport" else "/api/v1/admin/operations/{id}" if op["owner"] == "M1" else "/api/v1/operations/{id}"
            entry["x-poll-path"] = location
            entry["responses"]["202"]["headers"] = {"Location": {"required": True, "schema": {"type": "string"}, "description": location}}
        if op["command"] == "RequestPurge":
            entry["x-feature-gate"] = "DISABLED_PENDING_ORGANIZATIONAL_POLICY; retention/hold/references and independent approval mandatory"
        role_hero_contracts.customize(entry,op['command'])
        m0_04_contracts.customize(entry,op["command"],ref,VERSION)
        m0_05_contracts.customize(entry,op["command"],ref,VERSION)
        m0_06_contracts.customize(entry,op["command"],ref,VERSION)
        m0_07_contracts.customize(entry,op["command"],ref,VERSION)
        m0_08_contracts.customize(entry,op["command"],ref,VERSION)
        m0_09_contracts.customize(entry,op["command"],ref,VERSION)
        m0_10_contracts.customize(entry,op["command"],ref,VERSION)
        m0_11_contracts.customize(entry,op["command"],ref,VERSION)
        # Keep examples synchronized after a phase replaces response/stream schemas.
        for message in [entry.get('requestBody',{})]+list(entry['responses'].values()):
            for media in message.get('content',{}).values():
                if media['schema'].get('format')=='binary':continue
                media['example']=sample(media['schema'])
        spec["paths"].setdefault(path, {})[method] = entry
    return spec


SNAPSHOT = {'state':STATES,'requester_id':UUID,'service_id':UUID,'service_owner_org_id':UUID,'accepted_at':UTC,'resolution_due_at':UTC,'policy_version':VERSION,'episode_id':UUID,
            'assignee_id':{'type':['string','null'],'format':'uuid'},'handling_team_id':{'type':['string','null'],'format':'uuid'},
            'resolution_endpoint':{'type':['string','null'],'format':'date-time'},'gross_seconds':{'type':'integer','minimum':0},'net_seconds':{'type':'integer','minimum':0}}
EVENTS = {
    "TicketCreated": ("M3", ["M5", "M6", "M7", "M9"], {**SNAPSHOT,'state':{'const':'OPEN'}}),
    "TicketVerified": ("M3", ["M9"], {"verification": {"const": "VERIFIED"}, "category_id": UUID}),
    "AssignmentChanged": ("M3", ["M9"], {"team_id": UUID, "assignee_id": UUID}),
    "TicketStateChanged": ("M3", ["M5", "M6", "M7", "M9"], SNAPSHOT),
    "ResolutionProposed": ("M3", ["M7", "M9"], {"attempt_id": UUID, "confirmation_due_at": UTC}),
    "NotificationStored": ("M9", ["M3"], {"ticket_id": UUID, "attempt_id": UUID}),
    "ConfirmationRecorded": ("M3", ["M6", "M7", "M9"], {"attempt_id": UUID, "decision": enum("ACCEPT", "REJECT", "FEEDBACK", "AUTO_NO_RESPONSE")}),
    "VendorCaseRecorded": ("M3", ["M7", "M9"], {"case_id": UUID, "internal_pic_id": UUID, "next_followup_at": UTC}),
    "PauseChanged": ("M3", ["M7", "M9"], {"pause_id": UUID, "policy_version": VERSION}),
    "HandoffAccepted": ("M3", ["M5", "M6", "M7", "M9"], {"from_org_id": UUID, "to_org_id": UUID, "team_id": UUID}),
    "EscalationRequested": ("M3", ["M7", "M9"], {"operation_id": UUID, "level": enum("L2", "COORDINATOR", "LEADERSHIP")}),
    "MediaScanCompleted": ("M3|M8", ["M9"], {"status": enum("CLEAN", "REJECTED"), "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"}}),
    "ContentPublished": ("M8", ["M9"], {"revision_id": UUID, "audience": AUDIENCE}),
    "AuditRecorded": ("ALL_OWNERS", ["M9"], {"actor_id": UUID, "action": TEXT, "object_id": UUID, "scope": TEXT, "reason": TEXT, "outcome": enum("SUCCESS", "DENIED", "FAILED")}),
}


def build_events():
    fields = {"event_id": UUID, "event_type": enum(*EVENTS), "producer": enum(*[f"M{i}" for i in range(1,10)]), "schema_version": {"type": "integer", "const": 1}, "aggregate_id": UUID, "aggregate_version": VERSION, "occurred_at": UTC, "correlation_id": UUID, "payload": {"type": "object"}}
    schema = {"$schema": "https://json-schema.org/draft/2020-12/schema", **obj(fields), "oneOf": []}
    examples, subscriptions = [], []
    for name, (producer, consumers, payload) in EVENTS.items():
        producers = [f"M{i}" for i in range(1,10)] if producer == "ALL_OWNERS" else producer.split("|")
        shape = obj(dict(payload))
        if name in ("TicketCreated","TicketStateChanged"):
            shape["properties"]["sla_clock"] = schemas["SLAClock"]
        if name == "ResolutionProposed":
            shape["properties"]["requester_id"] = UUID
        if name == "TicketStateChanged":
            shape["properties"]["dispatch"] = obj({
                "team_id": UUID, "assignee_id": UUID, "explanation": TEXT,
                "tier": enum("L1", "L2"), "proposal_digest": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
                "recommended_assignee_id": UUID,
            })
        schema["oneOf"].append({"properties": {"event_type": {"const": name}, "producer": enum(*producers), "payload": shape}})
        event = {k: sample(v) for k,v in fields.items()}
        event.update(event_type=name, producer=producers[0], payload=sample(shape))
        if name == "ResolutionProposed":
            event["payload"]["confirmation_due_at"] = "2026-11-05T03:00:00Z"
        examples.append(event)
        subscriptions.append({"event_type": name, "producers": producers, "consumers": consumers, "schema_version": 1,
                              "ordering": "monotonic aggregate snapshots; no consecutive-version assumption for partial subscriptions",
                              "projection": 'canonical complete snapshot; CAS source_version, ignore older/equal snapshot' if name in ('TicketCreated','TicketStateChanged') else 'intent stream, inbox dedup by event ID; never advance canonical snapshot watermark from partial intent',
                              "dedup": "consumer_id + event_id; differing digest is integrity error",
                              "ack": "after inbox and effect commit in consumer owner transaction",
                              "self_relay": False})
    return schema, examples, subscriptions


def artifacts():
    api = build_openapi()
    events, examples, subscriptions = build_events()
    trace = io.StringIO(newline="")
    writer = csv.writer(trace, lineterminator="\n")
    registry = {r['module_id']:r['schema'] for r in csv.DictReader((ROOT/'contracts/module_registry.csv').read_text(encoding='utf-8-sig').splitlines())}
    data_contracts = {'M1':'subjects sessions memberships delegations system_operation_requests', 'M2':'services service_forms policies portal_navigation', 'M3':'tickets ticket_versions idempotency_records resolution_attempts confirmation_notifications attachments drafts vendor_cases handoff_requests', 'M4':'rules classification_proposals', 'M5':'routing_rules rosters assignment_proposals load_projection', 'M6':'calendars holidays targets clock_projection', 'M7':'rules jobs', 'M8':'content revisions media drafts', 'M9':'notifications delivery_jobs audit_entries report_facts export_jobs'}
    writer.writerow(["operation_id","method","path","command","owner","permission","source_requirements","acceptance","data_contracts","event_contract","policy_fixtures","implementation_phase"])
    for path, methods in api["paths"].items():
        for method, op in methods.items():
            tables = ' '.join(registry[owner]+'.'+name for owner in op['x-owner'].split('|') for name in data_contracts[owner].split())
            acceptance = ['AC02','AC06']
            if method != 'get':
                acceptance.append('AC03')
            if op['x-command'] in ('CreateTicket','VerifyTicket','DispatchTicket','TransitionTicket','ResolveTicket','ConfirmResolution','ReadTicketSLA','RecordVendorCase','ApprovePause','AcceptHandoff'):
                acceptance.append('AC08')
            writer.writerow([op["operationId"],method.upper(),path,op["x-command"],op["x-owner"],op["x-permission"]," ".join(op["x-requirements"]),' '.join(acceptance),tables,'contracts/events/subscriptions.v1.json','tests/contract/policy.v1.fixture.json tests/contract/calendar.v1.fixture.json',"M0-03 onward; contract only in M0-02"])
    return {"contracts/openapi/business.json": api, "contracts/events/business.v1.schema.json": events,
            "contracts/events/subscriptions.v1.json": {"subscriptions": subscriptions},
            "tests/contract/business-events.v1.fixture.json": examples,
            "contracts/business_traceability.csv": trace.getvalue(),
            "frontend/src/features/business-types.generated.ts":type_source(api['components']['schemas'])}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for relative, value in artifacts().items():
        data = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2)+"\n"
        path = ROOT/relative
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != data:
                raise SystemExit("FAIL generated contract drift: " + relative)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data, encoding="utf-8", newline="\n")
    print("PASS business contract generation" + (" consistency" if args.check else ""))
