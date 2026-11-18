#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.HELPDESK_BASE_URL || 'http://127.0.0.1:18090';
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.EDGE_CDP_PORT || 9238);

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
    await waitFor(() => this.eval("document.readyState === 'complete'"), 10000, `readyState on ${url}`);
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-faq-edge-'));
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

  await waitFor(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (!r.ok) return false;
      const ver = await r.json();
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

async function loginRoleKeyword(cdp, roleKeyword) {
  await cdp.navigate(`${BASE}/admin/auth/login.html`, 600);
  await waitFor(() => cdp.eval(`(() => { const s = document.querySelector('#hd-subject'); return s && s.options.length > 0; })()`), 8000, 'lab subjects');
  const matchedVal = await cdp.eval(`(() => {
    const sel = document.querySelector('#hd-subject');
    const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(${JSON.stringify(roleKeyword.toLowerCase())}));
    if (!opt) return '';
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-hd-lab-select]')?.click();
    return opt.value;
  })()`);
  assert.ok(matchedVal, `Subject matching "${roleKeyword}" must exist`);
  await waitFor(() => cdp.eval(`!location.pathname.endsWith('/login.html')`), 10000, `redirect after ${roleKeyword}`);
  await sleep(500);
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
          body: JSON.stringify({ expected_version: s.version, reason: 'FAQ browser E2E role switch' })
        });
      }
    } catch {}
  })()`);
  await cdp.send('Network.clearBrowserCookies');
}

async function run() {
  const { cdp, close } = await launchEdge();
  const runtimeErrors = [];
  cdp.on('Runtime.exceptionThrown', p => {
    runtimeErrors.push(p.exceptionDetails?.text || p.exceptionDetails?.exception?.description || 'exception');
  });

  const slug = `faq-uji-otomatis-${Date.now()}`;
  const question = `Bagaimana prosedur pengujian FAQ otomatis ${Date.now()}?`;
  const answerText = 'Ini jawaban uji otomatis M8 yang aman dan terstruktur untuk warga Kota Depok.';

  try {
    // 1. Public /faq.html desktop & hash anchor & Select2 topic filter
    await cdp.setViewport(1280, 800, false);
    await cdp.navigate(`${BASE}/faq.html#faq-pelaporan-insiden-depok-csirt`, 700);
    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-faq-status]')?.textContent || '').includes('Menampilkan')`), 10000, 'public FAQ live hydration');

    const pubFaqState = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.hd-faq-item'));
      const csirt = document.getElementById('faq-pelaporan-insiden-depok-csirt');
      const topicSelect = document.querySelector('#hd-faq-topic');
      const hasS2 = Boolean(topicSelect?.closest('.hd-s2'));
      const topics = Array.from(topicSelect?.options || []).map(o => o.value).filter(Boolean);
      return {
        count: items.length,
        csirtOpen: Boolean(csirt?.open),
        hasS2,
        topics,
        cspCount: (window.__cspViolations || []).length,
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    })()`);
    assert.ok(pubFaqState.count >= 5, `Expected >= 5 public FAQs, got ${pubFaqState.count}`);
    assert.equal(pubFaqState.csirtOpen, true, 'Hash deep-link must auto-open #faq-pelaporan-insiden-depok-csirt');
    assert.equal(pubFaqState.hasS2, true, 'Topic filter must be Select2 enhanced');
    assert.ok(pubFaqState.topics.includes('Akun & Email Dinas'), 'Topic filter must list seeded topics');
    assert.equal(pubFaqState.cspCount, 0, 'No CSP violations on /faq.html');
    assert.equal(pubFaqState.overflow, 0, 'No horizontal overflow on desktop /faq.html');

    // Filter by Select2 topic + search keyword
    await cdp.eval(`(() => {
      const sel = document.querySelector('#hd-faq-topic');
      sel.value = 'Akun & Email Dinas';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(150);
    const filteredCount = await cdp.eval(`document.querySelectorAll('.hd-faq-item').length`);
    assert.equal(filteredCount, 1, 'Filtering by Akun & Email Dinas should display 1 FAQ');

    await cdp.eval(`(() => {
      const sel = document.querySelector('#hd-faq-topic');
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const q = document.querySelector('#hd-faq-q');
      q.value = 'Capability Token';
      q.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(150);
    const keywordCount = await cdp.eval(`document.querySelectorAll('.hd-faq-item').length`);
    assert.equal(keywordCount, 1, 'Keyword search for Capability Token should display 1 FAQ');

    // Mobile check on /faq.html (390x844)
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE}/faq.html`, 700);
    const mobileOverflow = await cdp.eval(`Math.max(0, document.documentElement.scrollWidth - window.innerWidth)`);
    assert.equal(mobileOverflow, 0, 'No horizontal overflow on mobile /faq.html');

    // 2. Public Landing / accordion M8 hydration
    await cdp.setViewport(1280, 800, false);
    await cdp.navigate(`${BASE}/`, 800);
    await waitFor(() => cdp.eval(`document.querySelectorAll('#vy-faq [id^="faq-m8-"]').length >= 5`), 10000, 'landing #vy-faq M8 hydration');
    const landingMutual = await cdp.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('#vy-faq .vy-faq__q'));
      btns[0].click();
      const firstOpen = btns[0].getAttribute('aria-expanded');
      btns[1].click();
      return { firstAfterSecond: btns[0].getAttribute('aria-expanded'), second: btns[1].getAttribute('aria-expanded'), csp: (window.__cspViolations || []).length };
    })()`);
    assert.equal(landingMutual.firstAfterSecond, 'false', 'Landing FAQ must stay single-expand');
    assert.equal(landingMutual.second, 'true', 'Second FAQ item opens cleanly');
    assert.equal(landingMutual.csp, 0, 'No CSP violations on landing');

    // 3. Negative RBAC check + XSS check as EDITOR
    await loginRoleKeyword(cdp, 'editor');
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=faqs`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-articles-rows] tr').length >= 5`), 10000, 'admin FAQ rows for EDITOR');

    const xssStatus = await cdp.eval(`(async () => {
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const badRes = await fetch('/api/v1/knowledge/faqs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({
          title: 'FAQ XSS Test',
          slug: 'faq-xss-${Date.now()}',
          audience: 'PUBLIC_GUEST',
          body: '<script>window.__xssFired=1</script><p>Halo</p>',
          category_label: 'Keamanan',
          sort_order: 99,
          expected_version: 1
        })
      });
      const publishRes = await fetch('/api/v1/knowledge/faqs/c1000000-0000-4000-8000-000000000001/transitions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({ expected_version: 1, action: 'ARCHIVE', reason: 'test forbidden' })
      });
      return { badStatus: badRes.status, publishStatus: publishRes.status, xssFired: Boolean(window.__xssFired) };
    })()`);
    assert.ok(xssStatus.badStatus === 422 || xssStatus.badStatus === 400, `Script tag in FAQ body must fail validation cleanly, got ${xssStatus.badStatus}`);
    assert.equal(xssStatus.publishStatus, 403, 'EDITOR without content.publish must receive 403 on FAQ transition');
    assert.equal(xssStatus.xssFired, false, 'XSS must never execute');

    // 4. Full Admin CRUD + Publish + Archive workflow as SUPER_ADMIN
    await logoutSession(cdp);
    await loginRoleKeyword(cdp, 'super admin');
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=faqs`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-articles-rows] tr').length >= 5`), 10000, 'admin FAQ rows for SUPER_ADMIN');

    const adminShellInfo = await cdp.eval(`(() => ({
      activeNav: document.querySelector('[aria-current="page"]')?.textContent?.trim(),
      dtShell: Boolean(document.querySelector('[data-hd-articles-section] .hd-dt-shell')),
      faqBtnPressed: document.querySelector('[data-hd-editorial-kind="FAQ"]')?.getAttribute('aria-pressed'),
    }))()`);
    assert.equal(adminShellInfo.activeNav, 'Tanya Jawab (FAQ)', 'Sidebar active link must match FAQ menu');
    assert.equal(adminShellInfo.dtShell, true, 'Admin FAQ table must use DataTables shell');
    assert.equal(adminShellInfo.faqBtnPressed, 'true', 'FAQ tab must be active');

    // Click "+ Tambah FAQ Baru", fill form, save draft
    await cdp.eval(`(() => {
      document.querySelector('[data-hd-new-article]').click();
      document.querySelector('#hd-art-title').value = ${JSON.stringify(question)};
      document.querySelector('#hd-art-slug').value = ${JSON.stringify(slug)};
      document.querySelector('#hd-art-category').value = 'Uji Otomatis';
      document.querySelector('#hd-art-order').value = '5';
      document.querySelector('#hd-art-body').value = ${JSON.stringify(answerText)};
      document.querySelector('[data-hd-article-form] button[type="submit"]').click();
    })()`);
    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-articles-rows]')?.textContent || '').includes(${JSON.stringify(slug)})`), 10000, 'created FAQ draft appears in table');

    // Check 409 CAS stale expected_version protection
    const casCheck = await cdp.eval(`(async () => {
      const list = await (await fetch('/api/v1/knowledge/faqs?limit=100', { credentials: 'include' })).json();
      const created = list.items.find(x => x.slug === ${JSON.stringify(slug)});
      if (!created) return { found: false };
      const csrfTok = decodeURIComponent(document.cookie.match(/(?:^|;\\s*)helpdesk_csrf=([^;]+)/)?.[1] || '');
      const stale = await fetch('/api/v1/knowledge/faqs/' + created.id, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrfTok },
        body: JSON.stringify({
          expected_version: created.version + 99,
          title: created.title, slug: created.slug, audience: created.audience, body: created.body,
          category_label: created.category_label, sort_order: created.sort_order
        })
      });
      return { found: true, staleStatus: stale.status };
    })()`);
    assert.equal(casCheck.found, true, 'Created FAQ must persist in DB');
    assert.equal(casCheck.staleStatus, 409, 'Mismatched expected_version must return 409 Conflict');

    // Publish via UI button
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-articles-rows] tr'));
      const row = rows.find(r => r.textContent.includes(${JSON.stringify(slug)}));
      const pubBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent.trim() === 'Terbitkan');
      pubBtn.click();
    })()`);
    await waitFor(() => cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-articles-rows] tr'));
      const row = rows.find(r => r.textContent.includes(${JSON.stringify(slug)}));
      return Boolean(row && row.textContent.includes('PUBLISHED'));
    })()`), 10000, 'FAQ transition to PUBLISHED');

    // 5. Verify live guest sees newly published FAQ at top on /faq.html and /
    await logoutSession(cdp);
    await cdp.navigate(`${BASE}/faq.html`, 700);
    await waitFor(() => cdp.eval(`Boolean(document.getElementById(${JSON.stringify(slug)}))`), 10000, 'newly published FAQ appears on /faq.html');
    const firstFaqId = await cdp.eval(`document.querySelector('.hd-faq-item')?.id`);
    assert.equal(firstFaqId, slug, 'Newly published FAQ with sort_order=5 must appear first');

    await cdp.navigate(`${BASE}/`, 700);
    await waitFor(() => cdp.eval(`(document.querySelector('#vy-faq')?.textContent || '').includes(${JSON.stringify(question)})`), 10000, 'newly published FAQ appears on / #vy-faq');

    // 6. Archive cleanup as SUPER_ADMIN and verify public no longer displays it
    await loginRoleKeyword(cdp, 'super admin');
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=faqs`, 700);
    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-articles-rows]')?.textContent || '').includes(${JSON.stringify(slug)})`), 10000, 'FAQ present for cleanup');
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-articles-rows] tr'));
      const row = rows.find(r => r.textContent.includes(${JSON.stringify(slug)}));
      const archBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent.trim() === 'Arsipkan');
      archBtn.click();
    })()`);
    await waitFor(() => cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-articles-rows] tr'));
      const row = rows.find(r => r.textContent.includes(${JSON.stringify(slug)}));
      return Boolean(row && row.textContent.includes('ARCHIVED'));
    })()`), 10000, 'FAQ transition to ARCHIVED');

    await logoutSession(cdp);
    await cdp.navigate(`${BASE}/faq.html`, 700);
    await waitFor(() => cdp.eval(`(document.querySelector('[data-hd-faq-status]')?.textContent || '').includes('Menampilkan')`), 10000, 'public FAQ reloads after archive');
    const afterArchiveVisible = await cdp.eval(`Boolean(document.getElementById(${JSON.stringify(slug)}))`);
    assert.equal(afterArchiveVisible, false, 'Archived FAQ must not appear publicly');

    assert.equal(runtimeErrors.length, 0, `Unexpected runtime exceptions: ${runtimeErrors.join('; ')}`);
    console.log('PASS FAQ Management & Live Portal Edge CDP E2E (10/10 assertions verified)');
  } finally {
    await close();
  }
}

run().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
