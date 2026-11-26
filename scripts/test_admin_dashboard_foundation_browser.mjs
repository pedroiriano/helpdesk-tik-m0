import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = 'http://127.0.0.1:18090';
assert.equal(process.env.HELPDESK_BASE_URL ?? origin, origin);
const dashboard = origin + '/admin/app/dashboard/index.html';
const evidenceDir = 'qa/remediation/dashboard-foundation-phase1';
const day = 86_400_000;
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits:1 });
const date = new Intl.DateTimeFormat('id-ID', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Jakarta' });
const { cdp, close } = await launchEdge();
const requests = [];
cdp.on('Network.requestWillBeSent', event => {
  const url = new URL(event.request.url);
  if (url.origin === origin && url.pathname === '/api/v1/reports') requests.push({ id:event.requestId, url });
});
const responses = new Map();
cdp.on('Network.responseReceived', event => {
  if (requests.some(request => request.id === event.requestId)) responses.set(event.requestId, event.response.status);
});
const errors = [];
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));

const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const visible = selector => evaluate(sel => Boolean(document.querySelector(sel)?.getClientRects().length), selector);
const summary = '[data-hd-dashboard-settings] summary';
const results = '[data-hd-dashboard-results]';
const reportStatus = '[data-hd-dashboard-status]';

async function reportFor(days, start) {
  await waitFor(() => visible(results), 10000, 'kartu periode ' + days);
  const { id, url } = requests.slice(start).at(-1) ?? {};
  assert.ok(url, 'ringkasan memakai API laporan');
  assert.equal(responses.get(id), 200);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  assert.equal(Date.parse(to) - Date.parse(from), days * day);
  const { body, base64Encoded } = await cdp.send('Network.getResponseBody', { requestId:id });
  const report = JSON.parse(base64Encoded ? Buffer.from(body, 'base64').toString() : body);
  const ui = await evaluate(() => {
    const value = key => document.querySelector('[data-hd-dashboard-' + key + ']').textContent.trim();
    const org = document.querySelector('#hd-dashboard-org');
    return {
      organization:org.value, organizationLabel:org.selectedOptions[0].text,
      scope:value('scope-name'), range:value('range'), ratio:value('ratio'), window:value('window'), freshness:value('watermark'),
      cards:['accepted','backlog','completed','rate'].map(value),
      sla:[...document.querySelectorAll('[data-hd-dashboard-metrics] td')].map(cell => cell.textContent),
      meterHidden:document.querySelector('#hd-dashboard-meter').hidden,
    };
  });
  const rate = report.sla_percent === null ? 'Belum terukur' : number.format(report.sla_percent) + '%';
  assert.deepEqual(ui.cards, [report.accepted, report.backlog, report.completed].map(number.format).concat(rate));
  assert.deepEqual(ui.sla, [report.denominator, report.count, report.breached, report.unmeasured].map(number.format));
  assert.equal(ui.meterHidden, report.sla_percent === null);
  assert.equal(ui.ratio, report.sla_percent === null
    ? 'Belum ada penyelesaian dengan target dan waktu selesai yang dapat diukur.'
    : `${number.format(report.count)} dari ${number.format(report.denominator)} penyelesaian terukur tepat waktu (${rate}).`);
  assert.equal(ui.organization, url.searchParams.get('organization_id'));
  assert.equal(ui.scope, ui.organizationLabel);
  assert.equal(ui.range, `${days} hari terakhir (WIB)`);
  assert.ok(ui.window.includes(date.format(new Date(from))) && ui.window.includes(date.format(new Date(to))));
  assert.ok(ui.freshness.includes(date.format(new Date(report.as_of))));
  return {
    days, scope:ui.scope, from, to, accepted:report.accepted, active_in_period:report.backlog,
    completed:report.completed, sla_percent:report.sla_percent, measured:report.denominator, on_time:report.count,
    late:report.breached, unmeasured:report.unmeasured,
  };
}

try {
  await loginRoleKeyword(cdp, 'Koordinator');
  await cdp.setViewport(1440, 900);
  const desktopStart = requests.length;
  await cdp.navigate(dashboard);
  const week = await reportFor(7, desktopStart);
  const mandates = await evaluate(async () => {
    const response = await fetch('/api/v1/auth/me', { cache:'no-store' });
    const { actor } = await response.json();
    return {
      role:actor.role, name:actor.name,
      permitted:[...new Set(actor.memberships.filter(m => m.organization_active && !m.team_id &&
        m.permissions.includes('report.read')).map(m => m.organization_id))],
    };
  });
  assert.equal(mandates.role, 'COORDINATOR');
  const overview = await evaluate(() => ({
    identity:document.querySelector('[data-admin-work-identity]').textContent,
    action:document.querySelector('[data-admin-work-link]').textContent,
    options:[...document.querySelector('#hd-dashboard-org').options].map(option => option.value),
    cohort:document.querySelector('#hd-dashboard-cohort').textContent,
  }));
  assert.equal(overview.identity, mandates.name + ' · Koordinator');
  assert.equal(overview.action, 'Perlu Keputusan');
  assert.deepEqual(overview.options, mandates.permitted);
  assert.match(overview.cohort, /diterima dalam periode ini.*Seluruh tiket aktif saat ini.*diterima sebelum periode ini/);

  await cdp.setViewport(390, 844, true);
  const mobile = await evaluate(() => ({
    overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
    kpisBottom:Math.round(document.querySelector('.hd-dashboard-kpis').getBoundingClientRect().bottom),
    viewport:innerHeight,
  }));
  assert.ok(mobile.overflow <= 1 && mobile.kpisBottom <= mobile.viewport, JSON.stringify(mobile));
  await evaluate(selector => document.querySelector(selector).focus(), summary);
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.ok(await visible('#hd-dashboard-period'));

  const periodStart = requests.length;
  await evaluate(() => {
    const period = document.querySelector('#hd-dashboard-period');
    period.value = '30';
    period.dispatchEvent(new Event('change', { bubbles:true }));
  });
  const month = await reportFor(30, periodStart);
  assert.equal(month.scope, week.scope);
  assert.ok(month.accepted >= week.accepted);
  const blockedParams = new URLSearchParams({ from:month.from, to:month.to, organization_id:'00000000-0000-4000-8000-000000000001' });
  const forbidden = await evaluate(async params => (await fetch('/api/v1/reports?' + params)).status, blockedParams.toString());
  assert.equal(forbidden, 403);

  await cdp.send('Network.setBlockedURLs', { urls:[origin + '/api/v1/reports?*'] });
  await evaluate(() => document.querySelector('[data-hd-dashboard-filter]').requestSubmit());
  await waitFor(() => evaluate(selector => document.querySelector(selector).textContent.includes('Ringkasan gagal dimuat'), reportStatus),
    10000, 'pesan pemulihan koneksi');
  assert.equal(await visible(results), false);
  assert.equal(await visible('[data-hd-dashboard-context]'), false);
  assert.equal(await visible('[data-hd-dashboard-detail-results]'), false);
  await cdp.send('Network.setBlockedURLs', { urls:[] });
  const retryStart = requests.length;
  await evaluate(() => document.querySelector('[data-hd-dashboard-filter]').requestSubmit());
  await reportFor(30, retryStart);

  await logoutSession(cdp);
  await evaluate(() => document.querySelector('[data-hd-dashboard-filter]').requestSubmit());
  await waitFor(() => visible('[data-hd-dashboard-login]'), 10000, 'opsi masuk kembali setelah sesi berakhir');
  assert.equal(await visible(results), false);
  assert.equal(await visible('[data-admin-work-start]'), false);
  const technicianStart = requests.length;
  await loginRoleKeyword(cdp, 'Teknisi');
  await cdp.navigate(dashboard);
  await waitFor(() => evaluate(selector => document.querySelector(selector).textContent.startsWith('Mandat aktif'), reportStatus),
    10000, 'status mandat teknisi');
  assert.equal(await evaluate(() => document.querySelector('[data-admin-work-link]').textContent), 'Tugas Saya');
  assert.equal(await visible(results), false);
  assert.equal(await visible(summary), false);
  assert.equal(requests.length, technicianStart);

  await logoutSession(cdp);
  await loginRoleKeyword(cdp, 'Super Admin');
  const superAdminStart = requests.length;
  await cdp.navigate(dashboard);
  await reportFor(7, superAdminStart);
  assert.equal(await evaluate(() => document.querySelector('[data-admin-work-link]').textContent), 'Master dan Akses');
  await evaluate(selector => { document.querySelector(selector).open = true; }, '[data-hd-dashboard-settings]');
  const superAdminPeriod = requests.length;
  await evaluate(() => {
    const period = document.querySelector('#hd-dashboard-period');
    period.value = '30';
    period.dispatchEvent(new Event('change', { bubbles:true }));
  });
  const superAdminMonth = await reportFor(30, superAdminPeriod);
  const superAdmin = await evaluate(async params => {
    const { actor, mode } = await (await fetch('/api/v1/auth/me')).json();
    const permitted = actor.memberships.filter(m => m.organization_active && !m.team_id && m.permissions.includes('report.read'));
    const reportScope = [...document.querySelector('#hd-dashboard-org').options].map(option => option.value);
    const denied = await Promise.all([
      fetch('/api/v1/reports?' + params),
      fetch('/api/v1/reports/exports/00000000-0000-4000-8000-000000000001'),
    ]);
    return {
      role:actor.role, mode, scopeMatches:reportScope.length === 1 && permitted.length === 1 &&
        reportScope[0] === permitted[0].organization_id,
      denied:denied.map(response => response.status),
    };
  }, blockedParams.toString());
  assert.deepEqual(superAdmin, { role:'SUPER_ADMIN', mode:'SYNTHETIC_LAB', scopeMatches:true, denied:[403, 403] });
  assert.deepEqual(errors, []);
  await mkdir(evidenceDir, { recursive:true });
  await writeFile(evidenceDir + '/browser.json', JSON.stringify({
    result:'PASS', target:dashboard, periods:[week, month], coordinator_scope_options:overview.options.length,
    out_of_scope_status:forbidden, mobile, keyboard_disclosure:true, failed_request_hides_old_data:true, retry:true,
    expired_session_hides_private_data:true, technician_shortcut_without_reports:true,
    super_admin:{ ...superAdmin, matched_7_and_30_days:true, period_30:superAdminMonth },
  }, null, 2) + '\n');
  console.log('PASS dashboard: Koordinator dan Super Admin sesuai API 7/30 hari, Teknisi tanpa izin laporan, ACL, keyboard, mobile dan pemulihan.');
} finally {
  try { await logoutSession(cdp); } finally { await close(); }
}
