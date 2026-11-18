#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.HELPDESK_BASE_URL || 'http://127.0.0.1:18090';
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.EDGE_S2_CDP_PORT || 9237);

const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
          else entry.resolve(msg.result ?? {});
        }
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {});
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20000);
      this.pending.set(id, {
        method,
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => this.listeners.get(method)?.delete(fn);
  }
  waitForEvent(method, pred = () => true, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error(`Timeout waiting for ${method}`)); }, timeoutMs);
      const off = this.on(method, params => {
        if (pred(params)) { clearTimeout(timer); off(); resolve(params); }
      });
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`JS error: ${res.exceptionDetails.text} ${JSON.stringify(res.exceptionDetails.exception?.description || '')}`);
    }
    return res.result?.value;
  }
  async navigate(url, waitMs = 550) {
    console.log('-> navigate:', url);
    const loaded = this.waitForEvent('Page.loadEventFired', () => true, 20000);
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(waitMs);
  }
  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: mobile ? 2 : 1, mobile,
    });
  }
}

async function waitFor(fn, timeoutMs = 12000, msg = 'condition') {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    await sleep(120);
  }
  throw new Error(`waitFor timeout (${msg})${lastErr ? ': ' + lastErr.message : ''}`);
}

async function launchEdge() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-s2-edge-'));
  const proc = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--window-size=1280,840',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let ver;
  await waitFor(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (!r.ok) return false;
      ver = await r.json();
      return Boolean(ver.webSocketDebuggerUrl);
    } catch { return false; }
  }, 12000, 'Edge CDP endpoint');

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const pageTarget = targets.find(t => t.type === 'page');
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'No page target found');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => {
        window.__cspViolations.push({ directive: e.violatedDirective, blockedURI: e.blockedURI });
      });
    `,
  });
  return {
    cdp,
    close: async () => {
      try { ws.close(); } catch {}
      try { proc.kill('SIGKILL'); } catch {}
      await sleep(250);
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function logoutSession(cdp) {
  await cdp.eval(`(async () => {
    try {
      const me = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (me.ok) {
        const s = await me.json();
        const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
          body: JSON.stringify({ expected_version: s.version, reason: 'Select2 & Subject E2E switch' })
        });
      }
    } catch {}
  })()`);
  await cdp.send('Network.clearBrowserCookies');
}

async function loginByKeyword(cdp, roleKeyword) {
  await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
  await waitFor(() => cdp.eval(`(() => { const s = document.querySelector('#hd-subject'); return s && s.options.length > 0 && s.closest('.hd-s2') !== null; })()`), 10000, 'lab subject Select2');
  const picked = await cdp.eval(`(() => {
    const sel = document.querySelector('#hd-subject');
    const wrap = sel.closest('.hd-s2');
    const trigger = wrap.querySelector('.hd-s2-trigger');
    trigger.click();
    const search = wrap.querySelector('.hd-s2-search');
    search.value = ${JSON.stringify(roleKeyword)};
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const firstOpt = wrap.querySelector('.hd-s2-option:not(.is-disabled)');
    if (!firstOpt) return null;
    firstOpt.click();
    return { val: sel.value, label: trigger.textContent.trim() };
  })()`);
  assert.ok(picked?.val, `Select2 search must match "${roleKeyword}"`);
  await cdp.eval(`document.querySelector('[data-hd-lab-select]')?.click()`);
  await waitFor(() => cdp.eval(`!location.pathname.endsWith('/login.html')`), 10000, `redirect after ${roleKeyword}`);
  await sleep(450);
  return picked;
}

async function checkAllSelectsEnhanced(cdp, contextName) {
  const stats = await cdp.eval(`(() => {
    const selects = Array.from(document.querySelectorAll('select:not([data-select2-ignore])'));
    const unenhanced = selects.filter(s => !s.closest('.hd-s2')).map(s => s.id || s.name || s.outerHTML.slice(0, 80));
    const nestedButtons = document.querySelectorAll('button button').length;
    const inlineStylesOnS2 = document.querySelectorAll('.hd-s2 [style], .hd-s2[style]').length;
    return { total: selects.length, unenhanced, nestedButtons, inlineStylesOnS2 };
  })()`);
  assert.deepEqual(stats.unenhanced, [], `${contextName}: unenhanced selects found: ${stats.unenhanced.join(', ')}`);
  assert.equal(stats.nestedButtons, 0, `${contextName}: button inside button forbidden`);
  assert.equal(stats.inlineStylesOnS2, 0, `${contextName}: inline style on Select2 forbidden (CSP)`);
  console.log(`  [OK] ${contextName}: ${stats.total} <select> enhanced to Select2 (0 unenhanced, 0 nested buttons, 0 inline styles)`);
}

async function main() {
  const { cdp, close } = await launchEdge();
  const consoleErrors = [];
  const exceptions = [];
  const cspViolations = [];
  cdp.on('Runtime.consoleAPICalled', e => {
    if (e.type === 'error') consoleErrors.push(e.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  cdp.on('Runtime.exceptionThrown', e => exceptions.push(e.exceptionDetails?.text || 'exception'));

  try {
    // 1. Login via Select2 search on /admin/auth/login.html as Super Admin
    await loginByKeyword(cdp, 'super admin');

    // 2. Daftar Akun Pengguna (?kind=subjects#new): #new auto-focus, role sync, Create, Edit, Toggle
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=subjects#new`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr').length > 0 && document.querySelector('#hd-subject-kind')?.closest('.hd-s2') !== null`), 10000, 'subjects page & Select2 ready');
    await checkAllSelectsEnhanced(cdp, 'Admin Subjects (?kind=subjects)');

    const formInit = await cdp.eval(`(() => {
      const f = document.querySelector('[data-hd-master-form]');
      return {
        hidden: f.hidden,
        creating: f.classList.contains('is-creating'),
        title: document.querySelector('[data-hd-editor-title]')?.textContent?.trim(),
        masterPickerOptgroups: document.querySelectorAll('#hd-master-kind optgroup').length,
      };
    })()`);
    assert.equal(formInit.hidden, false, '#new hash must show master form');
    assert.equal(formInit.creating, true, '#new hash must open form in is-creating mode');
    assert.match(formInit.title, /Tambah akun pengguna/i);
    assert.ok(formInit.masterPickerOptgroups >= 2, 'Master picker should render optgroups in Select2');

    // Test dynamic subject-kind -> subject-role option sync
    const roleFilterCheck = await cdp.eval(`(() => {
      const kindSel = document.querySelector('#hd-subject-kind');
      const roleSel = document.querySelector('#hd-subject-role');
      const roleWrap = roleSel.closest('.hd-s2');
      const visibleRoles = () => Array.from(roleWrap.querySelectorAll('.hd-s2-option')).map(li => li.textContent.trim());

      kindSel.value = 'ASN';
      kindSel.dispatchEvent(new Event('change', { bubbles: true }));
      roleWrap.querySelector('.hd-s2-trigger').click();
      const asnOpts = visibleRoles();
      roleWrap.querySelector('.hd-s2-trigger').click();

      kindSel.value = 'PUBLIC';
      kindSel.dispatchEvent(new Event('change', { bubbles: true }));
      roleWrap.querySelector('.hd-s2-trigger').click();
      const pubOpts = visibleRoles();
      roleWrap.querySelector('.hd-s2-trigger').click();

      kindSel.value = 'STAFF';
      kindSel.dispatchEvent(new Event('change', { bubbles: true }));
      return { asnOpts, pubOpts, roleNow: roleSel.value };
    })()`);
    assert.equal(roleFilterCheck.asnOpts.length, 1, 'ASN kind must only allow ASN role');
    assert.equal(roleFilterCheck.pubOpts.length, 1, 'PUBLIC kind must only allow PUBLIC role');
    assert.equal(roleFilterCheck.roleNow, 'OPERATOR', 'Switching back to STAFF resets default OPERATOR role');

    const uniq = Date.now().toString().slice(-6);
    const testNameBase = `Operator Select2 ${uniq}`;
    const testNameUpdated = `${testNameBase} Updated`;
    const testEmail = `s2.uji.${uniq}@depok.go.id`;
    const testNip = `19950101${uniq}01`;
    const testPw = 'SandiKuat#2026';

    // Submit Create Subject via UI
    await cdp.eval(`(() => {
      const f = document.querySelector('[data-hd-master-form]');
      f.elements['name'].value = ${JSON.stringify(testNameBase)};
      f.elements['subject-kind'].value = 'STAFF';
      f.elements['subject-kind'].dispatchEvent(new Event('change', { bubbles: true }));
      f.elements['subject-role'].value = 'OPERATOR';
      f.elements['subject-role'].dispatchEvent(new Event('change', { bubbles: true }));
      f.elements['external-ref'].value = ${JSON.stringify(testNip)};
      f.elements['email'].value = ${JSON.stringify(testEmail)};
      f.elements['phone'].value = '081299990001';
      f.elements['password'].value = ${JSON.stringify(testPw)};
      document.querySelector('[data-hd-master-form] button[type="submit"]').click();
    })()`);

    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-save-status]')?.textContent || '').includes('Tersimpan pada server')`), 5000, 'Subject created save status').catch(async err => {
      const diag = await cdp.eval(`(() => {
        const f = document.querySelector('[data-hd-master-form]');
        return {
          saveStatus: document.querySelector('[data-hd-save-status]')?.textContent,
          status: document.querySelector('[data-hd-status]')?.textContent,
          valid: f?.checkValidity(),
          invalidFields: Array.from(f?.elements || []).filter(x => x.willValidate && !x.checkValidity()).map(x => x.name + ':' + x.validationMessage),
          btnDisabled: f?.querySelector('button[type="submit"]')?.disabled,
        };
      })()`);
      throw new Error(`${err.message} | DIAG=${JSON.stringify(diag)}`);
    });
    const createdRowInfo = await waitFor(() => cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      if (!hit) return null;
      return { c0: hit.cells[0].textContent, c1: hit.cells[1].textContent, c2: hit.cells[2].textContent };
    })()`), 10000, 'new subject row rendered');
    assert.ok(createdRowInfo.c0.includes(testNameBase));
    assert.match(createdRowInfo.c1, new RegExp(testEmail));
    assert.match(createdRowInfo.c2, /^Aktif · v1$/);

    // Edit created subject -> update name without re-entering password -> v2
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      hit.querySelectorAll('button')[0].click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-master-form]')?.classList.contains('is-editing')`), 5000, 'subject edit mode');
    await cdp.eval(`(() => {
      const f = document.querySelector('[data-hd-master-form]');
      f.elements['name'].value = ${JSON.stringify(testNameUpdated)};
      document.querySelector('[data-hd-master-form] button[type="submit"]').click();
    })()`);
    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-save-status]')?.textContent || '').includes('Versi 2')`), 10000, 'subject updated v2');

    // Toggle Nonaktifkan -> Confirm Modal -> v3 -> Aktifkan -> v4
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      hit.querySelectorAll('button')[1].click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'subject archive confirm open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(() => cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      return hit && hit.cells[2].textContent.trim() === 'Nonaktif · v3';
    })()`), 10000, 'subject deactivated v3');

    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      hit.querySelectorAll('button')[1].click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'subject reactivate confirm open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(() => cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr'));
      const hit = rows.find(r => (r.cells[1]?.textContent || '').includes(${JSON.stringify(testEmail)}));
      return hit && hit.cells[2].textContent.trim() === 'Aktif · v4';
    })()`), 10000, 'subject reactivated v4');
    console.log('  [OK] Subjects CRUD: create -> edit -> deactivate -> reactivate verified in UI');

    // 3. Memberships (?kind=memberships#new): Quick shortcuts, Select2 live search + keyboard, clear, invalid focus
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=memberships#new`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('#hd-member-subject')?.options.length > 2`), 10000, 'memberships subjects options');
    await checkAllSelectsEnhanced(cdp, 'Admin Memberships (?kind=memberships)');

    const shortcutsOk = await cdp.eval(`(() => {
      const sSub = document.querySelector('[data-hd-shortcut="subjects"]');
      const sOrg = document.querySelector('[data-hd-shortcut="organizations"]');
      return {
        subVisible: Boolean(sSub && !sSub.hidden && sSub.getAttribute('href')?.includes('kind=subjects#new')),
        orgVisible: Boolean(sOrg && !sOrg.hidden && sOrg.getAttribute('href')?.includes('kind=organizations#new')),
      };
    })()`);
    assert.equal(shortcutsOk.subVisible, true, 'Shortcut + Buat Akun Pengguna Baru must be visible on memberships');
    assert.equal(shortcutsOk.orgVisible, true, 'Shortcut + Tambah Perangkat Daerah Baru must be visible for Super Admin on memberships');

    // Search newly created user in #hd-member-subject Select2 + select via keyboard Enter + clear via x
    const s2MemberInteract = await cdp.eval(`(() => {
      const sel = document.querySelector('#hd-member-subject');
      const wrap = sel.closest('.hd-s2');
      wrap.querySelector('.hd-s2-trigger').click();
      const search = wrap.querySelector('.hd-s2-search');
      search.value = ${JSON.stringify(testNameUpdated)};
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const matches = wrap.querySelectorAll('.hd-s2-option').length;
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const selectedAfterEnter = sel.value;
      const clearBtn = wrap.querySelector('.hd-s2-clear');
      const clearVisible = !clearBtn.hidden;
      clearBtn.click();
      const clearedVal = sel.value;
      return { matches, selectedAfterEnter, clearVisible, clearedVal };
    })()`);
    assert.equal(s2MemberInteract.matches, 1, 'Select2 search should isolate newly created subject');
    assert.ok(s2MemberInteract.selectedAfterEnter, 'Enter key must select highlighted option');
    assert.equal(s2MemberInteract.clearVisible, true, 'Clear button must appear for selected option');
    assert.equal(s2MemberInteract.clearedVal, '', 'Clear button must reset select value to empty');

    // Verify native required validation marks .is-invalid & focuses trigger
    const invalidOk = await cdp.eval(`(() => {
      const f = document.querySelector('[data-hd-master-form]');
      const sel = document.querySelector('#hd-member-subject');
      const wrap = sel.closest('.hd-s2');
      const trigger = wrap.querySelector('.hd-s2-trigger');
      f.checkValidity();
      return {
        hasInvalid: wrap.classList.contains('is-invalid'),
        focusedTrigger: document.activeElement === trigger,
      };
    })()`);
    assert.equal(invalidOk.hasInvalid, true, 'Invalid required native select must add .is-invalid on Select2 wrapper');
    assert.equal(invalidOk.focusedTrigger, true, 'Invalid event on hidden native select must focus Select2 trigger');

    // Check Escape closes dropdown cleanly
    const escClosed = await cdp.eval(`(() => {
      const wrap = document.querySelector('#hd-member-subject').closest('.hd-s2');
      wrap.querySelector('.hd-s2-trigger').click();
      const openBefore = wrap.classList.contains('is-open');
      wrap.querySelector('.hd-s2-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const openAfter = wrap.classList.contains('is-open');
      return { openBefore, openAfter };
    })()`);
    assert.equal(escClosed.openBefore, true);
    assert.equal(escClosed.openAfter, false, 'Escape must close Select2 dropdown');

    // Mobile responsive check on memberships with dropdown open
    await cdp.setViewport(390, 844, true);
    await sleep(300);
    const mobOverflow = await cdp.eval(`(() => {
      const wrap = document.querySelector('#hd-member-subject').closest('.hd-s2');
      wrap.querySelector('.hd-s2-trigger').click();
      const res = {
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        ddRight: wrap.querySelector('.hd-s2-dropdown').getBoundingClientRect().right,
      };
      wrap.querySelector('.hd-s2-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return res;
    })()`);
    assert.ok(mobOverflow.sw <= mobOverflow.iw + 2, `Mobile 390px horizontal overflow: ${mobOverflow.sw} > ${mobOverflow.iw}`);
    assert.ok(mobOverflow.ddRight <= mobOverflow.iw + 2, `Mobile Select2 dropdown overflows right edge: ${mobOverflow.ddRight}`);
    await cdp.setViewport(1280, 840, false);

    // 4. Multiple Select2 Chips (?kind=services edit policy #hd-mime & #hd-audience)
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=services`, 750);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length > 0`), 10000, 'services table loaded');
    await cdp.eval(`document.querySelector('[data-hd-rows] tr button')?.click()`);
    await waitFor(() => cdp.eval(`document.querySelector('#hd-mime')?.closest('.hd-s2--multiple') !== null && !document.querySelector('#hd-mime').disabled`), 10000, 'service policy multiple select loaded');
    const multiCheck = await cdp.eval(`(() => {
      const mimeSel = document.querySelector('#hd-mime');
      const wrap = mimeSel.closest('.hd-s2--multiple');
      const tagsBefore = wrap.querySelectorAll('.hd-s2-tag').length;
      const firstRemove = wrap.querySelector('.hd-s2-tag__remove');
      const selectedBefore = mimeSel.selectedOptions.length;
      if (firstRemove) firstRemove.click();
      const selectedAfterRemove = mimeSel.selectedOptions.length;
      const tagsAfterRemove = wrap.querySelectorAll('.hd-s2-tag').length;
      // Also click trigger & select a value via dropdown option
      wrap.querySelector('.hd-s2-trigger').click();
      const unselectedOpt = Array.from(wrap.querySelectorAll('.hd-s2-option')).find(o => !o.classList.contains('is-selected'));
      if (unselectedOpt) unselectedOpt.click();
      const selectedAfterAdd = mimeSel.selectedOptions.length;
      return { tagsBefore, selectedBefore, selectedAfterRemove, tagsAfterRemove, selectedAfterAdd };
    })()`);
    assert.ok(multiCheck.selectedBefore >= 1, 'Service policy must load at least 1 selected MIME');
    assert.equal(multiCheck.tagsBefore, multiCheck.selectedBefore, 'Select2 tag chip count must match selectedOptions');
    assert.equal(multiCheck.selectedAfterRemove, multiCheck.selectedBefore - 1, 'Clicking tag chip remove must deselect native option');
    assert.equal(multiCheck.tagsAfterRemove, multiCheck.selectedAfterRemove);
    assert.equal(multiCheck.selectedAfterAdd, multiCheck.selectedAfterRemove + 1, 'Clicking multi-select dropdown option must add chip');
    console.log('  [OK] Multiple Select2 chips + tag removal + dropdown sync verified on #hd-mime');

    // 5. Negative Security & Conflict API Tests for /admin/subjects + Clean up E2E account password/status
    const secResults = await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const hdr = () => ({ 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok });
      const me = await (await fetch('/api/v1/auth/me', { credentials: 'include' })).json();
      const list = await (await fetch('/api/v1/admin/subjects?limit=100&include_inactive=1', { credentials: 'include' })).json();
      const target = list.items.find(s => s.email === ${JSON.stringify(testEmail)});

      const dup = await fetch('/api/v1/admin/subjects', {
        method: 'POST', credentials: 'include', headers: hdr(),
        body: JSON.stringify({ name: 'Dup Email', kind: 'STAFF', role: 'OPERATOR', email: ${JSON.stringify(testEmail)}, active: true }),
      });
      const mismatch = await fetch('/api/v1/admin/subjects', {
        method: 'POST', credentials: 'include', headers: hdr(),
        body: JSON.stringify({ name: 'Bad KindRole', kind: 'ASN', role: 'OPERATOR', active: true }),
      });
      const stale = await fetch('/api/v1/admin/subjects/' + target.id, {
        method: 'PUT', credentials: 'include', headers: hdr(),
        body: JSON.stringify({ expected_version: 1, name: 'Stale', kind: 'STAFF', role: 'OPERATOR', active: true }),
      });
      const selfDeact = await fetch('/api/v1/admin/subjects/' + me.actor.subject_id, {
        method: 'PUT', credentials: 'include', headers: hdr(),
        body: JSON.stringify({ expected_version: 1, name: me.actor.name, kind: 'STAFF', role: me.actor.role, active: false }),
      });
      return {
        targetId: target.id,
        targetVersion: target.version,
        dupStatus: dup.status,
        mismatchStatus: mismatch.status,
        staleStatus: stale.status,
        selfDeactStatus: selfDeact.status,
      };
    })()`);
    assert.equal(secResults.dupStatus, 409, 'Duplicate email must return 409 Conflict');
    assert.equal(secResults.mismatchStatus, 422, 'Kind/role mismatch must return 422');
    assert.equal(secResults.staleStatus, 409, 'Stale expected_version must return 409 Conflict');
    assert.equal(secResults.selfDeactStatus, 422, 'Self-deactivation must return 422');

    // Non-SUPER_ADMIN negative check (Operator -> 403) + Local login with newly created account
    await logoutSession(cdp);
    await loginByKeyword(cdp, 'operator');
    const opForbidden = await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const res = await fetch('/api/v1/admin/subjects', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({ name: 'Unauth Create', kind: 'STAFF', role: 'OPERATOR', active: true }),
      });
      return res.status;
    })()`);
    assert.equal(opForbidden, 403, 'Operator without identity.grant must receive 403 on POST /admin/subjects');

    // Coordinator ticket queue Select2 check
    await logoutSession(cdp);
    await loginByKeyword(cdp, 'koordinator');
    await cdp.navigate(`${BASE}/admin/app/tickets/index.html`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('#queue-filter-service')?.options.length >= 1`), 10000, 'ticket queue filters');
    await checkAllSelectsEnhanced(cdp, 'Admin Tickets Queue');

    // Local UI form login using newly created account's email & password
    await logoutSession(cdp);
    await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
    await waitFor(() => cdp.eval(`(() => { const i = document.querySelector('input[name="identifier"]'); const b = i?.closest('form')?.querySelector('button[type="submit"]'); return i && b && !b.disabled; })()`), 8000, 'manual credential login form ready');
    await cdp.eval(`(() => {
      const i = document.querySelector('input[name="identifier"]');
      const f = i.closest('form');
      i.value = ${JSON.stringify(testEmail)};
      f.querySelector('input[name="password"]').value = ${JSON.stringify(testPw)};
      f.querySelector('button[type="submit"]').click();
    })()`);
    await waitFor(() => cdp.eval(`!location.pathname.endsWith('/login.html')`), 10000, 'redirect after manual credential login');
    const localMe = await cdp.eval(`(async () => {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, name: data.actor?.name, role: data.actor?.role };
    })()`);
    assert.equal(localMe.status, 200, `Created account must login cleanly with password (got ${localMe.status})`);
    assert.equal(localMe.name, testNameUpdated);

    // Clean up all E2E test subjects (including any left over from an earlier interrupted run)
    await logoutSession(cdp);
    await loginByKeyword(cdp, 'super admin');
    await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const list = await (await fetch('/api/v1/admin/subjects?limit=100', { credentials: 'include' })).json();
      for (const s of (list.items || []).filter(x => x.active !== false && x.name && x.name.startsWith('Operator Select2'))) {
        await fetch('/api/v1/admin/subjects/' + s.id, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
          body: JSON.stringify({
            expected_version: s.version || 1,
            name: s.name,
            kind: s.kind || 'STAFF',
            role: s.role || 'OPERATOR',
            external_ref: s.external_ref || '',
            email: s.email || '',
            phone: s.phone || '',
            active: false,
          }),
        });
      }
    })()`);
    console.log('  [OK] Security & local password login checks passed; test subject deactivated');

    // 6. Web Publik Select2 Verification (/akses.html, /layanan.html, /lapor.html desktop + 390x844 mobile)
    await logoutSession(cdp);
    await cdp.navigate(`${BASE}/akses.html`, 600);
    await waitFor(() => cdp.eval(`document.querySelector('#hd-subject')?.options.length > 0`), 10000, '/akses.html subjects');
    await checkAllSelectsEnhanced(cdp, 'Web Publik (/akses.html)');

    await cdp.navigate(`${BASE}/layanan.html`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-catalog] > *').length > 0`), 10000, '/layanan.html catalog');
    await checkAllSelectsEnhanced(cdp, 'Web Publik (/layanan.html)');

    const publicServiceId = await cdp.eval(`(() => {
      const a = document.querySelector('a[href*="lapor.html?id="]');
      if (!a) return '';
      return new URL(a.href).searchParams.get('id') || '';
    })()`);
    assert.ok(publicServiceId, 'Catalog must provide a public id link to /lapor.html');

    await cdp.navigate(`${BASE}/lapor.html?id=${encodeURIComponent(publicServiceId)}`, 800);
    await waitFor(() => cdp.eval(`document.querySelector('#report-category')?.closest('.hd-s2') !== null`), 10000, '/lapor.html Select2');
    await cdp.eval(`(() => {
      const chk = document.querySelector('#report-asn-guest');
      if (chk && !chk.checked) chk.click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('#report-organization')?.options.length >= 1`), 10000, '/lapor.html organization picker');
    await checkAllSelectsEnhanced(cdp, 'Web Publik (/lapor.html)');

    // Check /lapor.html mobile 390x844
    await cdp.setViewport(390, 844, true);
    await sleep(300);
    const pubMob = await cdp.eval(`(() => {
      const wrap = document.querySelector('#report-organization').closest('.hd-s2');
      wrap.querySelector('.hd-s2-trigger').click();
      const res = {
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        ddRight: wrap.querySelector('.hd-s2-dropdown').getBoundingClientRect().right,
      };
      wrap.querySelector('.hd-s2-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return res;
    })()`);
    assert.ok(pubMob.sw <= pubMob.iw + 2, `Public /lapor.html mobile overflow: ${pubMob.sw} > ${pubMob.iw}`);
    assert.ok(pubMob.ddRight <= pubMob.iw + 2, `Public /lapor.html Select2 dropdown overflows right edge: ${pubMob.ddRight}`);
    await cdp.setViewport(1280, 840, false);

    const cspFinal = await cdp.eval(`window.__cspViolations || []`);
    for (const v of cspFinal) cspViolations.push(v);

    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    assert.equal(exceptions.length, 0, `Unexpected uncaught exceptions: ${exceptions.join('; ')}`);
    assert.equal(cspViolations.length, 0, `Unexpected CSP violations: ${JSON.stringify(cspViolations)}`);
    console.log('PASS Select2 Combo Boxes (Web Publik + Web Admin) & Account CRUD (?kind=subjects) E2E');
  } finally {
    await close();
  }
}

main().catch(err => {
  console.error('FAIL Select2 & Subjects E2E:', err);
  process.exit(1);
});
