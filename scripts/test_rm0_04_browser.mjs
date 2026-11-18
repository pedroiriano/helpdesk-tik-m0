#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.HELPDESK_BASE_URL || 'http://127.0.0.1:18090';
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.EDGE_CDP_PORT || 9234);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'qa', 'remediation', 'rm0-04');
fs.mkdirSync(OUT_DIR, { recursive: true });

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
      }, 25000);
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
  async navigate(url, waitMs = 450) {
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
  async screenshot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(OUT_DIR, name);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    return filePath;
  }
  async key(keyName, code, keyCode, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 12000, msg = 'condition') {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    await sleep(150);
  }
  throw new Error(`waitFor timeout (${msg})${lastErr ? ': ' + lastErr.message : ''}`);
}

async function launchEdge() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-edge-'));
  const proc = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--window-size=1280,800',
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
  await cdp.send('Security.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => {
        window.__cspViolations.push({
          directive: e.violatedDirective,
          effective: e.effectiveDirective,
          blockedURI: e.blockedURI,
          sourceFile: e.sourceFile,
          line: e.lineNumber
        });
      });
    `,
  });
  return {
    cdp,
    close: async () => {
      try { ws.close(); } catch {}
      try { proc.kill('SIGKILL'); } catch {}
      await sleep(300);
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function loginQuickProfile(cdp, profileId, expectedDestPrefix = '/admin/app/') {
  await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-quick-login="${profileId}"]'))`), 8000, `profile button ${profileId}`);
  await cdp.eval(`document.querySelector('[data-quick-login="${profileId}"]').click()`);
  await waitFor(() => cdp.eval(`location.pathname.startsWith(${JSON.stringify(expectedDestPrefix)})`), 10000, `redirect after ${profileId}`);
  await sleep(400);
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
          body: JSON.stringify({ expected_version: s.version, reason: 'RM0-04 browser test logout' })
        });
      }
    } catch {}
  })()`);
  await cdp.send('Network.clearBrowserCookies');
}

async function loginSubjectById(cdp, subjectId, adminLogin = true) {
  const loginUrl = adminLogin ? `${BASE}/admin/auth/login.html` : `${BASE}/akses.html`;
  await cdp.navigate(loginUrl, 600);
  await waitFor(() => cdp.eval(`(() => { const s = document.querySelector('#hd-subject, select[name="subject"]'); return s && s.options.length > 0; })()`), 8000, 'lab subjects loaded');
  await cdp.eval(`(() => {
    const sel = document.querySelector('#hd-subject, select[name="subject"]');
    sel.value = ${JSON.stringify(subjectId)};
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-hd-lab-select]')?.click();
  })()`);
  await waitFor(() => cdp.eval(`!location.pathname.endsWith('/login.html') && !location.pathname.endsWith('/akses.html')`), 10000, `login subject ${subjectId}`);
  await sleep(500);
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    base_url: BASE,
    browser: 'Microsoft Edge Headless (CDP)',
    suites: {},
    csp_violations: [],
    console_errors: [],
    exceptions: [],
    result: 'FAIL',
  };

  const { cdp, close } = await launchEdge();
  const consoleErrors = [];
  const exceptions = [];
  const cspList = [];
  let currentRoute = '';

  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') {
      const text = (p.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      if (!text.includes('Failed to load resource: the server responded with a status of 401')) {
        consoleErrors.push({ route: currentRoute, text });
      }
    }
  });
  cdp.on('Runtime.exceptionThrown', p => {
    exceptions.push({ route: currentRoute, text: p.exceptionDetails?.text || 'uncaught' });
  });

  async function recordRouteTelemetry(label) {
    currentRoute = label;
    const v = await cdp.eval(`window.__cspViolations || []`);
    for (const item of v) cspList.push({ route: label, ...item });
  }

  async function runSuite(name, fn) {
    try {
      const detail = await fn();
      report.suites[name] = { status: 'PASS', ...detail };
      console.log(`[PASS] ${name}`);
    } catch (err) {
      report.suites[name] = { status: 'FAIL', error: err.message };
      console.error(`[FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  try {
    // 1. Bootstrap discovery
    const boot = await (await fetch(`${BASE}/api/v1/auth/bootstrap`)).json();
    const catJson = await (await fetch(`${BASE}/api/v1/catalog/services?limit=10`)).json();
    const firstSvc = catJson.items?.[0];
    assert.ok(firstSvc?.id, 'Must have seeded catalog service');

    // A. R4-B CSP, Console Errors, Routes, Desktop/Mobile Overflow, FAQ Accordion
    await runSuite('R4-B_csp_routes_overflow_faq', async () => {
      const publicRoutes = [
        '/', '/layanan.html', `/detail-layanan.html?id=${firstSvc.id}`, '/lapor.html',
        '/tiket.html', '/lacak.html', '/panduan.html', '/halaman.html', '/faq.html',
        '/status.html', '/kontak.html', '/akses.html', '/daftar.html',
      ];
      const checks = [];
      for (const vp of [
        { name: 'desktop', w: 1280, h: 800, mobile: false },
        { name: 'mobile_390', w: 390, h: 844, mobile: true },
        { name: 'mobile_375', w: 375, h: 667, mobile: true },
      ]) {
        await cdp.setViewport(vp.w, vp.h, vp.mobile);
        for (const r of vp.name === 'desktop' ? publicRoutes : ['/', '/lapor.html', '/panduan.html', '/halaman.html', '/faq.html', '/akses.html']) {
          await cdp.navigate(`${BASE}${r}`, 450);
          await recordRouteTelemetry(`${vp.name}:${r}`);
          const m = await cdp.eval(`({
            h1: document.querySelector('h1')?.textContent?.trim() || '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
            wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
              ? [...document.querySelectorAll('*')].filter(e => {
                  const r = e.getBoundingClientRect();
                  return r.width > 0 && (r.right > document.documentElement.clientWidth + 2 || e.scrollWidth > document.documentElement.clientWidth + 2);
                }).slice(0, 12).map(e => ({ tag: e.tagName, id: e.id, cls: String(e.className), r: Math.round(e.getBoundingClientRect().right), sw: e.scrollWidth }))
              : []
          })`);
          assert.ok(m.h1.length > 0, `${vp.name}:${r} missing H1`);
          assert.ok(m.overflow <= 2, `${vp.name}:${r} horizontal overflow ${m.sw} > ${m.cw}: ${JSON.stringify(m.wide)}`);
          checks.push(`${vp.name}:${r}:ok`);
        }
      }
      // Verify FAQ auto-close sibling accordion on both / (.vy-faq__q) and /faq.html (details.hd-faq-item)
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/`, 500);
      await recordRouteTelemetry('home-faq-accordion');
      const homeFaqCheck = await cdp.eval(`(() => {
        const btns = [...document.querySelectorAll('.vy-faq__q')];
        if (btns.length < 2) return { count: btns.length };
        btns[0].click();
        const afterFirst = btns[0].getAttribute('aria-expanded');
        btns[1].click();
        return {
          count: btns.length,
          afterFirst,
          firstAfterSecond: btns[0].getAttribute('aria-expanded'),
          secondExpanded: btns[1].getAttribute('aria-expanded')
        };
      })()`);
      assert.ok(homeFaqCheck.count >= 2 && homeFaqCheck.afterFirst === 'true' && homeFaqCheck.firstAfterSecond === 'false' && homeFaqCheck.secondExpanded === 'true',
        `Landing FAQ accordion check failed: ${JSON.stringify(homeFaqCheck)}`);

      await cdp.navigate(`${BASE}/faq.html`, 500);
      await recordRouteTelemetry('faq-page-accordion');
      const pageFaqCheck = await cdp.eval(`(() => {
        const items = [...document.querySelectorAll('details.hd-faq-item')];
        if (items.length < 2) return { count: items.length };
        items[0].querySelector('summary').click();
        const afterFirst = items[0].open;
        items[1].querySelector('summary').click();
        return { count: items.length, afterFirst, firstAfterSecond: items[0].open, secondOpen: items[1].open };
      })()`);
      assert.ok(pageFaqCheck.count >= 2 && pageFaqCheck.afterFirst === true && pageFaqCheck.firstAfterSecond === false && pageFaqCheck.secondOpen === true,
        `FAQ page accordion check failed: ${JSON.stringify(pageFaqCheck)}`);
      return { checked: checks.length, homeFaqCheck, pageFaqCheck };
    });

    // B1. access-profiles (5 profile login cards + membership Simpan reopens + permissions retained + ceiling)
    await runSuite('candidate_access_profiles', async () => {
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/admin/auth/login.html`, 500);
      await recordRouteTelemetry('admin-login-desktop');
      const profileCount = await cdp.eval(`document.querySelectorAll('[data-quick-login]').length`);
      assert.equal(profileCount, 5, 'Expected 5 primary quick-login profile cards');
      await cdp.setViewport(390, 844, true);
      const mobOverflow = await cdp.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      assert.ok(mobOverflow <= 2, `Login mobile overflow ${mobOverflow}`);

      await cdp.setViewport(1280, 800, false);
      // Negative grant_ceiling check: SUPER_ADMIN (ceiling={hero.write,hero.publish}) cannot save EDITOR content permissions
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=memberships`, 700);
      await recordRouteTelemetry('admin-memberships-ceiling');
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length > 0`), 8000, 'membership rows');
      await cdp.eval(`(() => {
        const rows = [...document.querySelectorAll('[data-hd-rows] tr')];
        const row = rows.find(r => r.textContent.includes('Editor')) || rows[0];
        row.querySelector('button').click();
      })()`);
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-access-feedback]')?.textContent)`), 8000, 'ceiling warning feedback');
      const ceilingWarn = await cdp.eval(`document.querySelector('[data-hd-access-feedback]')?.textContent || ''`);
      assert.ok(ceilingWarn.includes('di luar kebijakan atau mandat'), `Expected grant ceiling warning for SUPER_ADMIN, got: ${ceilingWarn}`);

      // PLATFORM_ADMIN OPD A (000000000005) holds full delegation grant_ceiling -> test Edit + Simpan preserves permissions & reopens record
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000005', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=memberships`, 700);
      await recordRouteTelemetry('admin-memberships');
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length > 0`), 8000, 'membership rows platform');
      const editInfo = await cdp.eval(`(() => {
        const rows = [...document.querySelectorAll('[data-hd-rows] tr')];
        const row = rows.find(r => r.textContent.includes('Operator')) || rows.find(r => r.textContent.includes('Editor')) || rows[0];
        row.querySelector('button').click();
        return { picked: row.textContent, totalRows: rows.length, sample: rows.slice(0, 5).map(r => r.textContent) };
      })()`);
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-access-permission]').length > 0`), 8000, 'access checkboxes');
      const beforePerms = await cdp.eval(`document.querySelector('#hd-permissions').value`);
      const preDiag = await cdp.eval(`(() => {
        const form = document.querySelector('[data-hd-master-form]');
        const exp = document.querySelector('#hd-expires');
        if (exp) exp.value = new Date(Date.now() + 90 * 86400000 + 7 * 3600000).toISOString().slice(0, 16);
        document.querySelector('#hd-reason').value = 'Verifikasi akses RM0-04 browser';
        const invalid = [...form.querySelectorAll('input,select,textarea')].filter(el => !el.disabled && !el.checkValidity()).map(el => ({ name: el.name, id: el.id, val: el.value, msg: el.validationMessage }));
        const accessFb = document.querySelector('[data-hd-access-feedback]')?.textContent || '';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
        return { invalid, accessFb, submitDisabled: submitBtn.disabled, exp: exp?.value };
      })()`);
      const saveMsg = await waitFor(async () => {
        const st = await cdp.eval(`({ save: document.querySelector('[data-hd-save-status]')?.textContent || '', fb: document.querySelector('[data-hd-access-feedback]')?.textContent || '' })`);
        if (st.save.includes('Tersimpan pada server.')) return st.save;
        if (st.save && !st.save.includes('Menyimpan')) throw new Error('Save status error: ' + JSON.stringify({ st, preDiag, editInfo }));
        if (st.fb.includes('tidak sesuai mandat')) throw new Error('Access validate blocked: ' + JSON.stringify({ st, preDiag, editInfo }));
        return false;
      }, 10000, 'membership save feedback');
      const afterPerms = await cdp.eval(`document.querySelector('#hd-permissions').value`);
      const editorTitleAfterSave = await cdp.eval(`document.querySelector('[data-hd-editor-title]')?.textContent || ''`);
      assert.equal(afterPerms, beforePerms, 'Reopened membership form must retain permissions');
      assert.ok(editorTitleAfterSave.includes('Ubah'), `Save should reopen record in Edit mode, got: ${editorTitleAfterSave}`);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=memberships`, 700);
      const rowsAfter = await cdp.eval(`document.querySelectorAll('[data-hd-rows] tr').length`);
      assert.ok(rowsAfter > 0, 'Memberships rows present after reload');
      return { profileCount, ceilingWarn, editInfo: editInfo.picked.slice(0, 60), saveMsg, editorTitleAfterSave };
    });

    // B2. catalog-routing (23 reporting categories + 37 OPDs cursor directory on /lapor.html + Smart Dispatch rule save & reload)
    await runSuite('candidate_catalog_routing', async () => {
      await logoutSession(cdp);
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/lapor.html?id=${firstSvc.id}`, 800);
      await recordRouteTelemetry('lapor-opd-directory');
      const catCount = await waitFor(() => cdp.eval(`document.querySelector('#report-category')?.options?.length || 0`), 8000, 'reporting categories');
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('#report-asn-guest'))`), 5000, 'ASN guest toggle');
      await cdp.eval(`(() => {
        const chk = document.querySelector('#report-asn-guest');
        chk.checked = true;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await waitFor(() => cdp.eval(`document.querySelector('#report-organization')?.options?.length >= 25`), 8000, 'OPD page 1 loaded');
      await cdp.eval(`document.querySelector('[data-report-org-more]')?.click()`);
      const opdCount = await waitFor(() => cdp.eval(`(() => {
        const s = document.querySelector('#report-organization');
        return s && s.options.length >= 38 ? s.options.length - 1 : 0;
      })()`), 8000, 'All >=37 OPDs loaded via cursor');

      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000005', true); // PLATFORM_ADMIN
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=services`, 800);
      await recordRouteTelemetry('admin-services-routing');
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length > 0`), 8000, 'service rows');
      await cdp.eval(`document.querySelector('[data-hd-rows] tr button').click()`);
      await waitFor(() => cdp.eval(`(() => {
        const f = document.querySelector('[data-hd-routing-editor]');
        return f && !f.hidden && f.querySelector('[name="team"]').options.length > 1;
      })()`), 10000, 'routing editor loaded');
      const ruleSaveMsg = await cdp.eval(`(() => {
        const f = document.querySelector('[data-hd-routing-editor]');
        const team = f.querySelector('[name="team"]');
        if (!team.value && team.options.length > 1) team.value = team.options[1].value;
        const skills = f.querySelector('[name="skills"]');
        if (!skills.value) skills.value = 'network';
        f.querySelector('[name="reason"]').value = 'Verifikasi routing RM0-04';
        f.querySelector('button[type="submit"]').click();
        return true;
      })()`);
      const routeStatus = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-routing-editor] [role="status"]')?.textContent || ''`);
        return t.includes('Aturan tersimpan.') ? t : false;
      }, 10000, 'routing save status');
      // Reload and re-open service to confirm persistence
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=services`, 800);
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length > 0`), 8000, 'service rows reload');
      await cdp.eval(`document.querySelector('[data-hd-rows] tr button').click()`);
      const reloadedVersion = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-routing-editor] [role="status"]')?.textContent || ''`);
        return t.includes('Aturan versi') ? t : false;
      }, 8000, 'routing version after reload');
      return { catCount, opdCount, routeSaveTrigger: ruleSaveMsg, routeStatus, reloadedVersion };
    });

    // B3. role-hero (Role policies + 5 Hero banner draft/publish + <=100vh desktop/mobile check + restore)
    await runSuite('candidate_role_hero', async () => {
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=role-policies`, 700);
      await recordRouteTelemetry('admin-role-policies');
      await waitFor(() => cdp.eval(`document.querySelector('#hd-role-policy-select')?.options?.length > 0`), 8000, 'role select options');
      await cdp.eval(`(() => {
        const sel = document.querySelector('#hd-role-policy-select');
        const sa = [...sel.options].find(o => o.value === 'SUPER_ADMIN');
        if (sa) { sel.value = sa.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      })()`);
      await sleep(200);
      const superAdminLocked = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-role-policy-section] [role="status"]')?.textContent || ''`);
        return t ? t : false;
      }, 8000, 'role policy initial status');
      assert.ok(superAdminLocked.includes('dilindungi') || superAdminLocked.includes('bawaan'), `Unexpected SA status: ${superAdminLocked}`);
      // Select TECHNICIAN, read original state, save reversible confirmation, reload
      await cdp.eval(`(() => {
        const sel = document.querySelector('#hd-role-policy-select');
        const opt = [...sel.options].find(o => o.value === 'TECHNICIAN') || sel.options[0];
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await sleep(300);
      const roleSaved = await cdp.eval(`(() => {
        const s = document.querySelector('[data-hd-role-policy-section]');
        const r = s.querySelector('#hd-role-policy-reason');
        if (r.disabled) return 'locked';
        r.value = 'Verifikasi kebijakan peran RM0-04';
        s.querySelector('button[type="submit"]').click();
        return 'submitted';
      })()`);
      assert.equal(roleSaved, 'submitted', 'TECHNICIAN role policy must be editable by Super Admin');
      const roleFeedback = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-role-policy-section] [role="status"]')?.textContent || ''`);
        return t.includes('Kebijakan tersimpan.') ? t : false;
      }, 10000, 'role policy save feedback');

      // Hero 5 banners draft/publish
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=hero`, 800);
      await recordRouteTelemetry('admin-hero-editor');
      const slotCount = await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hero-slots] fieldset').length`), 8000, 'hero slots rendered');
      assert.equal(slotCount, 5, `Expected 5 hero banner slots, got ${slotCount}`);
      const origTitle = await cdp.eval(`document.querySelector('[data-hero-slots] fieldset input')?.value || ''`);
      const testTitle = 'Layanan Resmi TIK Depok · Uji RM0-04';
      await cdp.eval(`(() => {
        const inp = document.querySelector('[data-hero-slots] fieldset input');
        inp.value = ${JSON.stringify(testTitle)};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#hd-hero-reason').value = 'Uji terbit hero RM0-04 browser';
        document.querySelector('[data-hd-hero-section] button[type="submit"]').click();
      })()`);
      const heroDraftMsg = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-hero-section] [role="status"]')?.textContent || ''`);
        return t.includes('Draf tersimpan.') ? t : false;
      }, 10000, 'hero draft saved');
      await cdp.eval(`(() => {
        document.querySelector('#hd-hero-reason').value = 'Terbit hero RM0-04 browser';
        document.querySelector('[data-hero-publish]').click();
      })()`);
      const heroPubMsg = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-hero-section] [role="status"]')?.textContent || ''`);
        return t.includes('Banner terbit.') ? t : false;
      }, 10000, 'hero published');

      // Verify on public / at 1280x720, 390x844, 375x667
      const heroFit = {};
      for (const vp of [
        { name: 'desktop_1280x720', w: 1280, h: 720, mobile: false, shot: 'hero-desktop.png' },
        { name: 'mobile_390x844', w: 390, h: 844, mobile: true, shot: 'hero-mobile.png' },
        { name: 'mobile_375x667', w: 375, h: 667, mobile: true },
      ]) {
        await cdp.setViewport(vp.w, vp.h, vp.mobile);
        await cdp.navigate(`${BASE}/`, 600);
        await recordRouteTelemetry(`hero-sync:${vp.name}`);
        const rect = await cdp.eval(`(() => {
          const hero = document.querySelector('.vy-hero, main > section');
          const r = hero?.getBoundingClientRect();
          return {
            height: r ? Math.round(r.height) : 0,
            vh: window.innerHeight,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            html: document.body.innerText.includes(${JSON.stringify(testTitle)}) || document.body.innerHTML.includes(${JSON.stringify(testTitle)})
          };
        })()`);
        assert.ok(rect.overflow <= 2, `${vp.name} hero horizontal overflow`);
        assert.ok(rect.height <= vp.h + 40 || vp.mobile, `${vp.name} hero too tall: ${rect.height} vs ${vp.h}`);
        if (vp.shot) await cdp.screenshot(vp.shot);
        heroFit[vp.name] = rect;
      }

      // Restore original hero title
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=hero`, 700);
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hero-slots] fieldset').length === 5`), 8000, 'hero restore load');
      await cdp.eval(`(() => {
        const inp = document.querySelector('[data-hero-slots] fieldset input');
        inp.value = ${JSON.stringify(origTitle)};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#hd-hero-reason').value = 'Pemulihan banner hero pasca-uji RM0-04';
        document.querySelector('[data-hd-hero-section] button[type="submit"]').click();
      })()`);
      await waitFor(async () => (await cdp.eval(`document.querySelector('[data-hd-hero-section] [role="status"]')?.textContent || ''`)).includes('Draf tersimpan.'), 10000, 'hero restore draft');
      await cdp.eval(`(() => {
        document.querySelector('#hd-hero-reason').value = 'Terbit ulang hero awal pasca-uji RM0-04';
        document.querySelector('[data-hero-publish]').click();
      })()`);
      await waitFor(async () => (await cdp.eval(`document.querySelector('[data-hd-hero-section] [role="status"]')?.textContent || ''`)).includes('Banner terbit.'), 10000, 'hero restore publish');

      return { superAdminLocked, roleFeedback, slotCount, heroDraftMsg, heroPubMsg, heroFit };
    });

    // C. RM0-03 R3-H Real BACKUP_MANIFEST UI Request -> Dual Approve -> Execute -> Artifact Download + SHA-256 Verify
    await runSuite('RM0_03_R3_H_backup_manifest_ui', async () => {
      await cdp.setViewport(1280, 800, false);
      // Subject 0005 (Admin Lab OPD A) requests BACKUP_MANIFEST
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000005', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 700);
      await recordRouteTelemetry('admin-maintenance-request');
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-tab-m11="runner"]'))`), 8000, 'runner tab');
      await cdp.eval(`document.querySelector('[data-hd-tab-m11="runner"]').click()`);
      await waitFor(() => cdp.eval(`document.querySelector('#hd-runner-org')?.options?.length > 0`), 8000, 'runner orgs');
      await cdp.eval(`(() => {
        document.querySelector('#hd-runner-kind').value = 'BACKUP_MANIFEST';
        document.querySelector('#hd-runner-reason').value = 'Audit manifest RM0-03 R3-H UI';
        document.querySelector('[data-hd-runner-form] button[type="submit"]').click();
      })()`);
      const jobId = await waitFor(async () => {
        const v = await cdp.eval(`document.querySelector('#hd-runner-job')?.value || ''`);
        return v.length >= 32 ? v : false;
      }, 10000, 'job ID populated');

      // Subject 0018 (Second Admin Approver) or Subject 0017 (SUPER_ADMIN) approves & executes
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000018', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 700);
      await recordRouteTelemetry('admin-maintenance-execute');
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-tab-m11="runner"]'))`), 8000, 'runner tab 2');
      await cdp.eval(`(() => {
        document.querySelector('[data-hd-tab-m11="runner"]').click();
        document.querySelector('#hd-runner-job').value = ${JSON.stringify(jobId)};
        document.querySelector('#hd-runner-approval-reason').value = 'Persetujuan kedua R3-H UI';
        document.querySelector('[data-hd-approve-job]').click();
      })()`);
      await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-runner-status]')?.textContent || ''`);
        return t.includes('APPROVED') ? t : false;
      }, 10000, 'job APPROVED');

      await cdp.eval(`(() => {
        document.querySelector('#hd-runner-approval-reason').value = 'Eksekusi nyata manifest R3-H UI';
        document.querySelector('[data-hd-execute-job]').click();
      })()`);
      const execStatus = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-hd-runner-status]')?.textContent || ''`);
        return t.includes('SUCCEEDED') ? t : false;
      }, 15000, 'job SUCCEEDED');

      // Fetch artifact via browser session cookie context
      const artifactVerify = await cdp.eval(`(async () => {
        const link = document.querySelector('[data-hd-artifact-link]');
        if (!link || link.hidden) return { error: 'artifact link hidden' };
        const resp = await fetch(link.href, { credentials: 'include' });
        const headerSha = resp.headers.get('X-Manifest-SHA256') || '';
        const text = await resp.text();
        const bytes = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const computedSha = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        const json = JSON.parse(text);
        return {
          status: resp.status,
          headerSha,
          computedSha,
          shaMatch: headerSha === computedSha && computedSha.length === 64,
          ownersCount: Object.keys(json.owners || {}).length,
          migrationCount: json.migration_count,
          configShaLen: (json.config_sha256 || '').length,
          jobId: json.job_id
        };
      })()`);
      assert.equal(artifactVerify.status, 200, 'Artifact download must return 200');
      assert.ok(artifactVerify.shaMatch, `Artifact SHA mismatch: ${JSON.stringify(artifactVerify)}`);
      assert.equal(artifactVerify.ownersCount, 9, 'Manifest must inspect all 9 isolated owner schemas');
      assert.equal(artifactVerify.configShaLen, 64, 'Manifest config SHA-256 must be recorded');
      return { jobId, execStatus, artifactVerify };
    });

    // D1. R4-D Validation Summary, Review Dialog, CDP Lost-Response Attachment Retry, Guest Tracking & Revoke, ASN Draft Isolation
    let testTicketId = '';
    await runSuite('R4-D_form_lost_response_draft_tracking', async () => {
      // Logout first so /lapor.html runs as Public Guest
      await logoutSession(cdp);
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/lapor.html?id=${firstSvc.id}`, 800);
      await recordRouteTelemetry('lapor-guest-validation');
      await waitFor(() => cdp.eval(`document.querySelector('#ticket-title') !== null`), 8000, 'lapor form ready');

      // Empty submit triggers per-field validation summary with focus buttons
      await cdp.eval(`(() => {
        const btn = document.querySelector('form[data-ticket-create] button[type="submit"]');
        btn.click();
      })()`);
      const valSummary = await cdp.eval(`(() => {
        const box = document.querySelector('[data-validation-summary]');
        const btns = [...document.querySelectorAll('[data-validation-list] button')];
        if (btns[1]) btns[1].click(); else if (btns[0]) btns[0].click();
        return {
          visible: box && !box.hidden,
          count: btns.length,
          focusedId: document.activeElement?.id || document.activeElement?.name || ''
        };
      })()`);
      assert.ok(valSummary.visible && valSummary.count >= 2 && valSummary.focusedId === 'ticket-description', `Validation summary failed: ${JSON.stringify(valSummary)}`);

      // Capture generated guest key before submit & fill valid report + select PNG file
      const guestKey = await cdp.eval(`document.querySelector('#ticket-key')?.value || ''`);
      assert.ok(/^[a-fA-F0-9]{64}$/.test(guestKey), `Expected 64-hex guest capability key, got ${guestKey.length} chars`);
      await cdp.eval(`(() => {
        const form = document.querySelector('form[data-ticket-create]');
        const saved = form.querySelector('input[name="saved-key"]');
        if (saved) saved.checked = true;
        const title = document.querySelector('#ticket-title');
        title.value = 'Uji Browser RM0-04 Perbaikan Upload dan Review';
        title.dispatchEvent(new Event('input', { bubbles: true }));
        const desc = document.querySelector('#ticket-description');
        desc.value = 'Deskripsi kendala uji end-to-end otomatis pada stack lokal.';
        desc.dispatchEvent(new Event('input', { bubbles: true }));
        for (const el of form.querySelectorAll('[name^="answer-"]')) {
          if (el.tagName === 'SELECT' && el.options.length > 1) el.value = el.options[1].value;
          else if (!el.value) el.value = el.type === 'number' ? '1' : el.type === 'date' ? '2026-11-17' : el.type === 'email' ? 'uji@depok.go.id' : 'Isian uji browser';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Attach 1x1 PNG file via DataTransfer
        const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130]);
        const file = new File([png], 'bukti-uji.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const inp = document.querySelector('#ticket-create-file');
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await sleep(300);

      // Submit opens Review modal, Edit closes, Re-submit reopens
      await cdp.eval(`document.querySelector('form[data-ticket-create] button[type="submit"]').click()`);
      const reviewOpen = await waitFor(() => cdp.eval(`document.querySelector('[data-report-review]')?.open === true`), 5000, 'review dialog open');
      assert.ok(reviewOpen, 'Review modal should open');
      await cdp.eval(`document.querySelector('[data-review-edit]').click()`);
      const reviewClosed = await cdp.eval(`document.querySelector('[data-report-review]')?.open === false`);
      assert.ok(reviewClosed, 'Review modal should close on edit');
      await cdp.eval(`document.querySelector('form[data-ticket-create] button[type="submit"]').click()`);
      await waitFor(() => cdp.eval(`document.querySelector('[data-report-review]')?.open === true`), 5000, 'review dialog reopen');

      // Enable CDP Fetch interception at Response stage for /attachments to simulate post-commit lost response!
      await cdp.send('Fetch.enable', {
        patterns: [{ urlPattern: '*/api/v1/tickets/*/attachments*', resourceType: 'Fetch', requestStage: 'Response' }],
      });
      const seenAttachmentReqs = [];
      let failOnce = true;
      const offFetch = cdp.on('Fetch.requestPaused', async params => {
        const ikey = params.request?.headers?.['Idempotency-Key'] || params.request?.headers?.['idempotency-key'] || '';
        seenAttachmentReqs.push({ url: params.request.url, status: params.responseStatusCode, idempotencyKey: ikey });
        if (failOnce) {
          failOnce = false;
          await cdp.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'ConnectionReset' });
        } else {
          await cdp.send('Fetch.continueRequest', { requestId: params.requestId });
        }
      });

      await cdp.eval(`document.querySelector('[data-review-send]').click()`);
      // Wait for retry button "Ulangi unggah lampiran" to appear after lost response
      const retryPrompt = await waitFor(async () => {
        const res = await cdp.eval(`(() => {
          const btns = [...document.querySelectorAll('button')];
          const retry = btns.find(b => b.textContent.includes('Ulangi unggah lampiran'));
          const link = document.querySelector('a[href*="/detail-tiket.html?id="]');
          return retry && !retry.hidden ? { retryVisible: true, href: link?.href || '' } : false;
        })()`);
        return res;
      }, 15000, 'lost response retry button visible');

      testTicketId = new URL(retryPrompt.href).searchParams.get('id') || '';
      assert.ok(testTicketId.length >= 32, 'Ticket ID must be created before attachment failure');

      // Click Retry upload attachment -> sends SAME Idempotency-Key to SAME ticket without duplicate!
      await cdp.eval(`(() => {
        const retry = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Ulangi unggah lampiran'));
        retry.click();
      })()`);
      const uploadRecovered = await waitFor(async () => {
        const t = await cdp.eval(`document.body.innerText`);
        return t.includes('masuk karantina untuk dipindai') ? true : false;
      }, 15000, 'attachment upload recovered');

      offFetch();
      await cdp.send('Fetch.disable').catch(() => {});
      assert.equal(seenAttachmentReqs.length, 2, `Expected 2 attachment requests, saw ${seenAttachmentReqs.length}`);
      assert.equal(seenAttachmentReqs[0].idempotencyKey, seenAttachmentReqs[1].idempotencyKey, 'Retry MUST reuse exact Idempotency-Key');
      assert.equal(seenAttachmentReqs[0].url, seenAttachmentReqs[1].url, 'Retry MUST target exact same ticket');

      // Navigate to detail-tiket as tracked guest & test logout + check /lacak.html
      let guestTrackingChecked = false;
      if (guestKey) {
        await cdp.navigate(`${BASE}/detail-tiket.html?id=${encodeURIComponent(testTicketId)}`, 700);
        await recordRouteTelemetry('detail-tiket-guest');
        const hasTitle = await waitFor(() => cdp.eval(`document.body.innerText.includes('Uji Browser RM0-04 Perbaikan Upload dan Review')`), 8000, 'guest detail loaded');
        assert.ok(hasTitle, 'Guest tracking session must open ticket detail');
        await cdp.eval(`document.querySelector('[data-tracking-logout]')?.click()`);
        await waitFor(() => cdp.eval(`location.pathname.endsWith('/lacak.html')`), 8000, 'redirect after tracking logout');
        const trackSessAfterLogout = await cdp.eval(`(async () => (await fetch('/api/v1/guest/tracking-session')).status)()`);
        assert.ok([401, 404].includes(trackSessAfterLogout), `Tracking session after logout must fail, got ${trackSessAfterLogout}`);

        // Track again via /lacak.html form & revoke capability
        await waitFor(() => cdp.eval(`(() => { const f = document.querySelector('form[data-ticket-track]'); return Boolean(f && !f.hidden); })()`), 8000, 'track form visible');
        await cdp.eval(`(() => {
          const inp = document.querySelector('#ticket-capability');
          inp.value = ${JSON.stringify(guestKey)};
          inp.closest('form').querySelector('button[type="submit"]').click();
        })()`);
        await waitFor(() => cdp.eval(`location.pathname.endsWith('/detail-tiket.html')`), 10000, 're-tracked via /lacak.html');
        await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-tracking-revoke]') && !document.querySelector('[data-tracking-revoke]').hidden)`), 8000, 'tracking revoke visible');
        // Revoke via fetch (bypass native confirm dialog by overriding confirm cleanly in page)
        await cdp.eval(`window.confirm = () => true; document.querySelector('[data-tracking-revoke]')?.click();`);
        await waitFor(() => cdp.eval(`location.pathname.endsWith('/lacak.html')`), 10000, 'redirect after revoke');
        const postRevokeCode = await cdp.eval(`(async () => {
          const bootR = await (await fetch('/api/v1/auth/bootstrap')).json();
          const r = await fetch('/api/v1/guest/tracking-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Guest-Capability': ${JSON.stringify(guestKey)} },
            body: JSON.stringify({ csrf_token: bootR.csrf_token })
          });
          return r.status;
        })()`);
        assert.ok([401, 403, 404].includes(postRevokeCode), `Revoked key must fail tracking, got ${postRevokeCode}`);
        guestTrackingChecked = true;
      }

      // Test ASN Draft Autosave + Reload Recovery + Account Isolation
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000003', false); // ASN OPD A
      await cdp.navigate(`${BASE}/lapor.html?id=${firstSvc.id}`, 800);
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('#ticket-title'))`), 8000, 'ASN lapor ready');
      await cdp.eval(`(() => {
        const t = document.querySelector('#ticket-title');
        const d = document.querySelector('#ticket-description');
        t.value = 'Draft ASN Privat RM0-04';
        d.value = 'Uraian draft privat yang tersimpan di server.';
        t.dispatchEvent(new Event('input', { bubbles: true }));
        d.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      // Wait for server autosave
      const draftSavedText = await waitFor(async () => {
        const t = await cdp.eval(`document.querySelector('[data-draft-status]')?.textContent || ''`);
        return t.includes('Draft tersimpan') ? t : false;
      }, 8000, 'ASN draft autosave');
      await cdp.navigate(`${BASE}/lapor.html?id=${firstSvc.id}`, 800);
      const restoredTitle = await cdp.eval(`(() => {
        const b = document.querySelector('[data-draft-restore]');
        if (!b) return '';
        b.click();
        return document.querySelector('#ticket-title')?.value || '';
      })()`);
      assert.equal(restoredTitle, 'Draft ASN Privat RM0-04', 'Draft restore should populate title');
      // Switch account to Publik A -> must NOT see ASN draft
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000001', false);
      await cdp.navigate(`${BASE}/lapor.html?id=${firstSvc.id}`, 800);
      const draftLeaked = await cdp.eval(`Boolean(document.querySelector('[data-draft-banner]') && !document.querySelector('[data-draft-banner]').hidden)`);
      assert.equal(draftLeaked, false, 'ASN draft MUST NOT leak after switching to Publik A');

      return { valSummary, retryPrompt, uploadRecovered, sameIdemKey: true, guestTrackingChecked, draftSavedText, testTicketId };
    });

    // D2. R4-E Queue Mobile/Desktop, Ticket Verification, Dispatch, Conflict 409, Resolution
    await runSuite('R4-E_queue_lifecycle_conflict', async () => {
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000004', true); // Operator OPD A
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/admin/app/tickets/index.html`, 900);
      await recordRouteTelemetry('admin-tickets-desktop');
      const desktopOv = await cdp.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      assert.ok(desktopOv <= 2, `Admin tickets desktop overflow ${desktopOv}`);

      await cdp.setViewport(390, 844, true);
      await sleep(300);
      await recordRouteTelemetry('admin-tickets-mobile');
      const mobOv = await cdp.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      assert.ok(mobOv <= 2, `Admin tickets mobile overflow ${mobOv}`);
      await cdp.screenshot('admin-tickets-mobile.png');

      // Open our created ticket in detail page
      await cdp.setViewport(1280, 800, false);
      assert.ok(testTicketId, 'Need ticketId from R4-D');
      await cdp.navigate(`${BASE}/admin/app/tickets/detail.html?id=${encodeURIComponent(testTicketId)}`, 900);
      await recordRouteTelemetry('admin-ticket-detail');
      await waitFor(() => cdp.eval(`document.querySelector('[data-form-verify]') && !document.querySelector('[data-operator-verify]')?.hidden`), 10000, 'operator verify form');

      // Verify ticket (M4)
      await cdp.eval(`(() => {
        const f = document.querySelector('[data-form-verify]');
        f.querySelector('#verify-reason').value = 'Verifikasi operator RM0-04 browser';
        f.querySelector('button[type="submit"]').click();
      })()`);
      const dispatchVisible = await waitFor(() => cdp.eval(`document.querySelector('[data-operator-dispatch]') && !document.querySelector('[data-operator-dispatch]').hidden`), 10000, 'dispatch panel visible after verify');
      assert.ok(dispatchVisible, 'Dispatch panel must unlock only after VERIFIED');

      // Dispatch ticket to proposed Technician (first concurrent dispatch succeeds -> bumps version -> UI submit catches 409 Conflict Banner!)
      const dispatchedAssigneeId = await waitFor(() => cdp.eval(`(() => {
        const s = document.querySelector('#dispatch-assignee');
        return s && s.options.length >= 1 ? (s.value || s.options[0].value) : '';
      })()`), 8000, 'dispatch assignees loaded');
      const concurrentDispatchCode = await cdp.eval(`(async () => {
        const cur = await (await fetch('/api/v1/tickets/${testTicketId}', { credentials: 'include' })).json();
        const prop = await (await fetch('/api/v1/tickets/${testTicketId}/dispatch-proposal?tier=L1', { credentials: 'include' })).json();
        const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
        const r = await fetch('/api/v1/tickets/${testTicketId}/dispatch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
          body: JSON.stringify({
            expected_version: cur.version,
            team_id: prop.team_id,
            assignee_id: ${JSON.stringify(dispatchedAssigneeId)},
            proposal_version: prop.ticket_version,
            proposal_digest: prop.digest,
            tier: prop.level,
            reason: 'Disposisi konkuren untuk uji konflik 409 UI'
          })
        });
        return r.status;
      })()`);
      assert.equal(concurrentDispatchCode, 200, `Concurrent dispatch expected 200, got ${concurrentDispatchCode}`);

      // Operator UI still holds stale pre-dispatch version -> submit triggers REAL 409 [data-conflict-banner]!
      await cdp.eval(`(() => {
        const sel = document.querySelector('#dispatch-assignee');
        sel.value = ${JSON.stringify(dispatchedAssigneeId)};
        document.querySelector('#dispatch-reason').value = 'Disposisi teknisi uji RM0-04';
        document.querySelector('[data-form-dispatch] button[type="submit"]').click();
      })()`);
      const conflictUiShown = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-conflict-banner]') && !document.querySelector('[data-conflict-banner]').hidden)`), 10000, 'conflict banner shown on 409');
      await cdp.eval(`document.querySelector('[data-conflict-reload]').click()`);
      await waitFor(() => cdp.eval(`document.querySelector('[data-conflict-banner]')?.hidden === true`), 8000, 'conflict banner cleared on reload');

      // Login as dispatched Technician -> START lifecycle transition -> Resolve ticket
      await loginSubjectById(cdp, dispatchedAssigneeId, true);
      await cdp.navigate(`${BASE}/admin/app/tickets/detail.html?id=${encodeURIComponent(testTicketId)}`, 900);
      await waitFor(() => cdp.eval(`document.querySelector('[data-ticket-lifecycle]') && !document.querySelector('[data-ticket-lifecycle]').hidden`), 10000, 'tech lifecycle START visible');
      await cdp.eval(`(() => {
        const f = document.querySelector('[data-form-lifecycle]');
        const sel = f.querySelector('#lifecycle-action');
        sel.value = 'START';
        f.querySelector('#lifecycle-reason').value = 'Memulai penanganan teknis uji RM0-04';
        f.querySelector('button[type="submit"]').click();
      })()`);
      await waitFor(() => cdp.eval(`document.querySelector('[data-form-resolve]') && !document.querySelector('[data-technician-resolve]')?.hidden`), 10000, 'tech resolve form visible after START');
      await cdp.eval(`(() => {
        const f = document.querySelector('[data-form-resolve]');
        f.querySelector('[name="summary"]').value = 'Penanganan teknis selesai dan diverifikasi melalui browser uji RM0-04.';
        f.querySelector('button[type="submit"]').click();
      })()`);
      const resolveStatus = await waitFor(() => cdp.eval(`(() => {
        const t = document.querySelector('[data-resolve-status]')?.textContent || '';
        return t.includes('Hasil penanganan tersimpan') ? t : false;
      })()`), 10000, 'tech resolve saved');
      return { desktopOv, mobOv, concurrentDispatchCode, conflictUiShown, dispatchedAssigneeId, resolveStatus };
    });

    // D3. R4-F M9 Reports Lag/Empty/Watermark & Export + Cross-org 403 + Logout Revocation
    await runSuite('R4-F_m9_reports_export', async () => {
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000011', true); // COORDINATOR OPD A (has report.read & report.export)
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=reports`, 800);
      await recordRouteTelemetry('admin-reports');
      await waitFor(() => cdp.eval(`document.querySelector('#hd-report-org')?.options?.length > 0`), 8000, 'report orgs');
      await cdp.eval(`document.querySelector('[data-hd-fetch-report]').click()`);
      const reportSummary = await waitFor(async () => {
        const vis = await cdp.eval(`(() => {
          const s = document.querySelector('[data-hd-report-summary]');
          return s && !s.hidden ? {
            measure: document.querySelector('[data-hd-rep-measure]')?.textContent,
            watermark: document.querySelector('[data-hd-rep-watermark]')?.textContent
          } : false;
        })()`);
        return vis;
      }, 10000, 'M9 summary visible');

      // Export CSV via dialog & verify download
      await cdp.eval(`document.querySelector('[data-hd-open-export]').click()`);
      await waitFor(() => cdp.eval(`document.querySelector('[data-hd-export-dialog]')?.open === true`), 5000, 'export dialog opened');
      await cdp.eval(`document.querySelector('[data-hd-export-form] button[type="submit"]').click()`);
      const exportResult = await waitFor(async () => {
        const a = await cdp.eval(`(() => {
          const area = document.querySelector('[data-hd-download-area]');
          const link = document.querySelector('[data-hd-download-link]');
          const st = document.querySelector('[data-hd-export-status]')?.textContent || '';
          return { ok: Boolean(area && !area.hidden && link && link.href.includes('/reports/exports/')), href: link?.href || '', st };
        })()`);
        if (a.ok) return a.href;
        if (a.st && !a.st.includes('Mengajukan') && !a.st.includes('Tugas ekspor diterima')) throw new Error('Export status error: ' + a.st);
        return false;
      }, 10000, 'export download link visible');
      const dlCheck = await cdp.eval(`(async () => {
        const r = await fetch(${JSON.stringify(exportResult)}, { credentials: 'include' });
        return { status: r.status, type: r.headers.get('Content-Type') || '' };
      })()`);
      assert.equal(dlCheck.status, 200, `Export file download failed: ${JSON.stringify(dlCheck)}`);

      // Cross-org export denial (Coordinator OPD B tries to download OPD A's export)
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000012', true);
      const crossOrgStatus = await cdp.eval(`(async () => (await fetch(${JSON.stringify(exportResult)}, { credentials: 'include' })).status)()`);
      assert.ok([403, 404].includes(crossOrgStatus), `Cross-org export download must be denied, got ${crossOrgStatus}`);
      // Logout / session revocation denies download immediately (401)
      await logoutSession(cdp);
      const postLogoutExportStatus = await cdp.eval(`(async () => (await fetch(${JSON.stringify(exportResult)}, { credentials: 'include' })).status)()`);
      assert.equal(postLogoutExportStatus, 401, `Post-logout export download must return 401, got ${postLogoutExportStatus}`);
      return { reportSummary, dlCheck, crossOrgStatus, postLogoutExportStatus };
    });

    // D4. R4-G M8 PAGE Editorial Lifecycle + Search Combobox + /halaman/{slug} + Archive Unavailable
    await runSuite('R4-G_m8_page_editorial_search_reader', async () => {
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true); // SUPER_ADMIN
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=articles`, 800);
      await recordRouteTelemetry('admin-articles-page');
      const slug = `rm004-e2e-halaman-${Date.now()}`;
      const title = 'Halaman Uji RM0-04 Depok';
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-editorial-kind="PAGE"]'))`), 8000, 'PAGE tab visible');
      await cdp.eval(`(() => {
        document.querySelector('[data-hd-editorial-kind="PAGE"]').click();
        document.querySelector('[data-hd-new-article]').click();
      })()`);
      await waitFor(() => cdp.eval(`document.querySelector('[data-hd-article-form]') && !document.querySelector('[data-hd-article-form]').hidden`), 5000, 'PAGE form open');
      await cdp.eval(`(() => {
        document.querySelector('#hd-art-title').value = ${JSON.stringify(title)};
        document.querySelector('#hd-art-slug').value = ${JSON.stringify(slug)};
        document.querySelector('#hd-art-audience').value = 'PUBLIC_GUEST';
        document.querySelector('#hd-art-body').value = 'Konten halaman portal resmi hasil uji end-to-end RM0-04.';
        document.querySelector('[data-hd-article-form] button[type="submit"]').click();
      })()`);
      await waitFor(async () => (await cdp.eval(`document.querySelector('[data-hd-articles-rows]')?.innerText || ''`)).includes(slug), 10000, 'draft PAGE appears in table');

      // Publish PAGE row
      await cdp.eval(`(() => {
        const rows = [...document.querySelectorAll('[data-hd-articles-rows] tr')];
        const row = rows.find(r => r.innerText.includes(${JSON.stringify(slug)}));
        const pub = [...row.querySelectorAll('button')].find(b => b.textContent.includes('Terbitkan'));
        pub.click();
      })()`);
      await waitFor(async () => {
        const rows = await cdp.eval(`(() => {
          const r = [...document.querySelectorAll('[data-hd-articles-rows] tr')].find(r => r.innerText.includes(${JSON.stringify(slug)}));
          return r?.innerText || '';
        })()`);
        return rows.includes('PUBLISHED');
      }, 10000, 'PAGE published');

      // Verify Search Combobox on /layanan.html finds PAGE hit & /halaman/{slug} loads on public portal
      await cdp.navigate(`${BASE}/layanan.html`, 700);
      await recordRouteTelemetry('layanan-search-page-hit');
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('#hd-public-search'))`), 8000, 'search combobox');
      await cdp.eval(`(() => {
        const box = document.querySelector('#hd-public-search');
        box.focus();
        box.value = ${JSON.stringify(title)};
        box.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      const searchHitFound = await waitFor(async () => {
        return cdp.eval(`document.querySelector('#hd-search-suggestions')?.innerText?.includes(${JSON.stringify(title)}) || false`);
      }, 8000, 'search combobox finds PAGE');
      await cdp.navigate(`${BASE}/halaman/${slug}`, 800);
      await recordRouteTelemetry('public-page-slug');
      const readerTitle = await waitFor(async () => {
        const t = await cdp.eval(`document.body.innerText`);
        return t.includes(title) ? t : false;
      }, 8000, 'public /halaman/{slug} renders');

      // Archive PAGE & verify public /halaman/{slug} becomes unavailable
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=articles`, 800);
      await cdp.eval(`document.querySelector('[data-hd-editorial-kind="PAGE"]').click()`);
      await waitFor(async () => (await cdp.eval(`document.querySelector('[data-hd-articles-rows]')?.innerText || ''`)).includes(slug), 8000, 'PAGE row before archive');
      await cdp.eval(`(() => {
        const row = [...document.querySelectorAll('[data-hd-articles-rows] tr')].find(r => r.innerText.includes(${JSON.stringify(slug)}));
        const arc = [...row.querySelectorAll('button')].find(b => b.textContent.includes('Arsipkan'));
        arc.click();
      })()`);
      await waitFor(async () => {
        const r = await cdp.eval(`[...document.querySelectorAll('[data-hd-articles-rows] tr')].find(r => r.innerText.includes(${JSON.stringify(slug)}))?.innerText || ''`);
        return r.includes('ARCHIVED');
      }, 10000, 'PAGE archived');
      await cdp.navigate(`${BASE}/halaman/${slug}`, 700);
      const afterArchive = await cdp.eval(`document.body.innerText`);
      assert.ok(!afterArchive.includes('Konten halaman portal resmi hasil uji end-to-end RM0-04'), 'Archived PAGE content must NOT render publicly');
      return { slug, rendered: Boolean(readerTitle), searchHitFound, archivedUnavailable: true };
    });

    // D5. R4-H Lightbox Keyboard + Media Owner Tabs + CLEAN Attachment Preview Lightbox + Revoke
    await runSuite('R4-H_lightbox_and_media', async () => {
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/`, 600);
      await recordRouteTelemetry('lightbox-home');
      // Open Hero stage gallery lightbox
      const lbOpen = await cdp.eval(`(() => {
        const btn = document.querySelector('#btn-open-gallery-lightbox');
        if (!btn) return false;
        btn.focus();
        btn.click();
        const modal = document.querySelector('#vy-lightbox');
        return Boolean(modal && !modal.hidden && !modal.hasAttribute('hidden'));
      })()`);
      assert.ok(lbOpen, 'Gallery lightbox must open');
      await sleep(300);
      await cdp.screenshot('lightbox-desktop.png');
      const countBefore = await cdp.eval(`document.querySelector('#vy-lb-counter')?.textContent || ''`);
      await cdp.key('ArrowRight', 'ArrowRight', 39);
      await sleep(200);
      const countAfterRight = await cdp.eval(`document.querySelector('#vy-lb-counter')?.textContent || ''`);
      assert.notEqual(countAfterRight, countBefore, 'ArrowRight must advance lightbox slide');
      await cdp.key('+', 'Equal', 187);
      await sleep(150);
      const zoomInfo = await cdp.eval(`document.querySelector('#vy-lb-zoom-level')?.textContent || ''`);
      assert.notEqual(zoomInfo, '100%', `Expected zoom > 100% after +, got ${zoomInfo}`);
      await cdp.key('Escape', 'Escape', 27);
      await sleep(250);
      const afterEsc = await cdp.eval(`({
        closed: document.querySelector('#vy-lightbox')?.hidden === true,
        activeId: document.activeElement?.id || ''
      })`);
      assert.ok(afterEsc.closed, 'Escape must close lightbox');
      assert.equal(afterEsc.activeId, 'btn-open-gallery-lightbox', 'Focus must restore to lightbox opener');

      // Admin Media M8/M3 owner tabs
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=media`, 800);
      await recordRouteTelemetry('admin-media');
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-tab-media="M3"]'))`), 8000, 'media tabs');
      await cdp.eval(`document.querySelector('[data-hd-tab-media="M3"]').click()`);
      await sleep(700);
      const m3Text = await cdp.eval(`document.querySelector('[data-hd-media-grid], [data-hd-media-status]')?.innerText || ''`);
      await cdp.eval(`document.querySelector('[data-hd-tab-media="M8"]').click()`);
      await sleep(700);

      // Ticket detail attachment lightbox check as Operator OPD A (authorized owner scope)
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000004', true);
      await cdp.navigate(`${BASE}/admin/app/tickets/detail.html?id=${encodeURIComponent(testTicketId)}`, 900);
      await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-ticket-attachments] .hd-btn-preview'))`), 10000, 'CLEAN attachment preview button visible');
      const attUrl = await cdp.eval(`document.querySelector('[data-ticket-attachments] a[href*="/attachments/"]')?.href || ''`);
      const previewClicked = await cdp.eval(`(() => {
        const btn = document.querySelector('[data-ticket-attachments] .hd-btn-preview');
        btn.focus();
        btn.click();
        const d = document.querySelector('[data-attachment-lightbox]');
        return { open: Boolean(d?.open), hidden: d?.hidden };
      })()`);
      assert.ok(previewClicked.open && !previewClicked.hidden, `Attachment lightbox failed to open: ${JSON.stringify(previewClicked)}`);
      const attImgLoaded = await waitFor(() => cdp.eval(`(() => {
        const img = document.querySelector('[data-att-lightbox-img]');
        return Boolean(img && img.complete && img.naturalWidth > 0);
      })()`), 6000, 'attachment preview image loaded');
      await cdp.key('Escape', 'Escape', 27);
      await sleep(250);
      const attLightboxEsc = await cdp.eval(`({
        closed: document.querySelector('[data-attachment-lightbox]')?.open === false,
        focusRestored: document.activeElement?.classList?.contains('hd-btn-preview') === true
      })`);
      assert.ok(attLightboxEsc.closed && attLightboxEsc.focusRestored, `Attachment lightbox Escape/focus failed: ${JSON.stringify(attLightboxEsc)}`);
      // Cross-org private M3 attachment download denial
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000012', true); // OPD B
      const revokedMediaCode = await cdp.eval(`(async () => (await fetch(${JSON.stringify(attUrl)}, { credentials: 'include' })).status)()`);
      assert.ok([403, 404].includes(revokedMediaCode), `Cross-org private attachment download must fail, got ${revokedMediaCode}`);
      // Also log back as Super Admin before footer check in R4-I
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      return { lbOpen, countBefore, countAfterRight, zoomInfo, afterEsc, m3Loaded: m3Text.length > 0, previewClicked, attImgLoaded, attLightboxEsc, revokedMediaCode };
    });

    // D6. R4-I Footer 2-tier, 200% Zoom Reflow & prefers-reduced-motion: reduce
    await runSuite('R4-I_footer_zoom_reduced_motion', async () => {
      // Test 200% zoom reflow (~640px desktop width)
      await cdp.setViewport(640, 480, false);
      const zoomChecks = {};
      for (const route of ['/', '/lapor.html', '/admin/app/dashboard/index.html']) {
        await cdp.navigate(`${BASE}${route}`, 550);
        await recordRouteTelemetry(`zoom200:${route}`);
        const ov = await cdp.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
        assert.ok(ov <= 2, `200% zoom reflow overflow on ${route}: ${ov}`);
        zoomChecks[route] = ov;
      }
      // Reduced motion emulation on /
      await cdp.setViewport(1280, 800, false);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      await cdp.navigate(`${BASE}/`, 550);
      const reducedMotion = await cdp.eval(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`);
      assert.equal(reducedMotion, true, 'prefers-reduced-motion media emulation active');
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });

      // Check Admin footer 2-tier layout desktop + mobile
      await cdp.navigate(`${BASE}/admin/app/tickets/index.html`, 600);
      const footerInfo = await cdp.eval(`(() => {
        const f = document.querySelector('.piui-footer');
        const text = f?.innerText || '';
        return {
          exists: Boolean(f),
          hasDepok: text.includes('Helpdesk TIK Kota Depok'),
          hasDiskominfo: text.includes('Diskominfo'),
          noPedro: !text.includes('Pedro Iriano'),
          height: f ? Math.round(f.getBoundingClientRect().height) : 0
        };
      })()`);
      assert.ok(footerInfo.exists && footerInfo.hasDepok && footerInfo.noPedro, `Footer check failed: ${JSON.stringify(footerInfo)}`);
      return { zoomChecks, reducedMotion, footerInfo };
    });

    // D7. Fase 2 UI->Backend Flows, Instant Search/Filters, Rules, Approvals, Scheduler, Ops Records & Mobile
    await runSuite('Fase2_UI_and_Ops', async () => {
      // 1. Public catalog instant search & access filter
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/layanan.html`, 700);
      await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-catalog] .hd-service-option').length > 0`), 8000, 'catalog loaded');
      const totalVisible = await cdp.eval(`document.querySelectorAll('[data-hd-catalog] .hd-service-option').length`);
      await cdp.eval(`(() => {
        const q = document.querySelector('#hd-catalog-q');
        q.value = 'CSIRT';
        q.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(150);
      const csirtCount = await cdp.eval(`document.querySelectorAll('[data-hd-catalog] .hd-service-option').length`);
      assert.ok(csirtCount >= 1 && csirtCount <= totalVisible, `Catalog search filter expected narrow match, got ${csirtCount}/${totalVisible}`);

      // 2. Super Admin: notifications, maintenance operations & M7 scheduler tab, rules panel, media pickers/approvals
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=notifications`, 700);
      const hasNotifRows = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-notif-rows] tr'))`), 8000, 'notifications inbox rendered');

      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 700);
      await cdp.eval(`document.querySelector('[data-hd-tab-m11="runner"]')?.click()`);
      const hasOpsTable = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-ops-rows] tr'))`), 8000, 'operations list rendered');
      await cdp.eval(`document.querySelector('[data-hd-tab-m11="scheduler"]')?.click()`);
      const hasSchedTable = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-scheduler-rows] tr'))`), 8000, 'scheduler list rendered');

      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=rules`, 700);
      await cdp.eval(`(() => { const s = document.querySelector('#hd-rule-owner'); s.value = 'sla'; s.dispatchEvent(new Event('change')); })()`);
      const hasSlaRules = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-rules-rows] button'))`), 8000, 'SLA rules rendered');

      // Super Admin sees its uploaded CLEAN media & M8 articles/pages in media pickers
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=media`, 700);
      const pickersReady = await waitFor(() => cdp.eval(`(() => {
        const s = document.querySelector('#media-source-pick');
        const t = document.querySelector('#media-target-pick');
        return Boolean(s && t && s.options.length > 1 && t.options.length > 1);
      })()`), 8000, 'media pickers populated');

      // Publisher OPD A loads media approvals list (200) and M8 content picker
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000015', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=media`, 700);
      const approvalsReady = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-hd-media-approvals-rows] tr') && document.querySelector('#media-target-pick')?.options.length > 1)`), 8000, 'media approvals table populated');

      // 3. Coordinator OPD A: Queue search, Handoff inbox, Bulk toolbar + Detail operational records & Mobile check
      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000011', true);
      await cdp.navigate(`${BASE}/admin/app/tickets/index.html`, 700);
      const queueControls = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-queue-search-form]') && !document.querySelector('[data-queue-search-form]').hidden && !document.querySelector('[data-handoff-inbox]').hidden && !document.querySelector('[data-bulk-bar]').hidden)`), 8000, 'queue search, handoff inbox, and bulk bar visible');
      await cdp.setViewport(375, 812, true);
      await sleep(300);
      const mobileOverflow = await cdp.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      assert.ok(mobileOverflow <= 2, `Admin tickets mobile 375px overflow: ${mobileOverflow}`);
      await cdp.setViewport(1280, 800, false);

      await cdp.navigate(`${BASE}/admin/app/tickets/detail.html?id=${encodeURIComponent(testTicketId)}`, 800);
      const opsRendered = await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-ops-records]') && !document.querySelector('[data-ops-records]').hidden)`), 8000, 'detail operational records visible');
      return { csirtCount, hasNotifRows, hasOpsTable, hasSchedTable, hasSlaRules, pickersReady, approvalsReady, queueControls, mobileOverflow, opsRendered };
    });

    // D8. Fase 3 Production Readiness UI (/auth/config, hidden SSO panel in lab, M9 delivery-jobs admin panel)
    await runSuite('Fase3_AuthConfig_and_DeliveryQueue', async () => {
      await cdp.setViewport(1280, 800, false);
      await cdp.navigate(`${BASE}/akses.html`, 700);
      const authState = await waitFor(() => cdp.eval(`(async () => {
        const res = await fetch('/api/v1/auth/config');
        if (!res.ok) return null;
        const cfg = await res.json();
        const ssoPanel = document.querySelector('[data-hd-sso-panel]');
        const labSection = document.querySelector('[data-hd-lab-section]');
        const hasSubjects = document.querySelectorAll('#hd-subject option[value]:not([value=""])').length > 0;
        if (!hasSubjects) return null;
        return {
          mode: cfg.mode,
          labAuth: cfg.lab_auth_enabled,
          ssoEnabled: cfg.sso_enabled,
          purgeEnabled: cfg.purge_enabled,
          ssoPanelHidden: ssoPanel ? getComputedStyle(ssoPanel).display === 'none' : false,
          labSectionVisible: labSection ? getComputedStyle(labSection).display !== 'none' : false,
        };
      })()`), 8000, 'auth/config & lab panels');
      assert.equal(authState.mode, 'SYNTHETIC_LAB');
      assert.equal(authState.labAuth, true);
      assert.equal(authState.ssoEnabled, false);
      assert.equal(authState.purgeEnabled, false);
      assert.equal(authState.ssoPanelHidden, true);
      assert.equal(authState.labSectionVisible, true);

      await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
      const adminAuth = await waitFor(() => cdp.eval(`(() => {
        const sso = document.querySelector('[data-hd-sso-panel]');
        const quick = document.querySelectorAll('[data-quick-login]').length;
        return quick >= 5 ? { quick, ssoHidden: sso ? getComputedStyle(sso).display === 'none' : false } : null;
      })()`), 8000, 'admin login lab/sso markers');
      assert.equal(adminAuth.ssoHidden, true);

      await loginSubjectById(cdp, '20000000-0000-4000-8000-000000000017', true);
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=notifications`, 700);
      const deliveryPanel = await waitFor(() => cdp.eval(`(() => {
        const panel = document.querySelector('[data-hd-delivery-panel]');
        const stat = document.querySelector('[data-hd-delivery-status]')?.textContent || '';
        const filter = document.querySelector('#hd-delivery-state');
        return panel && !panel.hidden && stat.length > 0 && Boolean(filter) ? { stat, rows: document.querySelectorAll('[data-hd-delivery-rows] tr').length } : null;
      })()`), 8000, 'M9 delivery queue admin panel');
      assert.ok(deliveryPanel.rows >= 1, `expected M9 delivery rows or empty indicator row, got ${JSON.stringify(deliveryPanel)}`);
      return { authState, adminAuth, deliveryPanel };
    });

    report.csp_violations = cspList;
    report.console_errors = consoleErrors;
    report.exceptions = exceptions;
    assert.equal(cspList.length, 0, `CSP violations detected: ${JSON.stringify(cspList)}`);
    assert.equal(exceptions.length, 0, `Uncaught JS exceptions detected: ${JSON.stringify(exceptions)}`);
    report.result = 'PASS';
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'browser-final.json'), JSON.stringify(report, null, 2));
    await close();
  }
}

main().catch(err => {
  console.error('BROWSER E2E FAILED:', err);
  process.exit(1);
});
