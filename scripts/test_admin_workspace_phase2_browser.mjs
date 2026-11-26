import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = process.env.HELPDESK_BASE_URL ?? 'http://127.0.0.1:18090';
assert.equal(origin, 'http://127.0.0.1:18090');
const master = '/admin/app/helpdesk/index.html?kind=';
const dashboard = '/admin/app/dashboard/index.html';
const { cdp, close } = await launchEdge();
const observations = {};
const checks = [];
const errors = [];
const screenshots = process.env.HELPDESK_UX_SCREENSHOTS;
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails?.text ?? 'Uncaught exception'));
const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const ready = (fn, label) => waitFor(() => evaluate(fn), 10000, label);
const visible = selector => evaluate(sel => {
  const element = document.querySelector(sel);
  return Boolean(element?.getClientRects().length);
}, selector);
async function navigate(path, width = 390, height = 844) {
  await cdp.setViewport(width, height, width < 600);
  await cdp.navigate(origin + path, 250);
}
async function key(value, code) {
  const name = value === ' ' ? 'Space' : value;
  const text = value === 'Enter' ? '\r' : value === ' ' ? ' ' : undefined;
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:value, code:name, windowsVirtualKeyCode:code, text });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:value, code:name, windowsVirtualKeyCode:code });
}
async function activate(selector, value = 'Enter', code = 13) {
  assert.ok(await visible(selector), selector + ' visible');
  await evaluate(sel => document.querySelector(sel).focus(), selector);
  await key(value, code);
}
async function select(selector, value) {
  await evaluate((sel, next) => {
    const control = document.querySelector(sel);
    control.value = next;
    control.dispatchEvent(new Event('change', { bubbles:true }));
  }, selector, value);
}
async function observe(name, selectors) {
  const sample = await evaluate(targets => {
    const boxes = Object.fromEntries(Object.entries(targets).map(([label, selector]) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return [label, { top:Math.round(box?.top ?? -1), bottom:Math.round(box?.bottom ?? -1) }];
    }));
    return { boxes, viewport:innerHeight, overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
      missingStyles:[...document.querySelectorAll('link[rel=stylesheet]')].filter(link => !link.sheet).length };
  }, selectors);
  assert.ok(sample.overflow <= 1 && sample.missingStyles === 0, name + ' document fits ' + JSON.stringify(sample));
  for (const [label, box] of Object.entries(sample.boxes)) {
    assert.ok(box.top >= 0 && box.bottom > box.top && box.bottom <= sample.viewport,
      name + ' ' + label + ' fits the first viewport ' + JSON.stringify(sample));
  }
  observations[name] = sample;
  if (screenshots) {
    await mkdir(screenshots, { recursive:true });
    const { data } = await cdp.send('Page.captureScreenshot', { format:'jpeg', quality:75 });
    await writeFile(screenshots + '/' + name + '.jpg', Buffer.from(data, 'base64'));
  }
}

try {
  await loginRoleKeyword(cdp, 'Koordinator');
  await navigate(dashboard);
  await ready(() => !document.querySelector('[data-hd-dashboard-results]')?.hidden, 'Dashboard KPIs');
  assert.equal(await evaluate(() => document.querySelector('[data-hd-dashboard-settings]').open), false);
  assert.ok(await visible('.hd-dashboard-links [data-admin-nav-id="reports"] .piui-nav-link__text'));
  await observe('dashboard_390', { action:'[data-admin-work-link]', kpis:'.hd-dashboard-kpis' });
  await cdp.setViewport(1440, 900, false);
  await observe('dashboard_1440', { action:'[data-admin-work-link]', kpis:'.hd-dashboard-kpis' });
  await cdp.setViewport(390, 844, true);
  await activate('[data-hd-dashboard-settings] summary');
  assert.ok(await visible('[data-hd-dashboard-filter]'));
  await select('#hd-dashboard-period', '30');
  await activate('[data-hd-dashboard-filter] button');
  await ready(() => !document.querySelector('[data-hd-dashboard-results]')?.hidden, 'Report refresh');
  checks.push('dashboard KPI before filters and report refresh');

  await navigate(master + 'availability');
  await ready(() => document.querySelector('[data-hd-roster-new]')?.getClientRects().length, 'Roster actions');
  assert.equal(await visible('[data-hd-roster-form]'), false);
  await observe('roster_390', { context:'[data-hd-roster-scope] summary', action:'[data-hd-roster-new]', first:'[data-hd-roster-rows] tr button' });
  await cdp.setViewport(1440, 900, false);
  await observe('roster_1440', { context:'[data-hd-roster-scope] summary', action:'[data-hd-roster-new]', first:'[data-hd-roster-rows] tr button' });
  await cdp.setViewport(390, 844, true);
  await activate('[data-hd-roster-rows] tr button');
  await ready(() => document.activeElement?.matches('[data-hd-roster-editor-title]') &&
    document.activeElement.textContent === 'Ubah jadwal', 'Roster editor receives focus');
  await activate('[data-hd-roster-reset]');
  await ready(() => document.activeElement?.matches('[data-hd-roster-rows] tr button'), 'Roster returns focus to the edited row');
  await activate('[data-hd-roster-new]');
  assert.ok(await visible('[data-hd-roster-form]'));
  await activate('[data-hd-roster-reset]');
  assert.equal(await visible('[data-hd-roster-form]'), false);
  await activate('[data-hd-roster-scope] summary');
  assert.ok(await visible('[data-hd-roster-scope][open] .hd-s2:has(#hd-roster-team) .hd-s2-trigger'));
  checks.push('roster collapsed scope, add and edit, cancel and focus return');

  await logoutSession(cdp);
  await loginRoleKeyword(cdp, 'Super Admin');
  await navigate(master + 'organizations');
  await ready(() => document.querySelector('[data-hd-rows] tr button')?.getClientRects().length, 'Organization rows');
  assert.equal(await visible('[data-hd-master-form]'), false);
  await observe('organizations_390', { action:'[data-hd-new]', search:'.hd-dt-quick-search [data-dt-search]', first:'[data-hd-rows] tr button' });
  await activate('[data-hd-new]');
  await ready(() => document.activeElement?.matches('[data-hd-master-form] input'), 'Master editor receives focus');
  await activate('[data-hd-cancel-master]');
  await ready(() => document.activeElement?.matches('[data-hd-new]'), 'Master cancel returns to Add');
  await activate('[data-hd-rows] tr button');
  assert.ok(await visible('[data-hd-master-form].is-editing'));
  await activate('[data-hd-cancel-master]');
  await ready(() => document.activeElement?.matches('[data-hd-rows] tr button'), 'Master cancel returns to edited row');
  await navigate(master + 'services#new', 1440, 900);
  await ready(() => document.activeElement?.matches('[data-hd-master-form] input'), 'Service new deep link');
  await activate('[data-hd-cancel-master]');
  await evaluate(() => window.scrollTo(0, 0));
  await observe('services_1440', { action:'[data-hd-new]', search:'.hd-dt-quick-search [data-dt-search]', first:'[data-hd-rows] tr button' });
  checks.push('master search, add, edit, cancel, focus return and #new deep link');

  await navigate(master + 'role-policies');
  await ready(() => document.querySelector('#hd-role-policy-select')?.options.length >= 2, 'Role policies');
  await observe('role_policies_390', { refresh:'[data-role-refresh]', module:'[data-role-module] summary' });
  await cdp.setViewport(1440, 900, false);
  await observe('role_policies_1440', { refresh:'[data-role-refresh]', module:'[data-role-module] summary' });
  await cdp.setViewport(390, 844, true);
  await select('#hd-role-policy-select', 'SUPER_ADMIN');
  assert.match(await evaluate(() => document.querySelector('[data-role-feedback]').textContent), /dilindungi/);
  assert.equal(await visible('[data-role-editor]'), false);
  await select('#hd-role-policy-select', 'OPERATOR');
  await activate('[data-role-module] summary');
  const changedPermission = await evaluate(() => {
    const input = document.querySelector('[data-role-module][open] input:not([disabled])');
    const group = input.closest('[data-role-module]').dataset.roleModule;
    const next = [...document.querySelector('#hd-role-module').options].find(option => option.value && option.value !== group);
    return { value:input.value, checked:!input.checked, otherModule:next?.value };
  });
  await activate('[data-role-module][open] input:not([disabled])', ' ', 32);
  assert.ok(changedPermission.otherModule);
  await select('#hd-role-module', changedPermission.otherModule);
  assert.equal(await evaluate(permission => new FormData(document.querySelector('[data-hd-role-policy-section] form'))
    .getAll('permissions').includes(permission), changedPermission.value), changedPermission.checked);
  await ready(() => !document.querySelector('[data-role-review-link]')?.hidden, 'Role change summary');
  await activate('[data-role-review-link]');
  await ready(() => document.activeElement?.id === 'hd-role-policy-reason', 'Role review link focuses reason');
  await cdp.send('Input.insertText', { text:'Pratinjau perubahan izin dalam uji lab.' });
  await activate('[data-role-editor] button[type=submit]');
  await ready(() => document.querySelector('[data-hd-archive-confirm]')?.open, 'Permission review dialog');
  await key('Escape', 27);
  await ready(() => !document.querySelector('[data-hd-archive-confirm]')?.open, 'Role changes not submitted');
  checks.push('protected role, permission groups, change summary, review and cancellation');

  await navigate(master + 'media');
  await ready(() => document.querySelector('.hd-media-card')?.getClientRects().length, 'Editorial cards');
  await observe('media_390', { upload:'[data-hd-toggle-upload]', filter:'.hd-s2:has(#hd-media-filter-status) .hd-s2-trigger', first:'.hd-media-card' });
  await activate('[data-hd-toggle-upload]');
  await ready(() => document.activeElement?.matches('[data-hd-upload-title]'), 'Media upload opens with focus');
  await activate('[data-hd-close-upload]');
  await ready(() => document.activeElement?.matches('[data-hd-toggle-upload]'), 'Media upload closes and restores focus');
  await activate('[data-hd-open-media-publication]');
  await ready(() => document.querySelector('#hd-media-publication')?.open &&
    document.activeElement?.closest('#hd-media-publication'),'Media review opens to its summary');
  await activate('#hd-media-publication summary');
  await activate('[data-hd-tab-media="M3"]');
  await ready(() => document.querySelector('[data-hd-tab-media="M3"]')?.getAttribute('aria-pressed') === 'true' &&
    !document.querySelector('[data-hd-media-status]').textContent.includes('Memuat'), 'Private attachments');
  await activate('[data-hd-tab-media="M8"]');
  await ready(() => document.querySelector('.hd-media-card')?.getClientRects().length, 'Editorial cards again');
  await activate('.hd-media-card .hd-media-actions button:nth-child(2)');
  await ready(() => document.querySelector('[data-hd-media-detail-dialog]')?.open, 'Media details');
  await key('Escape', 27);
  await ready(() => !document.querySelector('[data-hd-media-detail-dialog]')?.open, 'Media details close with Escape');
  await navigate(master + 'media', 1440, 900);
  await ready(() => document.querySelector('.hd-media-card')?.getClientRects().length, 'Editorial desktop');
  await observe('media_1440', { upload:'[data-hd-toggle-upload]', first:'.hd-media-card' });
  await logoutSession(cdp);
  checks.push('media genres, upload and publication focus, detail dialog');

  assert.deepEqual(errors, []);
  const directory = process.env.HELPDESK_UX_REPORT_DIR ?? 'qa/remediation/ui-ux-admin-workspace-phase2';
  await mkdir(directory, { recursive:true });
  await writeFile(directory + '/browser.json', JSON.stringify({ result:'PASS', origin, observations, checks,
    limits:'Edge emulation with lab roles. No schedule, master, permissions or media mutations.' }, null, 2) + '\n');
  console.log('PASS Dashboard, Ketersediaan Tim, master, Hak Akses dan Pustaka Media');
} finally {
  await close();
}
