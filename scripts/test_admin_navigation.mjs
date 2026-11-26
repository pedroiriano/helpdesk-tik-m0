import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {adminItems,adminGroups,adminSubgroups,adminIconHref,canNavigate,canOpenAdminPage,adminPageContext,roleLabels,adminSubjects} from '../frontend/admin-navigation.mjs';

const actor=(role,permissions=[],active=true,kind='STAFF',org='A')=>({version:3,actor:{name:'Akun sintetis',kind,role,memberships:[{organization_id:org,organization_active:active,permissions}]}});
const operator=actor('OPERATOR',['ticket.read','media.read','ticket.verify']);
const administrator=actor('PLATFORM_ADMIN',['catalog.write','identity.grant']);
assert.equal(new Set(adminItems.map(i=>i.id)).size,adminItems.length);
assert.equal(new Set(adminItems.map(i=>i.href)).size,adminItems.length);
assert.equal(new Set(adminItems.map(i=>i.icon)).size,adminItems.length,'Every admin sidebar menu item must use a distinct icon (zero duplicate icons)');
const allSidebarIcons=[...adminItems.map(i=>i.icon),...adminSubgroups.map(s=>s.icon)];
assert.equal(new Set(allSidebarIcons).size,allSidebarIcons.length,'Submenu toggles and items must not share icons');
for(const item of adminItems) {
  assert.ok(item.href.startsWith('/')&&!item.href.startsWith('//'));
  if(item.permissions) {
    assert.equal(canNavigate(item,undefined),false);
    assert.equal(canNavigate(item,actor('PUBLIC',item.permissions,true,'PUBLIC')),false);
    assert.equal(canNavigate(item,actor('OPERATOR',item.permissions,false)),false);
    if (item.id === 'availability') {
      assert.equal(canNavigate(item,actor('PLATFORM_ADMIN',['rules.write'])),false);
      assert.equal(canNavigate(item,actor('PLATFORM_ADMIN',['identity.grant','rules.write'])),true);
      assert.equal(canNavigate(item,actor('TECHNICIAN',['ticket.read','ticket.resolve'])),true);
      assert.equal(canNavigate(item,actor('TECHNICIAN',['ticket.resolve'])),false);
    } else {
      assert.equal(canNavigate(item,actor(item.role ?? 'OPERATOR',[item.permissions[0]],true,'STAFF',item.organization)),true);
    }
    if(item.organization) assert.equal(canNavigate(item,actor('EDITOR',item.permissions)),false);
    if(item.role) assert.equal(canNavigate(item,actor('PLATFORM_ADMIN',item.permissions)),false);
  }
}
assert.equal(canOpenAdminPage('/admin/app/helpdesk/index.html','?kind=memberships',operator),false);
assert.equal(canOpenAdminPage('/admin/app/helpdesk/index.html','?kind=memberships',administrator),true);
assert.equal(canOpenAdminPage('/admin/app/helpdesk/index.html','?kind=unknown',administrator),false);
assert.equal(canOpenAdminPage('/admin/app/tickets/index.html','',administrator),false);
assert.equal(canOpenAdminPage('/admin/app/dashboard/index.html','',undefined),false);
assert.equal(adminPageContext('/admin/app/helpdesk/index.html','?kind=media',operator).title,'Pustaka media');
assert.equal(adminPageContext('/admin/app/helpdesk/index.html','',operator).item.id,'media');
assert.equal(adminPageContext('/admin/app/tickets/detail.html').item.id,'tickets');
assert.equal(adminPageContext('/admin/app/tickets/index.html','?filter=my-tasks').title,'Tugas saya');

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
for(const file of ['admin/index.html','admin/app/dashboard/index.html','admin/app/helpdesk/index.html','admin/app/tickets/index.html','admin/app/tickets/detail.html']) {
  const html=await read('frontend/dist/'+file);
  const nav=label=>html.match(new RegExp(`<nav aria-label="${label}" data-admin-navigation>([\\s\\S]*?)</nav>`))?.[1];
  assert.ok(nav('Navigasi Utama'),file);assert.equal(nav('Navigasi Utama'),nav('Navigasi Mobile'),file);
  const ids=[...nav('Navigasi Utama').matchAll(/data-admin-nav-id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids,adminItems.map(i=>i.id));
  assert.ok(!html.includes('budi.sec@piui-zero.internal')&&!html.includes('Peran: Super Admin &amp; AppSec Lead'),file);
  assert.ok(html.includes('data-admin-profile-name')&&html.includes('data-admin-profile-role'),file);
  assert.ok(html.includes('data-admin-logout')&&!html.includes('id="btn-session-logout"'),file);
}
const html=await read('frontend/dist/admin/app/helpdesk/index.html');
const select=html.match(/<select class="piui-input" id="hd-master-kind"[^>]*>([\s\S]*?)<\/select>/)[1];
assert.deepEqual([...select.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(m=>[m[1],m[2]]),adminItems.filter(i=>i.kind).map(i=>[i.kind,i.label]));
assert.ok(!html.includes('data-hd-quick-login'));
const palette=await read('frontend/dist/admin/assets/js/components/cmd-palette.js');
const commands=JSON.parse(palette.match(/const COMMAND_ITEMS = (\[[\s\S]*?\]);/)[1]);
assert.deepEqual(commands.map(c=>[c.navId,c.title,c.href]),adminItems.map(i=>[i.id,i.label,i.href]));
assert.ok(palette.includes('commandItems()')&&palette.includes('data-admin-nav-id'));
assert.ok(!commands.some(c=>/transactions|users\/detail|components\/index/.test(c.href)));

// Execute the actual logout binder with a controlled transport; no real session writes.
const raw=(await read('frontend/src/features/admin-shell.ts')).replace(/^import .*;\r?\n/gm,'');
const code=stripTypeScriptTypes(raw.replaceAll('export function ','function '))+'\nsyncAdminShell';
for(const expired of [false,true]) {
  let handler,destination,calls=[];
  const button={dataset:{},hidden:true,disabled:false,addEventListener:(event,fn)=>{handler=fn;}};
  class APIError extends Error {constructor(status){super('fixture');this.status=status;}}
  const context={adminItems,adminGroups,adminPageContext,canNavigate,canOpenAdminPage,roleLabels,APIError,
    document:{querySelectorAll:s=>s==='[data-admin-logout]'?[button]:[],querySelector:()=>null},
    location:{pathname:'/admin/app/dashboard/index.html',search:'',assign:p=>{destination=p;}},
    api:async(...args)=>{calls.push(args);if(expired)throw new APIError(401);},sessionBus:{postMessage:()=>{}},
  };
  const sync=vm.runInNewContext(code,context);
  sync(operator);assert.equal(button.hidden,false);await handler();
  assert.equal(calls[0][0],'/auth/logout');assert.equal(calls[0][1],'POST');assert.equal(calls[0][2].expected_version,3);
  assert.equal(destination,'/admin/auth/login.html');assert.equal(button.disabled,false);
  sync(undefined);assert.equal(button.hidden,true);await handler();assert.equal(calls.length,1);
}
console.log('PASS canonical desktop/mobile/footer/palette/module map; active scope, access guards, route context and actual server logout binding');

assert.deepEqual(adminSubjects([{kind:'PUBLIC'},{kind:'ASN'},{kind:'STAFF'}]),[{kind:'STAFF'}]);
console.log('PASS Admin lab picker excludes requester identities');

const loginHtml=await read('frontend/dist/admin/auth/login.html');
assert.ok(loginHtml.includes('piui-sidebar__group-label" hidden>Pekerjaan'));
assert.ok(loginHtml.includes('Periksa kelengkapan dan sahkan kategori laporan.'));
console.log('PASS login task guidance and empty private group prevention');

let pageChange,destination;
const picker={value:'categories',disabled:true,dataset:{},addEventListener:(name,handler)=>{pageChange=handler;}};
const bind=vm.runInNewContext(stripTypeScriptTypes(raw.replaceAll('export function ','function '))+'\nbindAdminPagePicker',{adminItems,canNavigate,location:{assign:p=>{destination=p;}}});
bind(picker,administrator);assert.equal(picker.disabled,false);pageChange();assert.equal(destination,'/admin/app/helpdesk/index.html?kind=categories');
picker.value='reports';destination=undefined;pageChange();assert.equal(destination,undefined);
console.log('PASS early enabled page picker and unauthorized target guard');

const sessionSource=await read('frontend/src/features/m0-03.ts');
const sessionCode=stripTypeScriptTypes(sessionSource.slice(sessionSource.indexOf('async function loadSession()'),sessionSource.indexOf('function intent()')))+'\nloadSession';
for(const errorStatus of [401,503]) {
  class APIError extends Error {constructor(status){super('fixture unavailable');this.status=status;}}
  let syncCount=0,failures=[];
  const load=vm.runInNewContext(sessionCode,{session:undefined,APIError,api:async()=>{throw new APIError(errorStatus);},
    status:(selector,message)=>failures.push({selector,message}),errorText:error=>error.message,nodes:()=>[],$:()=>null,
    syncJourney:()=>{syncCount++;},syncAdminShell:()=>{},roleLabels});
  if(errorStatus===503){await assert.rejects(load(),/fixture unavailable/);assert.equal(syncCount,0);assert.equal(failures.length,1);}
  else {await load();assert.equal(syncCount,1);assert.equal(failures.length,0);}
}
console.log('PASS unavailable session service is not presented as an unauthenticated account');

const queueHtml=await read('frontend/dist/admin/app/tickets/index.html');
for(const label of ['Antrean verifikasi','Antrean disposisi','Tugas saya']) assert.ok(queueHtml.includes(label));
console.log('PASS shared queue and dashboard task labels');

const busSource=await read('frontend/src/features/session-events.ts');
let constructed=0;
class ChannelFixture {constructor(name){constructed++;assert.equal(name,'helpdesk_session');}}
const shared=vm.runInNewContext(stripTypeScriptTypes(busSource.replace('export const ','const '))+'\nsessionBus',{BroadcastChannel:ChannelFixture});
assert.ok(shared);assert.equal(constructed,1);
assert.ok(raw.includes("sessionBus?.postMessage('SESSION_CHANGED')")&&!raw.includes('new BroadcastChannel'));
assert.ok(sessionSource.includes("import { sessionBus } from './session-events'"));
console.log('PASS one session channel shared by login/logout without a self-echo sender');

const features=await read('frontend/dist/admin/assets/js/components/feature-registry.js');
assert.ok(features.includes("document.querySelector('[data-hd-page],[data-ticket-page],form[data-hd-login]')&&feature.id==='notification-launchers'"));
console.log('PASS live dashboard excludes prototype notification launcher');

const keyboardCode=palette.slice(palette.indexOf('  searchInput.addEventListener("keydown"'),palette.indexOf('  // Pintasan Global'));
let keyboardHandler,closed=0,prevented=0,stopped=0;
vm.runInNewContext(keyboardCode,{searchInput:{addEventListener:(_,handler)=>{keyboardHandler=handler;}},dialogEl:{close:()=>{closed++;}}});
keyboardHandler({key:'Escape',preventDefault:()=>{prevented++;},stopPropagation:()=>{stopped++;}});
assert.equal(closed,1);assert.equal(prevented,1);assert.equal(stopped,1);
console.log('PASS native palette Escape closes instead of only clearing search');

const footer=html.match(/<ul class="piui-footer__links">([\s\S]*?)<\/ul>/)[1];
assert.deepEqual([...footer.matchAll(/data-admin-nav-id="([^"]+)"/g)].map(m=>m[1]),adminItems.filter(i=>i.footer).map(i=>i.id));
console.log('PASS footer uses the canonical task map');

const piuiSprite = await read('frontend/dist/admin/assets/icons/piui-sprite.svg');
const hdSprite = await read('frontend/dist/helpdesk/admin-icons.svg');
for (const icon of allSidebarIcons) {
  const href = adminIconHref(icon);
  const symbolId = href.split('#')[1];
  const src = href.startsWith('/helpdesk/admin-icons.svg') ? hdSprite : piuiSprite;
  assert.ok(src.includes(`id="${symbolId}"`), `Missing SVG symbol ${href}`);
}
console.log(`PASS sidebar sub-menus & 100% unique SVG icons (${allSidebarIcons.length}/${allSidebarIcons.length} distinct)`);
