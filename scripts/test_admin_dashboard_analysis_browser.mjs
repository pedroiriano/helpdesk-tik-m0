import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = 'http://127.0.0.1:18090';
assert.equal(process.env.HELPDESK_BASE_URL ?? origin, origin);
const target = origin + '/admin/app/dashboard/index.html';
const evidenceDir = 'qa/remediation/dashboard-analysis-phase2';
const orgOther = '10000000-0000-4000-8000-000000000002';
const { cdp, close } = await launchEdge();
const requests = [];
const errors = [];
cdp.on('Network.requestWillBeSent', e => {
  const url = new URL(e.request.url);
  if (url.origin === origin && url.pathname.startsWith('/api/v1/')) requests.push(url);
});
cdp.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.text));
const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(x => JSON.stringify(x)).join(',') + ')');
const ready = (fn, message) => waitFor(() => evaluate(fn), 12000, message);
const reportRequest = () => requests.findLast(url => url.pathname === '/api/v1/reports' && url.searchParams.get('view') === 'dashboard');
const visible = selector => evaluate(s => Boolean(document.querySelector(s)?.getClientRects().length), selector);
const pageRows = () => evaluate(() => [...document.querySelectorAll('[data-hd-analysis-rows] tr')].map(row => row.dataset.ticketId));
const api = path => evaluate(async endpoint => {
  const r = await fetch('/api/v1' + endpoint, { cache:'no-store' });
  return { status:r.status, noStore:r.headers.get('cache-control'), data:r.ok ? await r.json() : null };
}, path);
const fetchData = async path => {
  const result = await api(path);
  assert.equal(result.status, 200, path);
  return result.data;
};
const sum = (values, key) => values.reduce((total, x) => total + x[key], 0);
const locale = new Intl.NumberFormat('id-ID', { maximumFractionDigits:1 });
const otherStatuses = {};

async function setPeriod() {
  await evaluate(() => {
    document.querySelector('[data-hd-dashboard-settings]').open = true;
    const period = document.querySelector('#hd-dashboard-period');
    period.value = '30';
    period.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await ready(() => document.querySelector('[data-hd-dashboard-range]').textContent === '30 hari terakhir (WIB)' &&
    !document.querySelector('[data-hd-dashboard-analysis]').hidden, 'analisis 30 hari');
  const url = reportRequest();
  assert.ok(url);
  const params = new URLSearchParams(url.searchParams);
  params.delete('view');
  assert.equal(Date.parse(params.get('to')) - Date.parse(params.get('from')), 30 * 86400000);
  return params;
}

function filtered(base, filters) {
  const result = new URLSearchParams(base);
  for (const [key, value] of Object.entries(filters)) result.set(key, value);
  return result;
}

async function traverse(params) {
  const query = filtered(params, { limit:'100' });
  const items = [];
  for (let i = 0; i < 4; i++) {
    const page = await fetchData('/reports/dashboard-tickets?' + query);
    items.push(...page.items);
    if (!page.next_cursor) return items;
    query.set('cursor', page.next_cursor);
  }
  assert.fail('Fixture terlalu besar untuk batas verifikasi');
}

async function assertCrossScope(params) {
  const cross = filtered(params, { organization_id:orgOther });
  for (const [name, endpoint] of Object.entries({
    aggregate:'/reports?' + filtered(cross, {view:'dashboard'}),
    detail:'/reports/dashboard-tickets?' + cross,
    search:'/reports/dashboard-tickets?' + filtered(cross, { q:'internet' }),
  })) {
    otherStatuses[name] = (await api(endpoint)).status;
    assert.equal(otherStatuses[name], 403, name);
  }
  otherStatuses.technical_export = await evaluate(async query =>
    (await fetch('/api/v1/reports/technical-performance.csv?' + query)).status, cross.toString());
  otherStatuses.cohort_export = await evaluate(async payload => {
    const csrf = document.cookie.split('; ').find(item => item.startsWith('helpdesk_csrf='))?.split('=')[1] ?? '';
    return (await fetch('/api/v1/reports/exports', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'X-CSRF-Token':csrf, 'Idempotency-Key':crypto.randomUUID() },
      body:JSON.stringify(payload),
    })).status;
  }, { ...Object.fromEntries(cross), timezone:'Asia/Jakarta', cohort:'ACCEPTED', format:'CSV' });
  assert.equal(otherStatuses.technical_export, 403);
  assert.equal(otherStatuses.cohort_export, 403);
}

try {
  await loginRoleKeyword(cdp, 'Koordinator');
  await cdp.setViewport(1440, 900);
  await cdp.navigate(target);
  await ready(() => !document.querySelector('[data-hd-dashboard-analysis]').hidden, 'dasbor petugas');
  const selected = await setPeriod();
  const org = selected.get('organization_id');
  assert.notEqual(org, orgOther);
  const report = await fetchData('/reports?' + filtered(selected, { view:'dashboard' }));
  const { daily, age, deadline } = report.analytics;
  assert.equal(sum(daily, 'accepted'), report.accepted);
  assert.equal(sum(daily, 'active'), report.backlog);
  assert.equal(sum(daily, 'completed'), report.completed);
  assert.equal(sum(age, 'count'), report.backlog);
  assert.equal(sum(deadline, 'count'), report.backlog);
  const allRows = await traverse(selected);
  assert.equal(allRows.length, report.accepted);
  assert.equal(new Set(allRows.map(row => row.id)).size, allRows.length);
  assert.equal(allRows.filter(row => row.age_seconds !== null).length, report.backlog);
  for (const bucket of deadline) assert.equal(allRows.filter(row => row.deadline === bucket.key).length, bucket.count);
  for (const bucket of age) {
    assert.equal((await traverse(filtered(selected, { segment:bucket.key }))).length, bucket.count);
  }
  assert.equal((await traverse(filtered(selected, { segment:'completed' }))).length, report.completed);
  const snapshot = await evaluate(() => ({
    trend:[...document.querySelectorAll('[data-hd-analysis-daily] tr')].map(row => [...row.cells].slice(1).map(cell => cell.textContent)),
    plot:[...document.querySelectorAll('.hd-trend-count')].map(node => node.textContent),
    labels:[...document.querySelectorAll('[data-hd-analysis-deadline] li')].map(node => node.firstElementChild.textContent),
  }));
  assert.deepEqual(snapshot.trend, daily.map(row => [row.accepted,row.active,row.completed].map(locale.format)));
  assert.deepEqual(snapshot.plot, daily.map(row => locale.format(row.accepted)));
  assert.deepEqual(snapshot.labels.map(label => label.split(' · ').at(-1)), deadline.map(item => locale.format(item.count)));

  await ready(() => document.querySelector('[data-hd-analysis-next]').disabled === false, 'halaman pertama');
  const first = await pageRows();
  await evaluate(() => document.querySelector('[data-hd-analysis-next]').click());
  await ready(() => document.querySelector('[data-hd-analysis-table-status]').textContent.startsWith('Halaman 2'), 'halaman kedua');
  const second = await pageRows();
  assert.ok(!second.some(id => first.includes(id)));
  const needle = allRows.find(row => row.id === second[0]);
  assert.ok(needle && !first.includes(needle.id));
  await evaluate(q => {
    document.querySelector('#hd-analysis-query').value = q;
    document.querySelector('[data-hd-analysis-search]').requestSubmit();
  }, needle.number.toLowerCase());
  await ready(() => document.querySelector('[data-hd-analysis-table-status]').textContent === 'Halaman 1 · 1 tiket', 'hasil pencarian lintas halaman');
  assert.deepEqual(await pageRows(), [needle.id]);
  assert.equal(await evaluate(() => new URL(document.querySelector('[data-hd-analysis-rows] a').href).searchParams.get('id')), needle.id);
  const titleQuery = needle.title.slice(0, 70).trim().toLowerCase();
  assert.ok(titleQuery);
  const byTitle = await traverse(filtered(selected, { q:titleQuery }));
  assert.deepEqual(byTitle.map(row => row.id), allRows.filter(row =>
    row.title.toLowerCase().includes(titleQuery) || row.number.toLowerCase().includes(titleQuery)).map(row => row.id));

  const day = daily.find(row => row.accepted > 0);
  await evaluate(() => document.querySelector('[data-hd-analysis-trend] button').click());
  await ready(() => document.querySelector('[data-hd-analysis-table-status]').textContent.startsWith('Halaman 1'), 'tautan grafik ke tabel');
  const filter = requests.findLast(url => url.pathname === '/api/v1/reports/dashboard-tickets').searchParams;
  for (const key of ['organization_id','from','to']) assert.equal(filter.get(key), selected.get(key));
  assert.equal(filter.get('day'), day.day);
  assert.equal((await traverse(filtered(selected, { day:day.day }))).length, day.accepted);
  await evaluate(() => document.querySelector('[data-hd-dashboard-drill="backlog"]').click());
  await ready(() => document.querySelector('[data-hd-analysis-table-status]').textContent.startsWith('Halaman 1'), 'tautan kartu ke tabel');
  assert.equal(requests.findLast(url => url.pathname === '/api/v1/reports/dashboard-tickets').searchParams.get('segment'), 'active');
  const listACL = await api('/reports/dashboard-tickets?' + filtered(selected, { segment:'invalid' }));
  assert.equal(listACL.status, 400);
  const cacheDirectives = (await api('/reports/dashboard-tickets?' + selected)).noStore.split(',').map(value => value.trim());
  assert.ok(cacheDirectives.length > 0 && cacheDirectives.every(value => value === 'no-store'));

  await ready(() => !document.querySelector('[data-hd-analysis-csv]').hidden &&
    document.querySelector('[data-hd-analysis-capacity-values] dd'), 'integrasi kapasitas dan kinerja');
  const capacityParams = requests.findLast(url => url.pathname === '/api/v1/admin/technical-capacity').searchParams;
  assert.equal(capacityParams.get('organization_id'), org);
  assert.ok(capacityParams.getAll('team_id').length > 0);
  const capacity = await fetchData('/admin/technical-capacity?' + capacityParams);
  const technical = await fetchData('/reports/technical-performance?' + selected);
  assert.equal(await evaluate(() => document.querySelector('[data-hd-analysis-capacity-values] dd').textContent), locale.format(capacity.technicians));
  assert.equal(await evaluate(() => document.querySelector('[data-hd-analysis-performance-values] dd').textContent), locale.format(technical.resolved_tickets));
  const links = await evaluate(() => Object.fromEntries(['csv','cohort-export','roster','performance-link'].map(key =>
    [key, document.querySelector('[data-hd-analysis-' + key + ']').href])));
  for (const name of ['csv','cohort-export','performance-link']) {
    const url = new URL(links[name]);
    for (const key of ['organization_id','from','to']) assert.equal(url.searchParams.get(key), selected.get(key));
  }
  assert.equal(new URL(links.roster).searchParams.get('organization_id'), org);
  const csvResult = await evaluate(async url => {
    const response = await fetch(url);
    return { status:response.status, header:(await response.text()).split('\n')[0] };
  }, links.csv);
  assert.equal(csvResult.status, 200);
  assert.match(csvResult.header, /^from,to,timezone,cohort,organization_id/);
  await assertCrossScope(selected);
  assert.equal((await api('/admin/technical-capacity?' + filtered(capacityParams, {organization_id:orgOther}))).status, 403);

  await cdp.setViewport(390, 844, true);
  const mobile = await evaluate(() => ({
    overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
    chartOverflow:document.querySelector('.hd-trend-scroll').scrollWidth - document.querySelector('.hd-trend-scroll').clientWidth,
  }));
  assert.ok(mobile.overflow <= 1 && mobile.chartOverflow > 0, JSON.stringify(mobile));
  await evaluate(() => document.querySelector('[data-hd-analysis-age] button').focus());
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  await ready(() => document.activeElement?.id === 'hd-analysis-table-title', 'fokus keyboard grafik ke tabel');

  await cdp.navigate(links['performance-link']);
  await ready(() => document.querySelector('[data-hd-technical-report]')?.getClientRects().length, 'rute kinerja teknis dari dasbor');
  const linkForm = await evaluate(() => ({
    organization_id:document.querySelector('#hd-technical-report-org').value,
    from:new Date(document.querySelector('#hd-technical-report-from').value + '+07:00').toISOString(),
    to:new Date(document.querySelector('#hd-technical-report-to').value + '+07:00').toISOString(),
  }));
  for (const [key, value] of Object.entries(linkForm)) assert.equal(value, selected.get(key));
  await cdp.send('Page.navigate', { url:links['cohort-export'] });
  await ready(() => location.hash === '#laporan-sla' && document.querySelector('[data-hd-open-export]')?.getClientRects().length,
    'formulir ekspor cohort dari dasbor');
  const exportForm = await evaluate(() => ({
    organization_id:document.querySelector('#hd-report-org').value,
    from:new Date(document.querySelector('#hd-report-from').value + '+07:00').toISOString(),
    to:new Date(document.querySelector('#hd-report-to').value + '+07:00').toISOString(),
  }));
  for (const [key, value] of Object.entries(exportForm)) assert.equal(value, selected.get(key));

  await logoutSession(cdp);
  await loginRoleKeyword(cdp, 'Super Admin');
  await cdp.navigate(target);
  const restricted = await setPeriod();
  assert.equal(await visible('[data-hd-dashboard-analysis]'), true);
  assert.equal(await visible('[data-hd-analysis-table]'), false);
  assert.equal(await visible('[data-hd-analysis-csv]'), false);
  assert.equal(await visible('[data-hd-analysis-cohort-export]'), false);
  assert.equal((await api('/reports/dashboard-tickets?' + restricted)).status, 403);
  assert.deepEqual(errors, []);

  await mkdir(evidenceDir, { recursive:true });
  await writeFile(evidenceDir + '/browser.json', JSON.stringify({
    result:'PASS', target, period:Object.fromEntries(selected), aggregates:{ accepted:report.accepted, backlog:report.backlog, completed:report.completed, age, deadline },
    reconciled_ticket_rows:allRows.length, searched_from_second_page:true, title_search:true, chart_and_card_drill:true,
    same_filters_in_capacity_performance_export:true, mobile, keyboard_focus:true,
    out_of_mandate:{ ...otherStatuses, capacity:403 }, report_only_account_no_detail_or_exports:true,
  }, null, 2) + '\n');
  console.log('PASS analisis Dasbor: agregat = tabel, drill-down, pencarian lintas halaman, kapasitas/kinerja, mobile, keyboard, mandat dan ekspor.');
} finally {
  try { await logoutSession(cdp); } finally { await close(); }
}
