import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchEdge, waitFor, logoutSession, loginRoleKeyword } from './test_maintenance_under_maintenance_browser.mjs';

const base = process.env.HELPDESK_BASE_URL;
assert.equal(base, 'http://127.0.0.1:18191', 'Run this mutating test only on the dedicated Phase 1 fixture.');
const evidence = path.resolve('qa/remediation/rm0-05/penyempurnaan/fase1-browser.json');
const checks = [];
const { cdp, close } = await launchEdge();
const report = { runtime: base, viewport: ['1280x840', '390x844'], result: 'FAIL', checks };

try {
  await cdp.setViewport(1280, 840);
  for (const [keyword, label, href] of [
    ['operator', 'Perlu Verifikasi', 'filter=verification'],
    ['teknisi', 'Tugas Saya', 'filter=my-tasks'],
    ['koordinator', 'Perlu Keputusan', 'filter=dispatch'],
    ['pimpinan', 'SLA dan Hambatan', 'kind=reports'],
    ['super admin', 'Master dan Akses', 'kind=memberships'],
  ]) {
    await logoutSession(cdp);
    await loginRoleKeyword(cdp, keyword);
    const criteria = JSON.stringify([label, href]);
    const matched = await waitFor(() => cdp.eval('(() => {const [label,href] = ' + criteria + '; const panel = document.querySelector("[data-admin-work-start]"); const link = panel?.querySelector("[data-admin-work-link]"); return panel && !panel.hidden && link?.textContent === label && link.href.includes(href)})()'), 10000, label);
    assert.ok(matched);
    if (keyword === 'super admin') {
      const access = await cdp.eval('({ticketMenu:[...document.querySelectorAll("a[data-admin-nav-id=tickets]")].some(a=>!a.hidden), csp:window.__cspViolations})');
      assert.equal(access.ticketMenu, false);
      assert.equal(access.csp.length, 0);
    }
    checks.push(label);
  }

  await cdp.navigate(base + '/admin/app/helpdesk/index.html?kind=rules');
  await waitFor(() => cdp.eval('!document.querySelector("[data-hd-rules-section]").hidden && !document.querySelector("[data-hd-roster]").hidden'), 10000, 'authorized roster panel');
  await cdp.eval('document.querySelector("[data-hd-roster] summary").click()');
  await waitFor(() => cdp.eval('document.querySelector("#hd-roster-team").options.length > 1'), 10000, 'team choices');
  await cdp.eval('(() => {const team = document.querySelector("#hd-roster-team"); team.selectedIndex=1; team.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await waitFor(() => cdp.eval('!!document.querySelector("[data-hd-roster-rows] button")'), 10000, 'roster data');
  await cdp.eval('document.querySelector("[data-hd-roster-rows] button").click()');
  assert.equal(await cdp.eval('document.activeElement.id'), 'hd-roster-reason');
  await cdp.eval('document.querySelector("#hd-roster-reason").value = "Fixture uji browser Fase 1"; document.querySelector("[data-hd-roster-form]").requestSubmit()');
  await waitFor(() => cdp.eval('document.querySelector("[data-hd-roster-status]").textContent === "Jadwal tersimpan."'), 10000, 'roster save');
  checks.push('Roster diperbarui melalui UI dan fokus alasan');

  await cdp.setViewport(390, 844, true);
  await cdp.navigate(base + '/admin/app/dashboard/index.html');
  await waitFor(() => cdp.eval('!document.querySelector("[data-admin-work-start]").hidden'), 10000, 'mobile work panel');
  const toggle = await cdp.eval('(() => {const button=document.querySelector("#btn-sidebar-toggle"); button.focus(); return { focused:document.activeElement===button, disabled:button.disabled, width:innerWidth };})()');
  assert.equal(toggle.focused, true, JSON.stringify(toggle));
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', text:'\r', unmodifiedText:'\r', windowsVirtualKeyCode:13, nativeVirtualKeyCode:13 });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.equal(await cdp.eval('matchMedia("(min-width:64rem)").matches'), false);
  await waitFor(() => cdp.eval('document.querySelector("#piui-mobile-drawer").open'), 10000, 'keyboard mobile drawer');
  assert.equal(await cdp.eval('document.documentElement.scrollWidth <= innerWidth + 1'), true);
  checks.push('Drawer mobile dibuka melalui keyboard tanpa luapan horizontal');

  await cdp.navigate(base + '/layanan.html');
  await cdp.eval('(() => { const input=document.querySelector("#hd-public-search"); input.value="Bantuan"; input.focus(); input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await waitFor(() => cdp.eval('document.querySelector("#hd-search-suggestions").children.length > 0'), 10000, 'public search suggestions');
  await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'ArrowDown', code:'ArrowDown', windowsVirtualKeyCode:40 });
  assert.ok(await cdp.eval('document.querySelector("#hd-public-search").getAttribute("aria-activedescendant")'));
  assert.equal(await cdp.eval('window.__cspViolations.length'), 0);
  checks.push('Saran pencarian publik dapat dipilih melalui keyboard');

  await logoutSession(cdp);
  const created = await cdp.eval(String.raw`(async () => {
    const bootstrap = await fetch('/api/v1/auth/config');
    const {csrf_token} = await bootstrap.json();
    const capability = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    const response = await fetch('/api/v1/tickets', {
      method:'POST', headers:{'Content-Type':'application/json', 'X-CSRF-Token':csrf_token,
        'X-Guest-Capability':capability, 'Idempotency-Key':crypto.randomUUID()},
      body:JSON.stringify({service_id:'30000000-0000-4000-8000-000000000001',
        service_version:1, form_version:1, policy_version:1,
        title:'Fixture browser Fase 1',description:'Laporan sintetis dari pengujian pintasan',answers:{ringkasan:'Skenario QA desktop'}}),
    });
    const result = await response.json();
    return {status:response.status,id:result.id,message:result.message};
  })()`);
  assert.equal(created.status, 201, created.message);
  await cdp.setViewport(1280, 840);
  await loginRoleKeyword(cdp, 'operator');
  await cdp.navigate(base + '/admin/app/tickets/index.html?filter=verification');
  const locator = JSON.stringify(created.id);
  await waitFor(() => cdp.eval('Array.from(document.querySelectorAll("[data-ticket-list] a[href]")).some(link => link.href.includes(' + locator + '))'), 10000, 'ticket visible in verification queue');
  const ticketLink = await cdp.eval('Array.from(document.querySelectorAll("[data-ticket-list] a[href]")).find(link => link.href.includes(' + locator + ')).href');
  await cdp.navigate(ticketLink);
  await waitFor(() => cdp.eval('document.querySelector(".hd-next-step a")?.textContent === "Periksa dan verifikasi laporan"'), 10000, 'primary action on ticket detail');
  checks.push('Tiket tamu masuk antrean operator dan detail memprioritaskan verifikasi');
  report.result = 'PASS';
} catch (err) {
  report.error = err.message;
  report.browserState = await cdp.eval('({ path:location.pathname, width:innerWidth, active:document.activeElement?.id, drawer:document.querySelector("#piui-mobile-drawer")?.open, expanded:document.querySelector("#btn-sidebar-toggle")?.getAttribute("aria-expanded"), csp:window.__cspViolations?.length })').catch(() => null);
} finally {
  await close();
  await fs.mkdir(path.dirname(evidence), { recursive: true });
  await fs.writeFile(evidence, JSON.stringify(report, null, 2) + '\n');
}
console.log(report.result, checks.length + ' browser checks', report.error ?? '');
if (report.result !== 'PASS') process.exitCode = 1;
