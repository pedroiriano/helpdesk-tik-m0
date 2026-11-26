import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launchEdge,loginRoleKeyword,waitFor} from './test_maintenance_under_maintenance_browser.mjs';

const origin=process.env.HELPDESK_BASE_URL;
assert.equal(origin,'http://127.0.0.1:18191','Use only the disposable 18191 fixture');
const route=kind => origin+'/admin/app/helpdesk/index.html?kind='+kind;
const orgA='10000000-0000-4000-8000-000000000001';
const {cdp,close}=await launchEdge();
try {
  await loginRoleKeyword(cdp,'Super Admin');
  await cdp.navigate(route('organizations'),550);
  const orgRow = `[data-hd-rows] tr:has(a[href*="organization_id=${orgA}"])`;
  await waitFor(()=>cdp.eval(`Boolean(document.querySelector(${JSON.stringify(orgRow)}))`),8000,'PD row');
  await cdp.eval(`[...document.querySelector(${JSON.stringify(orgRow)}).querySelectorAll('button')].find(b=>b.textContent==='Nonaktifkan').click()`);
  const impact = await waitFor(()=>cdp.eval(`(() => {
    const box=document.querySelector('[data-hd-archive-confirm]');
    return box?.open ? [...box.querySelectorAll('[data-hd-arch-details] li')].map(e=>e.textContent) : false;
  })()`),8000,'organization impact dialog');
  assert.ok(impact.some(e=>e.startsWith('Bidang terkait:')));
  assert.ok(impact.some(e=>e.startsWith('Layanan milik PD:')));
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor(()=>cdp.eval(`!document.querySelector('[data-hd-archive-confirm]').open`),5000,'impact cancelled');
  await cdp.eval(`document.querySelector(${JSON.stringify(orgRow)}).querySelector('a[href*="kind=divisions"]').click()`);
  await waitFor(()=>cdp.eval(`Boolean(document.querySelector('[data-hd-rows] a[href*="kind=teams"][href*="division_id="]'))`),8000,'division link');
  assert.equal(await cdp.eval(`document.querySelector('#hd-master-scope-org').value`),orgA);
  const divLink=await cdp.eval(`document.querySelector('[data-hd-rows] a[href*="kind=teams"][href*="division_id="]').href`);
  await cdp.navigate(divLink,400);
  const division=new URL(divLink).searchParams.get('division_id');
  await waitFor(()=>cdp.eval(`document.querySelector('#hd-master-scope-division')?.value === ${JSON.stringify(division)} && document.querySelector('[data-hd-caption]')?.textContent.includes('Bidang terpilih')`),8000,'division filter');
  await cdp.navigate(route('teams')+'&organization_id='+orgA,550);
  const rosterURL=await waitFor(()=>cdp.eval(`document.querySelector('[data-hd-rows] a[href*="team_id="][href$="#roster"]')?.href`),8000,'roster link');
  await cdp.navigate(rosterURL,550);
  const team=new URL(rosterURL).searchParams.get('team_id');
  await waitFor(()=>cdp.eval(`document.querySelector('[data-hd-roster]')?.open && document.querySelector('#hd-roster-team')?.value === ${JSON.stringify(team)} && !document.querySelector('[data-hd-roster-form]')?.hidden`),8000,'prefilled roster');
  const eligibility=await cdp.eval(`(async()=> {
    const select=document.querySelector('#hd-roster-subject');
    const q=new URLSearchParams({organization_id:document.querySelector('#hd-roster-org').value,team_id:document.querySelector('#hd-roster-team').value});
    const r=await fetch('/api/v1/staff/directory?'+q);
    const data=await r.json();
    return {status:r.status, roles:data.items.map(p=>p.role), ids:data.items.map(p=>p.id), options:[...select.options].map(o=>o.value).filter(Boolean)};
  })()`);
  assert.equal(eligibility.status,200);
  assert.deepEqual(eligibility.options,eligibility.ids);
  assert.ok(eligibility.options.length > 0,'Fixture team should have eligible technicians');
  assert.ok(eligibility.roles.every(r=>r==='TECHNICIAN'));

  await cdp.navigate(route('media'),600);
  await waitFor(()=>cdp.eval(`Boolean(document.querySelector('#media-upload-org')?.options.length)`),8000,'media organization');
  await cdp.eval(`(() => {
    document.querySelector('[data-hd-toggle-upload]').click();
    const form=document.querySelector('[data-hd-media-upload-form]');
    const org=form.querySelector('#media-upload-org');
    org.value=${JSON.stringify(orgA)};
    org.dispatchEvent(new Event('change',{bubbles:true}));
    const dt=new DataTransfer();
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
    dt.items.add(new File([png],'media-hero-ux2.png',{type:'image/png'}));
    const input=form.querySelector('#hd-admin-media-file');
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    form.querySelector('#hd-media-alt').value='Banner sintetis UX Prioritas 2 '+Date.now();
    form.querySelector('input[name=hero_candidate]').checked=true;
    form.requestSubmit();
  })()`);
  await waitFor(()=>cdp.eval(`document.querySelector('[data-hd-media-upload-status]')?.textContent.includes('CLEAN') && !document.querySelector('[data-hd-open-uploaded-hero]')?.hidden`),15000,'clean upload linked to Hero');
  await cdp.eval(`document.querySelector('[data-hd-open-uploaded-hero]').click()`);
  await waitFor(()=>cdp.eval(`[...document.querySelectorAll('[data-hero-slots] select option')].some(option=>option.text.includes('Banner sintetis UX Prioritas 2')&&option.text.includes('CLEAN'))`),8000,'validated asset available in Hero editor');
  await writeFile('qa/remediation/rm0-04/ux-prioritas-2/structure-media.json',JSON.stringify({result:'PASS',origin,reviewCancelled:true,impactSections:impact.length,divisionScoped:true,rosterPrefilled:true,eligibleTechnicians:eligibility.options.length,upload:'CLEAN',heroCandidateListed:true},null,2)+'\n');
  console.log('PASS PD → Bidang → Tim → Roster, tinjauan dampak, dan media CLEAN di Hero');
}finally{await close();}

