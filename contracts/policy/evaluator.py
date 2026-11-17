"""Pure executable contract oracle. NOT wired into HTTP/auth or production workers.

No clock, DB, credential parsing or transport. Trusted contexts are supplied by fixtures;
M0-03+ must implement and prove principal establishment and enforcement in Go.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
PERMISSIONS = json.loads((HERE/'permissions.v1.json').read_text())
MACHINE = json.loads((HERE/'state-machine.v1.json').read_text())
CALENDAR = json.loads((HERE/'calendar.v1.json').read_text())


def instant(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def authorize(actor, permission, resource, now, *, internal=False):
    public = permission in PERMISSIONS['public_permissions'] and resource.get('published', False) and resource.get('audience') == 'PUBLIC_GUEST'
    if public:
        return 200
    if not actor or not actor.get('trusted') or actor.get('revoked') or instant(actor.get('expires_at', '1970-01-01T00:00:00Z')) <= instant(now):
        return 401
    role = PERMISSIONS['roles'].get(actor.get('role'))
    if not role:
        return 403
    is_self = resource.get('requester_id', resource.get('principal_id')) == actor.get('id')
    org = resource.get('target_org_id') if permission == 'ticket.handoff.accept' else resource.get('org_id')
    scoped = org is not None and org in actor.get('org_ids', [])
    if role['scope'] == 'self':
        visible = is_self
    elif role['scope'] == 'org':
        visible = scoped
    elif role['scope'] == 'assigned':
        visible = scoped and (resource.get('assignee_id') == actor.get('id') or actor.get('id') in resource.get('delegate_ids', []))
    elif role['scope'] == 'bound_ticket':
        visible = resource.get('id') == actor.get('ticket_id')
    else:
        visible = False
    if actor['role'] == 'GUEST':
        visible = visible and actor.get('capability_ticket_id') == resource.get('id') and actor.get('capability_valid', False)
    if not visible:
        return 404
    if permission not in role['permissions'] or permission not in actor.get('granted_permissions', role['permissions']):
        return 404 if permission in ('ticket.read', 'media.read', 'audit.read', 'report.read') else 403
    if internal and actor['role'] in ('GUEST','PUBLIC','ASN'):
        return 403
    if permission == 'media.read' and (resource.get('scan_state') != 'CLEAN' or not resource.get('blob_present', True)):
        return 404
    if permission == 'system.purge.request':
        return 403  # disabled until separate organizational policy and independent approval
    return 200


def visible_records(actor, permission, resources, now):
    """Scope is applied before consumers count, page, project or export."""
    return [r for r in resources if authorize(actor, permission, r, now) == 200]


def grant_allowed(actor, requested_permissions, target_org_id, now):
    resource = {'org_id':target_org_id}
    if authorize(actor,'identity.grant',resource,now) != 200:
        return False
    return set(requested_permissions) <= set(actor.get('grant_ceiling',[]))


def media_reuse_allowed(actor, source, target, now, *, sanitized_copy=False, approved=False):
    if authorize(actor,'media.reuse',source,now) != 200 or authorize(actor,'media.write',target,now) != 200:
        return False
    if source.get('scan_state') != 'CLEAN':
        return False
    if source.get('visibility') == 'PRIVATE' and target.get('visibility') == 'PUBLIC':
        return sanitized_copy and approved and target.get('owner') == 'M8'
    return True


def merge_intervals(intervals):
    merged = []
    for start,end in sorted((instant(a),instant(b)) for a,b in intervals):
        if end <= start:
            raise ValueError('invalid pause interval')
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0],max(end,merged[-1][1]))
        else:
            merged.append((start,end))
    return merged


def business_due(start, minutes, *, holidays=(), pauses=()):
    """CAL-1 reference only. Production calculator belongs to M6."""
    if minutes <= 0:
        raise ValueError('positive business target required')
    zone = timezone(timedelta(hours=CALENDAR['utc_offset_hours']))
    cursor = instant(start).astimezone(zone)
    remaining = minutes*60
    pause_union = merge_intervals(pauses)
    for _ in range(3660):
        day = cursor.replace(hour=0,minute=0,second=0,microsecond=0)
        if day.weekday() in CALENDAR['weekdays'] and str(day.date()) not in holidays:
            left = max(cursor,day.replace(hour=CALENDAR['start_hour']))
            right = day.replace(hour=CALENDAR['end_hour'])
            segments = [(left,right)] if left < right else []
            for pstart,pend in pause_union:
                unpaused = []
                for a,b in segments:
                    if pend <= a or pstart >= b:
                        unpaused.append((a,b))
                    else:
                        if a < pstart:
                            unpaused.append((a,pstart))
                        if pend < b:
                            unpaused.append((pend,b))
                segments = unpaused
            for a,b in segments:
                available = (b-a).total_seconds()
                if remaining <= available:
                    return (a+timedelta(seconds=remaining)).astimezone(timezone.utc).isoformat().replace('+00:00','Z')
                remaining -= available
        cursor = day+timedelta(days=1)
    raise ValueError('calendar fixture horizon exceeded')


def transition(ticket, action, actor, now, expected_version, **context):
    rule = next((r for r in MACHINE['transitions'] if r['action'] == action), None)
    if not rule:
        return {'status': 422}
    auth = authorize(actor, rule['permission'], ticket, now)
    if auth != 200:
        return {'status': auth}
    if action != 'CREATE' and expected_version != ticket.get('version'):
        return {'status': 409}
    if ticket['state'] not in rule['from']:
        return {'status': 422}
    requester = actor.get('id') == ticket.get('requester_id')
    operator = actor.get('role') in ('OPERATOR','COORDINATOR')
    due = instant(ticket.get('confirmation_due_at', now))
    active = context.get('attempt_id') is not None and context.get('attempt_id') == ticket.get('active_attempt_id')
    guards = {
        'service_access': context.get('service_active', False) and context.get('audience_allowed', False) and context.get('form_valid', False),
        'verification_evidence': bool(context.get('category_id') and context.get('reason') and context.get('evidence_digest')),
        'verified': ticket.get('verification') == 'VERIFIED',
        'valid_assignment': context.get('assignment_valid', False),
        'operator': operator,
        'requester_or_operator': requester or operator,
        'assignee': actor.get('id') == ticket.get('assignee_id') or actor.get('id') in ticket.get('delegate_ids', []),
        'resolution_evidence': bool(context.get('summary')),
        'requester': requester,
        'active_attempt': active,
        'deadline': instant(now) >= due,
        'within_confirmation_window': instant(now) <= due,
        'notification_proof': ticket.get('notification_durable', False) and bool(ticket.get('notification_id')) and ticket.get('notification_ticket_id') == ticket.get('id') and ticket.get('notification_attempt_id') == ticket.get('active_attempt_id'),
        'no_feedback': not ticket.get('feedback_committed', False),
        'reopen_policy': context.get('reopen_enabled', False) and context.get('within_reopen_window', False),
        'pause_policy': context.get('pause_policy_allowed', False) and context.get('pause_approved', False) and bool(context.get('reason')),
        'internal_pic': bool(context.get('internal_pic_id')),
        'handoff_target': bool(context.get('target_org_id')) and context.get('target_org_id') != ticket.get('org_id'),
        'handoff_acceptance': context.get('handoff_state') == 'PENDING' and ticket.get('target_org_id') in actor.get('org_ids', []) and bool(context.get('reason')),
    }
    if not all(guards[name] for name in rule['guards']):
        return {'status': 422}
    target = rule['to']
    if target == 'RETURN_TO_WORK':
        target = 'IN_PROGRESS' if ticket.get('assignee_active') else 'TRIAGED'
    if target == 'SAME':
        target = ticket['state']
    result = {**ticket, 'status': 200, 'state': target, 'version': ticket.get('version',0)+1}
    if action == 'RESOLVE':
        result['confirmation_due_at'] = (instant(now)+timedelta(hours=MACHINE['confirmation_hours'])).isoformat().replace('+00:00','Z')
    if action == 'VERIFY':
        result['verification'] = 'VERIFIED'
    if action in ('SUPPLY_INFORMATION','REOPEN'):
        result['verification'] = 'PENDING'
    if action == 'FEEDBACK':
        result['feedback_committed'] = True
    if action == 'ACCEPT_HANDOFF':
        result['org_id'] = ticket['target_org_id']
        result['delegate_ids'] = []
    if action == 'REOPEN':
        result['previous_episode_id'] = ticket.get('episode_id')
        result['new_episode_required'] = True
    return result
