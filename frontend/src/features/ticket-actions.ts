import type { Components } from './business-types.generated';

type Session = Components['Session'] | undefined;
type Ticket = Components['Ticket'] & { archived_at?: string | null };

export function setGuestReceiptMode(form: HTMLFormElement, guest: boolean) {
  const acknowledgement = form.elements.namedItem('saved-key') as HTMLInputElement | null;
  if (acknowledgement) {
    acknowledgement.required = guest;
    acknowledgement.disabled = !guest;
  }
  const section = form.querySelector<HTMLElement>('[data-guest-key]');
  if (section) section.hidden = !guest;
}

// UI availability mirrors the server. Each command still authorizes the actual object.
export function requesterPermission(session: Session, ticket: Ticket, permission: string) {
  if (ticket.requester_kind === 'GUEST') return !session;
  if (session?.actor.subject_id !== ticket.requester_id) return false;
  if (session.actor.role === 'PUBLIC') return true;
  return session.actor.role === 'ASN' && session.actor.memberships.some(m =>
    m.organization_active && m.organization_id === ticket.requester_org_id && m.permissions.includes(permission));
}

export function ticketActions(session: Session, ticket: Ticket, now = Date.now()) {
  const has = (permission: string) => session?.actor.kind === 'STAFF' && session.actor.memberships.some(m =>
    m.organization_active && m.organization_id === ticket.service_owner_org_id && m.permissions.includes(permission));
  const internal = Boolean(has('ticket.read'));
  const grant = (permission: string) => internal && Boolean(has(permission));
  const active = !ticket.archived_at;
  const terminal = ['CLOSED', 'CANCELLED'].includes(ticket.state);
  const assigned = ['ASSIGNED', 'IN_PROGRESS'].includes(ticket.state);
  const operator = grant('ticket.transition') && session?.actor.role === 'OPERATOR';
  const requester = requesterPermission(session, ticket, 'ticket.transition');
  const technician = grant('ticket.resolve') && ticket.assignee_id === session?.actor.subject_id;
  const lifecycle: Components['Transition']['action'][] = [];
  if (active) {
    if (operator && ['OPEN', 'TRIAGED'].includes(ticket.state)) lifecycle.push('REQUEST_INFORMATION');
    if ((operator || requester) && ticket.state === 'NEEDS_INFORMATION') lifecycle.push('SUPPLY_INFORMATION');
    if (technician && grant('ticket.transition') && ticket.state === 'ASSIGNED') lifecycle.push('START');
    if ((operator || requester) && ['OPEN', 'TRIAGED', 'NEEDS_INFORMATION'].includes(ticket.state)) lifecycle.push('CANCEL');
    if ((operator || requester) && ticket.state === 'CLOSED' && ticket.reopen_until && Date.parse(ticket.reopen_until) > now) lifecycle.push('REOPEN');
  }
  return {
    internal, lifecycle,
    verify: active && grant('ticket.verify') && ticket.state === 'OPEN' && ticket.verification === 'PENDING',
    dispatch: active && grant('ticket.dispatch') && ticket.verification === 'VERIFIED' && ['OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'].includes(ticket.state),
    resolve: active && technician && ticket.state === 'IN_PROGRESS',
    confirm: active && ticket.state === 'RESOLVED' && Boolean(ticket.active_attempt_id) && requesterPermission(session, ticket, 'ticket.confirm'),
    vendor: active && assigned && (grant('ticket.vendor') || technician),
    pause: active && assigned && grant('ticket.pause'),
    handoff: active && !terminal && grant('ticket.handoff'),
    escalate: active && !terminal && (grant('ticket.escalate') || technician),
    archive: active && terminal && grant('ticket.archive'),
    restore: !active && grant('ticket.archive'),
    comment: active && (grant('ticket.comment') || requesterPermission(session, ticket, 'ticket.comment')),
    attach: active && (grant('ticket.attach') || requesterPermission(session, ticket, 'ticket.attach')),
  };
}

export function activeResolution(ticket: Pick<Ticket, 'active_attempt_id'>, attempts: Components['Resolution'][]) {
  return ticket.active_attempt_id ? attempts.find(a => a.id === ticket.active_attempt_id) : attempts[0];
}

// CAS is transport metadata. Retries keep the original version held by durableIntent.
export function commandFingerprint<T extends {expected_version: number}>(payload: T) {
  const {expected_version: _version, ...intent} = payload;
  return JSON.stringify(intent);
}
