import { openAdminConfirmDialog } from './admin-confirm';
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
  const modules = form.querySelector<HTMLSelectElement>('#hd-role-module')!;
  const scope = form.querySelector<HTMLElement>('[data-role-scope]')!;
  const changes = form.querySelector<HTMLElement>('[data-role-changes]')!;
  const summary = form.querySelector<HTMLElement>('[data-role-summary]')!;
  const reviewLink = form.querySelector<HTMLAnchorElement>('[data-role-review-link]')!;
  const editor = form.querySelector<HTMLElement>('[data-role-editor]')!;
  const choices = form.querySelector<HTMLElement>('[data-role-choices]')!;
  const reason = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const feedback = form.querySelector<HTMLElement>('[data-role-feedback]')!;
  const sender = durableIntent<Components['RolePolicyWrite']>();
  let entries: Components['RolePolicy'][] = [];
  let saving = false;

  const selected = () => entries.find(p => p.role === roles.value);
  const permissionsInForm = () => new FormData(form).getAll('permissions').map(String);
  const changeSet = (item: Components['RolePolicy']) => {
    const permissions = permissionsInForm();
    return {
      permissions,
      added: permissions.filter(p => !item.permissions.includes(p)),
      removed: item.permissions.filter(p => !permissions.includes(p)),
    };
  };
  const updateChanges = () => {
    const item = selected();
    for (const group of choices.querySelectorAll('[data-role-module]')) {
      group.querySelector('[data-role-checked]')!.textContent =
        group.querySelectorAll('input:checked').length + ' izin aktif';
    }
    if (!item?.editable) {
      summary.hidden = editor.hidden = submit.disabled = true;
      return;
    }
    const {added, removed} = changeSet(item);
    const changed = added.length + removed.length > 0;
    summary.hidden = false;
    reviewLink.hidden = submit.disabled = !changed;
    changes.textContent = changed
      ? added.length + ' izin ditambahkan · ' + removed.length + ' izin dicabut'
      : 'Belum ada perubahan izin.';
  };

  function render() {
    const item = selected();
    const previousModule = modules.value;
    choices.replaceChildren();
    modules.replaceChildren(new Option('Semua modul',''));
    modules.disabled = !item;
    scope.textContent = item ? 'Berlaku untuk peran ' + roles.selectedOptions[0].text
      + ' sesuai mandat PD masing-masing akun.' : '';
    reason.value = '';
    editor.hidden = reason.disabled = !item?.editable;
    if (!item) { updateChanges(); return; }
    for (const [label, prefixes] of [...groups, ['Akses lain',[]] as [string,string[]]]) {
      const permissions = item.available.filter(p => prefixes.length
        ? prefixes.some(prefix=>p.startsWith(prefix))
        : !groups.some(([,values])=>values.some(prefix=>p.startsWith(prefix))));
      if (!permissions.length) continue;
      const module = document.createElement('details');
      module.className = 'hd-role-module';
      module.dataset.roleModule = label;
      const title = document.createElement('summary');
      const name = document.createElement('span');
      name.textContent = label;
      const count = document.createElement('span');
      count.dataset.roleChecked = '';
      title.append(name, count);
      const grid = document.createElement('fieldset');
      grid.className = 'hd-role-permissions';
      modules.add(new Option(label,label));
      const legend = document.createElement('legend');
      legend.textContent = label;
      legend.className = 'u-sr-only';
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
      module.append(title,grid);
      choices.append(module);
    }
    if ([...modules.options].some(option => option.value === previousModule)) modules.value = previousModule;
    filterModule();
    updateChanges();
    feedback.textContent = item.editable ? (item.version ? `Kebijakan versi ${item.version}.` : 'Menggunakan kebijakan bawaan.')
      : 'Hak inti Super Admin dilindungi.';
  }
  function filterModule() {
    for (const group of choices.querySelectorAll<HTMLDetailsElement>('[data-role-module]')) {
      group.hidden = Boolean(modules.value) && group.dataset.roleModule !== modules.value;
      if (modules.value && !group.hidden) group.open = true;
    }
  }
  modules.addEventListener('change', filterModule);
  choices.addEventListener('change', updateChanges);
  reviewLink.addEventListener('click', event => {
    event.preventDefault();
    reason.focus();
  });

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
  form.addEventListener('submit', event => {
    event.preventDefault();
    const item = selected();
    if (saving || !item?.editable || !form.reportValidity()) return;
    const {permissions, added, removed} = changeSet(item);
    const payload: Components['RolePolicyWrite'] = {expected_version:item.version, permissions, reason:reason.value.trim()};
    const path = '/admin/role-policies/'+encodeURIComponent(item.role);
    const role = roles.selectedOptions[0].text;
    openAdminConfirmDialog({
      title:'Tinjau kebijakan ' + role,
      description:scope.textContent ?? '',
      details:[
        'Ditambahkan: ' + (added.map(p => permissionLabels[p] ?? p).join(', ') || 'Tidak ada'),
        'Dicabut: ' + (removed.map(p => permissionLabels[p] ?? p).join(', ') || 'Tidak ada'),
        'Alasan: ' + payload.reason,
      ],
      confirmLabel:'Simpan kebijakan',
      confirmTone:removed.length ? 'warn' : 'primary',
      onConfirm:async () => {
        saving = roles.disabled = submit.disabled = true;
        try {
          const result = await sender(path,payload,(key,body)=>api<Components['Receipt']>(path,'PUT',body,key));
          item.version = result.version;
          item.permissions = payload.permissions;
          render();
          feedback.textContent = 'Kebijakan tersimpan. Versi ' + result.version + '. Berlaku pada permintaan akun berikutnya.';
        } catch (error) {
          throw new Error(errorText(error));
        } finally {
          saving = roles.disabled = false;
          updateChanges();
        }
      },
    });
  });
  await load();
}
