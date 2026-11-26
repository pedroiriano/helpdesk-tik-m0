import policy from '../contracts/policy/permissions.v1.json' with { type: 'json' };

// Presentation profiles never replace the canonical role or server authorization.
export const primaryProfiles = [
  {id:'operator',label:'Operator',roles:['OPERATOR'],description:'Periksa dan teruskan laporan baru.',permission:'ticket.verify',href:'/admin/app/tickets/index.html?filter=verification',action:'Perlu Verifikasi'},
  {id:'technician',label:'Teknisi',roles:['TECHNICIAN'],description:'Buka tugas dan catat hasil penanganan.',permission:'ticket.resolve',href:'/admin/app/tickets/index.html?filter=my-tasks',action:'Tugas Saya'},
  {id:'coordinator',label:'Koordinator',roles:['COORDINATOR'],description:'Atur penugasan dan tindak lanjuti hambatan.',permission:'ticket.dispatch',href:'/admin/app/tickets/index.html?filter=dispatch',action:'Perlu Keputusan'},
  {id:'leadership',label:'Pimpinan',roles:['LEADERSHIP'],description:'Pantau capaian SLA dan eskalasi.',permission:'report.read',href:'/admin/app/helpdesk/index.html?kind=reports',action:'SLA dan Hambatan'},
  {id:'administrator',label:'Administrator',roles:['ADMIN_OPD','PLATFORM_ADMIN','SUPER_ADMIN'],description:'Kelola akun, akses, dan layanan sesuai mandat.',permission:'identity.grant',href:'/admin/app/helpdesk/index.html?kind=memberships',action:'Master dan Akses'},
];
export const specialProfiles = [
  {id:'editor',label:'Editor konten',roles:['EDITOR']},
  {id:'publisher',label:'Penerbit konten',roles:['PUBLISHER']},
  {id:'auditor',label:'Auditor',roles:['AUDITOR']},
  {id:'requester-asn',label:'Pemohon ASN',roles:['ASN']},
  {id:'requester',label:'Pemohon publik',roles:['PUBLIC']},
];
export const roleLabels = {OPERATOR:'Operator',TECHNICIAN:'Teknisi',COORDINATOR:'Koordinator',LEADERSHIP:'Pimpinan',PLATFORM_ADMIN:'Administrator · Platform',ADMIN_OPD:'Administrator · OPD',SUPER_ADMIN:'Administrator · Super Admin',AUDITOR:'Auditor',EDITOR:'Editor konten',PUBLISHER:'Penerbit konten',PUBLIC:'Pemohon',ASN:'Pemohon ASN'};
export const profileForRole = role => [...primaryProfiles,...specialProfiles].find(p=>p.roles.includes(role));
export const subjectsForProfile = (subjects,id) => {
  const profile = [...primaryProfiles,...specialProfiles].find(p=>p.id === id);
  return profile ? subjects.filter(s=>profile.roles.includes(s.role) && s.kind === (id === 'requester-asn' ? 'ASN' : id === 'requester' ? 'PUBLIC' : 'STAFF')) : [];
};
export function quickLoginSubject(subjects,id) {
  const candidates=subjectsForProfile(subjects,id);
  return id === 'administrator' ? candidates.find(s=>s.role === 'ADMIN_OPD') ?? candidates.find(s=>s.role === 'PLATFORM_ADMIN') : candidates[0];
}
export function delegationOptions(session, organization, role, currentPermissions) {
  const memberships = session?.actor.kind === 'STAFF' ? session.actor.memberships.filter(m=>m.organization_active && m.organization_id === organization && m.permissions.includes('identity.grant')) : [];
  const ceiling = new Set(memberships.flatMap(m=>m.grant_ceiling));
  return (currentPermissions ?? policy.roles[role]?.permissions ?? []).filter(p=>ceiling.has(p));
}
// Sensitive platform jobs, purge and organization creation require explicit advanced choices.
const advancedOnly = new Set(['system.purge.request','system.job','system.maintenance','identity.organization.create','identity.role.manage','hero.publish','content.publish']);
export const standardAccess = (session,organization,role,currentPermissions) => delegationOptions(session,organization,role,currentPermissions).filter(p=>!advancedOnly.has(p));
export const accessIsAllowed = (session,organization,role,permissions) => {
  const allowed = delegationOptions(session,organization,role);
  return !!session && session.actor.kind === 'STAFF' && session.actor.memberships.some(m=>m.organization_active && m.organization_id === organization && m.permissions.includes('identity.grant')) && !!profileForRole(role) && permissions.every(p=>allowed.includes(p));
};
export function workStart(session) {
  const role = session?.actor.role;
  const profile = profileForRole(role);
  const can = permission => session?.actor.kind === 'STAFF' && session.actor.memberships.some(m=>m.organization_active && m.permissions.includes(permission));
  if (profile && primaryProfiles.includes(profile)) {
    if (can(profile.permission)) return profile;
    if (profile.id === 'administrator' && can('catalog.write')) return {...profile,href:'/admin/app/helpdesk/index.html?kind=services',action:'Kelola layanan'};
  }
  if (role === 'EDITOR' && can('content.write')) return {...profile,description:'Susun dan tinjau panduan layanan.',href:'/admin/app/helpdesk/index.html?kind=articles',action:'Kelola Panduan'};
  if (role === 'PUBLISHER' && can('content.publish')) return {...profile,description:'Tinjau panduan sebelum diterbitkan.',href:'/admin/app/helpdesk/index.html?kind=articles',action:'Tinjau Penerbitan'};
  if (role === 'AUDITOR' && can('audit.read')) return {...profile,description:'Telusuri aktivitas dalam mandat audit.',href:'/admin/app/helpdesk/index.html?kind=audit',action:'Jejak Audit'};
  return {label:profile?.label ?? 'Petugas',description:profile ? 'Buka menu sesuai tugas dan hak akses akun Anda.' : 'Periksa penugasan dan hak akses bersama Administrator.',href:'/panduan.html',action:'Buka panduan pengguna'};
}
