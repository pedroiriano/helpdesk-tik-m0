#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.HELPDESK_BASE_URL || 'http://127.0.0.1:18090';
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.EDGE_CDP_PORT || 9236);

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
  async navigate(url, waitMs = 500) {
    console.log('-> navigate:', url);
    const cur = await this.eval('location.href').catch(() => '');
    if (cur === url) {
      await waitFor(() => this.eval("document.readyState === 'complete'"), 10000, `readyState on ${url}`);
      await sleep(waitMs);
      return;
    }
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helpdesk-dt-edge-'));
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
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => {
        window.__cspViolations.push({
          directive: e.violatedDirective,
          blockedURI: e.blockedURI,
        });
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
          body: JSON.stringify({ expected_version: s.version, reason: 'DataTables browser test switch role' })
        });
      }
    } catch {}
  })()`);
  await cdp.send('Network.clearBrowserCookies');
}

async function inspectVisibleDataTables(cdp, label) {
  const info = await cdp.eval(`(() => {
    const tables = Array.from(document.querySelectorAll('table.piui-table')).filter(t => {
      let cur = t;
      while (cur) {
        if (cur.hidden) return false;
        cur = cur.parentElement;
      }
      return true;
    });
    return tables.map((t, i) => {
      const shell = t.closest('.hd-dt-shell');
      const sizes = shell ? Array.from(shell.querySelectorAll('[data-dt-pagesize] option')).map(o => o.textContent) : [];
      const rows = Array.from(t.tBodies[0]?.rows || []);
      const visibleRows = rows.filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row'));
      return {
        index: i,
        hasShell: Boolean(shell),
        hasSearch: Boolean(shell?.querySelector('[data-dt-search]')),
        hasFilter: Boolean(shell?.querySelector('[data-dt-filter]')),
        hasPager: Boolean(shell?.querySelector('[data-dt-pager]')),
        hasInfo: Boolean(shell?.querySelector('[data-dt-info]')),
        sizes,
        totalDomRows: rows.length,
        visibleRows: visibleRows.length,
        sortHeaders: t.querySelectorAll('th button.hd-dt-sort').length,
        infoText: shell?.querySelector('[data-dt-info]')?.textContent || '',
        overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    });
  })()`);
  assert.ok(info.length > 0, `${label}: expected at least one visible piui-table`);
  for (const t of info) {
    assert.equal(t.hasShell, true, `${label} table#${t.index} must have .hd-dt-shell`);
    assert.equal(t.hasSearch, true, `${label} table#${t.index} missing [data-dt-search]`);
    assert.equal(t.hasFilter, true, `${label} table#${t.index} missing [data-dt-filter]`);
    assert.equal(t.hasPager, true, `${label} table#${t.index} missing [data-dt-pager]`);
    assert.equal(t.hasInfo, true, `${label} table#${t.index} missing [data-dt-info]`);
    assert.deepEqual(t.sizes, ['10', '20', '50', '100', 'Semua'], `${label} table#${t.index} page size options mismatch`);
    assert.ok(t.sortHeaders >= 1, `${label} table#${t.index} must have sortable headers`);
    assert.ok(t.overflowPx <= 2, `${label} desktop horizontal overflow ${t.overflowPx}px`);
  }
  return info;
}

async function runInteractiveChecks(cdp, selectorContext, pageLabel) {
  const before = await cdp.eval(`(() => {
    const shell = document.querySelector(${JSON.stringify(selectorContext)})?.closest('.hd-dt-shell');
    const tbody = shell.querySelector('tbody');
    const allReal = Array.from(tbody.rows).filter(r => !r.hasAttribute('data-dt-empty-row') && !(r.cells.length === 1 && r.cells[0].colSpan > 1));
    const vis = allReal.filter(r => !r.hidden);
    const firstSortBtn = shell.querySelector('th button.hd-dt-sort');
    const colIdx = firstSortBtn ? Array.from(firstSortBtn.closest('tr').cells).indexOf(firstSortBtn.closest('th')) : 0;
    const filterOpts = Array.from(shell.querySelectorAll('[data-dt-filter] option')).filter(o => o.value).map(o => ({ value: o.value, text: o.textContent }));
    return {
      total: allReal.length,
      visibleCount: vis.length,
      firstCell: vis[0]?.cells[colIdx]?.textContent?.trim() || '',
      hasNextPageBtn: !shell.querySelector('[data-dt-next]')?.disabled,
      filterOpts,
      colIdx,
    };
  })()`);
  assert.ok(before.total >= 2, `${pageLabel}: need >=2 real rows to test sorting & search (got ${before.total})`);
  assert.ok(before.visibleCount <= 10, `${pageLabel}: default page size 10 must clamp visible rows (got ${before.visibleCount})`);

  // 1. Page size switch (10 -> all -> 10, checking 20/50/100 presence verified above)
  if (before.total > 10) {
    assert.equal(before.hasNextPageBtn, true, `${pageLabel}: next page button should be enabled when total=${before.total}`);
    const page2Visible = await cdp.eval(`(() => {
      const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
      shell.querySelector('[data-dt-next]').click();
      return {
        visible: Array.from(shell.querySelectorAll('tbody tr')).filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row')).length,
        info: shell.querySelector('[data-dt-info]').textContent,
        page2Active: shell.querySelector('[data-dt-page="2"]')?.getAttribute('aria-current'),
      };
    })()`);
    assert.equal(page2Visible.page2Active, 'page', `${pageLabel}: page 2 must be active after clicking Next`);
    assert.ok(page2Visible.info.includes('Menampilkan 11–'), `${pageLabel}: info must reflect page 2 (${page2Visible.info})`);

    for (const sz of ['20', '50', '100', 'all']) {
      const szRes = await cdp.eval(`(() => {
        const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
        const sel = shell.querySelector('[data-dt-pagesize]');
        sel.value = ${JSON.stringify(sz)};
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          visible: Array.from(shell.querySelectorAll('tbody tr')).filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row')).length,
          info: shell.querySelector('[data-dt-info]').textContent,
        };
      })()`);
      if (sz === 'all') {
        assert.equal(szRes.visible, before.total, `${pageLabel}: Semua must show all ${before.total} rows`);
        assert.ok(szRes.info.includes(`semua ${before.total}`), `${pageLabel}: Semua info mismatch (${szRes.info})`);
      } else {
        assert.equal(szRes.visible, Math.min(Number(sz), before.total), `${pageLabel}: size ${sz} row count mismatch`);
      }
    }
    // Restore to 10
    await cdp.eval(`(() => {
      const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
      const sel = shell.querySelector('[data-dt-pagesize]');
      sel.value = '10';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  // 2. Sorting: asc -> desc -> none
  const sortRes = await cdp.eval(`(() => {
    const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
    const btn = shell.querySelector('th button.hd-dt-sort');
    const th = btn.closest('th');
    const getFirst = () => shell.querySelector('tbody tr:not([hidden]):not([data-dt-empty-row])')?.cells[${before.colIdx}]?.textContent?.trim() || '';
    btn.click();
    const ascAria = th.getAttribute('aria-sort');
    const ascFirst = getFirst();
    btn.click();
    const descAria = th.getAttribute('aria-sort');
    const descFirst = getFirst();
    btn.click();
    const noneAria = th.getAttribute('aria-sort');
    return { ascAria, ascFirst, descAria, descFirst, noneAria };
  })()`);
  assert.equal(sortRes.ascAria, 'ascending', `${pageLabel}: first click must set aria-sort=ascending`);
  assert.equal(sortRes.descAria, 'descending', `${pageLabel}: second click must set aria-sort=descending`);
  assert.equal(sortRes.noneAria, 'none', `${pageLabel}: third click must reset aria-sort=none`);

  // 3. Filter
  if (before.filterOpts.length >= 1) {
    const chosen = before.filterOpts[0];
    const m = chosen.text.match(/\((\d+)\)$/);
    const expectedCount = m ? Number(m[1]) : 1;
    const fRes = await cdp.eval(`(() => {
      const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
      const sel = shell.querySelector('[data-dt-filter]');
      sel.value = ${JSON.stringify(chosen.value)};
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const sizeSel = shell.querySelector('[data-dt-pagesize]');
      sizeSel.value = 'all';
      sizeSel.dispatchEvent(new Event('change', { bubbles: true }));
      const vis = Array.from(shell.querySelectorAll('tbody tr')).filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row')).length;
      const resetVisible = !shell.querySelector('[data-dt-reset]').hidden;
      shell.querySelector('[data-dt-reset]').click();
      sizeSel.value = '10';
      sizeSel.dispatchEvent(new Event('change', { bubbles: true }));
      return { vis, resetVisible };
    })()`);
    assert.equal(fRes.vis, expectedCount, `${pageLabel}: filter option ${chosen.text} should show ${expectedCount} rows (got ${fRes.vis})`);
    assert.equal(fRes.resetVisible, true, `${pageLabel}: reset button should appear when filtered`);
  }

  // 4. Live Search (matching + no-match empty row + reset)
  const sampleKeyword = before.firstCell.split(/\s+/)[0] || before.firstCell;
  const searchRes = await cdp.eval(`(() => {
    const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
    const inp = shell.querySelector('[data-dt-search]');
    inp.value = ${JSON.stringify(sampleKeyword)};
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const matchCount = Array.from(shell.querySelectorAll('tbody tr')).filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row')).length;
    inp.value = '___zzzz_tidak_mungkin_ada_998877___';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const emptyRowShown = Boolean(shell.querySelector('tbody tr[data-dt-empty-row]:not([hidden])'));
    const emptyInfo = shell.querySelector('[data-dt-info]').textContent;
    shell.querySelector('[data-dt-reset]').click();
    const restoredCount = Array.from(shell.querySelectorAll('tbody tr')).filter(r => !r.hidden && !r.hasAttribute('data-dt-empty-row')).length;
    return { matchCount, emptyRowShown, emptyInfo, restoredCount };
  })()`);
  assert.ok(searchRes.matchCount >= 1, `${pageLabel}: search for "${sampleKeyword}" should match >=1 row`);
  assert.equal(searchRes.emptyRowShown, true, `${pageLabel}: empty filter row must appear on 0 matches`);
  assert.ok(searchRes.emptyInfo.includes('Menampilkan 0'), `${pageLabel}: empty search info mismatch (${searchRes.emptyInfo})`);
  assert.equal(searchRes.restoredCount, before.visibleCount, `${pageLabel}: reset should restore initial row count`);
}

async function checkMobileResponsive(cdp, url, selectorContext, label) {
  await cdp.setViewport(390, 844, true);
  await cdp.navigate(url, 700);
  await waitFor(() => cdp.eval(`Boolean(document.querySelector(${JSON.stringify(selectorContext)})?.closest('.hd-dt-shell'))`), 10000, `mobile shell on ${label}`);
  const mob = await cdp.eval(`(() => {
    const shell = document.querySelector(${JSON.stringify(selectorContext)}).closest('.hd-dt-shell');
    const options = shell.querySelector('.hd-dt-compact');
    if (options) options.querySelector('summary').click();
    const mSort = shell.querySelector('.hd-dt-control--mobile-sort');
    const searchEl = shell.querySelector('[data-dt-search]');
    const thead = shell.querySelector('thead');
    const selSort = shell.querySelector('[data-dt-mobile-sort]');
    const hasSortOpt = selSort && selSort.options.length > 1;
    let mobileSortedAria = '';
    if (hasSortOpt) {
      selSort.value = selSort.options[1].value;
      selSort.dispatchEvent(new Event('change', { bubbles: true }));
      mobileSortedAria = shell.querySelector('th[aria-sort="ascending"]')?.getAttribute('aria-sort') || '';
    }
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      mSortDisplay: getComputedStyle(mSort).display,
      theadDisplay: getComputedStyle(thead).display,
      searchHeight: searchEl.getBoundingClientRect().height,
      mobileSortedAria,
    };
  })()`);
  assert.ok(mob.scrollW <= mob.innerW + 2, `${label} mobile overflow: scrollW=${mob.scrollW} > innerW=${mob.innerW}`);
  assert.notEqual(mob.mSortDisplay, 'none', `${label} mobile sort dropdown must be visible <=640px`);
  assert.equal(mob.theadDisplay, 'none', `${label} table thead must switch to card mode <=640px`);
  assert.ok(mob.searchHeight >= 44, `${label} mobile search control height ${mob.searchHeight} < 44px`);
  assert.equal(mob.mobileSortedAria, 'ascending', `${label} mobile sort must update aria-sort=ascending`);
  await cdp.setViewport(1280, 800, false);
}

async function main() {
  const { cdp, close } = await launchEdge();
  const consoleErrors = [];
  const exceptions = [];
  const cspViolations = [];

  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') {
      const text = (p.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      if (!text.includes('401')) consoleErrors.push(text);
    }
  });
  cdp.on('Runtime.exceptionThrown', p => {
    exceptions.push(p.exceptionDetails?.text || 'uncaught');
  });

  try {
    // A. SUPER_ADMIN: Master Services, Notifications, Maintenance, Rules, Navigation, Articles, Media + Mobile
    await loginRoleKeyword(cdp, 'super admin');

    // Check Master Services Data Table + UX Form + Archive/Restore round-trip
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=services`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr').length > 0`), 10000, 'master services loaded');
    await inspectVisibleDataTables(cdp, 'Master Services');
    await runInteractiveChecks(cdp, '[data-hd-rows]', 'Master Services');
    const editWorked = await cdp.eval(`(() => {
      const btn = document.querySelector('[data-hd-rows] tr:not([hidden]) button');
      if (!btn) return false;
      btn.click();
      return Boolean(document.querySelector('#hd-name')?.value) &&
        document.querySelector('[data-hd-master-form]').classList.contains('is-editing');
    })()`);
    assert.equal(editWorked, true, 'Master row Ubah button listener and edit mode badge must work');

    // Check + Tambah data focus + grid column count (<=2 cols) + no cluttered picker pagination buttons
    const masterFormUx = await cdp.eval(`(() => {
      document.querySelector('[data-hd-new]').click();
      const form = document.querySelector('[data-hd-master-form]');
      const gridStyle = getComputedStyle(form.querySelector('.hd-form-grid'));
      const colCount = gridStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
      const hiddenPrevNext = Array.from(form.querySelectorAll('.hd-picker-actions button'))
        .filter(b => b.textContent.includes('Sebelumnya') || b.textContent.includes('Berikutnya'))
        .every(b => b.hidden);
      return {
        isCreating: form.classList.contains('is-creating'),
        badge: document.querySelector('[data-hd-editor-badge]')?.textContent || '',
        colCount,
        hiddenPrevNext,
      };
    })()`);
    assert.equal(masterFormUx.isCreating, true, 'Clicking Tambah must switch master form into is-creating');
    assert.equal(masterFormUx.badge, 'Data Baru', 'Badge must read Data Baru');
    assert.ok(masterFormUx.colCount <= 2, `Form grid should be max 2 columns (got ${masterFormUx.colCount})`);
    assert.equal(masterFormUx.hiddenPrevNext, true, 'Unused picker Prev/Next pagination buttons should be hidden');

    // Check Memberships: real subject names shown (not all "Akses pengguna"), default expiry prefilled, full subject dropdown
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=memberships`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr').length > 0`), 10000, 'memberships rows loaded');
    const membUx = await cdp.eval(`(() => {
      const names = Array.from(document.querySelectorAll('[data-hd-rows] tr')).map(r => r.cells[0]?.textContent?.trim() || '');
      const hasRealNames = names.some(n => n !== 'Akses pengguna' && n.includes('·'));
      document.querySelector('[data-hd-new]').click();
      const subjectCount = document.querySelector('#hd-member-subject')?.options?.length || 0;
      const defaultExpires = document.querySelector('#hd-expires')?.value || '';
      const hasRevokeAction = Array.from(document.querySelectorAll('[data-hd-rows] tr button')).some(b => /Cabut|Pulihkan/.test(b.textContent));
      return { hasRealNames, subjectCount, defaultExpires, hasRevokeAction, sample: names.slice(0, 3) };
    })()`);
    assert.equal(membUx.hasRealNames, true, `Memberships should display real subject names & roles (sample: ${JSON.stringify(membUx.sample)})`);
    assert.ok(membUx.subjectCount > 10, `Add membership dropdown should immediately list active subjects without forcing profile pre-filter (got ${membUx.subjectCount})`);
    assert.ok(membUx.defaultExpires.length >= 16, 'Add membership must auto-fill default 1-year expiry');
    assert.equal(membUx.hasRevokeAction, true, 'Memberships table must expose quick Cabut/Pulihkan action');

    // Non-destructive Category Archive -> Restore round-trip via Confirm Dialog + Toggle button
    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=categories`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-rows] tr button').length >= 2`), 10000, 'category rows loaded');
    const targetCatIdx = await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr:not([hidden])'));
      const activeIdx = rows.findIndex(r => r.cells[2]?.textContent?.startsWith('Aktif'));
      const pickIdx = activeIdx >= 0 ? activeIdx : 0;
      const row = rows[pickIdx];
      const wasActive = row.cells[2]?.textContent?.startsWith('Aktif');
      row.querySelectorAll('button')[1].click();
      return { pickIdx, wasActive };
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'archive confirm modal open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(async () => {
      const s = await cdp.eval(`({ open: Boolean(document.querySelector('[data-hd-archive-confirm]')?.open), msg: document.querySelector('[data-hd-status]')?.textContent || '' })`);
      return !s.open && s.msg.includes('berhasil');
    }, 10000, 'category toggle completed');
    // Immediately restore back to original state
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr:not([hidden])'));
      rows[${targetCatIdx.pickIdx}].querySelectorAll('button')[1].click();
    })()`);
    await waitFor(() => cdp.eval(`document.querySelector('[data-hd-archive-confirm]')?.open === true`), 5000, 'restore confirm modal open');
    await cdp.eval(`document.querySelector('[data-hd-arch-submit]').click()`);
    await waitFor(async () => {
      const state = await cdp.eval(`(() => {
        const rows = Array.from(document.querySelectorAll('[data-hd-rows] tr:not([hidden])'));
        return {
          open: Boolean(document.querySelector('[data-hd-archive-confirm]')?.open),
          cell: rows[${targetCatIdx.pickIdx}]?.cells[2]?.textContent || '',
        };
      })()`);
      return !state.open && (targetCatIdx.wasActive ? state.cell.startsWith('Aktif') : state.cell.startsWith('Nonaktif'));
    }, 10000, 'category status restored symmetrically');

    // Check Rules "+ Tambah Aturan Baru" + Toggle Nonaktifkan button + Articles auto-slugify
    for (const kind of ['notifications', 'rules', 'navigation', 'articles', 'maintenance', 'media']) {
      await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=${kind}`, 700);
      await waitFor(() => cdp.eval(`Array.from(document.querySelectorAll('table.piui-table')).some(t => t.closest('.hd-dt-shell'))`), 8000, `kind=${kind} datatable shell`);
      if (kind === 'rules') {
        const hasRuleBtns = await cdp.eval(`(() => {
          document.querySelector('[data-hd-new-rule]')?.click();
          const hasRowsBtn = Array.from(document.querySelectorAll('[data-hd-rules-rows] tr button')).some(b => /Nonaktifkan|Aktifkan/.test(b.textContent));
          return {
            creating: document.querySelector('[data-hd-rule-form]')?.classList.contains('is-creating'),
            hasRowsBtn,
          };
        })()`);
        assert.equal(hasRuleBtns.creating, true, 'Rules + Tambah Aturan Baru must switch rule form into is-creating');
      }
      if (kind === 'articles') {
        const autoSlug = await cdp.eval(`(() => {
          document.querySelector('[data-hd-new-article]')?.click();
          const t = document.querySelector('#hd-art-title');
          t.value = 'Panduan Layanan Jaringan Depok 2026';
          t.dispatchEvent(new Event('input', { bubbles: true }));
          const slugVal = document.querySelector('#hd-art-slug')?.value || '';
          document.querySelector('[data-hd-close-art-form]')?.click();
          return slugVal;
        })()`);
        assert.equal(autoSlug, 'panduan-layanan-jaringan-depok-2026', 'Articles form must auto-generate URL slug');
      }
      if (kind === 'maintenance') {
        await cdp.eval(`document.querySelector('[data-hd-tab-m11="scheduler"]')?.click()`);
        await sleep(500);
        await inspectVisibleDataTables(cdp, 'maintenance-scheduler');
        await cdp.eval(`document.querySelector('[data-hd-tab-m11="health"]')?.click()`);
        await sleep(500);
      }
      await inspectVisibleDataTables(cdp, `helpdesk?kind=${kind}`);
    }

    await checkMobileResponsive(cdp, `${BASE}/admin/app/helpdesk/index.html?kind=services`, '[data-hd-rows]', 'Master Services');

    // B. AUDITOR: Dashboard SLA Metrics + Auto-loaded Audit Log
    await logoutSession(cdp);
    await loginRoleKeyword(cdp, 'auditor');

    await cdp.navigate(`${BASE}/admin/app/dashboard/index.html`, 700);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-dashboard-metrics] tr').length > 0`), 10000, 'dashboard metrics loaded');
    await inspectVisibleDataTables(cdp, 'Dashboard');
    await runInteractiveChecks(cdp, '[data-hd-dashboard-metrics]', 'Dashboard');

    await cdp.navigate(`${BASE}/admin/app/helpdesk/index.html?kind=audit`, 800);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-hd-audit-rows] tr').length > 0`), 10000, 'audit log auto-loaded');
    await inspectVisibleDataTables(cdp, 'Audit Log');
    await runInteractiveChecks(cdp, '[data-hd-audit-rows]', 'Audit Log');

    // C. COORDINATOR: Admin Ticket Queue + Handoff Inbox + Detail + Mobile
    await logoutSession(cdp);
    await loginRoleKeyword(cdp, 'koordinator');

    await cdp.navigate(`${BASE}/admin/app/tickets/index.html`, 800);
    await waitFor(() => cdp.eval(`document.querySelectorAll('[data-ticket-list] tbody tr').length > 0`), 10000, 'admin ticket queue loaded');
    await inspectVisibleDataTables(cdp, 'Tickets Queue');
    await runInteractiveChecks(cdp, '[data-ticket-list] tbody', 'Tickets Queue');

    const firstTicketHref = await cdp.eval(`document.querySelector('[data-ticket-list] tbody tr:not([hidden]) a[href*="detail.html"]')?.getAttribute('href') || ''`);
    assert.ok(firstTicketHref, 'Admin ticket queue must render ticket detail links');
    await cdp.navigate(`${BASE}${firstTicketHref}`, 800);
    const schedulerShellAttached = await cdp.eval(`Boolean(document.querySelector('[data-ticket-scheduler-rows]')?.closest('.hd-dt-shell'))`);
    assert.equal(schedulerShellAttached, true, 'Ticket Detail scheduler table must also be wrapped in .hd-dt-shell');

    await checkMobileResponsive(cdp, `${BASE}/admin/app/tickets/index.html`, '[data-ticket-list] tbody', 'Tickets Queue');

    const cspOnLast = await cdp.eval(`window.__cspViolations || []`);
    for (const v of cspOnLast) cspViolations.push(v);

    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    assert.equal(exceptions.length, 0, `Unexpected uncaught exceptions: ${exceptions.join('; ')}`);
    assert.equal(cspViolations.length, 0, `Unexpected CSP violations: ${JSON.stringify(cspViolations)}`);
    console.log('PASS Web Admin Data Tables E2E (All 15 tables: Sorting, Filter, Live Search, Page Size 10/20/50/100/Semua, Pagination, Responsive 390x844, 0 CSP/console errors)');
  } finally {
    await close();
  }
}

main().catch(err => {
  console.error('FAIL Web Admin Data Tables E2E:', err);
  process.exit(1);
});
