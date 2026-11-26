
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const origin = process.env.HELPDESK_BASE_URL;
assert.ok(['http://127.0.0.1:18090','http://127.0.0.1:18191'].includes(origin), 'Use a local Helpdesk gateway');
const admin = '/admin/app/helpdesk/index.html?kind=';
const {cdp, close} = await launchEdge();
const checks = {};
const literal = JSON.stringify;

async function key(key, windowsVirtualKeyCode, modifiers = 0) {
  const code = key;
  for (const type of ['keyDown','keyUp']) {
    const text = type === 'keyDown' && key === 'Enter' ? '\r' : undefined;
    await cdp.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers,text});
  }
}
const expression = (f,...args) => '('+f+')('+args.map(literal).join(',')+')';
const evaluate = (f,...args) => cdp.eval(expression(f,...args));
const focus = selector => evaluate(sel => document.querySelector(sel)?.focus(),selector);
const ready = (f, description) => waitFor(() => cdp.eval(expression(f)),8000,description);
const navigate = async path => {
  await cdp.navigate(origin+path,350);
  await ready(() => document.readyState === 'complete' &&
    [...document.querySelectorAll('link[rel=stylesheet]')].every(link=>link.sheet), 'styles loaded');
};
async function measure(name, selectors) {
  const result = await evaluate(targets => {
    const width = document.documentElement.clientWidth;
    const wrap = document.documentElement.scrollWidth;
    const boxes = targets.map(selector => {
      const elem = document.querySelector(selector);
      const rect = elem?.getBoundingClientRect();
      return {selector, height:rect?.height??0, width:rect?.width??0, left:rect?.left??0, right:rect?.right??0};
    });
    return {width, overflow:wrap-width,boxes};
  }, selectors);
  assert.ok(result.overflow <= 2,name+' horizontal overflow '+JSON.stringify(result));
  for (const box of result.boxes) {
    assert.ok(box.height >= 43.75 && box.width >= 43.75,name+' target < 44px '+JSON.stringify(box));
    assert.ok(box.left >= -2 && box.right <= result.width+2,name+' target clipped '+JSON.stringify(box));
  }
  checks[name]=result;
}
async function assertFocus(selector) {
  const focused = await evaluate(sel => {
    const el=document.activeElement;
    if (!el?.matches(sel)) return false;
    const style=getComputedStyle(el);
    return el.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  },selector);
  assert.ok(focused,'Visible keyboard focus expected at '+selector);
}

async function assertInFirstViewport(name, selector) {
  const box = await evaluate(sel => {
    const target = document.querySelector(sel)?.getBoundingClientRect();
    return {top:Math.round(target?.top??-1),bottom:Math.round(target?.bottom??0),viewport:innerHeight};
  },selector);
  assert.ok(box.top>=0 && box.bottom>box.top && box.bottom<=box.viewport,name+' initially visible '+JSON.stringify(box));
  checks[name] = box;
}

try {
  await cdp.setViewport(360,700,true);
  await navigate('/');
  await key('Tab',9);
  await assertFocus('.skip-link');
  await key('Enter',13);
  await ready(()=>document.activeElement?.id==='main-content','public skip link moves focus');
  await measure('home_360', ['.hd-hero-btn--primary','.hd-hero-btn--secondary']);
  await focus('#vy-topbar-glide-panel-btn');
  await key('Enter',13);
  await ready(()=>document.querySelector('#vy-topbar-glide-panel-btn')?.getAttribute('aria-expanded')==='true' &&
    Boolean(document.activeElement?.closest('#vy-topbar-glide-flyout')),'public menu open with focus inside');
  await key('Escape',27);
  await ready(()=>document.activeElement?.id==='vy-topbar-glide-panel-btn' &&
    document.querySelector('#vy-topbar-glide-panel-btn')?.getAttribute('aria-expanded')==='false','public menu closes and restores focus');

  await cdp.setViewport(400,498,true);
  await navigate('/');
  await measure('home_short_400', ['.hd-hero-btn--primary','.vy-stage__tab:last-child']);
  const layout = await evaluate(() => {
    const hero = document.querySelector('.vy-ref-hero').getBoundingClientRect();
    const cta = document.querySelector('.hd-hero-cta-wrap').getBoundingClientRect();
    const tabs = document.querySelector('.vy-stage__tabs').getBoundingClientRect();
    const nav = document.querySelector('.vy-quick-nav').getBoundingClientRect();
    return {hero:hero.height, viewport:innerHeight, gap:tabs.top-cta.bottom, within:tabs.bottom<=hero.bottom+1,
      navAfter:nav.top>=hero.bottom-1,count:document.querySelectorAll('.vy-stage__tab').length};
  });
  assert.ok(layout.count===5 && layout.hero<=layout.viewport+1 && layout.gap>=9 && layout.within && layout.navAfter,JSON.stringify(layout));
  await focus('.vy-stage__tab[aria-selected="true"]');
  await key('ArrowRight',39);
  await ready(()=>document.activeElement?.matches('.vy-stage__tab[aria-selected="true"]') &&
    document.querySelectorAll('.vy-stage__tab')[1]?.getAttribute('aria-selected')==='true','banner keyboard selection');
  checks.home_short_layout=layout;
  await cdp.setViewport(360,700,true);
  await navigate('/layanan.html');
  const service = await ready(()=>document.querySelector('.hd-service-option:has([data-service-access="PUBLIC_GUEST"]) a[href*="/lapor.html?id="]')?.getAttribute('href'), 'guest service loaded');
  await measure('catalog_360',['#hd-catalog-q','.hd-service-option .btn-primary']);
  await cdp.setViewport(320,667,true);
  await navigate(service);
  await ready(()=>Boolean(document.querySelector('[data-ticket-create]:not([hidden])') && document.querySelector('#ticket-key')?.value),'report form ready');
  assert.ok(await evaluate(()=>document.querySelector('[data-ticket-create]').noValidate),
    'Report validation must be wired before the form becomes interactive');
  await cdp.setViewport(390,844,true);
  await assertInFirstViewport('report_title_390','#ticket-title');
  await cdp.setViewport(320,667,true);
  await measure('report_320',['#ticket-title','#ticket-description','#hd-create-dropzone','[data-ticket-create] button[type=submit]']);
  const fileWidth = await evaluate(()=>document.querySelector('#ticket-create-file')?.getBoundingClientRect().width);
  assert.ok(fileWidth <= 2,'Hidden file input must stay compact');
  await evaluate(()=>{
    const input = document.querySelector('#ticket-create-file');
    const files = new DataTransfer();
    files.items.add(new File([new Uint8Array(10485761)],'lampiran-sintetis.pdf',{type:'application/pdf'}));
    input.files = files.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await ready(()=>document.querySelector('[data-submit-status]')?.textContent.includes('melebihi batas') &&
    !document.querySelector('#ticket-create-file').files.length,'oversize attachment gets rejected locally');
  await focus('[data-ticket-create] button[type=submit]');
  await key('Enter',13);
  await ready(()=>document.querySelectorAll('[data-validation-list] button').length >= 2,'invalid form announces correction links');
  await focus('[data-validation-list] li:nth-child(2) button');
  await key('Enter',13);
  await ready(()=>document.activeElement?.id==='ticket-description','correction link focuses description');
  await assertFocus('#ticket-description');
  await evaluate(() => {
    const form=document.querySelector('[data-ticket-create]');
    form.querySelector('#ticket-title').value='Laporan aksesibilitas sintetis';
    form.querySelector('#ticket-description').value='Pratinjau laporan menggunakan keyboard.';
    form.querySelector('[name="saved-key"]').checked=true;
    for (const field of form.querySelectorAll('[name^="answer-"]')) {
      if (field.tagName==='SELECT') field.value=[...field.options].find(o=>o.value)?.value??'';
      else field.value=({number:'1',email:'ux@example.invalid',date:'2026-11-24'})[field.type]??'Data sintetis';
    }
  });
  await focus('[data-ticket-create] button[type=submit]');
  await key('Enter',13);
  await ready(()=>document.querySelector('[data-report-review]')?.open,'review opens with keyboard');
  await measure('report_dialog_320',['[data-review-send]','[data-review-edit]']);
  await key('Tab',9,8);
  await ready(()=>Boolean(document.activeElement?.closest('[data-report-review]')),'keyboard remains inside review');
  await key('Escape',27);
  await ready(()=>!document.querySelector('[data-report-review]').open &&
    document.activeElement?.matches('[data-ticket-create] button[type=submit]'),'cancel review returns focus');

  await navigate('/lacak.html');
  await ready(()=>Boolean(document.querySelector('[data-ticket-track]:not([hidden])')),'tracking form ready');
  await measure('track_320',['#ticket-capability','[data-ticket-track] button[type=submit]']);

  await cdp.setViewport(360,700,true);
  await loginRoleKeyword(cdp,'Operator OPD A');
  await navigate('/admin/app/tickets/index.html?filter=verification');
  await ready(()=>Boolean(document.querySelector('[data-queue-filters]:not([hidden])')),'queue controls ready');
  await measure('queue_360',['#queue-search-q','[data-queue-filter="verification"]','[data-queue-search-form] button[type=submit]']);
  await focus('[data-queue-advanced] summary');
  await key('Enter',13);
  await ready(()=>document.querySelector('[data-queue-advanced]')?.open,'advanced filters open from keyboard');
  await key('Enter',13);
  await ready(()=>!document.querySelector('[data-queue-advanced]')?.open,'advanced filters close from keyboard');
  await ready(()=>Boolean(document.querySelector('[data-ticket-list] .hd-dt-compact summary')),'page-specific table options ready');
  await cdp.setViewport(390,844,true);
  await evaluate(()=>window.scrollTo(0,0));
  const firstOpen='[data-ticket-list] tbody tr:not([hidden]) [data-queue-column="open"] a';
  await assertInFirstViewport('queue_first_ticket_open_390',firstOpen);
  await measure('queue_card_actions_390',[firstOpen]);
  await cdp.setViewport(1440,900,false);
  await assertInFirstViewport('queue_first_ticket_open_1440',firstOpen);
  await cdp.setViewport(360,700,true);
  await focus('[data-ticket-list] .hd-dt-compact summary');
  await key('Enter',13);
  await ready(()=>document.querySelector('[data-ticket-list] .hd-dt-compact')?.open &&
    document.querySelector('[data-ticket-list] [data-dt-search]')?.getBoundingClientRect().height>=44,'page-specific table controls open from keyboard');
  await focus('[data-ticket-list] [data-dt-search]');
  await cdp.send('Input.insertText',{text:'___no_matching_ticket_ui_test___'});
  await ready(()=>Boolean(document.querySelector('[data-ticket-list] [data-dt-empty-row]:not([hidden])')),'page-specific search shows its empty state');
  await focus('[data-ticket-list] [data-dt-reset]');
  await key('Enter',13);
  await ready(()=>!document.querySelector('[data-ticket-list] [data-dt-empty-row]:not([hidden])'),'clearing local search restores page results');
  await focus('[data-ticket-list] .hd-dt-compact summary');
  await key('Enter',13);
  await ready(()=>!document.querySelector('[data-ticket-list] .hd-dt-compact')?.open,'page-specific table controls close from keyboard');
  await focus('#btn-sidebar-toggle');
  await key('Enter',13);
  await ready(()=>document.querySelector('#piui-mobile-drawer')?.open,'admin drawer opens from keyboard');
  const labels = await evaluate(() => [...document.querySelectorAll('#piui-mobile-drawer a[data-admin-nav-id]:not([hidden])')]
    .filter(link=>link.getClientRects().length>0)
    .map(link=>({text:link.querySelector('.piui-nav-link__text')?.textContent?.trim(),height:link.getBoundingClientRect().height})));
  assert.ok(labels.length && labels.every(link=>link.text && link.height>=43.75),JSON.stringify(labels));
  await key('Escape',27);
  await ready(()=>!document.querySelector('#piui-mobile-drawer')?.open &&
    document.activeElement?.id==='btn-sidebar-toggle','admin drawer closes and restores focus');

  await cdp.setViewport(390,844,true);
  await focus(firstOpen);
  await key('Enter',13);
  await ready(()=>document.querySelector('.hd-next-step [data-ticket-jump]') &&
    !document.querySelector('[data-ticket-content]')?.hidden,'authorized ticket detail ready');
  await evaluate(()=>window.scrollTo(0,0));
  await assertInFirstViewport('ticket_next_action_390','.hd-next-step [data-ticket-jump]');
  await measure('ticket_detail_links_390',['.hd-ticket-jumps a[href="#ticket-history"]','.hd-next-step [data-ticket-jump]']);
  const actionTarget = await evaluate(()=>document.querySelector('.hd-next-step [data-ticket-jump]').hash.slice(1));
  await focus('.hd-next-step [data-ticket-jump]');
  await key('Enter',13);
  await waitFor(()=>evaluate(id=>document.activeElement?.id===id,actionTarget),8000,'role action moves focus to the authorized form');
  for (const section of ['ticket-conversation','ticket-history','ticket-attachments']) {
    await focus('.hd-ticket-jumps a[href="#'+section+'"]');
    await key('Enter',13);
    await waitFor(()=>evaluate(id=>document.activeElement?.id===id,section),8000,section+' keyboard focus');
  }
  await evaluate(()=>{
    const audience=document.querySelector('#ticket-comment-visibility');
    audience.value='INTERNAL';
    audience.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await ready(()=>document.querySelector('[data-ticket-comment][data-audience="internal"] [data-comment-label]')?.textContent==='Catatan internal','comment audience labels update');
  await focus('[data-back-to-queue]');
  await key('Enter',13);
  await ready(()=>new URLSearchParams(location.search).get('filter')==='verification' &&
    document.querySelector('[data-queue-filter="verification"]')?.getAttribute('aria-pressed')==='true','return to the previous queue view');
  await focus('#queue-search-q');
  await cdp.send('Input.insertText',{text:'ujiantreanhasilkosong261126'});
  await ready(()=>!document.querySelector('[data-queue-search-reset]')?.hidden,'reset appears for a custom queue search');
  await focus('[data-queue-search-form] button[type="submit"]');
  await key('Enter',13);
  await ready(()=>document.querySelector('[data-ticket-status]')?.textContent.includes('Belum ada tiket') &&
    document.querySelector('[data-queue-filter="all"]')?.getAttribute('aria-pressed')==='true','server search runs in the authorized all-tickets view');
  await focus('[data-queue-search-reset]');
  await key('Enter',13);
  await ready(()=>document.activeElement?.id==='queue-search-q' && !document.activeElement.value &&
    Boolean(document.querySelector('[data-ticket-list] [data-queue-column="open"]')),'queue reset restores results and input focus');

  await loginRoleKeyword(cdp,'Super Admin');
  await cdp.setViewport(320,667,true);
  await navigate(admin+'role-policies');
  await ready(()=>Boolean(document.querySelector('#hd-role-policy-select')?.options.length),'role selector ready');
  assert.ok(await evaluate(()=>{
    const brand = document.querySelector('.piui-topbar .piui-brand__name');
    const range = document.createRange();
    if (!brand || brand.textContent.trim() !== 'Helpdesk TIK Kota Depok') return false;
    range.selectNodeContents(brand);
    const box = brand.getBoundingClientRect();
    return [...range.getClientRects()].every(line=>line.left>=box.left-1 && line.right<=box.right+1 && line.bottom<=box.bottom+1);
  }),'The full Admin brand is legible on a 320px screen');
  await measure('role_policy_320',['[data-role-refresh]','[data-hd-role-policy-section] .hd-s2-trigger']);
  await navigate(admin+'hero');
  await ready(()=>document.querySelectorAll('[data-hero-slots] fieldset').length===5,'hero editor loaded');
  await measure('hero_editor_320',['[data-hero-size="desktop"]','[data-hero-size="mobile"]','[data-hero-preview-slots] button:last-child']);
  await focus('[data-hero-size="mobile"]');
  await key('Enter',13);
  await ready(()=>document.querySelector('[data-hero-size="mobile"]')?.getAttribute('aria-pressed')==='true','preview selects mobile from keyboard');
  await navigate(admin+'organizations');
  await ready(()=>Boolean(document.querySelector('[data-hd-rows] tr a[href*="kind=divisions"]')),'organization table ready');
  await measure('master_320',['[data-hd-new]','[data-hd-rows] tr a[href*="kind=divisions"]']);
  await cdp.setViewport(640,480,false);
  await measure('master_reflow_640',['[data-hd-new]']);

  const report = {result:'PASS',origin,checks,keyboard:['public skip link','both drawers and focus return',
    'banner thumbnail selection','report validation and modal Escape','advanced queue filters','ticket detail section and role action focus',
    'comment audience','return to the previous queue view','mobile Hero preview'],
    scope:'Edge lab, report preview without submission, read-only Admin work after synthetic sign-in; 640 CSS pixels represents reflow, no human UAT'};
  const directory=process.env.HELPDESK_UX_REPORT_DIR || 'qa/remediation/rm0-04/ux-prioritas-3';
  await mkdir(directory,{recursive:true});
  await writeFile(directory+'/accessibility.json',JSON.stringify(report,null,2)+'\n');
  console.log('PASS narrow reflow, 44px controls, keyboard and focus return');
} finally {
  await close();
}

