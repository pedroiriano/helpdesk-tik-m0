import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { adminItems, canNavigate } from '../frontend/admin-navigation.mjs';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = 'http://127.0.0.1:18090';
assert.equal(process.env.HELPDESK_BASE_URL ?? origin, origin);
const target = origin + '/admin/app/dashboard/index.html';
const dir = 'qa/remediation/admin-sidebar-rail';
const { cdp, close } = await launchEdge();
const errors = [];
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
const evaluate = (fn, ...args) => cdp.eval('(' + fn + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const visible = selector => evaluate(s => Boolean(document.querySelector(s)?.getClientRects().length), selector);
const rail = '#piui-sidebar [data-admin-navigation]';
const drawer = '#piui-mobile-drawer';
const topbar = '#btn-sidebar-toggle';
const catalog = rail + ' [data-admin-submenu="sub-catalog"]';
const content = rail + ' [data-admin-submenu="sub-content"]';
const waitState = value => waitFor(() => evaluate(mode =>
  document.querySelector('.piui-app-shell')?.dataset.sidebar === mode, value), 10000, 'mode ' + value);

async function key(value, code) {
  const params = { key:value, code:value, windowsVirtualKeyCode:code, ...(value === 'Enter' ? { text:'\r' } : {}) };
  await cdp.send('Input.dispatchKeyEvent', { ...params, type:'keyDown' });
  await cdp.send('Input.dispatchKeyEvent', { key:value, code:value, windowsVirtualKeyCode:code, type:'keyUp' });
}

async function activate(selector) {
  assert.ok(await visible(selector), selector);
  await evaluate(s => document.querySelector(s).focus(), selector);
  await key('Enter', 13);
}

async function assertRail(expectedCount) {
  const session = await evaluate(async () => (await fetch('/api/v1/auth/me')).json());
  const expected = adminItems.filter(item => canNavigate(item, session)).map(item => item.id);
  const actual = await evaluate(root => {
    const nav = document.querySelector(root);
    const all = [...nav.querySelectorAll('a[data-admin-nav-id]')];
    const links = all.filter(link => link.getClientRects().length).map(link => ({
      id:link.dataset.adminNavId,
      child:Boolean(link.closest('[data-admin-submenu]')),
      name:link.getAttribute('aria-label'),
      title:link.title,
      icon:link.querySelector('use').getBBox().width,
      target:link.getBoundingClientRect().height,
      tabIndex:link.tabIndex,
      textHidden:getComputedStyle(link.querySelector('.piui-nav-link__text')).display === 'none',
    }));
    const sidebar = nav.closest('#piui-sidebar');
    return { links, scroll:sidebar.scrollHeight > sidebar.clientHeight,
      overflow:sidebar.scrollWidth - sidebar.clientWidth };
  }, rail);
  assert.deepEqual(actual.links.map(link => link.id), expected);
  const children = actual.links.filter(link => link.child).length;
  if (expectedCount !== undefined) assert.equal(children, expectedCount);
  assert.ok(actual.links.every(link => link.name && link.title === link.name &&
    link.icon > 0 && link.target >= 44 && link.tabIndex === 0 && link.textHidden));
  assert.ok(actual.overflow <= 1);
  return { role:session.actor.role, total_icons:actual.links.length, submenu_icons:children, scrollable:actual.scroll };
}

try {
  await cdp.setViewport(1280, 720);
  await loginRoleKeyword(cdp, 'Super Admin');
  await cdp.navigate(target);
  await waitState('expanded');
  assert.equal(await visible(catalog + ' .piui-nav-sublist'), false);
  await activate(content + ' button');
  assert.equal(await visible(content + ' .piui-nav-sublist'), true);
  await activate(topbar);
  await waitState('collapsed');
  const superAdmin = await assertRail(16);
  assert.equal(superAdmin.role, 'SUPER_ADMIN');
  assert.equal(superAdmin.scrollable, true);
  await evaluate(sel => document.querySelector(sel).focus(), rail + ' [data-admin-nav-id="portal"]');
  const canReachLast = await evaluate(() => {
    const sidebar = document.querySelector('#piui-sidebar');
    const focused = document.activeElement.getBoundingClientRect();
    const bounds = sidebar.getBoundingClientRect();
    return sidebar.scrollTop > 0 && focused.top >= bounds.top && focused.bottom <= bounds.bottom;
  });
  assert.ok(canReachLast, 'fokus menggulir ke ikon tujuan di bawah');

  await activate(topbar);
  await waitState('expanded');
  assert.equal(await visible(catalog + ' .piui-nav-sublist'), false);
  assert.equal(await visible(content + ' .piui-nav-sublist'), true);
  await activate(topbar);
  await waitState('collapsed');
  await activate(rail + ' [data-admin-nav-id="hero"]');
  await waitFor(() => evaluate(sel => location.search === '?kind=hero' &&
    document.querySelector(sel)?.getAttribute('aria-current') === 'page' &&
    document.querySelector(sel)?.getClientRects().length, rail + ' [data-admin-nav-id="hero"]'), 12000, 'tujuan submenu aktif');
  await waitState('collapsed');
  await assertRail(16);

  await cdp.setViewport(390, 844, true);
  await activate(topbar);
  await waitFor(() => evaluate(sel => document.querySelector(sel)?.open, drawer), 10000, 'drawer native');
  const mobileGroup = drawer + ' [data-admin-submenu="sub-catalog"]';
  assert.equal(await visible(mobileGroup + ' .piui-nav-sublist'), false);
  assert.equal(await visible(mobileGroup + ' .hd-nav-submenu__label'), true);
  await activate(mobileGroup + ' button');
  assert.equal(await visible(mobileGroup + ' [data-admin-nav-id="services"] .piui-nav-link__text'), true);
  await key('Escape', 27);
  await waitFor(() => evaluate(sel => !document.querySelector(sel)?.open &&
    document.activeElement?.id === 'btn-sidebar-toggle', drawer), 10000, 'Escape kembali ke tombol drawer');

  await logoutSession(cdp);
  await cdp.setViewport(1280, 720);
  await loginRoleKeyword(cdp, 'Teknisi L1 OPD A');
  await cdp.navigate(target);
  await waitState('collapsed');
  const technician = await assertRail();
  assert.equal(technician.role, 'TECHNICIAN');
  for (const id of ['role-policies','memberships','hero']) assert.equal(await visible(`${rail} [data-admin-nav-id="${id}"]`), false);
  assert.deepEqual(errors, []);

  await mkdir(dir, { recursive:true });
  await writeFile(dir + '/browser.json', JSON.stringify({
    result:'PASS', target, super_admin:superAdmin, technician, all_authorized_icons_rendered:true,
    keyboard_link_and_active_route:true, focus_scrolls_to_bottom:true, desktop_disclosure_state_preserved:true,
    mobile_drawer_labels_and_escape:true, unauthorized_routes_hidden:true,
  }, null, 2) + '\n');
  console.log('PASS sidebar: ikon submenu, nama dan fokus, navigasi aktual, kembali ke mode lebar, drawer dan mandat.');
} finally {
  try { await logoutSession(cdp); } finally { await close(); }
}
