export function applyReportLink(org: HTMLSelectElement, from: HTMLInputElement, to: HTMLInputElement) {
  const query = new URLSearchParams(location.search);
  const organization = query.get('organization_id') ?? '';
  const lower = Date.parse(query.get('from') ?? '');
  const upper = Date.parse(query.get('to') ?? '');
  if (![...org.options].some(option => option.value === organization) ||
      !Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower || upper - lower > 31 * 86400000) return;
  const wibInput = (time: number) => new Date(time + 7 * 3600000).toISOString().slice(0, -1);
  org.value = organization;
  from.value = wibInput(lower);
  to.value = wibInput(upper);
}
