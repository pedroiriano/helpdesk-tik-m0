import type { Components } from './business-types.generated';

type Session = Components['Session'];
type Ticket = Pick<Components['Ticket'], 'state' | 'verification'>;

const states: Record<string, string> = {
  OPEN: 'Laporan diterima', TRIAGED: 'Sedang ditelaah',
  NEEDS_INFORMATION: 'Perlu informasi tambahan', ASSIGNED: 'Petugas ditugaskan',
  IN_PROGRESS: 'Sedang ditangani', RESOLVED: 'Menunggu konfirmasi hasil',
  CLOSED: 'Selesai', CANCELLED: 'Dibatalkan',
};
const priorities: Record<string, string> = {
  LOW: 'Rendah', NORMAL: 'Normal', HIGH: 'Tinggi', CRITICAL: 'Kritis',
};

export function ticketState(ticket: Pick<Ticket, 'state'>) {
  return states[ticket.state] ?? 'Status belum tersedia';
}

export function priorityLabel(priority?: string) {
  return priority ? priorities[priority] ?? 'Belum ditetapkan' : 'Belum ditetapkan';
}

export function requesterGuidance(ticket: Ticket) {
  if (ticket.state === 'NEEDS_INFORMATION') return 'Petugas meminta informasi tambahan. Buka tiket dan lengkapi informasi yang diminta.';
  if (ticket.state === 'RESOLVED') return 'Petugas telah mengirim hasil penanganan. Periksa hasilnya, lalu konfirmasi atau sampaikan keberatan.';
  if (ticket.state === 'CLOSED') return 'Riwayat dan hasil penanganan tersedia di detail tiket.';
  if (ticket.state === 'CANCELLED') return 'Lihat alasan pembatalan pada riwayat tiket.';
  if (ticket.verification !== 'VERIFIED') return 'Petugas akan memeriksa kelengkapan laporan Anda.';
  return 'Pantau perkembangan dan percakapan dengan petugas di detail tiket.';
}

export function loginDestination(kind: string | undefined, query: string) {
  const params = new URLSearchParams(query);
  const service = params.get('service') ?? '';
  const validService = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(service);
  if (validService && ['report', 'detail'].includes(params.get('intent') ?? '')) {
    const page = params.get('intent') === 'report' ? '/lapor.html?id=' : '/detail-layanan.html?slug=';
    return page + encodeURIComponent(service);
  }
  return kind === 'STAFF' ? '/admin/app/dashboard/index.html' : '/tiket.html';
}

export function serviceLoginHref(service: string, intent: 'report' | 'detail') {
  return '/akses.html?' + new URLSearchParams({service, intent});
}

export function canUse(session: Session | undefined, permission: string) {
  return session?.actor.memberships.some(m => m.organization_active && m.permissions.includes(permission)) ?? false;
}

export function syncJourney(session: Session | undefined) {
  const staff = session?.actor.kind === 'STAFF';
  const visible: Record<string, boolean> = {
    guest: !session, account: Boolean(session), requester: Boolean(session) && !staff, staff,
  };
  for (const node of document.querySelectorAll<HTMLElement>('[data-hd-audience]')) {
    node.hidden = !visible[node.dataset.hdAudience ?? ''];
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-hd-permission]')) {
    node.hidden = !staff || !canUse(session, node.dataset.hdPermission ?? '');
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.hd-ticket-nav a')) {
    const target = new URL(link.href, location.origin);
    const current = target.pathname === location.pathname && (!target.searchParams.has('kind') || target.searchParams.get('kind') === new URLSearchParams(location.search).get('kind'));
    if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    link.classList.toggle('is-active', current);
  }
}

// Escape text used by the legacy PIUI HTML shell, including attribute contexts.
export function htmlText(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
