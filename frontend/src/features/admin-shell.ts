import { sessionBus } from './session-events';
import { workStart } from '../../admin-profiles.mjs';
import { adminItems, adminPageContext, canNavigate, canOpenAdminPage, roleLabels } from '../../admin-navigation.mjs';
import { api, APIError } from './transport';
import type { Components } from './business-types.generated';

type Session = Components['Session'];
let currentSession: Session | undefined;
const hiddenByGuard = new Map<HTMLElement, boolean>();
const node = (tag:string, text:string, cls = '') => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (cls) element.className = cls;
  return element;
};

export function bindAdminPagePicker(select: HTMLSelectElement, session: Session | undefined) {
  if (select.dataset.adminNavBound) return;
  select.dataset.adminNavBound = 'true';
  select.addEventListener('change',()=>{
    const item = adminItems.find(i=>i.kind === select.value);
    if (item && canNavigate(item,session)) location.assign(item.href);
  });
  select.disabled = false;
}

export function syncAdminShell(session: Session | undefined) {
  if (!location.pathname.startsWith('/admin/')) return;
  currentSession = session;
  const staff = session?.actor.kind === 'STAFF';
  const context = adminPageContext(location.pathname, location.search, session);
  const role = session ? roleLabels[session.actor.role] ?? 'Petugas' : 'Belum masuk';
  const scopes = new Set(session?.actor.memberships.filter(m=>m.organization_active).map(m=>m.organization_id));

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-admin-nav-id]')) {
    const item = adminItems.find(i=>i.id === link.dataset.adminNavId);
    link.hidden = !item || !canNavigate(item,session);
    if (link.parentElement?.tagName === 'LI') link.parentElement.hidden = link.hidden;
    if (!link.hidden && context.item?.id === item?.id) link.setAttribute('aria-current',context.detail ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  }
  for (const nav of document.querySelectorAll<HTMLElement>('[data-admin-navigation]')) {
    if (!nav.dataset.submenuBound) {
      nav.dataset.submenuBound = '1';
      nav.addEventListener('click', (event) => {
        const toggle = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.hd-nav-submenu__toggle') : null;
        const sub = toggle?.closest<HTMLElement>('[data-admin-submenu]');
        if (!toggle || !sub) return;
        const nextOpen = sub.dataset.open !== 'true';
        sub.dataset.open = String(nextOpen);
        toggle.setAttribute('aria-expanded', String(nextOpen));
        const sublist = sub.querySelector<HTMLElement>('.piui-nav-sublist');
        if (sublist) sublist.hidden = !nextOpen;
      });
    }
    let summary = nav.previousElementSibling as HTMLElement | null;
    if (!summary?.hasAttribute('data-admin-context')) {
      summary = node('div','', 'hd-admin-context');
      summary.setAttribute('data-admin-context','');
      nav.before(summary);
    }
    summary.replaceChildren(node('strong',role),node('span',session?.actor.name ?? 'Masuk untuk membuka pekerjaan Anda.'),node('small',staff ? `${scopes.size} organisasi aktif · Diskominfo Depok` : 'Helpdesk TIK Kota Depok'));
    summary.title = `${role} · ${session?.actor.name ?? 'Belum masuk'}`;
    for (const sub of nav.querySelectorAll<HTMLElement>('[data-admin-submenu]')) {
      const visibleItems = [...sub.querySelectorAll<HTMLAnchorElement>('a[data-admin-nav-id]:not([hidden])')];
      const hasVisible = visibleItems.length > 0;
      sub.hidden = !hasVisible;
      const row = sub.closest<HTMLElement>('.hd-nav-submenu-row');
      if (row) row.hidden = !hasVisible;
      const hasCurrent = Boolean(sub.querySelector('a[aria-current="page"], a[aria-current="location"]'));
      const openSub = hasCurrent || (staff && visibleItems.length > 0 && visibleItems.length <= 2);
      sub.dataset.open = String(openSub);
      const toggle = sub.querySelector<HTMLButtonElement>('.hd-nav-submenu__toggle');
      const sublist = sub.querySelector<HTMLElement>('.piui-nav-sublist');
      if (toggle) toggle.setAttribute('aria-expanded', String(openSub));
      if (sublist) sublist.hidden = !openSub;
    }
    for (const list of nav.querySelectorAll<HTMLElement>('.piui-nav-list')) {
      list.hidden = !list.querySelector('a[data-admin-nav-id]:not([hidden])');
      const heading = list.previousElementSibling;
      if (heading instanceof HTMLElement) heading.hidden = list.hidden;
    }
  }
  for (const name of document.querySelectorAll('[data-admin-profile-name]')) name.textContent = session?.actor.name ?? 'Belum masuk';
  for (const label of document.querySelectorAll('[data-admin-profile-role]')) label.textContent = `Peran: ${role}`;
  for (const panel of document.querySelectorAll<HTMLElement>('[data-admin-work-start]')) {
    panel.hidden = !staff;
    if (staff) {
      const start = workStart(session);
      panel.querySelector('[data-admin-work-title]')!.textContent = `Mulai sebagai ${start.label}`;
      panel.querySelector('[data-admin-work-description]')!.textContent = start.description;
      const link=panel.querySelector<HTMLAnchorElement>('[data-admin-work-link]')!;
      link.href=start.href;link.textContent=start.action;
    }
  }
  for (const link of document.querySelectorAll('[data-admin-account-switch]')) link.textContent = session ? 'Ganti akun' : 'Masuk petugas';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-admin-logout]')) {
    button.hidden = !session;
    if (button.dataset.bound) continue;
    button.dataset.bound = 'true';
    button.addEventListener('click',async()=>{
      if (!currentSession || button.disabled) return;
      button.disabled = true;
      try {
        await api('/auth/logout','POST',{expected_version:currentSession.version,reason:'Keluar dari ruang petugas'});
        sessionBus?.postMessage('SESSION_CHANGED');
        location.assign('/admin/auth/login.html');
      } catch (error) {
        if (error instanceof APIError && error.status === 401) location.assign('/admin/auth/login.html');
        else {
          let status = document.querySelector('[data-admin-account-status]');
          if (!status) { status = node('p',''); status.setAttribute('data-admin-account-status',''); status.setAttribute('role','status'); button.after(status); }
          status.textContent = 'Keluar akun belum berhasil. Coba kembali.';
        }
      } finally { button.disabled = false; }
    });
  }

  const main = document.querySelector<HTMLElement>('main[data-hd-page],main[data-ticket-page]');
  if (!main) return;
  let breadcrumb = main.querySelector<HTMLElement>('[data-admin-breadcrumb]');
  if (!breadcrumb) {
    breadcrumb = node('nav','', 'hd-admin-breadcrumb');
    breadcrumb.setAttribute('data-admin-breadcrumb','');
    breadcrumb.setAttribute('aria-label','Jejak navigasi');
    main.prepend(breadcrumb);
  }
  const crumbs = node('ol','');
  if (context.item?.id !== 'dashboard') {
    const home = node('a','Dasbor petugas') as HTMLAnchorElement;
    home.href = '/admin/app/dashboard/index.html';
    const item = node('li',''); item.append(home); crumbs.append(item);
  }
  if (context.detail) {
    const parent = node('a','Antrean tiket') as HTMLAnchorElement; parent.href='/admin/app/tickets/index.html';
    const item=node('li','');item.append(parent);crumbs.append(item);
  }
  const current = node('li',context.title); current.setAttribute('aria-current','page');crumbs.append(current);
  breadcrumb.replaceChildren(crumbs);
  const heading = main.querySelector('h1'); if (heading) heading.textContent=context.title;
  const description=main.querySelector('.piui-page-subtitle');
  if (description && context.item?.description) description.textContent=context.item.description;
  document.title = `${context.title} · Helpdesk TIK Kota Depok`;

  const permitted = canOpenAdminPage(location.pathname,location.search,session);
  let access = main.querySelector<HTMLElement>('[data-admin-access]');
  if (!permitted) {
    for (const child of [...main.children]) {
      if (!(child instanceof HTMLElement) || child === breadcrumb || child === access) continue;
      if (!hiddenByGuard.has(child)) hiddenByGuard.set(child,Boolean(child.hidden));
      child.hidden = true; child.setAttribute('data-admin-blocked','');
    }
    if (!access) { access=node('section','', 'piui-card hd-admin-access');access.setAttribute('data-admin-access','');main.append(access); }
    access.hidden=false;
    const title=node('h1',staff ? 'Halaman di luar tugas Anda' : 'Masuk ruang petugas');
    document.title = `${title.textContent} · Helpdesk TIK Kota Depok`;
    const explanation=node('p',staff ? 'Pilih menu yang tersedia sesuai mandat akun Anda.' : 'Gunakan akun petugas untuk membuka ruang kerja ini. Tiket pemohon tersedia melalui portal publik.');
    const login=node('a',session ? 'Ganti akun' : 'Masuk petugas','piui-btn piui-btn--primary') as HTMLAnchorElement;login.href='/admin/auth/login.html';
    const portal=node('a',staff ? 'Dasbor petugas' : 'Portal publik','piui-btn piui-btn--secondary') as HTMLAnchorElement;portal.href=staff ? '/admin/app/dashboard/index.html' : '/';
    const actions=node('div','', 'hd-actions');actions.append(login,portal);access.replaceChildren(title,explanation,actions);
  } else {
    for (const [element,hidden] of hiddenByGuard) { element.hidden=hidden; element.removeAttribute('data-admin-blocked'); }
    hiddenByGuard.clear();if (access) access.hidden=true;
  }
}
