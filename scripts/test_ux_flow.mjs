import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {loginDestination, serviceLoginHref, ticketState, canUse, htmlText, priorityLabel} from '../frontend/src/features/journey.ts';

const service = '30000000-0000-4000-8000-000000000001';
assert.equal(loginDestination('STAFF', '?service=' + service + '&intent=report'), '/lapor.html?id=' + service);
assert.equal(loginDestination('ASN', '?service=email-dinas-depok&intent=detail'), '/detail-layanan.html?slug=email-dinas-depok');
for (const bad of ['https://other.example', '//other.example', '../admin', 'javascript:alert(1)', 'x&next=/admin/']) {
  assert.equal(loginDestination('PUBLIC', '?intent=report&service=' + encodeURIComponent(bad)), '/tiket.html');
}
assert.equal(loginDestination('STAFF', '?next=https://other.example'), '/admin/app/dashboard/index.html');
assert.equal(loginDestination('PUBLIC', ''), '/tiket.html');
assert.match(serviceLoginHref(service, 'report'), /^\/akses\.html\?service=/);
assert.equal(ticketState({state:'NEEDS_INFORMATION', verification:'PENDING'}), 'Perlu informasi tambahan');
assert.equal(canUse({actor:{memberships:[{organization_active:false,permissions:['ticket.read']}]}}, 'ticket.read'), false);

const source = await readFile(new URL('../frontend/src/features/m0-04.ts', import.meta.url), 'utf8');
const snippet = source.slice(source.indexOf('async function track():'), source.indexOf('function formatIndonesianDateTime'));
const trackCode = stripTypeScriptTypes(snippet) + '\ntrack';
const fixtureKey = 'a'.repeat(64);

async function runTracking(key, failure = false) {
  const calls = [], messages = [];
  let submit, destination;
  const field = {value:key, focus(){}};
  const button = {disabled:false};
  const form = {
    hidden:true, reportValidity:()=>true,
    addEventListener(name, handler) { if (name === 'submit') submit = handler; },
    querySelector(selector) {
      return selector === '#ticket-capability' ? field : selector === 'button[type=submit]' ? button : null;
    },
  };
  const context = {
    session:undefined,
    loadSession:async()=>{},
    $:(selector, parent)=>parent ? parent.querySelector(selector) : form,
    intent:()=>()=> 'synthetic-tracking-intent',
    getBootstrap:async()=>({csrf_token:'synthetic-csrf'}),
    setStatus:message=>messages.push(message),
    errorText:error=>error.message,
    api:async(...args)=>{
      calls.push(args);
      if (failure) { field.value = ''; throw new Error('Kunci tidak ditemukan atau sudah dicabut.'); }
      return {ticket_id:'30000000-0000-4000-8000-000000000002'};
    },
    location:{assign:path=>{destination=path;}},
  };
  const init = vm.runInNewContext(trackCode, context);
  await init();
  assert.equal(form.hidden, false);
  await submit({preventDefault(){}});
  assert.equal(button.disabled, false);
  return {calls, messages, destination, field};
}
const invalid = await runTracking('invalid');
assert.equal(invalid.calls.length, 0);
const success = await runTracking('  ' + fixtureKey.toUpperCase() + '  ');
assert.equal(success.calls.length, 1);
assert.equal(success.calls[0][0], '/guest/tracking-session');
assert.equal(success.calls[0][5]['X-Guest-Capability'], fixtureKey);
assert.deepEqual(JSON.parse(JSON.stringify(success.calls[0][2])), {csrf_token:'synthetic-csrf'});
assert.equal(success.destination, '/detail-tiket.html?id=30000000-0000-4000-8000-000000000002');
assert.ok(!success.destination.includes(fixtureKey));
const expired = await runTracking(fixtureKey, true);
assert.equal(expired.destination, undefined);
assert.equal(expired.field.value, fixtureKey);
assert.ok(!expired.messages.join(' ').includes(fixtureKey));
console.log('PASS tracking normal input, header-only capability, error recovery, service-context routing and live mandate helpers');

// Exercise the actual capture/review/confirm listeners without network writes.
const reviewCode = stripTypeScriptTypes(source.slice(source.indexOf('  const review = $<HTMLDialogElement>'), source.indexOf('  const sender = durableIntent<Components[\'TicketCreate\']>')));
const handlers = {}, reviewHandlers = {}, children = [];
let capture, sent = 0, valid = true, focus = '';
const dialog = {open:false, showModal(){this.open=true;}, close(){this.open=false;reviewHandlers.close?.();}, addEventListener(n,h){reviewHandlers[n]=h;}};
const controls = Object.fromEntries(['[data-review-send]','[data-review-edit]','button[type=submit]'].map(k=>[k,{focus(){focus=k;},addEventListener(n,h){handlers[k]=h;}}]));
const formEl = {reportValidity:()=>valid,addEventListener(n,h){capture=h;}, requestSubmit(){const e={prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};capture(e);if(!e.prevented)sent++;}};
const fields = {title:'Judul sintetis',description:'Uraian sintetis','answer-location':'Lab'};
vm.runInNewContext(reviewCode, {
  $:selector=>selector==='[data-report-review]'?dialog:selector==='[data-review-fields]'?{replaceChildren(){children.length=0;},append(...nodes){children.push(...nodes);}}:controls[selector],
  formEl,service:{name:'Layanan sintetis'},formSnap:{fields:[{key:'location',label:'Lokasi'}]},selectedFile:{name:'contoh.png'},
  reporting:{valid:()=>true,review(){}},el:(tag,text)=>({tag,text}),formValue:(form,name)=>fields[name]??'',
});
valid=false;formEl.requestSubmit();assert.equal(dialog.open,false);assert.equal(sent,0);
valid=true;formEl.requestSubmit();assert.equal(dialog.open,true);assert.equal(sent,0);
assert.equal(focus,'[data-review-send]');
assert.ok(children.some(n=>n.text==='Lab'));
handlers['[data-review-edit]']();assert.equal(dialog.open,false);assert.equal(focus,'button[type=submit]');assert.equal(sent,0);
formEl.requestSubmit();handlers['[data-review-send]']();assert.equal(dialog.open,false);assert.equal(sent,1);
formEl.requestSubmit();assert.equal(dialog.open,true);assert.equal(sent,1);
console.log('PASS review validation, safe summary, edit focus, one confirmation dispatch and re-review');

assert.equal(ticketState({state:'OPEN',verification:'PENDING'}),'Laporan diterima');
assert.equal(priorityLabel(undefined),'Belum ditetapkan');
assert.equal(htmlText('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
assert.equal(htmlText("&'"), '&amp;&#39;');
console.log('PASS detail state, unspecified priority and safe text encoding');

const renderCode = stripTypeScriptTypes(source.slice(source.indexOf('function renderExecutiveTicketProgress('), source.indexOf('async function ticketDetail()'))) + '\nrenderExecutiveTicketProgress';
const render = vm.runInNewContext(renderCode, {
  document:{createElement:()=>({children:[],append(...nodes){this.children.push(...nodes);},querySelector:()=>null})},
  session:undefined,htmlText,ticketState,priorityLabel,requesterGuidance:()=> 'Petunjuk pemohon',
  formatIndonesianDateTime:date=>date,getRelativeTime:()=> 'Baru saja',getStepClass:()=>'',getStepIcon:n=>String(n),
});
const unsafe='<img src=x onerror="alert(1)">';
const rendered=render({state:'RESOLVED',verification:'VERIFIED',classification:{category:unsafe},number:unsafe,title:unsafe,description:unsafe,calendar_version:unsafe},unsafe,unsafe,unsafe,undefined,'2026-11-14T12:00:00Z');
const markup=rendered.children.map(n=>n.innerHTML).join('');
assert.ok(!markup.includes('<img'));assert.ok(markup.includes('&lt;img'));
assert.ok(markup.includes('Belum ditetapkan'));assert.ok(markup.includes('2026-11-14T12:00:00Z'));assert.ok(!markup.includes('24 jam kalender'));
console.log('PASS rendered ticket text/attribute escaping and server confirmation deadline');
