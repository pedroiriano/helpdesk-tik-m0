#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.HELPDESK_BASE_URL || 'http://127.0.0.1:18090';
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.EDGE_MAINT_CDP_PORT || 9238);
const REPORT_SERVICE = process.env.HELPDESK_MAINT_TEST_SERVICE_ID || '31000000-0000-4000-8000-000000000001';

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
  async navigate(url, waitMs = 600) {
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

export async function waitFor(fn, timeoutMs = 12000, msg = 'condition') {
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

export async function launchEdge() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-maint-edge-'));
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

export async function logoutSession(cdp) {
  await cdp.eval(`(async () => {
    try {
      const me = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (me.ok) {
        const s = await me.json();
        const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
        await fetch('/api/v1/auth/logout', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
          body: JSON.stringify({ expected_version: s.version, reason: 'Maintenance browser E2E switch' })
        });
      }
    } catch {}
  })()`);
  await cdp.send('Network.clearBrowserCookies');
}

export async function loginRoleKeyword(cdp, roleKeyword) {
  await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
  await waitFor(() => cdp.eval(`(() => { const s = document.querySelector('#hd-subject'); return s && s.options.length > 0; })()`), 8000, 'lab subjects');
  const picked = await cdp.eval(`(() => {
    const sel = document.querySelector('#hd-subject');
    const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(${JSON.stringify(roleKeyword.toLowerCase())}));
    if (!opt) return '';
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-hd-lab-select]')?.click();
    return opt.value;
  })()`);
  assert.ok(picked, `Subject matching "${roleKeyword}" must exist`);
  await waitFor(() => cdp.eval(`!location.pathname.endsWith('/login.html')`), 10000, `redirect after ${roleKeyword}`);
  await sleep(450);
}

async function resetMaintenanceClean(cdp) {
  await cdp.eval(`(async () => {
    const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
    if (!csrfTok) return;
    const now = Date.now();
    await fetch('/api/v1/admin/maintenance', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
      body: JSON.stringify({
        mode: 'NORMAL', schedule_kind: 'UNSCHEDULED', display_mode: 'BANNER',
        starts_at: new Date(now - 60000).toISOString(), ends_at: new Date(now).toISOString(),
        message: 'Cleanup E2E reset to NORMAL'
      }),
    });
  })()`);
}

async function main() {
  const { cdp, close } = await launchEdge();
  const consoleErrors = [];
  const exceptions = [];
  const cspViolations = [];
  cdp.on('Runtime.consoleAPICalled', e => {
    if (e.type === 'error') {
      const txt = e.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (!txt.includes('503')) consoleErrors.push(txt);
    }
  });
  cdp.on('Runtime.exceptionThrown', e => exceptions.push(e.exceptionDetails?.text || 'exception'));

  let loggedInAsAdmin = false;
  try {
    // Clean initial state
    await loginRoleKeyword(cdp, 'super admin');
    loggedInAsAdmin = true;
    await resetMaintenanceClean(cdp);

    // 1. Verify Normal initial public state on /status.html & /
    await cdp.navigate(`${BASE}/status.html`, 600);
    const initStatus = await waitFor(() => cdp.eval(`(() => {
      const s = document.querySelector('[data-hd-status-maint-state]')?.textContent?.trim() || '';
      return s.includes('Normal') ? { state: s, banner: Boolean(document.querySelector('[data-hd-maint-banner]')), overlay: Boolean(document.querySelector('[data-hd-maint-overlay]')) } : null;
    })()`), 8000, 'initial /status.html normal');
    assert.equal(initStatus.banner, false);
    assert.equal(initStatus.overlay, false);

    // 2. Test SCHEDULED (Terjadwal) Maintenance -> Upcoming Banner -> Cancel row
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-badge]')?.textContent?.includes('OPERASIONAL NORMAL')`), 8000, 'admin maintenance normal badge');

    await cdp.eval(`(() => {
      const sk = document.querySelector('#hd-maint-schedule-kind');
      sk.value = 'SCHEDULED';
      sk.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-display').value = 'FULL_SCREEN';
      document.querySelector('#hd-maint-display').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-mode').value = 'READ_ONLY';
      document.querySelector('#hd-maint-mode').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-reason').value = 'Peningkatan kapasitas basis data SPBE terjadwal';
      document.querySelector('[data-hd-maintenance-form] button[type="submit"]').click();
    })()`);

    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-badge]')?.textContent?.includes('TERJADWAL')`), 10000, 'scheduled live badge');
    const schedRowFound = await cdp.eval(`Array.from(document.querySelectorAll('[data-hd-maint-rows] tr')).some(r => r.textContent.includes('TERJADWAL') && r.textContent.includes('Peningkatan kapasitas'))`);
    assert.equal(schedRowFound, true, 'Admin maintenance table must show TERJADWAL row');

    // Public / must display Scheduled Announcement Banner (and NOT Full-Screen Overlay yet)
    await cdp.navigate(`${BASE}/`, 700);
    const pubSched = await waitFor(() => cdp.eval(`(() => {
      const b = document.querySelector('[data-hd-maint-banner]');
      if (!b) return null;
      return {
        isScheduledClass: b.classList.contains('hd-maint-banner--scheduled'),
        text: b.textContent,
        hasOverlay: Boolean(document.querySelector('[data-hd-maint-overlay]')),
      };
    })()`), 8000, 'public landing scheduled banner');
    assert.equal(pubSched.isScheduledClass, true);
    assert.match(pubSched.text, /Pemeliharaan Sistem Terjadwal/i);
    assert.match(pubSched.text, /Peningkatan kapasitas basis data SPBE terjadwal/);
    assert.equal(pubSched.hasOverlay, false, 'Scheduled future maintenance must not block portal prematurely');
    console.log('  [OK] Scheduled (Terjadwal) announcement banner verified on / and admin table');

    // Cancel scheduled window from Admin table action button
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-rows] button') !== null`), 8000, 'cancel button rendered');
    await cdp.eval(`(() => {
      const row = Array.from(document.querySelectorAll('[data-hd-maint-rows] tr')).find(r => r.textContent.includes('Peningkatan kapasitas'));
      row.querySelector('button').click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'cancel confirm dialog open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-badge]')?.textContent?.includes('OPERASIONAL NORMAL')`), 10000, 'scheduled cancelled back to normal');

    // 3. Test UNSCHEDULED (Tidak Terjadwal / Darurat) + FULL_SCREEN + READ_ONLY
    await cdp.eval(`(() => {
      const sk = document.querySelector('#hd-maint-schedule-kind');
      sk.value = 'UNSCHEDULED';
      sk.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-display').value = 'FULL_SCREEN';
      document.querySelector('#hd-maint-display').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-mode').value = 'READ_ONLY';
      document.querySelector('#hd-maint-mode').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-org').value = '';
      document.querySelector('#hd-maint-org').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-reason').value = 'Pemeliharaan darurat tidak terjadwal pada router pusat data';
      document.querySelector('[data-hd-maintenance-form] button[type="submit"]').click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-badge]')?.textContent?.includes('UNDER MAINTENANCE AKTIF')`), 10000, 'admin unscheduled active');

    // Check Web Publik / & /lapor.html render FULL_SCREEN Under Maintenance overlay + no horizontal overflow on mobile
    await cdp.navigate(`${BASE}/`, 750);
    const pubFull = await waitFor(() => cdp.eval(`(() => {
      const o = document.querySelector('[data-hd-maint-overlay]');
      if (!o) return null;
      return {
        mainHidden: document.querySelector('main')?.hidden === true,
        text: o.textContent,
        inlineStyles: o.querySelectorAll('[style]').length,
        hasAdminLink: Boolean(o.querySelector('a[href="/admin/auth/login.html"]')),
        hasStatusLink: Boolean(o.querySelector('a[href="/status.html"]')),
      };
    })()`), 8000, 'public / fullscreen overlay');
    assert.equal(pubFull.mainHidden, true);
    assert.match(pubFull.text, /Sistem Sedang Dalam Pemeliharaan \(Under Maintenance\)/);
    assert.match(pubFull.text, /Pemeliharaan Tidak Terjadwal \/ Darurat/);
    assert.match(pubFull.text, /router pusat data/);
    assert.equal(pubFull.inlineStyles, 0, 'Overlay must have 0 inline style attributes (CSP)');
    assert.equal(pubFull.hasAdminLink, true);
    assert.equal(pubFull.hasStatusLink, true);

    await cdp.setViewport(390, 844, true);
    await sleep(250);
    const mobOverlay = await cdp.eval(`({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })`);
    assert.ok(mobOverlay.sw <= mobOverlay.iw + 2, `Mobile 390px overlay overflow: ${mobOverlay.sw} > ${mobOverlay.iw}`);
    await cdp.setViewport(1280, 840, false);

    // /status.html stays readable (no full-screen hide) & shows active maintenance alert + tile
    await cdp.navigate(`${BASE}/status.html`, 700);
    const stPage = await waitFor(() => cdp.eval(`(() => {
      const s = document.querySelector('[data-hd-status-maint-state]')?.textContent?.trim() || '';
      if (!s.includes('Under Maintenance')) return null;
      return {
        mainHidden: document.querySelector('main')?.hidden === true,
        hasBanner: Boolean(document.querySelector('.hd-maint-banner--active')),
        state: s,
      };
    })()`), 8000, '/status.html active state');
    assert.equal(stPage.mainHidden, false, '/status.html must stay readable during FULL_SCREEN maintenance');
    assert.equal(stPage.hasBanner, true);

    // Verify backend write API actually enforces 503 during READ_ONLY
    const block503 = await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const res = await fetch('/api/v1/tickets', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({ service_id: '31000000-0000-4000-8000-000000000001', service_version: 1, form_version: 1, policy_version: 1, title: 'Uji 503', description: 'Uji blokir', answers: {} }),
      });
      return res.status;
    })()`);
    assert.equal(block503, 503, 'Write API must return 503 during READ_ONLY maintenance');
    console.log('  [OK] Unscheduled (Darurat) FULL_SCREEN Under Maintenance overlay + 503 write guard verified');

    // READ_ONLY takes precedence over DRAIN while both windows are active.
    await resetMaintenanceClean(cdp);
    await waitFor(() => cdp.eval("(async () => (await (await fetch('/api/v1/maintenance/status')).json()).active === null)()"), 5000, 'READ_ONLY ended');
    // 4. Test BANNER + DRAIN mode locks ticket creation form on /lapor.html while keeping catalog readable
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-stop]') !== null`), 8000);
    await cdp.eval(`(() => {
      document.querySelector('#hd-maint-schedule-kind').value = 'UNSCHEDULED';
      document.querySelector('#hd-maint-schedule-kind').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-display').value = 'BANNER';
      document.querySelector('#hd-maint-display').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-mode').value = 'DRAIN';
      document.querySelector('#hd-maint-mode').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#hd-maint-reason').value = 'Migrasi basis data berlangsung; pengajuan laporan baru ditutup sementara';
      document.querySelector('[data-hd-maintenance-form] button[type="submit"]').click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-title]')?.textContent?.includes('(DRAIN)')`), 10000, 'admin DRAIN applied');

    await cdp.navigate(`${BASE}/lapor.html?id=${encodeURIComponent(REPORT_SERVICE)}`, 800);
    const laporDrain = await waitFor(() => cdp.eval(`(() => {
      const f = document.querySelector('form[data-ticket-create]');
      if (!f || f.hidden) return null;
      const notice = f.querySelector('.hd-maint-form-notice');
      const submit = f.querySelector('button[type="submit"]');
      if (!notice || !submit) return null;
      return {
        hasBanner: Boolean(document.querySelector('.hd-maint-banner--active')),
        hasOverlay: Boolean(document.querySelector('[data-hd-maint-overlay]')),
        noticeText: notice.textContent,
        submitDisabled: submit.disabled,
      };
    })()`), 10000, '/lapor.html DRAIN lock');
    assert.equal(laporDrain.hasBanner, true);
    assert.equal(laporDrain.hasOverlay, false);
    assert.match(laporDrain.noticeText, /Mode DRAIN/);
    assert.equal(laporDrain.submitDisabled, true, 'DRAIN banner mode must disable ticket submission upfront');
    console.log('  [OK] BANNER + DRAIN mode verified with form lock on /lapor.html');

    // 5. Stop Maintenance Immediately ("Hentikan Pemeliharaan Sekarang") & verify public returns Normal
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=maintenance`, 750);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-stop]') && !document.querySelector('[data-hd-maint-stop]').hidden`), 8000, 'stop button visible');
    await cdp.eval(`document.querySelector('[data-hd-maint-stop]').click()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'stop confirm dialog open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-maint-live-badge]')?.textContent?.includes('OPERASIONAL NORMAL')`), 10000, 'stopped back to normal');

    await cdp.navigate(`${BASE}/`, 600);
    const restoredPublic = await cdp.eval(`({
      mainVisible: document.querySelector('main')?.hidden === false,
      overlay: Boolean(document.querySelector('[data-hd-maint-overlay]')),
      banner: Boolean(document.querySelector('[data-hd-maint-banner]')),
    })`);
    assert.deepEqual(restoredPublic, { mainVisible: true, overlay: false, banner: false });

    // Negative Security Checks: Operator forbidden from GET/POST /admin/maintenance; Invalid enum -> 400
    await logoutSession(cdp);
    await loginRoleKeyword(cdp, 'operator');
    loggedInAsAdmin = false;
    const secNeg = await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const g = await fetch('/api/v1/admin/maintenance', { credentials: 'include' });
      const p = await fetch('/api/v1/admin/maintenance', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({ mode: 'READ_ONLY', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(), message: 'Hack' }),
      });
      return { getStatus: g.status, postStatus: p.status };
    })()`);
    assert.equal(secNeg.getStatus, 403, 'Operator without system.maintenance/system.health must receive 403 on GET /admin/maintenance');
    assert.equal(secNeg.postStatus, 403, 'Operator must receive 403 on POST /admin/maintenance');

    const cspFinal = await cdp.eval(`window.__cspViolations || []`);
    for (const v of cspFinal) cspViolations.push(v);

    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    assert.equal(exceptions.length, 0, `Unexpected uncaught exceptions: ${exceptions.join('; ')}`);
    assert.equal(cspViolations.length, 0, `Unexpected CSP violations: ${JSON.stringify(cspViolations)}`);
    console.log('PASS Under Maintenance (Terjadwal + Tidak Terjadwal, Full-Screen + Banner, Admin Overview + Stop, ACL 403 + 503 Guard, Mobile 390x844, 0 CSP errors)');
  } catch (err) {
    if (loggedInAsAdmin) {
      await resetMaintenanceClean(cdp).catch(() => {});
    }
    throw err;
  } finally {
    await close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(err => {
    console.error('FAIL Under Maintenance E2E:', err);
    process.exit(1);
  });
}
