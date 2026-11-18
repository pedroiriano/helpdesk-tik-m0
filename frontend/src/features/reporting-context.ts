import { api, errorText } from './transport';
import type { Components } from './business-types.generated';

type Entry = Components['DirectoryEntry'];
type DirectoryPage = { items: Entry[]; next_cursor: string | null };

export async function bindReportingContext(form: HTMLFormElement, service: Components['Service'], session?: Components['Session']) {
  const block = form.querySelector<HTMLElement>('[data-report-context]')!;
  const category = form.querySelector<HTMLSelectElement>('#report-category')!;
  const asn = form.querySelector<HTMLInputElement>('#report-asn-guest')!;
  const affiliation = form.querySelector<HTMLElement>('[data-report-affiliation]')!;
  const org = form.querySelector<HTMLSelectElement>('#report-organization')!;
  const division = form.querySelector<HTMLSelectElement>('#report-division')!;
  const query = form.querySelector<HTMLInputElement>('#report-org-search')!;
  const more = form.querySelector<HTMLButtonElement>('[data-report-org-more]')!;
  const moreDivisions = form.querySelector<HTMLButtonElement>('[data-report-division-more]')!;
  const state = form.querySelector<HTMLElement>('[data-report-context-status]')!;
  const loggedASN = session?.actor.kind === 'ASN';
  const mode = loggedASN ? 'asn' : '';
  let orgCursor: string | null = null;
  let divisionCursor: string | null = null;
  let orgEpoch = 0;
  let divisionEpoch = 0;
  const fallbackCategory = 'Belum yakin · ditinjau petugas';

  function listPath(filters: Record<string, string>) {
    return '/reporting/directory?' + new URLSearchParams({ limit:'25', mode, ...filters });
  }
  function appendOptions(select: HTMLSelectElement, items: Entry[]) {
    for (const item of items) {
      if (![...select.options].some(option=>option.value===item.id)) select.add(new Option(item.name,item.id));
    }
  }
  async function loadDivisions(reset: boolean) {
    const epoch = ++divisionEpoch;
    if (reset) {
      division.replaceChildren(new Option('Pilih bidang bila tersedia', ''));
      divisionCursor = null;
    }
    division.disabled = true;
    moreDivisions.hidden = true;
    if (!org.value) return;
    try {
      const page = await api<DirectoryPage>(listPath({ organization_id:org.value, cursor:divisionCursor ?? '' }));
      if (epoch !== divisionEpoch) return;
      appendOptions(division,page.items);
      divisionCursor = page.next_cursor;
      division.disabled = division.options.length <= 1;
      moreDivisions.hidden = !divisionCursor;
      if (division.disabled) state.textContent = 'Belum ada bidang terdaftar untuk organisasi ini.';
    } catch (error) {
      if (epoch === divisionEpoch) state.textContent = errorText(error);
    }
  }
  async function loadOrganizations(reset: boolean) {
    const epoch = ++orgEpoch;
    if (reset) {
      org.replaceChildren(new Option('Pilih PD / Unit Kerja', ''));
      orgCursor = null;
      void loadDivisions(true);
    }
    org.disabled = true;
    more.hidden = true;
    state.textContent = 'Memuat PD / Unit Kerja…';
    try {
      const page = await api<DirectoryPage>(listPath({ q:query.value.trim(), cursor:orgCursor ?? '' }));
      if (epoch !== orgEpoch) return;
      appendOptions(org,page.items);
      orgCursor = page.next_cursor;
      more.hidden = !orgCursor;
      org.disabled = false;
      state.textContent = org.options.length > 1 ? '' : 'Tidak ada PD / Unit Kerja yang cocok.';
      if (loggedASN && !orgCursor && org.options.length === 2 && !query.value && !org.value) {
        org.selectedIndex = 1;
        void loadDivisions(true);
      }
    } catch (error) {
      if (epoch === orgEpoch) state.textContent = errorText(error);
    }
  }
  async function toggleAffiliation() {
    const enabled = loggedASN || asn.checked;
    affiliation.hidden = !enabled;
    org.required = enabled;
    if (enabled) await loadOrganizations(true);
    else {
      ++orgEpoch;
      ++divisionEpoch;
      org.disabled = division.disabled = true;
      org.value = division.value = '';
      state.textContent = '';
    }
  }
  asn.closest<HTMLElement>('[data-report-asn-choice]')!.hidden = Boolean(session);
  asn.addEventListener('change',()=>void toggleAffiliation());
  org.addEventListener('change',()=>{state.textContent='';void loadDivisions(true);});
  let searchTimer: number | undefined;
  query.addEventListener('input',()=>{
    window.clearTimeout(searchTimer);
    searchTimer=window.setTimeout(()=>{if (!affiliation.hidden) void loadOrganizations(true);},250);
  });
  more.addEventListener('click',()=>void loadOrganizations(false));
  moreDivisions.addEventListener('click',()=>void loadDivisions(false));

  category.replaceChildren(new Option(fallbackCategory, ''));
  block.hidden = false;
  const categories = await api<Components['ReportingCategories']>('/reporting/services/' + service.id + '/categories').catch(()=>undefined);
  if (categories) {
    appendOptions(category, [...categories.items].sort((a,b)=>a.name.localeCompare(b.name,'id')));
    if (categories.suggested_id && categories.items.some(item=>item.id===categories.suggested_id && !item.name.startsWith('Bantuan TIK lainnya'))) {
      category.value = categories.suggested_id;
    }
  }
  category.disabled = !categories;
  if (!categories) category.nextElementSibling!.textContent = 'Kategori belum dapat dimuat. Petugas akan meninjau deskripsi laporan.';
  await toggleAffiliation();
  const enabled = () => loggedASN || asn.checked;
  return {
    valid() {
      if (!enabled() || (org.value && !org.disabled)) return true;
      state.textContent = 'Pilih PD / Unit Kerja sebelum melanjutkan.';
      (org.disabled ? query : org).focus();
      return false;
    },
    payload(): Pick<Components['TicketCreate'],'reported_category_id'|'reporting_org_id'|'reporting_division_id'> {
      return {
        ...(category.value ? {reported_category_id:category.value} : {}),
        ...(enabled() && org.value ? {reporting_org_id:org.value} : {}),
        ...(enabled() && division.value ? {reporting_division_id:division.value} : {}),
      };
    },
    review(add: (label: string, value: string) => void) {
      add('Kategori laporan', category.selectedOptions[0]?.textContent ?? fallbackCategory);
      if (enabled() && org.value) add(loggedASN ? 'Perangkat daerah akun ASN' : 'Perangkat daerah pelapor · belum terverifikasi', org.selectedOptions[0]?.textContent ?? '');
      if (enabled() && division.value) add('Bidang', division.selectedOptions[0]?.textContent ?? '');
    },
  };
}
