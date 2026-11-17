"""Role policy and Hero acceptance on a labeled disposable HTTP/PostgreSQL lab."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from http.cookiejar import CookieJar
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, Request
from uuid import uuid4

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
state = json.loads((HERE / 'browser-lab-state.json').read_text(encoding='utf8'))
origin = state['url']
url = urlsplit(origin)
assert state['running'] and state['readiness'] == 200 and not state['persistent_volumes']
assert url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port not in (None, 18080)
label = subprocess.check_output(['docker','inspect',state['web'],'--format','{{index .Config.Labels "helpdesk.scope"}}'],text=True).strip()
binding = subprocess.check_output(['docker','port',state['web'],'8080/tcp'],text=True).strip()
assert label == 'lifecycle-browser-test' and binding == url.netloc


class Client:
    def __init__(self):
        self.jar = CookieJar()
        self.http = build_opener(HTTPCookieProcessor(self.jar))

    def request(self, method, path, expected=200, payload=None, headers=None):
        time.sleep(.11)
        h = {'Origin':origin}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode()
            h.update({'Content-Type':'application/json','Idempotency-Key':str(uuid4()),
                      'X-CSRF-Token':next((c.value for c in self.jar if c.name=='helpdesk_csrf'),'')})
        h.update(headers or {})
        try:
            response = self.http.open(Request(origin+'/api/v1'+path,data,h,method=method),timeout=12)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            result = json.loads(raw) if response.headers.get_content_type() == 'application/json' else raw
            assert response.status == expected, (method,path,expected,response.status,
                                                   result.get('message') if isinstance(result,dict) else '')
            return result

    def login(self, number):
        nonce = self.request('GET','/auth/bootstrap')['csrf_token']
        self.request('POST','/auth/sessions',201,{'lab_subject_id':subject(number),'csrf_token':nonce},{'X-CSRF-Token':nonce})
        return self


def subject(number):
    return f'20000000-0000-4000-8000-{number:012d}'


def sql(command):
    return subprocess.run(['docker','exec','-i',state['database'],'psql','-X','-U','postgres','-d','helpdesk','-qAt','-v','ON_ERROR_STOP=1'],
                          input=command,text=True,capture_output=True,check=True).stdout.strip()


super_admin, org_admin, editor, publisher, guest = Client().login(17), Client().login(5), Client().login(14),Client().login(15),Client()
org = '10000000-0000-4000-8000-000000000001'
policy_path = '/admin/role-policies'
guest.request('GET',policy_path,401)
org_admin.request('GET',policy_path,403)
policies = {row['role']:row for row in super_admin.request('GET',policy_path)['items']}
assert not policies['SUPER_ADMIN']['editable']
session = super_admin.request('GET','/auth/me')
assert {'identity.role.manage','media.write','content.publish','hero.publish'} <= set(session['permissions'])
assert 'ticket.read' not in session['permissions']
super_admin.request('PUT',policy_path+'/SUPER_ADMIN',403,{'expected_version':0,'permissions':[],'reason':'Protected core'})
super_admin.request('PUT',policy_path+'/EDITOR',422,{'expected_version':0,'permissions':['ticket.read'],'reason':'Cannot add ticket privileges'})
editor_policy = policies['EDITOR']
reduced = [p for p in editor_policy['permissions'] if p!='hero.write']
edit = {'expected_version':editor_policy['version'],'permissions':reduced,'reason':'Uji pencabutan izin editor'}
org_admin.request('PUT',policy_path+'/EDITOR',403,edit)
super_admin.request('PUT',policy_path+'/EDITOR',403,edit,{'X-CSRF-Token':'invalid'})
changed = super_admin.request('PUT',policy_path+'/EDITOR',200,edit)
super_admin.request('PUT',policy_path+'/EDITOR',409,edit)
assert 'hero.write' not in editor.request('GET','/auth/me')['permissions']
editor.request('GET','/admin/hero',403)
assert 'hero.write' not in org_admin.request('GET','/admin/assignable-role/EDITOR')['permissions']
super_admin.request('PUT',policy_path+'/EDITOR',200,{'expected_version':changed['version'],'permissions':editor_policy['permissions'],'reason':'Pulihkan konfigurasi lab'})
assert 'hero.write' in editor.request('GET','/auth/me')['permissions']

operator = Client().login(4)
operator_policy = policies['OPERATOR']
assert 'hero.write' in operator_policy['available']
sql(f"UPDATE identity.memberships SET permissions=array_remove(permissions,'hero.write') WHERE subject_id='{subject(4)}' AND org_id='{org}';")
super_admin.request('PUT',policy_path+'/OPERATOR',200,{'expected_version':operator_policy['version'],'permissions':sorted(set(operator_policy['permissions']+['hero.write'])),
                    'reason':'Tambahkan izin editorial yang dapat didelegasikan'})
operator.request('GET','/admin/hero',403)
sql(f"UPDATE identity.memberships SET permissions=array_append(permissions,'hero.write') WHERE subject_id='{subject(4)}' AND org_id='{org}';")
operator.request('GET','/admin/hero')

image = ROOT/'assets/02_Hero_Tanpa_Teks/hero-01-bantuan-tik-terpadu-tanpa-teks.png'
data = image.read_bytes()
upload = {'org_id':org,'expected_version':1,'filename':'fixture.png','mime':'image/png','size_bytes':len(data),
          'sha256':sha256(data).hexdigest(),'alt':'Banner fixture','license':'Internal','hero_candidate':True}
regular = editor.request('POST','/media',201,{**upload,'hero_candidate':False})
marked = editor.request('POST','/media',201,upload)
assert regular['visibility']==marked['visibility']=='PRIVATE'
hero = '/admin/hero'
assert guest.request('GET','/portal/hero') == {'version':0,'banners':[]}
assets = [
    'hero-01-bantuan-tik-terpadu-tanpa-teks.png','hero-02-tiket-layanan-tanpa-teks.png',
    'hero-03-dukungan-kinerja-tanpa-teks.png','hero-04-layanan-terintegrasi-tanpa-teks.png',
    'hero-05-pusat-panduan-mandiri-tanpa-teks.png',
]
banners = [{'asset':asset,'title':f'Banner {i+1}','alt':f'Ilustrasi {i+1}'} for i,asset in enumerate(assets)]
def draft(items, version=0):
    return {'expected_version':version,'banners':items,'reason':'Susun banner dalam lab'}
def selected(id):
    return [{'media_id':id,'title':'Banner editorial','alt':'Gambar uji'},*banners[1:]]

publisher.request('PUT',hero,403,draft(banners))
editor.request('PUT',hero,422,draft(banners[:4]))
editor.request('PUT',hero,422,draft(selected(marked['id'])))
editor.request('PUT',hero,422,draft(selected(regular['id'])))

# The disposable runtime intentionally has no scanner. Seed clean fixture blobs
# after proving the real API rejects pending uploads.
for item in (regular,marked):
    subprocess.run(['docker','exec','-i',state['app'],'sh','-c','cat > "$1"','fixture','/private/uploads/'+item['id']],
                   input=data,check=True,capture_output=True)
    sql(f"UPDATE knowledge.media SET status='CLEAN' WHERE id='{item['id']}' AND status='PENDING';")
assert marked['id'] in {m['id'] for m in editor.request('GET',hero+'/media')['items']}
editor.request('PUT',hero,422,draft(selected(regular['id'])))
result = editor.request('PUT',hero,200,draft(selected(marked['id'])))
assert publisher.request('GET',hero)['draft'][0]['media_id']==marked['id']
pub = {'expected_version':result['version'],'reason':'Penerbit menyetujui gambar beranda'}
editor.request('POST',hero+'/publish',403,pub)
guest.request('GET','/portal/hero/media/'+marked['id']+'?v=2',404)
assert guest.request('GET','/portal/hero')['banners']==[]
published = publisher.request('POST',hero+'/publish',200,pub)
public = guest.request('GET','/portal/hero')
assert public['version']==published['version'] and public['banners'][0]['media_id']==marked['id']
old_url = '/portal/hero/media/'+marked['id']+'?v='+str(public['version'])
assert guest.request('GET',old_url)==data
guest.request('GET','/media/'+marked['id']+'/content',404)
next_draft = editor.request('PUT',hero,200,draft(banners,published['version']))
assert guest.request('GET',old_url)==data
publisher.request('POST',hero+'/publish',200,{'expected_version':next_draft['version'],'reason':'Kembalikan gambar bawaan'})
guest.request('GET',old_url,404)
assert int(sql("SELECT count(*) FROM identity.audit_intents WHERE action='SetRoleModulePolicy';"))>=3
assert sql("SELECT count(*) FROM knowledge.audit_intents WHERE action IN ('SaveHeroDraft','PublishHero');")=='4'

report = {'result':'PASS','timestamp':datetime.now(timezone.utc).isoformat(),'working_database_writes':False,
          'cases':['Super Admin scoped editorial access and protected core','403 role, CSRF and privilege escalation guards',
                   '409 version guard, live session revocation and restore','new editorial permission requires an account grant',
                   'separate draft and publish permissions','pending/non-banner media rejected',
                   'draft private and published bytes served','public URL revoked on replacement','durable audit intents'],
          'scanner':'CLEAN blob seeded after pending rejection; scan pipeline unchanged and not exercised in disposable lab'}
(HERE/'http.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print('PASS role policy, live ACL, privacy, draft/publish, blob access and audit on disposable lab')
