import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchEdge, loginRoleKeyword, logoutSession, waitFor } from './test_maintenance_under_maintenance_browser.mjs';

const base = 'http://127.0.0.1:18090';
const genericReport = '/lapor.html?id=31000000-0000-4000-8000-000000000001';
const admin = '/admin/app/helpdesk/index.html?kind=';
const {cdp,close} = await launchEdge();
const observations = {};
const checks = new Set();
const errors = [];
cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails?.text));
const evaluate = (fn,...args) => cdp.eval('('+fn+')('+args.map(value=>JSON.stringify(value)).join(',')+')');
const wait = (fn,label) => waitFor(()=>evaluate(fn),8000,label);
const open = path => cdp.navigate(base + path,250);
const labNotice = () => [...document.querySelectorAll('[data-hd-environment]')]
  .some(note => !note.hidden && note.getClientRects().length && note.textContent.includes('Gunakan data contoh'));
async function measure(name, selectors) {
  const state = await evaluate(targets=>{
    const boxes = Object.fromEntries(Object.entries(targets).map(([label,selector])=>{
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return [label,rect ? {top:Math.round(rect.top),bottom:Math.round(rect.bottom),height:Math.round(rect.height)} : null];
    }));
    return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      missingCSS:[...document.styleSheets].length === 0 || [...document.querySelectorAll('link[rel=stylesheet]')].some(link=>!link.sheet), boxes};
  }, selectors);
  assert.ok(state.overflow<=1 && !state.missingCSS,name+' layout');
  observations[name] = state;
  return state;
}
async function press(selector, key, code) {
  await evaluate(sel=>document.querySelector(sel).focus(),selector);
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,text:key==='Enter'?'\r':undefined});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
}
async function checkCopy() {
  const trouble = await evaluate(()=>{
    const forbidden = /\b(?:DEMO|prototipe|pengembangan|sintetis|lab|UAT|M[1-9]|M11)\b/i;
    const roots = document.querySelectorAll('main,footer,header,#main-content');
    const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const issues = [];
    while(walker.nextNode()){
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element?.closest('main,footer,header') || !element.getClientRects().length ||
        element.closest('[hidden],script,style,[data-hd-kb-body],[data-hd-media-container],[data-hd-rows],tbody,[data-hd-kb-cards]')) continue;
      if (forbidden.test(node.textContent)) issues.push(node.textContent.trim().slice(0,95));
    }
    for(const root of roots) for(const node of root.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
      if(!node.getClientRects().length || node.closest('[hidden],[data-hd-kb-body],tbody,[data-hd-media-container]')) continue;
      for(const key of ['aria-label','title','placeholder','alt']){
        const text=node.getAttribute(key);
        if(text && forbidden.test(text)) issues.push(text.slice(0,95));
      }
    }
    return [...new Set(issues)].slice(0,12);
  });
  assert.deepEqual(trouble,[],'Operational copy on '+await evaluate(()=>location.pathname+location.search));
}

try {
  await cdp.setViewport(400,498,true);
  await open('/');
  const hero = await measure('hero_400',{hero:'.vy-ref-hero',image:'.vy-stage__img',cta:'.hd-hero-cta-wrap',thumbs:'.vy-stage__tabs',links:'.hd-landing-links'});
  assert.ok(hero.boxes.hero.height<=498 && hero.boxes.image.height>0 && hero.boxes.thumbs.bottom<=498 &&
    hero.boxes.thumbs.top-hero.boxes.cta.bottom>=9 && hero.boxes.links.height<=104,JSON.stringify(hero));
  assert.equal(await evaluate(()=>document.querySelectorAll('.vy-stage__tab').length),5);
  await press('.vy-stage__tab[aria-selected="true"]','ArrowRight',39);
  await wait(()=>document.querySelectorAll('.vy-stage__tab')[1]?.getAttribute('aria-selected')==='true','keyboard selects second banner');
  await wait(()=>document.querySelector('.hd-service-status')?.textContent.includes('Koneksi layanan berhasil'),'connection success text');
  await checkCopy();
  checks.add('Hero manual, five banners, short viewport, compact shortcuts and connection label');
  await evaluate(()=>document.querySelector('.hd-landing-links a[href="/layanan.html"]').click());
  await wait(()=>document.querySelector('.hd-service-option'),'Catalog from home');
  await cdp.setViewport(390,844,true);
  assert.equal(await evaluate(()=>document.querySelector('.hd-catalog-options').open),false);
  const catalog = await measure('catalog_390',{search:'#hd-catalog-q',filter:'.hd-catalog-options summary',first:'.hd-service-option'});
  assert.ok(catalog.boxes.first.top<570 && catalog.boxes.filter.height>=44,JSON.stringify(catalog));
  await press('.hd-catalog-options summary','Enter',13);
  await wait(()=>document.querySelector('.hd-catalog-options').open,'filter opens');
  await evaluate(()=>{
    const input=document.querySelector('#hd-catalog-access');
    input.value='PUBLIC_GUEST'; input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await wait(()=>document.querySelector('[data-hd-filter-count]')?.textContent==='1','filter counter');
  await press('.hd-catalog-options summary','Enter',13);
  await evaluate(()=>{
    const input=document.querySelector('#hd-catalog-q');
    input.value='uji-hasil-kosong-261126'; input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await wait(()=>document.querySelector('[data-hd-status]')?.textContent.includes('Tidak ada layanan'),'empty catalog');
  await open('/layanan.html');
  await wait(()=>document.querySelector('.hd-service-option:has([data-service-access="PUBLIC_GUEST"])'),'catalog restored');
  await checkCopy();
  await cdp.setViewport(1440,900,false);
  await wait(()=>document.querySelector('.hd-catalog-options').open,'desktop filter expands');
  await measure('catalog_1440',{search:'#hd-catalog-q',filters:'.hd-catalog-options',first:'.hd-service-option'});
  const destination = await evaluate(()=>{
    const card=document.querySelector('.hd-service-option:has([data-service-access="PUBLIC_GUEST"])');
    const action=card.querySelector('a[href*="/lapor.html"]');
    card.querySelector('a[href*="/detail-layanan.html"]').click();
    return action.getAttribute('href');
  });
  await wait(()=>document.querySelector('[data-hd-detail]:not([hidden]) .hd-detail-top-actions a') &&
    document.querySelector('[data-hd-policy]')?.textContent.includes('Batas lampiran'),'service detail ready');
  assert.equal(await evaluate(()=>document.querySelector('.hd-detail-top-actions a').getAttribute('href')),destination);
  await checkCopy();
  await cdp.setViewport(390,844,true);
  await evaluate(()=>document.querySelector('.hd-detail-top-actions a').click());
  await wait(labNotice,'notice on report from catalog');
  await open(genericReport);
  await wait(labNotice,'notice on direct report URL');
  const report = await measure('report_390',{notice:'[data-hd-environment]',title:'#ticket-title'});
  assert.ok(report.boxes.notice.bottom<=report.boxes.title.top && report.boxes.title.bottom<844);
  checks.add('Catalog filters, empty result, case detail, context preserved, report notice on both paths');

  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs',{urls:['*/api/v1/catalog/services*','*/api/v1/health/ready']});
  await open('/layanan.html');
  await wait(()=>document.querySelector('[data-hd-catalog-retry]:not([hidden])'),'catalog failure action');
  await open('/');
  await wait(()=>document.querySelector('.hd-service-status')?.textContent.includes('Layanan belum terhubung'),'connection failure text');
  await cdp.send('Network.setBlockedURLs',{urls:[]});
  await evaluate(()=>document.querySelector('.hd-service-status button').click());
  await wait(()=>document.querySelector('.hd-service-status')?.textContent.includes('Koneksi layanan berhasil'),'connection retry');
  checks.add('Catalog failure feedback and connection recovery');

  await open('/panduan.html');
  const href = await wait(()=>document.querySelector('[data-hd-kb-featured-link]')?.getAttribute('href'),'published guide link');
  const kb = await measure('knowledge_390',{search:'#hd-knowledge-search',featured:'.hd-featured-guide',first:'.hd-knowledge-card'});
  assert.ok(kb.boxes.first && kb.boxes.first.top<820,JSON.stringify(kb));
  await evaluate(()=>document.querySelector('[data-hd-kb-featured-link]').click());
  await wait(()=>document.querySelector('[data-hd-kb-title]')?.textContent,'guide reader from listing');
  await open(href);
  await wait(()=>document.querySelector('[data-hd-kb-title]')?.textContent,'guide reader directly');
  await measure('guide_detail_390',{heading:'[data-hd-kb-title]',back:'[data-hd-kb-detail] > p a'});
  checks.add('Published guide navigation and direct detail');

  for(const path of ['/akses.html','/daftar.html','/admin/auth/login.html']){
    await open(path);
    await wait(labNotice,'notice before input at '+path);
    await checkCopy();
  }
  await loginRoleKeyword(cdp,'Koordinator');
  await open('/admin/app/dashboard/index.html');
  await wait(()=>document.querySelector('[data-hd-dashboard-context]:not([hidden])')?.textContent.includes('WIB'),'dashboard report scope and period');
  await measure('dashboard_390',{context:'[data-hd-dashboard-context]',kpis:'.hd-dashboard-kpis'});
  await checkCopy();
  await open('/admin/app/tickets/index.html');
  await wait(()=>document.querySelector('[data-ticket-list] tbody tr'),'ticket queue');
  await checkCopy();
  await logoutSession(cdp);
  await loginRoleKeyword(cdp,'Super Admin');
  for(const kind of ['rules','articles','media','maintenance','notifications','role-policies']){
    await open(admin+kind);
    await wait(()=>document.querySelector('[data-hd-admin]:not([hidden])'),'admin '+kind);
    await checkCopy();
  }
  await logoutSession(cdp);
  checks.add('Runtime environment markers and visible copy across public, staff and admin routes');
  assert.deepEqual(errors,[]);
  const dir='qa/remediation/ui-ux-phase3';
  await mkdir(dir,{recursive:true});
  await writeFile(dir+'/browser.json',JSON.stringify({result:'PASS',base,checks:[...checks],observations,errors},null,2)+'\n');
  console.log('PASS Fase 3, layout, bahasa, keyboard, detail dinamis dan penanda lingkungan uji');
} finally {
  await close();
}
