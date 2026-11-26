import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = 'http://127.0.0.1:18090';
assert.equal(process.env.HELPDESK_BASE_URL ?? origin, origin);
const target = origin + '/admin/app/dashboard/index.html';
const output = 'qa/remediation/dashboard-analysis-example';
const { cdp, close } = await launchEdge();
const apiRequests = [];
const errors = [];
cdp.on('Network.requestWillBeSent', event => {
  if (event.request.url.startsWith(origin + '/api/v1/')) apiRequests.push(event.request.method);
});
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const visible = selector => evaluate(s => Boolean(document.querySelector(s)?.getClientRects().length), selector);
const selected = source => waitFor(() => evaluate(value =>
  document.querySelector('[data-hd-dashboard-analysis]')?.dataset.source === value, source), 10000, source);
const finished = () => waitFor(() => evaluate(() => document.querySelector('[data-hd-analysis-performance-values] dd')), 10000, 'angka kinerja');
const kpi = () => evaluate(() => [...document.querySelectorAll('.hd-dashboard-kpis .piui-card__value')].map(node => node.textContent));
async function activate(selector) {
  await evaluate(s => document.querySelector(s).focus(), selector);
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
}
const geometry = () => evaluate(() => {
  const panel = document.querySelector('.hd-dashboard-analysis');
  const trend = document.querySelector('.hd-analysis-trend').getBoundingClientRect();
  const age = document.querySelector('[aria-labelledby="hd-age-title"]').getBoundingClientRect();
  const deadline = document.querySelector('[aria-labelledby="hd-deadline-title"]').getBoundingClientRect();
  const css = getComputedStyle(panel);
  return {
    content_width:Math.round(panel.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)),
    trend_width:Math.round(trend.width), trend_height:Math.round(trend.height),
    age_and_deadline_same_row:Math.abs(age.top - deadline.top) < 1,
    overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

try {
  await loginRoleKeyword(cdp, 'Super Admin');
  await cdp.setViewport(1280, 780);
  await cdp.navigate(target);
  await selected('system');
  await finished();
  const liveKpis = await kpi();
  assert.equal(liveKpis[0], '0');
  assert.ok(await visible('[data-hd-analysis-trend-empty]'));
  assert.equal(await visible('[data-hd-analysis-chart]'), false);
  const system = await geometry();
  assert.ok(system.trend_height <= 170 && system.content_width - system.trend_width <= 1, JSON.stringify(system));

  const requestCount = apiRequests.length;
  await activate('[data-hd-analysis-demo-mode]');
  await selected('example');
  await finished();
  assert.equal(apiRequests.length, requestCount);
  assert.deepEqual(await kpi(), liveKpis);
  assert.ok(await visible('[data-hd-analysis-demo-note]'));
  assert.equal(await evaluate(() => document.querySelector('[data-hd-analysis-demo-mode]').getAttribute('aria-pressed')), 'true');
  const figures = await evaluate(() => ({
    total:document.querySelector('[data-hd-analysis-trend-total]').textContent,
    daily:[...document.querySelectorAll('[data-hd-analysis-daily] tr')].map(row => [...row.cells].slice(1).map(cell => Number(cell.textContent))),
    age:[...document.querySelectorAll('[data-hd-analysis-age] li')].map(row => Number(row.textContent.split(' · ').at(-1))),
    deadline:[...document.querySelectorAll('[data-hd-analysis-deadline] li')].map(row => Number(row.textContent.split(' · ').at(-1))),
    stackHeights:[...document.querySelectorAll('.hd-trend-fill > span')].map(segment => segment.getBoundingClientRect().height),
    capacity:document.querySelector('[data-hd-analysis-capacity-values] dd').textContent,
    performance:document.querySelector('[data-hd-analysis-performance-values] dd').textContent,
  }));
  assert.equal(figures.total, '80 tiket diterima');
  assert.equal(figures.daily.length, 7);
  assert.equal(figures.daily.reduce((sum, row) => sum + row[0], 0), 80);
  const active = figures.daily.reduce((sum, row) => sum + row[1], 0);
  assert.equal(active, 30);
  for (const buckets of [figures.age, figures.deadline]) assert.equal(buckets.reduce((sum, n) => sum + n, 0), active);
  assert.ok(figures.stackHeights.length > 14 && figures.stackHeights.every(height => height > 0));
  assert.equal(figures.capacity, '8');
  assert.equal(figures.performance, '49');
  for (const selector of ['table','cohort-export','csv','roster','performance-link']) {
    assert.equal(await visible('[data-hd-analysis-' + selector + ']'), false, selector);
  }
  assert.equal(await evaluate(() => document.querySelectorAll('[data-hd-analysis-trend] button').length), 0);
  const desktop = await geometry();
  assert.ok(desktop.content_width - desktop.trend_width <= 1 && desktop.age_and_deadline_same_row && desktop.overflow === 0, JSON.stringify(desktop));
  if (process.env.HELPDESK_EXAMPLE_CAPTURE) {
    await evaluate(() => document.querySelector('.hd-dashboard-analysis').scrollIntoView({ block:'start' }));
    const screenshot = await cdp.send('Page.captureScreenshot', { format:'png' });
    await writeFile(process.env.HELPDESK_EXAMPLE_CAPTURE, Buffer.from(screenshot.data, 'base64'));
  }
  await cdp.setViewport(390, 844, true);
  const mobile = await geometry();
  assert.ok(mobile.content_width - mobile.trend_width <= 1 && !mobile.age_and_deadline_same_row && mobile.overflow === 0, JSON.stringify(mobile));
  await activate('[data-hd-analysis-live-mode]');
  await selected('system');
  await finished();
  assert.equal(await visible('[data-hd-analysis-demo-note]'), false);
  assert.deepEqual(await kpi(), liveKpis);
  assert.equal(await evaluate(() => document.querySelector('[data-hd-analysis-trend-total]').textContent), '0 tiket diterima');

  // Exercise the frontend mode gate without changing this lab account or backend environment.
  await cdp.send('Fetch.enable', { patterns:[{ urlPattern:origin + '/api/v1/auth/me', requestStage:'Response' }] });
  const authPaused = cdp.waitForEvent('Fetch.requestPaused');
  const reload = cdp.navigate(target);
  const { requestId, responseStatusCode } = await authPaused;
  assert.equal(responseStatusCode, 200);
  const reply = await cdp.send('Fetch.getResponseBody', { requestId });
  const session = JSON.parse(reply.base64Encoded ? Buffer.from(reply.body, 'base64').toString() : reply.body);
  session.mode = 'OIDC_SSO';
  await cdp.send('Fetch.fulfillRequest', {
    requestId, responseCode:200, responseHeaders:[{ name:'Content-Type', value:'application/json' }, { name:'Cache-Control', value:'no-store' }],
    body:Buffer.from(JSON.stringify(session)).toString('base64'),
  });
  await cdp.send('Fetch.disable');
  await reload;
  await selected('system');
  assert.equal(await visible('[data-hd-analysis-source]'), false);
  assert.deepEqual(errors, []);

  await mkdir(output, { recursive:true });
  await writeFile(output + '/browser.json', JSON.stringify({
    result:'PASS', target, system_empty:system, example_desktop:desktop, example_mobile:mobile,
    example:{ accepted:80, active:30, completed:49, cancelled:1, daily:figures.daily, age:figures.age, deadline:figures.deadline },
    no_example_api_requests:true, system_kpis_preserved:true, example_no_ticket_actions_or_export:true,
    source_toggle_keyboard:true, nonlab_mode_simulation_hides_example:true,
  }, null, 2) + '\n');
  console.log('PASS Analisis: layout penuh, keadaan kosong ringkas, grafik contoh, keyboard, pemisahan sistem/lab dan izin.');
} finally {
  try { await logoutSession(cdp); } finally { await close(); }
}
