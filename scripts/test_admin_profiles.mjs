import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {primaryProfiles,specialProfiles,subjectsForProfile,profileForRole,quickLoginSubject,delegationOptions,standardAccess,accessIsAllowed,workStart} from '../frontend/admin-profiles.mjs';
import {canNavigate,adminItems} from '../frontend/admin-navigation.mjs';
const policy=JSON.parse(await readFile(new URL('../contracts/policy/permissions.v1.json',import.meta.url),'utf8'));
const all=[...new Set(Object.values(policy.roles).flatMap(r=>r.permissions))];
const session=(role,org='A',permissions=['identity.grant'],ceiling=all,active=true,kind='STAFF')=>({actor:{role,kind,memberships:[{organization_id:org,organization_active:active,permissions,grant_ceiling:ceiling}]}});
assert.deepEqual(primaryProfiles.map(p=>p.label),['Operator','Teknisi','Koordinator','Pimpinan','Administrator']);
const profiles=[...primaryProfiles,...specialProfiles];
assert.equal(new Set(profiles.flatMap(p=>p.roles)).size,profiles.flatMap(p=>p.roles).length);
for(const p of profiles) for(const role of p.roles) {
  assert.ok(policy.roles[role],role);
  assert.equal(profileForRole(role),p);
  const selected=standardAccess(session('PLATFORM_ADMIN'),'A',role);
  assert.ok(selected.every(permission=>policy.roles[role].permissions.includes(permission)));
  assert.ok(!selected.some(permission=>['system.purge.request','system.job','system.maintenance','identity.organization.create'].includes(permission)));
  assert.equal(accessIsAllowed(session('PLATFORM_ADMIN'),'A',role,selected),true);
  for(const denied of [session('PLATFORM_ADMIN','B'),session('PLATFORM_ADMIN','A',['catalog.write']),session('PLATFORM_ADMIN','A',['identity.grant'],all,false),session('PUBLIC','A',['identity.grant'],all,true,'PUBLIC')]) {
    assert.deepEqual(delegationOptions(denied,'A',role),[]);
    assert.equal(accessIsAllowed(denied,'A',role,['ticket.read']),false);
    assert.equal(accessIsAllowed(denied,'A',role,[]),false);
  }
}
assert.deepEqual(standardAccess(session('ADMIN_OPD','A',['identity.grant'],['ticket.read','ticket.verify','system.purge.request']),'A','OPERATOR'),['ticket.read','ticket.verify']);
assert.equal(accessIsAllowed(session('ADMIN_OPD','A',['identity.grant'],['ticket.read']),'A','OPERATOR',['ticket.verify']),false);
assert.equal(accessIsAllowed(session('PLATFORM_ADMIN'),'A','ADMIN_OPD',['ticket.read']),false);
assert.equal(accessIsAllowed(session('PLATFORM_ADMIN'),'A','VENDOR',[]),false);
const subjects=[{id:'s',kind:'STAFF',role:'SUPER_ADMIN'},{id:'p',kind:'STAFF',role:'PLATFORM_ADMIN'},{id:'o',kind:'STAFF',role:'ADMIN_OPD'},{id:'fake',kind:'PUBLIC',role:'OPERATOR'},{id:'t1',kind:'STAFF',role:'TECHNICIAN'},{id:'t2',kind:'STAFF',role:'TECHNICIAN'},{id:'a',kind:'ASN',role:'ASN'}];
assert.equal(quickLoginSubject(subjects,'administrator').id,'o');
assert.equal(quickLoginSubject(subjects.filter(s=>s.id!=='o'),'administrator').id,'p');
assert.equal(quickLoginSubject(subjects.filter(s=>['s'].includes(s.id)),'administrator'),undefined);
assert.deepEqual(subjectsForProfile(subjects,'operator'),[]);
assert.deepEqual(subjectsForProfile(subjects,'technician').map(s=>s.id),['t1','t2']);
assert.deepEqual(subjectsForProfile(subjects,'requester-asn').map(s=>s.id),['a']);
assert.deepEqual(subjectsForProfile(subjects,'unknown'),[]);
for(const profile of primaryProfiles) {
  const role=profile.roles[0];
  const actor=session(role,'A',policy.roles[role].permissions);
  const task=workStart(actor);
  assert.equal(task.href,profile.href);
  const item=adminItems.find(i=>i.href===task.href || i.id==='tickets' && task.href.includes('/tickets/'));
  assert.ok(item && canNavigate(item,actor));
  assert.equal(workStart(session(role,'A',[],all,false)).href,'/panduan.html');
}
assert.equal(workStart(session('ADMIN_OPD','A',['catalog.write'])).href,'/admin/app/helpdesk/index.html?kind=services');
assert.equal(workStart(undefined).href,'/panduan.html');
const login=await readFile(new URL('../frontend/dist/admin/auth/login.html',import.meta.url),'utf8');
assert.deepEqual([...login.matchAll(/data-quick-login="([^"]+)"/g)].map(m=>m[1]),primaryProfiles.map(p=>p.id));
assert.ok(login.includes('<details class="hd-access-details"><summary>Akun lab lainnya dan akses khusus</summary>'));
const editor=await readFile(new URL('../frontend/dist/admin/app/helpdesk/index.html',import.meta.url),'utf8');
const select=editor.match(/id="hd-access-profile"[^>]*>([\s\S]*?)<\/select>/)[1];
assert.deepEqual([...select.matchAll(/<option value="([^"]+)">/g)].map(m=>m[1]),primaryProfiles.map(p=>p.id));
assert.ok(editor.includes('data-hd-access-standard')&&editor.includes('Pengaturan akses lanjutan')&&editor.includes('Peran akun tidak diubah melalui formulir ini.'));
console.log('PASS five profiles; exact role mapping; least-privilege quick login; org/role/ceiling negative cases; guarded work destinations; compiled login/editor');

// Exercise the actual submit listener so a successful POST becomes an editable record.
const source = await readFile(new URL('../frontend/src/features/m0-03.ts', import.meta.url), 'utf8');
const start = source.indexOf('  const saveKey = intent();');
const end = source.indexOf('  function addField(', start);
assert.ok(start >= 0 && end > start);
let submitHandler, edited, message = '';
const requests = [];
const fields = {'member-subject':'tech',org:'A',team:'',permissions:'ticket.read, ticket.resolve',expires:'2027-01-01T12:00',reason:'Fixture'};
const ctx = {
  form:{reportValidity:()=>true,addEventListener:(_,handler)=>{submitHandler=handler;}},
  select:{value:'memberships'},selected:undefined,submit:{disabled:false},session:{},
  accessEditor:{validate:()=>true},value:(_,field)=>fields[field],checked:()=>false,intent:()=>()=> 'fixture',
  api:async(path,method,body)=>{
    requests.push({path,method,body});
    return {id:'saved-binding',version:requests.length};
  },
  load:async()=>{},
  configure:row=>{edited=row;ctx.selected=row;message='';},
  status:(_,text)=>{message=text;},
};
vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end)),ctx);
await submitHandler({preventDefault(){}});
assert.equal(requests[0].method,'POST');
assert.equal(edited.id,'saved-binding');
assert.equal(edited.version,1);
assert.equal(message,'Tersimpan pada server. Versi 1.');
await submitHandler({preventDefault(){}});
assert.equal(requests[1].path,'/admin/memberships/saved-binding');
assert.equal(requests[1].method,'PUT');
assert.equal(requests[1].body.expected_version,1);
assert.equal(edited.version,2);
assert.equal(message,'Tersimpan pada server. Versi 2.');
console.log('PASS successful grant reopens the saved record and retains success after edit');
