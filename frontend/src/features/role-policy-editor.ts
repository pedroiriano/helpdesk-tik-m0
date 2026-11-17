import { roleLabels } from '../../admin-profiles.mjs';
import { permissionLabels } from './admin-access';
import { api, errorText, durableIntent } from './transport';
import type { Components } from './business-types.generated';

const groups: [string, string[]][] = [
  ['Akun, organisasi dan peran',['identity.','session.']],
  ['Katalog dan aturan penugasan',['catalog.','rules.']],
  ['Tiket, penugasan dan eskalasi',['ticket.','draft.']],
  ['Banner Hero',['hero.']],
  ['Panduan dan artikel',['content.']],
  ['Pustaka media',['media.']],
  ['Notifikasi',['notification.']],
  ['Laporan dan jejak audit',['report.','audit.']],
  ['Pemeliharaan dan sistem',['system.','operation.']],
];

export async function showRolePolicies(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>('form')!;
  const roles = form.querySelector<HTMLSelectElement>('select')!;
  const choices = form.querySelector<HTMLElement>('[data-role-choices]')!;
  const reason = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const feedback = form.querySelector<HTMLElement>('[role="status"]')!;
  const sender = durableIntent<Components['RolePolicyWrite']>();
  let entries: Components['RolePolicy'][] = [];
  let saving = false;

  function render() {
    const item = entries.find(p => p.role === roles.value);
    choices.replaceChildren();
    reason.value = '';
    reason.disabled = !item?.editable;
    submit.disabled = !item?.editable;
    if (!item) return;
    for (const [label, prefixes] of [...groups, ['Akses lain',[]] as [string,string[]]]) {
      const permissions = item.available.filter(p => prefixes.length
        ? prefixes.some(prefix=>p.startsWith(prefix))
        : !groups.some(([,values])=>values.some(prefix=>p.startsWith(prefix))));
      if (!permissions.length) continue;
      const grid = document.createElement('fieldset');
      grid.className = 'hd-role-permissions';
      const legend = document.createElement('legend');
      legend.textContent = label;
      grid.append(legend);
      for (const permission of permissions) {
        const option = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox'; input.name = 'permissions'; input.value = permission;
        input.checked = item.permissions.includes(permission);
        input.disabled = !item.editable;
        option.append(input, document.createTextNode(permissionLabels[permission] ?? permission));
        grid.append(option);
      }
      choices.append(grid);
    }
    feedback.textContent = item.editable ? (item.version ? `Kebijakan versi ${item.version}.` : 'Menggunakan kebijakan bawaan.')
      : 'Hak inti Super Admin dilindungi.';
  }
  async function load() {
    const previous = roles.value;
    roles.disabled = submit.disabled = true;
    try {
      entries = (await api<Components['RolePolicies']>('/admin/role-policies')).items;
      roles.replaceChildren(...entries.map(p=>new Option(roleLabels[p.role] ?? p.role,p.role)));
      if (entries.some(p=>p.role===previous)) roles.value=previous;
      roles.disabled = false;
      render();
    } catch (error) { feedback.textContent = errorText(error); }
  }
  roles.addEventListener('change', render);
  section.querySelector('[data-role-refresh]')?.addEventListener('click',()=>{if (!saving) void load();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const item = entries.find(p=>p.role===roles.value);
    if (saving || !item?.editable || !form.reportValidity()) return;
    const payload: Components['RolePolicyWrite'] = {expected_version:item.version,
      permissions:new FormData(form).getAll('permissions').map(String),reason:reason.value.trim()};
    const path = '/admin/role-policies/'+encodeURIComponent(item.role);
    saving=true;
    roles.disabled=submit.disabled=true;
    try {
      const result=await sender(path,payload,(key,body)=>api<Components['Receipt']>(path,'PUT',body,key));
      item.version=result.version;
      item.permissions=payload.permissions;
      render();
      feedback.textContent=`Kebijakan tersimpan. Versi ${result.version}. Berlaku pada permintaan akun berikutnya.`;
    } catch (error) {feedback.textContent=errorText(error);}
    finally {saving=false;roles.disabled=submit.disabled=false;}
  });
  await load();
}
