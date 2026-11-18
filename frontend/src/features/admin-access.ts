import { primaryProfiles, specialProfiles, profileForRole, subjectsForProfile, roleLabels, delegationOptions, standardAccess } from '../../admin-profiles.mjs';
import { api, errorText } from './transport';
import type { Components } from './business-types.generated';

type Session = Components['Session'];
type Subject = Components['Subject'];
type Binding = Partial<Components['Membership']>;
export const permissionLabels: Record<string,string> = {
  'ticket.read':'Membaca tiket sesuai cakupan',
  'ticket.create':'Membuat laporan','ticket.verify':'Memverifikasi laporan','ticket.dispatch':'Menugaskan teknisi',
  'ticket.resolve':'Mengajukan hasil penanganan','ticket.comment':'Menulis percakapan','ticket.attach':'Melampirkan bukti',
  'ticket.transition':'Memperbarui status sesuai alur','ticket.confirm':'Mengonfirmasi hasil sebagai pemohon',
  'ticket.vendor':'Mencatat tindak lanjut vendor','ticket.escalate':'Mengajukan eskalasi','ticket.worklog':'Mencatat pekerjaan',
  'ticket.bulk':'Menindaklanjuti beberapa tiket','ticket.pause':'Menyetujui jeda SLA','ticket.handoff':'Mengajukan perpindahan OPD',
  'ticket.handoff.accept':'Menerima perpindahan OPD','ticket.archive':'Mengarsipkan tiket',
  'identity.grant':'Mengelola keanggotaan dan akses','identity.organization.create':'Membuat organisasi',
  'catalog.write':'Mengelola layanan','rules.write':'Mengelola aturan layanan',
  'system.health':'Memeriksa kesehatan sistem','system.maintenance':'Mengelola pemeliharaan','system.job':'Mengajukan pekerjaan sistem',
  'system.purge.request':'Mengajukan purge terkendali','report.read':'Melihat laporan kinerja','report.export':'Mengekspor laporan',
  'audit.read':'Membaca jejak audit','content.read':'Membaca konten berizin','content.write':'Menyusun konten','content.publish':'Menerbitkan konten',
  'media.read':'Membaca media berizin','media.write':'Mengunggah media','media.reuse':'Menggunakan ulang media berizin',
  'notification.read':'Membaca notifikasi','notification.binding':'Mengatur kanal notifikasi',
  'draft.read':'Membaca draf sendiri','draft.write':'Menyimpan draf sendiri','session.read':'Melihat sesi','session.revoke':'Mencabut sesi',
  'operation.read':'Membaca hasil proses berizin',
  'hero.write':'Mengubah draf Banner Hero','hero.publish':'Menerbitkan Banner Hero',
  'identity.role.manage':'Mengelola kebijakan akses peran',
};

export function bindAccessEditor(form: HTMLFormElement, session: Session, subjects: Subject[]) {
  const get = <T extends HTMLElement>(selector:string) => form.querySelector<T>(selector)!;
  const primary = get<HTMLSelectElement>('#hd-access-profile');
  const special = get<HTMLSelectElement>('#hd-access-special');
  const account = get<HTMLSelectElement>('#hd-member-subject');
  const organization = get<HTMLSelectElement>('#hd-org');
  const permissions = get<HTMLTextAreaElement>('#hd-permissions');
  const choices = get('[data-hd-access-choices]');
  const summary = get('[data-hd-access-summary]');
  const feedback = get('[data-hd-access-feedback]');
  const standard = get<HTMLButtonElement>('[data-hd-access-standard]');
  const selectedSubject = () => subjects.find(s=>s.id === account.value);
  const selectedPermissions = () => [...new Set(permissions.value.split(',').map(p=>p.trim()).filter(Boolean))];
  let editing = false;
  let livePermissions: string[] | undefined;
  let policyEpoch = 0;

  function allowedFor(role: string) {
    return livePermissions ? delegationOptions(session,organization.value,role,livePermissions) : [];
  }
  function defaultsFor(role: string) {
    return livePermissions ? standardAccess(session,organization.value,role,livePermissions) : [];
  }
  async function loadPolicy() {
    const epoch = ++policyEpoch;
    livePermissions = undefined;
    draw();
    const subject = selectedSubject();
    if (!subject) return;
    try {
      const current = await api<Components['AssignableRole']>('/admin/assignable-role/' + encodeURIComponent(subject.role));
      if (epoch !== policyEpoch) return;
      livePermissions = current.permissions;
      draw();
    } catch (error) {
      if (epoch === policyEpoch) feedback.textContent = errorText(error);
    }
  }
  function draw() {
    const subject = selectedSubject();
    const allowed = allowedFor(subject?.role ?? '');
    const selected = selectedPermissions();
    const org = organization.selectedOptions[0]?.textContent ?? 'Organisasi belum dipilih';
    summary.textContent = subject
      ? `${roleLabels[subject.role] ?? 'Akses khusus'} · ${subject.name} · ${org}. ${selected.length} izin terpilih. ${primaryProfiles.find(p=>p.roles.includes(subject.role))?.description ?? 'Akses mengikuti mandat akun dan organisasi.'}`
      : 'Pilih profil tugas, akun, dan organisasi. Belum ada akses yang diberikan.';
    standard.disabled = !subject || !defaultsFor(subject.role).length;
    choices.replaceChildren();
    for (const permission of allowed) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=selected.includes(permission);
      checkbox.setAttribute('data-access-permission',permission);
      const text = document.createElement('span'); text.textContent=permissionLabels[permission] ?? permission;
      label.append(checkbox,text);
      checkbox.addEventListener('change',()=>{
        const values = new Set(selectedPermissions());
        if (checkbox.checked) values.add(permission); else values.delete(permission);
        permissions.value=[...values].join(', '); feedback.textContent='Pilihan berubah. Periksa ringkasan sebelum menyimpan.'; draw();
      });
      choices.append(label);
    }
    const blocked = selected.filter(p=>!allowed.includes(p));
    if (livePermissions && blocked.length) feedback.textContent=`${blocked.length} izin berada di luar kebijakan atau mandat delegasi saat ini. Sesuaikan pilihan sebelum menyimpan.`;
  }
  const allAssignableSubjects = () => subjects.filter(s => s.role !== 'VENDOR');
  function filterAccounts() {
    const profileKey = primary.value || special.value;
    const list = profileKey ? subjectsForProfile(subjects, profileKey) : allAssignableSubjects();
    account.replaceChildren(new Option('Pilih akun pengguna', ''), ...list.map(s => new Option(`${s.name} · ${roleLabels[s.role] ?? 'Akses khusus'}`, s.id)));
    permissions.value = '';
    feedback.textContent = list.length ? 'Pilih akun, lalu gunakan akses standar atau pengaturan lanjutan.' : 'Belum ada akun untuk profil ini. Peran akun harus disiapkan melalui pengelolaan identitas yang berwenang.';
    void loadPolicy();
  }
  primary.addEventListener('change',()=>{special.value='';filterAccounts();});
  special.addEventListener('change',()=>{primary.value='';filterAccounts();});
  account.addEventListener('change',()=>{if (!editing) permissions.value='';feedback.textContent='Akun dipilih. Periksa organisasi dan pilih akses yang akan diberikan.';void loadPolicy();});
  organization.addEventListener('change',()=>{if (!editing) permissions.value='';feedback.textContent='Organisasi berubah. Pilih ulang akses sesuai mandat organisasi ini.';draw();});
  permissions.addEventListener('input',()=>{feedback.textContent='';draw();});
  standard.addEventListener('click',()=>{
    const subject=selectedSubject(); if(!subject) return;
    permissions.value=defaultsFor(subject.role).join(', ');
    feedback.textContent='Akses standar disiapkan. Belum disimpan ke server. Izin operasional sistem berisiko tetap melalui pengaturan lanjutan.';
    draw();
  });
  return {
    reset(row?:Binding) {
      editing=Boolean(row); feedback.textContent='';
      const subject=subjects.find(s=>s.id === row?.subject_id);
      const profile=subject ? profileForRole(subject.role) : undefined;
      primary.value=profile && primaryProfiles.some(p=>p.id===profile.id) ? profile.id : '';
      special.value=profile && specialProfiles.some(p=>p.id===profile.id) ? profile.id : '';
      get<HTMLDetailsElement>('[data-hd-field="access-special"]').open=Boolean(special.value);
      primary.disabled=special.disabled=account.disabled=organization.disabled=editing;
      const profileKey = primary.value || special.value;
      const list = profileKey ? subjectsForProfile(subjects, profileKey) : allAssignableSubjects();
      account.replaceChildren(new Option('Pilih akun pengguna',''),...list.map(s=>new Option(`${s.name} · ${roleLabels[s.role] ?? 'Akses khusus'}`,s.id)));
      if(row?.subject_id && !subject) account.add(new Option('Akun tersimpan · identitas belum tersedia',row.subject_id));
      account.value=row?.subject_id ?? '';
      permissions.value=row?.permissions?.join(', ') ?? '';
      get<HTMLDetailsElement>('[data-hd-field="permissions"]').open=false;
      const grid=get('.hd-form-grid');
      for(const name of ['access-profile','access-special','member-subject','org','team','expires','access-summary','permissions','reason','revoked']) {
        const field=form.querySelector<HTMLElement>(`[data-hd-field="${name}"]`);if(field)grid.append(field);
      }
      void loadPolicy();
    },
    validate() {
      const subject=selectedSubject();
      const scope=session.actor.memberships.some(m=>m.organization_active && m.organization_id===organization.value && m.permissions.includes('identity.grant'));
      if (!subject || !scope || !livePermissions || !selectedPermissions().every(p=>allowedFor(subject.role).includes(p))) {
        feedback.textContent='Akun, organisasi, atau izin tidak sesuai mandat Anda. Periksa pilihan; perubahan belum dikirim.';
        summary.tabIndex=-1;summary.focus();return false;
      }
      return true;
    },
  };
}
