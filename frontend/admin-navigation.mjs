// One task map for the native PIUI sidebar, sub-menus, drawer, footer, page context and palette.
const HELPDESK_ICONS = new Set([
  'ticket', 'tag', 'compass', 'book-open', 'help-circle',
  'building', 'sitemap', 'wrench', 'id-card', 'key',
  'folder-catalog', 'file-text', 'org-tree', 'globe',
]);

export function adminIconHref(icon) {
  return HELPDESK_ICONS.has(icon)
    ? `/helpdesk/admin-icons.svg#icon-${icon}`
    : `/admin/assets/icons/piui-sprite.svg#icon-${icon}`;
}

export const adminGroups = [
  {
    label: 'Pekerjaan',
    items: [
      {id:'dashboard',label:'Dasbor petugas',href:'/admin/app/dashboard/index.html',icon:'dashboard',description:'Pilih pekerjaan dan pantau ringkasan sesuai tugas Anda.',footer:true},
      {id:'tickets',label:'Antrean tiket',href:'/admin/app/tickets/index.html',icon:'ticket',permissions:['ticket.read'],description:'Periksa laporan masuk dan lanjutkan penanganan sesuai tugas Anda.',footer:true},
      {id:'availability',kind:'availability',label:'Ketersediaan Tim',icon:'calendar',permissions:['rules.write','ticket.resolve'],description:'Periksa jadwal, kapasitas dan ketidakhadiran teknisi.'},
      {id:'notifications',kind:'notifications',label:'Notifikasi',icon:'bell',permissions:['notification.read'],description:'Periksa pemberitahuan dan pengaturan saluran notifikasi.'},
    ],
  },
  {
    label: 'Layanan dan konten',
    subgroups: [
      {
        id: 'sub-catalog',
        label: 'Katalog & Portal',
        icon: 'folder-catalog',
        items: [
          {id:'services',kind:'services',label:'Layanan TIK',icon:'components',permissions:['catalog.write'],description:'Kelola layanan, persyaratan, formulir dan kebijakan layanan.'},
          {id:'categories',kind:'categories',label:'Kategori layanan',icon:'tag',permissions:['catalog.write'],description:'Kelola kategori yang digunakan saat memeriksa laporan.'},
          {id:'navigation',kind:'navigation',label:'Menu portal publik',icon:'compass',permissions:['catalog.write'],description:'Atur susunan menu pada portal publik.'},
        ],
      },
      {
        id: 'sub-content',
        label: 'Konten & Media',
        icon: 'file-text',
        items: [
          {id:'articles',kind:'articles',label:'Panduan dan artikel',icon:'book-open',permissions:['content.read','content.write','content.publish'],description:'Susun, tinjau dan terbitkan panduan sesuai mandat Anda.'},
          {id:'faqs',kind:'faqs',label:'Tanya Jawab (FAQ)',icon:'help-circle',permissions:['content.read','content.write','content.publish'],description:'Kelola pertanyaan umum (FAQ), topik kategori, urutan tampil dan publikasi ke portal.'},
          {id:'media',kind:'media',label:'Pustaka media',icon:'gallery',permissions:['media.read','media.write'],description:'Temukan berkas yang boleh diakses dan kelola media sesuai izin.'},
          {id:'hero',kind:'hero',label:'Banner Hero',icon:'layout-cards',permissions:['hero.write','hero.publish'],organization:'10000000-0000-4000-8000-000000000001',description:'Atur lima banner beranda, simpan draf, lalu terbitkan.'},
        ],
      },
    ],
  },
  {
    label: 'Organisasi dan akses',
    subgroups: [
      {
        id: 'sub-org',
        label: 'Struktur Organisasi',
        icon: 'org-tree',
        items: [
          {id:'organizations',kind:'organizations',label:'PD / Unit Kerja',icon:'building',permissions:['identity.grant'],description:'Kelola PD / Unit Kerja yang dapat dipilih pelapor.'},
          {id:'divisions',kind:'divisions',label:'Bidang',icon:'sitemap',permissions:['identity.grant'],description:'Kelola bidang aktif di masing-masing PD / Unit Kerja.'},
          {id:'teams',kind:'teams',label:'Tim teknis',icon:'wrench',permissions:['identity.grant'],description:'Kelola tim teknis dan organisasi penanggung jawabnya.'},
        ],
      },
      {
        id: 'sub-access',
        label: 'Pengguna & Akses',
        icon: 'users',
        items: [
          {id:'subjects',kind:'subjects',label:'Daftar akun pengguna',icon:'id-card',permissions:['identity.grant'],description:'Tambahkan akun staf, ASN, atau pengguna baru dan kelola peran serta status aktif.'},
          {id:'memberships',kind:'memberships',label:'Akun dan hak akses',icon:'key',permissions:['identity.grant'],description:'Kelola keanggotaan dan hak akses sesuai mandat organisasi Anda.'},
          {id:'role-policies',kind:'role-policies',label:'Peran dan Akses Modul',icon:'lock',permissions:['identity.role.manage'],role:'SUPER_ADMIN',description:'Atur tindakan yang boleh diberikan kepada setiap peran.'},
        ],
      },
    ],
  },
  {
    label: 'Pengawasan dan sistem',
    items: [
      {id:'reports',kind:'reports',label:'Laporan kinerja',icon:'analytics',permissions:['report.read'],description:'Tinjau capaian, periode laporan dan ekspor yang diizinkan.'},
      {id:'audit',kind:'audit',label:'Jejak audit',icon:'audit',permissions:['audit.read'],description:'Telusuri catatan aktivitas untuk pemeriksaan.',footer:true},
      {id:'rules',kind:'rules',label:'Aturan layanan dan SLA',icon:'clock',permissions:['rules.write'],description:'Kelola status aktif aturan klasifikasi, routing, kalender SLA, dan eskalasi.'},
      {id:'maintenance',kind:'maintenance',label:'Pemeliharaan sistem',icon:'settings',permissions:['system.health','system.maintenance','system.job'],description:'Periksa kesehatan dan jalankan pekerjaan sistem sesuai mandat.'},
    ],
  },
  {
    label: 'Bantuan dan portal',
    subgroups: [
      {
        id: 'sub-portal',
        label: 'Portal & Bantuan',
        icon: 'globe',
        items: [
          {id:'guide',label:'Panduan pengguna',href:'/panduan.html',icon:'info',audience:'public',footer:true},
          {id:'status',label:'Status layanan',href:'/status.html',icon:'status',audience:'public',footer:true},
          {id:'portal',label:'Portal publik',href:'/',icon:'home',audience:'public'},
        ],
      },
    ],
    items: [
      {id:'login',label:'Masuk petugas',href:'/admin/auth/login.html',icon:'user',audience:'guest'},
    ],
  },
];

for (const group of adminGroups) {
  const attach = (list, subLabel) => {
    for (const item of list) {
      item.href ??= '/admin/app/helpdesk/index.html?kind=' + item.kind;
      item.group = subLabel ? `${group.label} › ${subLabel}` : group.label;
      if (subLabel) item.subgroup = subLabel;
    }
  };
  if (group.subgroups) for (const sub of group.subgroups) attach(sub.items, sub.label);
  if (group.items) attach(group.items);
}

export const adminSubgroups = adminGroups.flatMap(g => g.subgroups ?? []);
export const adminItems = adminGroups.flatMap(g => [
  ...(g.subgroups ? g.subgroups.flatMap(s => s.items) : []),
  ...(g.items ?? []),
]);
export const queueViews = {verification:'Antrean verifikasi',dispatch:'Antrean disposisi','my-tasks':'Tugas saya'};
export { roleLabels } from './admin-profiles.mjs';

export function canNavigate(item, session) {
  if (item.audience === 'public') return true;
  const staff = session?.actor.kind === 'STAFF';
  if (item.audience === 'guest') return !staff;
  if (item.id === 'availability') return session?.actor.kind === 'STAFF' &&
    session.actor.memberships.some(m => m.organization_active &&
      ((m.permissions.includes('identity.grant') && m.permissions.includes('rules.write')) ||
      (session.actor.role === 'COORDINATOR' && m.permissions.includes('ticket.dispatch')) ||
      (session.actor.role === 'TECHNICIAN' && m.permissions.includes('ticket.read') && m.permissions.includes('ticket.resolve'))));
  if (item.id === 'reports' && session?.actor.role === 'TECHNICIAN' &&
      session.actor.memberships.some(m => m.organization_active && m.permissions.includes('ticket.read') && m.permissions.includes('ticket.resolve'))) return true;
  if (item.role && session?.actor.role !== item.role) return false;
  return !!staff && (!item.permissions?.length || session.actor.memberships.some(m =>
    m.organization_active && (!item.organization || m.organization_id === item.organization) && item.permissions.some(p => m.permissions.includes(p))));
}

export function adminPageContext(pathname, search = '', session) {
  const params = new URLSearchParams(search);
  if (pathname === '/admin/' || pathname === '/admin/index.html' || pathname.includes('/dashboard/')) return {item:adminItems[0],title:adminItems[0].label};
  if (pathname.includes('/tickets/')) {
    const item = adminItems.find(i => i.id === 'tickets');
    const detail = pathname.endsWith('/detail.html');
    return {item,title:detail ? 'Detail tiket' : queueViews[params.get('filter')] ?? item.label,detail};
  }
  if (pathname.includes('/helpdesk/')) {
    const kind = params.get('kind');
    const item = kind ? adminItems.find(i => i.kind === kind) : adminItems.find(i => i.kind && canNavigate(i,session));
    return {item,title:item?.label ?? 'Halaman tidak tersedia'};
  }
  return {title:'Ruang petugas'};
}

export function canOpenAdminPage(pathname, search, session) {
  if (session?.actor.kind !== 'STAFF') return false;
  const context = adminPageContext(pathname, search, session);
  return !!context.item && canNavigate(context.item, session);
}

const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function adminNavLink(item, pathname = '', className = 'piui-nav-link') {
  const context = adminPageContext('/admin/' + pathname);
  const current = context.item?.id === item.id ? ` aria-current="${context.detail ? 'location' : 'page'}"` : '';
  return `<a href="${escape(item.href)}" class="${className}" data-admin-nav-id="${item.id}" title="${escape(item.label)}" aria-label="${escape(item.label)}"${current}${item.audience ? '' : ' hidden'}><svg width="20" height="20" aria-hidden="true"><use href="${adminIconHref(item.icon)}"></use></svg><span class="piui-nav-link__text">${escape(item.label)}</span></a>`;
}

function renderSubmenu(sub, pathname) {
  const context = adminPageContext('/admin/' + pathname);
  const hasPublic = sub.items.some(i => i.audience === 'public');
  const hasActive = sub.items.some(i => context.item?.id === i.id);
  const expanded = hasActive;
  return `<li class="hd-nav-submenu-row"${hasPublic ? '' : ' hidden'}><div class="hd-nav-submenu" data-admin-submenu="${escape(sub.id)}" data-open="${expanded ? 'true' : 'false'}"><button type="button" class="piui-nav-link hd-nav-submenu__toggle" aria-expanded="${expanded ? 'true' : 'false'}" title="${escape(sub.label)}"><svg width="20" height="20" aria-hidden="true"><use href="${adminIconHref(sub.icon)}"></use></svg><span class="piui-nav-link__text hd-nav-submenu__label">${escape(sub.label)}</span><svg class="hd-nav-submenu__chevron" width="16" height="16" aria-hidden="true"><use href="/admin/assets/icons/piui-sprite.svg#icon-chevron-down"></use></svg></button><ul class="piui-nav-sublist" aria-label="${escape(sub.label)}"${expanded ? '' : ' hidden'}>${sub.items.map(item => `<li>${adminNavLink(item, pathname)}</li>`).join('')}</ul></div></li>`;
}

export function renderAdminNav(label, pathname) {
  return `<nav aria-label="${label}" data-admin-navigation>${adminGroups.map(g => {
    const groupItems = [...(g.subgroups ? g.subgroups.flatMap(s => s.items) : []), ...(g.items ?? [])];
    const allHidden = groupItems.every(i => !i.audience);
    const subRows = g.subgroups ? g.subgroups.map(sub => renderSubmenu(sub, pathname)).join('') : '';
    const flatRows = (g.items ?? []).map(item => `<li>${adminNavLink(item, pathname)}</li>`).join('');
    return `<div class="piui-sidebar__group-label"${allHidden ? ' hidden' : ''}>${escape(g.label)}</div><ul class="piui-nav-list"${allHidden ? ' hidden' : ''}>${subRows}${flatRows}</ul>`;
  }).join('')}</nav>`;
}

export function renderMasterOptions() {
  const opts = [];
  for (const g of adminGroups) {
    if (g.subgroups) {
      for (const s of g.subgroups) {
        const kids = s.items.filter(i => i.kind);
        if (kids.length) opts.push(`<optgroup label="${escape(g.label + ' — ' + s.label)}">${kids.map(i => `<option value="${i.kind}">${escape(i.label)}</option>`).join('')}</optgroup>`);
      }
    }
    const direct = (g.items ?? []).filter(i => i.kind);
    if (direct.length) opts.push(`<optgroup label="${escape(g.label)}">${direct.map(i => `<option value="${i.kind}">${escape(i.label)}</option>`).join('')}</optgroup>`);
  }
  return opts.join('');
}

export function adminSubjects(subjects) { return subjects.filter(s=>s.kind === 'STAFF'); }
