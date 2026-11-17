import { durableIntent } from '../frontend/src/features/transport.ts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ticketActions, activeResolution, setGuestReceiptMode, commandFingerprint } from '../frontend/src/features/ticket-actions.ts';

const now = Date.parse('2026-11-13T06:00:00Z');
const ticket = {state:'OPEN',verification:'PENDING',requester_kind:'PUBLIC',requester_id:'requester',requester_org_id:'A',service_owner_org_id:'A',assignee_id:'tech',active_attempt_id:'current',reopen_until:'2026-11-14T06:00:00Z'};
const actor = (role, id, permissions=[], org='A', active=true) => ({actor:{role,kind:['PUBLIC','ASN'].includes(role)?role:'STAFF',subject_id:id,memberships:[{organization_id:org,organization_active:active,permissions}]}});
const requester = actor('PUBLIC','requester');
const grants = ['ticket.read','ticket.transition','ticket.verify','ticket.dispatch','ticket.vendor','ticket.pause','ticket.handoff','ticket.escalate','ticket.comment','ticket.attach','ticket.archive'];
const operator = actor('OPERATOR','operator',grants);
const tech = actor('TECHNICIAN','tech',['ticket.read','ticket.transition','ticket.resolve','ticket.comment','ticket.attach']);
const coord = actor('COORDINATOR','coord',['ticket.read','ticket.dispatch','ticket.vendor','ticket.pause','ticket.handoff','ticket.escalate']);
const leader = actor('LEADERSHIP','leader',['ticket.read','ticket.escalate']);
const allowed = (session,state,extra={}) => ticketActions(session,{...ticket,state,...extra},now);
assert.ok(allowed(operator,'OPEN').verify);
assert.equal(allowed(operator,'OPEN').dispatch,false);
assert.deepEqual(allowed(operator,'OPEN').lifecycle,['REQUEST_INFORMATION','CANCEL']);
assert.deepEqual(allowed(requester,'NEEDS_INFORMATION').lifecycle,['SUPPLY_INFORMATION','CANCEL']);
assert.ok(allowed(coord,'TRIAGED',{verification:'VERIFIED'}).dispatch);
assert.deepEqual(allowed(tech,'ASSIGNED').lifecycle,['START']);
assert.equal(allowed(tech,'ASSIGNED').resolve,false);
assert.ok(allowed(tech,'IN_PROGRESS').resolve);
assert.ok(allowed(coord,'IN_PROGRESS').vendor);
assert.ok(allowed(coord,'IN_PROGRESS').pause);
assert.ok(allowed(leader,'IN_PROGRESS').escalate);
assert.equal(allowed(leader,'IN_PROGRESS').resolve,false);
assert.ok(allowed(requester,'RESOLVED').confirm);
assert.equal(allowed(actor('PUBLIC','other'),'RESOLVED').confirm,false);
assert.equal(allowed(requester,'RESOLVED',{active_attempt_id:undefined}).confirm,false);
assert.deepEqual(allowed(requester,'CLOSED').lifecycle,['REOPEN']);
assert.deepEqual(allowed(leader,'CLOSED').lifecycle,[]);
assert.deepEqual(allowed(tech,'CLOSED').lifecycle,[]);
assert.deepEqual(allowed(operator,'CLOSED',{reopen_until:'2026-11-12T00:00:00Z'}).lifecycle,[]);
assert.ok(allowed(operator,'CLOSED').archive);
assert.equal(allowed(coord,'CLOSED').archive,false);
assert.ok(allowed(operator,'CLOSED',{archived_at:'2026-11-13T00:00:00Z'}).restore);
assert.equal(allowed(leader,'OPEN').comment,false);
assert.equal(allowed(leader,'OPEN').attach,false);
assert.equal(allowed(actor('TECHNICIAN','other',['ticket.read','ticket.resolve']),'IN_PROGRESS').resolve,false);
assert.equal(allowed(actor('ASN','requester',['ticket.confirm'],'A',false),'RESOLVED').confirm,false);
assert.ok(allowed(undefined,'RESOLVED',{requester_kind:'GUEST'}).confirm);
assert.equal(allowed(requester,'RESOLVED',{requester_kind:'GUEST'}).confirm,false);
for (const state of ['OPEN','TRIAGED','NEEDS_INFORMATION','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED']) {
  for (const session of [actor('OPERATOR','operator',grants,'B'),actor('OPERATOR','operator',grants,'A',false),actor('PLATFORM_ADMIN','admin',['catalog.write'])]) {
    const plan=allowed(session,state);
    assert.deepEqual(plan.lifecycle,[]);
    for (const [key,value] of Object.entries(plan)) if(key!=='lifecycle') assert.equal(value,false,`${state}/${key}`);
  }
  const archived=allowed(operator,state,{archived_at:'2026-11-13T00:00:00Z'});
  assert.deepEqual(archived.lifecycle,[]);
  for (const key of ['verify','dispatch','resolve','confirm','vendor','pause','handoff','escalate','archive','comment','attach']) assert.equal(archived[key],false);
}
const attempts=[{id:'previous',summary:'Old'},{id:'current',summary:'Current'}];
assert.equal(activeResolution(ticket,attempts).summary,'Current');
assert.equal(activeResolution({...ticket,active_attempt_id:'missing'},attempts),undefined);

// Exercise the actual lifecycle consumer, not a separately mirrored UI rule.
const source=await readFile(new URL('../frontend/src/features/m0-04.ts',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.slice(source.indexOf('  function renderLifecycle('),source.indexOf('  const submitLifecycle ='))) + '\nrenderLifecycle';
for(const [session,state,expected] of [[leader,'CLOSED',[]],[tech,'ASSIGNED',['START']],[requester,'NEEDS_INFORMATION',['SUPPLY_INFORMATION','CANCEL']]]) {
  let options=[];
  const section={hidden:false};
  const render=vm.runInNewContext(code,{session,ticketActions,lifecycleForm:{},lifecycleSection:section,
    lifecycleLabels:{START:'Mulai penanganan',SUPPLY_INFORMATION:'Lengkapi informasi',CANCEL:'Batalkan tiket'},
    $:()=>({replaceChildren(...nodes){options=nodes.map(n=>n.value);}}),el:()=>({}),
  });
  render({...ticket,state});
  assert.deepEqual(options,expected);assert.equal(section.hidden,!expected.length);
}
console.log('PASS role/state actions, owner and active mandate, archived/terminal guards, active resolution and lifecycle UI consumer');

const acknowledgement={required:true,disabled:false}, guestSection={hidden:true};
const form={elements:{namedItem:()=>acknowledgement},querySelector:()=>guestSection};
setGuestReceiptMode(form,false);assert.equal(acknowledgement.required,false);assert.equal(acknowledgement.disabled,true);assert.equal(guestSection.hidden,true);
setGuestReceiptMode(form,true);assert.equal(acknowledgement.required,true);assert.equal(acknowledgement.disabled,false);assert.equal(guestSection.hidden,false);
console.log('PASS guest receipt validation enabled only for guests');

const sendResolution=durableIntent();
const original={expected_version:4,summary:'Hasil perbaikan sintetis'};
const calls=[];
await assert.rejects(sendResolution('/resolve',original,async(key,body)=>{calls.push({key,body});throw new Error('lost response');},commandFingerprint(original)));
await sendResolution('/resolve',{...original,expected_version:8},async(key,body)=>{calls.push({key,body});return {state:'RESOLVED'};},commandFingerprint({...original,expected_version:8}));
assert.equal(calls[0].key,calls[1].key);assert.equal(calls[1].body.expected_version,4);
assert.equal(commandFingerprint({expected_version:1,decision:'REJECT',reason:'Sama'}),commandFingerprint({expected_version:2,decision:'REJECT',reason:'Sama'}));
assert.notEqual(commandFingerprint({expected_version:1,decision:'REJECT'}),commandFingerprint({expected_version:1,decision:'ACCEPT'}));
console.log('PASS command fingerprint preserves original CAS on unknown-commit retry');
