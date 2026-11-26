import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = 'http://127.0.0.1:18090';
assert.equal(process.env.HELPDESK_BASE_URL ?? origin, origin);
const target = origin + '/admin/app/dashboard/index.html';
const evidenceDir = 'qa/remediation/dashboard-acceptance-phase3';
const action = '[data-admin-work-link]';
const status = '[data-hd-dashboard-status]';
const drill = '[data-hd-dashboard-drill="accepted"]';
const tableStatus = '[data-hd-analysis-table-status]';
const { cdp, close } = await launchEdge();
const errors = [];
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const visible = selector => evaluate(s => Boolean(document.querySelector(s)?.getClientRects().length), selector);
const focus = selector => evaluate(s => document.querySelector(s).focus(), selector);
const whenState = (selector, state) => waitFor(() => evaluate((s, value) => document.querySelector(s)?.dataset.state === value, selector, state), 10000, state + ' ' + selector);
const atHeading = () => waitFor(() => evaluate(() => document.activeElement?.id === 'hd-analysis-table-title'), 10000, 'fokus judul tabel');
const vk = { Tab:9, Enter:13, ArrowRight:39 };
async function key(value) {
  const params = { key:value, code:value, windowsVirtualKeyCode:vk[value] };
  await cdp.send('Input.dispatchKeyEvent', { ...params, type:'keyDown', ...(value === 'Enter' ? { text:'\r' } : {}) });
  await cdp.send('Input.dispatchKeyEvent', { ...params, type:'keyUp' });
}

const roles = [
  ['Koordinator OPD A','COORDINATOR','Perlu Keputusan','filter=dispatch',true,true,true],
  ['Operator OPD A','OPERATOR','Perlu Verifikasi','filter=verification',false,false,false],
  ['Teknisi L1 OPD A','TECHNICIAN','Tugas Saya','filter=my-tasks',false,false,false],
  ['Pimpinan','LEADERSHIP','SLA dan Hambatan','kind=reports',true,true,true],
  ['Super Admin','SUPER_ADMIN','Master dan Akses','kind=memberships',true,false,false],
  ['Admin Lab OPD A','PLATFORM_ADMIN','Master dan Akses','kind=memberships',false,false,false],
  ['Admin OPD B','ADMIN_OPD','Master dan Akses','kind=memberships',false,false,false],
  ['Editor Konten','EDITOR','Kelola Panduan','kind=articles',false,false,false],
  ['Penerbit Konten','PUBLISHER','Tinjau Penerbitan','kind=articles',false,false,false],
  ['Auditor','AUDITOR','Jejak Audit','kind=audit',true,false,true],
];

async function measure(expectKPI) {
  const sample = await evaluate(showKPI => {
    window.scrollTo(0, 0);
    const rect = selector => {
      const element = document.querySelector(selector);
      const { top, bottom, width, height } = element.getBoundingClientRect();
      return { top:Math.round(top), bottom:Math.round(bottom), width:Math.round(width), height:Math.round(height) };
    };
    const report = document.querySelector('.hd-dashboard-report');
    const styles = getComputedStyle(report);
    const reportWidth = report.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    return {
      viewport:[innerWidth,innerHeight],
      overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
      action:rect('[data-admin-work-link]'),
      ...(showKPI ? {
        kpis:rect('.hd-dashboard-kpis'),
        report_content_width:Math.round(reportWidth),
        report_heading_width:rect('.hd-dashboard-report-head').width,
        report_sla_width:rect('[data-hd-dashboard-settings]').width,
        ...(document.querySelector('[data-hd-dashboard-status]').textContent
          ? {report_status_width:rect('[data-hd-dashboard-status]').width}
          : {}),
      } : {}),
    };
  }, expectKPI);
  assert.ok(sample.overflow <= 1, JSON.stringify(sample));
  for (const box of [sample.action, sample.kpis].filter(Boolean)) {
    assert.ok(box.top >= 0 && box.bottom <= sample.viewport[1] && box.width > 0 && box.height > 0, JSON.stringify(sample));
  }
  assert.ok(sample.action.height >= 44);
  if (expectKPI) {
    const widths = [sample.kpis.width, sample.report_heading_width, sample.report_sla_width, sample.report_status_width];
    for (const width of widths.filter(value => value !== undefined)) {
      assert.ok(Math.abs(width - sample.report_content_width) <= 1, 'Lebar isi Kinerja tiket: ' + JSON.stringify(sample));
    }
  }
  return sample;
}

async function selectPeriod(days) {
  await evaluate(value => {
    const period = document.querySelector('#hd-dashboard-period');
    period.value = String(value);
    period.dispatchEvent(new Event('change', { bubbles:true }));
  }, days);
  await waitFor(() => evaluate(value => document.querySelector('[data-hd-dashboard-range]').textContent === value + ' hari terakhir (WIB)' &&
    !document.querySelector('[data-hd-dashboard-results]').hidden, days), 10000, 'periode ' + days);
}

const samples = {};
const measurements = {};
let readiness;
try {
  for (const [keyword, role, label, filter, expectKPI, expectDetails, expectExport] of roles) {
    await cdp.setViewport(390, 844, true);
    await loginRoleKeyword(cdp, keyword);
    await cdp.navigate(target);
    await waitFor(() => visible(action), 10000, 'aksi ' + role);
    const identity = await evaluate(async () => {
      const { actor, mode } = await (await fetch('/api/v1/auth/me')).json();
      const shortcut = document.querySelector('[data-admin-work-link]');
      return {role:actor.role, mode, nameVisible:document.querySelector('[data-admin-work-identity]').textContent.startsWith(actor.name),
        action:shortcut.textContent, filter:new URL(shortcut.href).search.slice(1)};
    });
    assert.deepEqual(identity, {role, mode:'SYNTHETIC_LAB', nameVisible:true, action:label, filter});
    if (expectKPI) await waitFor(() => visible('[data-hd-dashboard-results]'), 10000, 'KPI ' + role);
    assert.equal(await visible('[data-hd-dashboard-results]'), expectKPI);
    assert.equal(await visible('[data-hd-analysis-table]'), expectDetails);
    assert.equal(await visible('[data-hd-analysis-cohort-export]'), expectExport);
    samples[role] = { action:label, filter, kpi:expectKPI, ticket_table:expectDetails, cohort_export:expectExport, ...await measure(expectKPI) };

    if (role === 'COORDINATOR') {
      assert.equal(await evaluate(() => document.querySelector('[data-hd-dashboard-status]').dataset.state), 'empty');
      assert.ok(await visible('[data-hd-dashboard-expand-period]'));
      assert.equal(await visible(drill), false);

      await cdp.send('Fetch.enable', { patterns:[{ urlPattern:origin + '/api/v1/reports?*' }] });
      const paused = cdp.waitForEvent('Fetch.requestPaused');
      await focus('[data-hd-dashboard-expand-period]');
      await key('Enter');
      const request = await paused;
      await whenState(status, 'loading');
      assert.ok(await visible('[data-hd-dashboard-loading]'));
      assert.equal(await visible('[data-hd-dashboard-results]'), false);
      assert.equal(await evaluate(() => document.querySelector('[data-hd-dashboard-results]').getAttribute('aria-busy')), 'true');
      await cdp.send('Fetch.failRequest', { requestId:request.requestId, errorReason:'Failed' });
      await cdp.send('Fetch.disable');
      await whenState(status, 'error');
      assert.equal(await visible('[data-hd-dashboard-loading]'), false);
      assert.equal(await visible('[data-hd-dashboard-analysis]'), false);
      await focus('[data-hd-dashboard-retry]');
      await key('Enter');
      await whenState(status, 'ready');
      await waitFor(() => visible(drill), 10000, 'kartu dapat dibuka setelah coba lagi');
      assert.equal(await evaluate(() => document.activeElement?.id), 'hd-dashboard-heading');
      assert.equal(await evaluate(() => document.querySelector('[data-hd-dashboard-range]').textContent), '30 hari terakhir (WIB)');

      for (const [w,h] of [[1440,900],[1280,720],[390,844],[320,568]]) {
        await cdp.setViewport(w, h, w < 600);
        measurements[w + 'x' + h] = await measure(true);
      }
      const longLabels = await evaluate(() => {
        const selectors = ['[data-admin-work-identity]','[data-hd-dashboard-scope-name]','.hd-dashboard-kpis h3'];
        return selectors.map(selector => {
          const node = document.querySelector(selector);
          const original = node.textContent;
          const long = original + ' · Unit Pelayanan Teknologi Informasi dan Administrasi Kependudukan Kecamatan';
          node.textContent = long;
          const css = getComputedStyle(node);
          const result = node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 &&
            css.textOverflow !== 'ellipsis' && node.textContent === long;
          node.textContent = original;
          return result;
        });
      });
      assert.deepEqual(longLabels, [true,true,true]);
      const tones = await evaluate(() => {
        const node = document.querySelector('[data-hd-analysis-deadline] li[data-tone="urgent"] > :first-child');
        const neutral = document.querySelector('[data-hd-analysis-deadline] li[data-tone="neutral"] > :first-child');
        const root = document.documentElement;
        const initial = root.getAttribute('data-theme');
        root.dataset.theme = 'dark';
        const dark = [getComputedStyle(node).color,getComputedStyle(neutral).color];
        root.dataset.theme = 'light';
        const light = [getComputedStyle(node).color,getComputedStyle(neutral).color];
        if (initial === null) root.removeAttribute('data-theme'); else root.dataset.theme = initial;
        return { dark, light, labelled:node.textContent.includes('Melewati tenggat') && neutral.textContent.length > 0 };
      });
      assert.ok(tones.labelled && tones.dark[0] !== tones.dark[1] && tones.light[0] !== tones.light[1] && tones.dark[0] !== tones.light[0]);

      await focus(action);
      await key('Tab');
      assert.ok(await evaluate(sel => document.activeElement.matches(sel), drill));
      await key('Enter');
      await atHeading();
      await whenState(tableStatus, 'ready');
      await focus('[data-hd-analysis-back]');
      await key('Enter');
      assert.ok(await evaluate(sel => document.activeElement.matches(sel), drill));
      await focus('[data-hd-analysis-trend] button[tabindex="0"]');
      await key('ArrowRight');
      const chartFocus = await evaluate(() => ({
        index:[...document.querySelectorAll('[data-hd-analysis-trend] button')].indexOf(document.activeElement),
        tabstops:document.querySelectorAll('[data-hd-analysis-trend] button[tabindex="0"]').length,
      }));
      assert.deepEqual(chartFocus, {index:1, tabstops:1});
      await key('Enter');
      await atHeading();
      await whenState(tableStatus, 'ready');
      await focus('[data-hd-analysis-back]');
      await key('Enter');
      assert.ok(await evaluate(() => document.activeElement.matches('[data-hd-analysis-trend] button[tabindex="0"]')));

      await evaluate(() => {
        document.querySelector('#hd-analysis-query').value = 'fixture-no-such-ticket-for-dashboard';
        document.querySelector('[data-hd-analysis-search]').requestSubmit();
      });
      await whenState(tableStatus, 'empty');
      assert.equal(await visible('[data-hd-analysis-ticket-content]'), false);
      await cdp.send('Network.setBlockedURLs', { urls:[origin + '/api/v1/reports/dashboard-tickets?*'] });
      await focus('[data-hd-analysis-reset]');
      await key('Enter');
      await whenState(tableStatus, 'error');
      assert.ok(await visible('[data-hd-analysis-table-retry]'));
      assert.equal(await evaluate(() => document.querySelectorAll('[data-hd-analysis-rows] tr').length), 0);
      await cdp.send('Network.setBlockedURLs', { urls:[] });
      await focus('[data-hd-analysis-table-retry]');
      await key('Enter');
      await whenState(tableStatus, 'ready');
      await atHeading();

      const expectedTicket = await evaluate(() => document.querySelector('[data-hd-analysis-rows] tr').dataset.ticketId);
      await focus('[data-hd-analysis-rows] tr a');
      await key('Enter');
      await waitFor(() => evaluate(id => new URL(location.href).searchParams.get('id') === id &&
        document.querySelector('[data-ticket-detail]')?.getClientRects().length, expectedTicket), 12000, 'detail tiket sesuai pilihan keyboard');
      readiness = { first_viewport:measurements, long_labels:true, state_tones_both_themes:true,
        empty_first_week:true, loading_busy:true, summary_retry:true, table_empty_retry:true,
        card_to_table_focus_return:true, chart_arrow_keys_and_focus_return:true, detail_route_loaded:true };
    }
    await logoutSession(cdp);
  }

  await cdp.navigate(target);
  await waitFor(() => visible('[data-admin-access] a[href="/admin/auth/login.html"]'), 10000, 'gerbang ruang petugas tanpa sesi');
  assert.equal(await visible('[data-hd-dashboard-results]'), false);
  assert.equal(await visible('[data-hd-analysis-table]'), false);
  assert.deepEqual(errors, []);
  await mkdir(evidenceDir, { recursive:true });
  await writeFile(evidenceDir + '/browser.json', JSON.stringify({ result:'PASS', target, roles:samples, readiness, no_session_hides_private_views:true }, null, 2) + '\n');
  console.log('PASS Dasbor Fase 3: 10 peran staf, viewport awal, label panjang, warna status, loading/kosong/retry, keyboard dan detail.');
} finally {
  try { await logoutSession(cdp); } finally { await close(); }
}
