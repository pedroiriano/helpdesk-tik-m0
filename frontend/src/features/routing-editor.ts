import { api, APIError, errorText, intent } from './transport';
import type { Components } from './business-types.generated';

type Service = Pick<Components['Service'],'id'|'owner_org_id'>;
type Page<T> = {items:T[];next_cursor:string|null};

export function bindRoutingEditor(form: HTMLFormElement, session: Components['Session']) {
  const find = <T extends HTMLElement>(selector: string) => form.querySelector<T>(selector)!;
  const tier = find<HTMLSelectElement>('[name="tier"]');
  const category = find<HTMLSelectElement>('[name="category"]');
  const organization = find<HTMLSelectElement>('[name="organization"]');
  const team = find<HTMLSelectElement>('[name="team"]');
  const skills = find<HTMLInputElement>('[name="skills"]');
  const reason = find<HTMLInputElement>('[name="reason"]');
  const active = find<HTMLInputElement>('[name="active"]');
  const submit = find<HTMLButtonElement>('[type="submit"]');
  const feedback = find<HTMLElement>('[role="status"]');
  let service: Service | undefined;
  let epoch = 0, teamEpoch = 0, version = 0;
  let saving = false;
  const idempotency = intent();
  const orgs = new Set(session.actor.memberships.filter(m=>m.organization_active &&
    m.permissions.includes('catalog.write') && m.permissions.includes('rules.write')).map(m=>m.organization_id));

  function path() {
    return `/admin/services/${service?.id}/routing/${tier.value}` +
      (category.value ? '?category_id='+encodeURIComponent(category.value) : '');
  }
  async function loadTeams(pick = '') {
    const stamp = ++teamEpoch;
    team.replaceChildren(new Option('Pilih tim aktif',''));
    if (!organization.value) return;
    const page = await api<Page<Components['Team']>>('/admin/teams?limit=100&organization_id='+encodeURIComponent(organization.value));
    if (stamp !== teamEpoch) return;
    for (const item of page.items.filter(t=>t.active)) team.add(new Option(item.name,item.id));
    team.value = pick;
  }
  async function loadRule() {
    if (!service) return;
    const stamp = ++epoch;
    submit.disabled = true;
    feedback.textContent = 'Memuat aturan penugasan…';
    try {
      const rule = await api<Components['RoutingRule']>(path()).catch(error=>{
        if (error instanceof APIError && error.status === 404) return undefined;
        throw error;
      });
      if (stamp !== epoch) return;
      version = rule?.version ?? 0;
      organization.value = rule?.target_org_id ?? service.owner_org_id;
      if (!organization.value) throw new Error('Tujuan di luar mandat');
      skills.value = rule?.required_skills.join(', ') ?? '';
      active.checked = rule?.active ?? true;
      reason.value = '';
      await loadTeams(rule?.team_id);
      if (stamp !== epoch) return;
      feedback.textContent = version ? `Aturan versi ${version}.` : 'Belum ada aturan untuk pilihan ini.';
      submit.disabled = false;
    } catch (error) {
      if (stamp === epoch) feedback.textContent = error instanceof APIError ? errorText(error) : 'Tim atau perangkat daerah tujuan belum dapat dimuat dalam mandat Anda.';
    }
  }
  for (const el of [tier,category]) el.addEventListener('change',()=>void loadRule());
  organization.addEventListener('change',()=>void loadTeams().catch(error=>{feedback.textContent=errorText(error);}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!service || saving || submit.disabled || !form.reportValidity()) return;
    const stamp = epoch;
    const url = path();
    const body: Components['RoutingInput'] = {
      expected_version:version, team_id:team.value, required_skills:skills.value.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),
      active:active.checked, reason:reason.value.trim(),
      ...(organization.value !== service.owner_org_id ? {target_org_id:organization.value} : {}),
    };
    if (!category.value && body.target_org_id) {
      feedback.textContent = 'Pilih kategori untuk tujuan lintas perangkat daerah.';
      return;
    }
    saving = true;
    submit.disabled = true;
    try {
      const saved = await api<Components['RoutingRule']>(url,'PUT',body,idempotency(url,body));
      if (stamp === epoch) {
        version = saved.version;
        feedback.textContent = `Aturan tersimpan. Versi ${version}.`;
      }
    } catch (error) { if (stamp === epoch) feedback.textContent = errorText(error); }
    finally { saving = false; if (stamp === epoch) submit.disabled = false; }
  });
  return async (selected?: Service) => {
    const stamp = ++epoch;
    ++teamEpoch;
    service = selected && orgs.has(selected.owner_org_id) ? selected : undefined;
    form.hidden = !service;
    if (!service) return;
    form.reset();
    submit.disabled = true;
    category.replaceChildren(new Option('Aturan bawaan layanan',''));
    organization.replaceChildren(new Option('Memuat perangkat daerah…',''));
    team.replaceChildren(new Option('Pilih tim aktif',''));
    try {
      const [categories, available] = await Promise.all([
        api<Page<Components['Category']>>('/admin/categories?limit=100&organization_id='+encodeURIComponent(service.owner_org_id)),
        api<Page<Components['Organization']>>('/admin/organizations?limit=100'),
      ]);
      if (stamp !== epoch) return;
      for (const item of categories.items.filter(c=>c.active)) category.add(new Option(item.name,item.id));
      organization.replaceChildren(...available.items.filter(o=>orgs.has(o.id) && o.active).map(o=>new Option(o.name,o.id)));
      await loadRule();
    } catch (error) { if (stamp === epoch) feedback.textContent = errorText(error); }
  };
}
