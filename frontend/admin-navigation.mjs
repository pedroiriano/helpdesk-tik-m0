// One task map for the native PIUI sidebar, drawer, footer, page context and palette.
export const adminGroups = [
  {label:'Pekerjaan', items:[
    {id:'dashboard',label:'Dasbor petugas',href:'/admin/app/dashboard/index.html',icon:'dashboard',description:'Pilih pekerjaan dan pantau ringkasan sesuai tugas Anda.',footer:true},
    {id:'tickets',label:'Antrean tiket',href:'/admin/app/tickets/index.html',icon:'transactions',permissions:['ticket.read'],description:'Periksa laporan masuk dan lanjutkan penanganan sesuai tugas Anda.',footer:true},
    {id:'notifications',kind:'notifications',label:'Notifikasi',icon:'bell',permissions:['notification.read'],description:'Periksa pemberitahuan dan pengaturan saluran notifikasi lab.'},
  ]},
  {label:'Layanan dan konten', items:[
    {id:'services',kind:'services',label:'Layanan TIK',icon:'components',permissions:['catalog.write'],description:'Kelola layanan, persyaratan, formulir dan kebijakan layanan.'},
    {id:'categories',kind:'categories',label:'Kategori layanan',icon:'components',permissions:['catalog.write'],description:'Kelola kategori yang digunakan saat memeriksa laporan.'},
    {id:'articles',kind:'articles',label:'Panduan dan artikel',icon:'info',permissions:['content.read','content.write','content.publish'],description:'Susun, tinjau dan terbitkan panduan sesuai mandat Anda.'},
    {id:'media',kind:'media',label:'Pustaka media',icon:'gallery',permissions:['media.read','media.write'],description:'Temukan berkas yang boleh diakses dan kelola media sesuai izin.'},
    {id:'hero',kind:'hero',label:'Banner Hero',icon:'gallery',permissions:['hero.write','hero.publish'],organization:'10000000-0000-4000-8000-000000000001',description:'Atur lima banner beranda, simpan draf, lalu terbitkan.'},
    {id:'navigation',kind:'navigation',label:'Menu portal publik',icon:'settings',permissions:['catalog.write'],description:'Atur susunan menu pada portal publik.'},
  ]},
  {label:'Organisasi dan akses', items:[
    {id:'organizations',kind:'organizations',label:'Perangkat daerah dan unit kerja',icon:'users',permissions:['identity.grant'],description:'Kelola perangkat daerah dan unit kerja yang dapat dipilih pelapor.'},
    {id:'divisions',kind:'divisions',label:'Bidang',icon:'users',permissions:['identity.grant'],description:'Kelola bidang aktif di masing-masing perangkat daerah atau unit kerja.'},
    {id:'memberships',kind:'memberships',label:'Akun dan hak akses',icon:'users',permissions:['identity.grant'],description:'Kelola keanggotaan dan hak akses sesuai mandat organisasi Anda.'},
    {id:'role-policies',kind:'role-policies',label:'Peran dan Akses Modul',icon:'users',permissions:['identity.role.manage'],role:'SUPER_ADMIN',description:'Atur tindakan yang boleh diberikan kepada setiap peran.'},
    {id:'teams',kind:'teams',label:'Tim teknis',icon:'users',permissions:['identity.grant'],description:'Kelola tim teknis dan organisasi penanggung jawabnya.'},
  ]},
  {label:'Pengawasan dan sistem', items:[
    {id:'reports',kind:'reports',label:'Laporan kinerja',icon:'analytics',permissions:['report.read'],description:'Tinjau capaian, periode laporan dan ekspor yang diizinkan.'},
    {id:'audit',kind:'audit',label:'Jejak audit',icon:'audit',permissions:['audit.read'],description:'Telusuri catatan aktivitas untuk pemeriksaan.',footer:true},
    {id:'maintenance',kind:'maintenance',label:'Pemeliharaan sistem',icon:'settings',permissions:['system.health','system.maintenance','system.job'],description:'Periksa kesehatan dan jalankan pekerjaan sistem sesuai mandat.'},
  ]},
  {label:'Bantuan dan portal', items:[
    {id:'guide',label:'Panduan pengguna',href:'/panduan.html',icon:'info',audience:'public',footer:true},
    {id:'status',label:'Status layanan',href:'/status.html',icon:'status',audience:'public',footer:true},
    {id:'portal',label:'Portal publik',href:'/',icon:'info',audience:'public'},
    {id:'login',label:'Masuk petugas',href:'/admin/auth/login.html',icon:'user',audience:'guest'},
  ]},
];
for (const group of adminGroups) for (const item of group.items) {
  item.href ??= '/admin/app/helpdesk/index.html?kind=' + item.kind;
  item.group = group.label;
}
export const adminItems = adminGroups.flatMap(g => g.items);
export const queueViews = {verification:'Antrean verifikasi',dispatch:'Antrean disposisi','my-tasks':'Tugas saya'};
export { roleLabels } from './admin-profiles.mjs';

export function canNavigate(item, session) {
  if (item.audience === 'public') return true;
  const staff = session?.actor.kind === 'STAFF';
  if (item.audience === 'guest') return !staff;
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
  return `<a href="${escape(item.href)}" class="${className}" data-admin-nav-id="${item.id}" title="${escape(item.label)}"${current}${item.audience ? '' : ' hidden'}><svg width="20" height="20" aria-hidden="true"><use href="/admin/assets/icons/piui-sprite.svg#icon-${item.icon}"></use></svg><span class="piui-nav-link__text">${escape(item.label)}</span></a>`;
}
export function renderAdminNav(label, pathname) {
  return `<nav aria-label="${label}" data-admin-navigation>${adminGroups.map(g=>`<div class="piui-sidebar__group-label"${g.items.every(i=>!i.audience)?' hidden':''}>${escape(g.label)}</div><ul class="piui-nav-list"${g.items.every(i=>!i.audience)?' hidden':''}>${g.items.map(item=>`<li>${adminNavLink(item,pathname)}</li>`).join('')}</ul>`).join('')}</nav>`;
}
export function renderMasterOptions() {
  return adminGroups.filter(g=>g.items.some(i=>i.kind)).map(g=>`<optgroup label="${escape(g.label)}">${g.items.filter(i=>i.kind).map(i=>`<option value="${i.kind}">${escape(i.label)}</option>`).join('')}</optgroup>`).join('');
}

export function adminSubjects(subjects) { return subjects.filter(s=>s.kind === 'STAFF'); }
