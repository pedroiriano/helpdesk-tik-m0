"""Verify the reporting and verified category routing slice against the disposable lab."""
from datetime import datetime, timezone
from http.cookiejar import CookieJar
import json
from pathlib import Path
import secrets
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPCookieProcessor
from uuid import uuid4

HERE = Path(__file__).resolve().parent
state = json.loads((HERE / 'browser-lab-state.json').read_text(encoding='utf-8'))
origin = state['url']
url = urlsplit(origin)
assert state['running'] and state['readiness'] == 200
assert url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port not in (None, 18080)
assert not state['persistent_volumes']
label = subprocess.check_output(['docker','inspect',state['web'],'--format','{{index .Config.Labels "helpdesk.scope"}}'],text=True).strip()
binding = subprocess.check_output(['docker','port',state['web'],'8080/tcp'],text=True).strip()
assert label == 'lifecycle-browser-test' and binding == url.netloc

cases = []


class Client:
    def __init__(self):
        self.cookies = CookieJar()
        self.http = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, method, path, status=200, body=None, headers=None):
        time.sleep(.12)  # Stay below the gateway's 10 r/s limit.
        data = None if body is None else json.dumps(body).encode()
        req_headers = {'Origin':origin}
        if data is not None:
            token = next((c.value for c in self.cookies if c.name == 'helpdesk_csrf'), '')
            req_headers.update({'Content-Type':'application/json','Idempotency-Key':str(uuid4()),'X-CSRF-Token':token})
        req_headers.update(headers or {})
        try:
            response = self.http.open(Request(origin+'/api/v1'+path,data,req_headers,method=method),timeout=15)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            result = json.loads(raw) if response.headers.get_content_type()=='application/json' else {}
            assert response.status == status, (method,path,status,response.status,result.get('message'))
            return result

    def login(self, index):
        nonce = self.request('GET','/auth/bootstrap')['csrf_token']
        self.request('POST','/auth/sessions',201,{'lab_subject_id':f'20000000-0000-4000-8000-{index:012d}','csrf_token':nonce},{'X-CSRF-Token':nonce})
        return self


a = '10000000-0000-4000-8000-000000000001'
b = '10000000-0000-4000-8000-000000000002'
team_a = '50000000-0000-4000-8000-000000000001'
team_b = '50000000-0000-4000-8000-000000000002'
division_a = '51000000-0000-4000-8000-000000000002'
division_b = '51000000-0000-4000-8000-000000000004'
service = '31000000-0000-4000-8000-000000000001'
guest, admin, admin_b, asn, operator, coordinator, receiver = Client(), Client().login(5), Client().login(6), Client().login(3), Client().login(4), Client().login(11), Client().login(12)
directory = '/reporting/directory'
entries = guest.request('GET',directory+'?limit=100')['items']
assert len(entries) == 37 and all(set(row)=={'id','name'} for row in entries)
assert guest.request('GET',directory+'?q=' + urlencode({'q':'Sekretariat Daerah'}).split('=',1)[1])['items']
assert {row['id'] for row in asn.request('GET',directory+'?mode=asn')['items']} == {a}
guest.request('GET',directory+'?mode=asn',401)
assert asn.request('GET',directory+'?mode=asn&organization_id='+b)['items'] == []
cases.append('Public directory 37 entries; ASN scope and guest bypass denied')

ref = next(row for row in entries if row['id'] not in (a,b))
division_name = 'Bidang Uji '+uuid4().hex[:6]
division = admin.request('POST','/admin/divisions',201,{'organization_id':ref['id'],'name':division_name,'active':True})
admin_b.request('PUT','/admin/divisions/'+division['id'],404,{'expected_version':1,'organization_id':ref['id'],'name':'Perubahan asing','active':False})
admin.request('POST','/admin/memberships',404,{'organization_id':ref['id'],'subject_id':str(uuid4())})
assert any(v['id']==division['id'] for v in guest.request('GET',directory+'?organization_id='+ref['id'])['items'])
admin.request('PUT','/admin/divisions/'+division['id'],200,{'expected_version':1,'organization_id':ref['id'],'name':division_name,'active':False})
assert all(v['id']!=division['id'] for v in guest.request('GET',directory+'?organization_id='+ref['id'])['items'])
cases.append('Reference division can be maintained without membership delegation; other OPD denied')
origin_team = next(t for t in admin.request('GET','/admin/teams?organization_id='+a)['items'] if t['id']==team_a)
assert origin_team.get('division_id')
admin.request('PUT','/admin/teams/'+team_a,422,{'expected_version':origin_team['version'],'organization_id':a,
              'name':origin_team['name'],'active':True,'division_id':division_b})
cases.append('Team references its active local division and rejects another organization’s division')

cats = guest.request('GET','/reporting/services/'+service+'/categories')['items']
assert len([x for x in cats if x['id'].startswith('41000000-')]) == 23
email = next(x['id'] for x in cats if x['name']=='Email kedinasan')
budget = next(x['id'] for x in cats if x['name']=='SIPD Penganggaran')
body = {'service_id':service,'service_version':1,'form_version':1,'policy_version':1,'title':'SIPD penganggaran terkendala',
        'description':'Penyimpanan dokumen gagal saat memakai SIPD penganggaran.','answers':{},'reported_category_id':email}
nonce = guest.request('GET','/auth/bootstrap')['csrf_token']
headers = {'X-CSRF-Token':nonce,'X-Guest-Capability':secrets.token_hex(32)}
guest.request('POST','/tickets',422,{**body,'reporting_org_id':a,'reporting_division_id':division_b},headers)
guest.request('POST','/tickets',422,{**body,'reported_category_id':str(uuid4())},headers)
guest.request('POST','/tickets',404,{**body,'service_id':'30000000-0000-4000-8000-000000000003','reporting_org_id':a},headers)
created = guest.request('POST','/tickets',201,{**body,'reporting_org_id':a,'reporting_division_id':division_a},headers)
path = '/tickets/'+created['id']
ticket = operator.request('GET',path)
assert ticket['requester_kind']=='GUEST' and ticket['requester_org_id'] is None
assert not ticket['reporting_context']['verified'] and ticket['reporting_context']['division']['id']==division_a
assert ticket['reported_category']['id']==email and ticket['classification']['category_id']==budget
asn.request('POST','/tickets',403,{**body,'reporting_org_id':b})
record = asn.request('POST','/tickets',201,{**body,'reporting_org_id':a,'reporting_division_id':division_a})
asn_ticket = asn.request('GET','/tickets/'+record['id'])
assert asn_ticket['reporting_context']['verified'] and asn_ticket['requester_org_id']==a
cases.append('Guest context and ASN context persist with different trust; bad category, bad division and scope bypass denied')

coordinator.request('GET',path+'/dispatch-proposal?tier=L1',409)
operator.request('POST',path+'/verify',200,{'expected_version':1,'category_id':budget,'priority':'NORMAL',
                  'classifier_version':ticket['classification']['rule_version'],'reason':'Kategori SIPD telah diperiksa'})
fallback = coordinator.request('GET',path+'/dispatch-proposal?tier=L1')
assert fallback['status']=='RECOMMENDED'
route = '/admin/services/'+service+'/routing/L1?category_id='+budget
local = admin.request('PUT',route,200,{'expected_version':0,'team_id':team_a,'required_skills':['network'],
                  'active':True,'reason':'Aturan kategori sintetis'})
assert local['category_id']==budget
proposal = coordinator.request('GET',path+'/dispatch-proposal?tier=L1')
assert proposal['status']=='RECOMMENDED' and proposal['digest']!=fallback['digest'] and 'kategori terverifikasi' in proposal['explanation'].lower()
assert 'Bidang' in proposal['destination']
cross = {'expected_version':1,'team_id':team_b,'target_org_id':b,'required_skills':['network'],'active':True,'reason':'Uji jalur lintas OPD'}
admin.request('PUT',route,403,cross)

# Install a temporary second mandate using the trusted, isolated fixture bootstrap only.
subprocess.run(['docker','exec','-i',state['database'],'psql','-X','-U','postgres','-d','helpdesk','-q','-v','ON_ERROR_STOP=1'],
    input=f"""INSERT INTO identity.memberships(id,subject_id,org_id,permissions,valid_until,grant_ceiling)
    VALUES('{uuid4()}','20000000-0000-4000-8000-000000000005','{b}',ARRAY['catalog.write','rules.write'],now()+interval '1 day',ARRAY[]::text[]);""",
    text=True,check=True,capture_output=True)
admin.request('PUT',route,200,cross)
proposal = coordinator.request('GET',path+'/dispatch-proposal?tier=L1')
assert proposal['status']=='HANDOFF' and proposal['target_org_id']==b and proposal['team_id']==team_b and proposal['candidates']==[]
assert any(x['id']==b for x in coordinator.request('GET',path+'/handoff-targets')['items'])
assert [x['id'] for x in coordinator.request('GET',path+'/handoff-targets?organization_id='+b)['items']]==[team_b]
operator.request('GET',path+'/handoff-targets',403)
handoff = coordinator.request('POST',path+'/handoffs',201,{'expected_version':2,'target_org_id':b,'target_team_id':team_b,'reason':'Alihkan kepada penanggung jawab tujuan'})
assert coordinator.request('GET',path)['service_owner_org_id']==a
accepted = receiver.request('POST',path+'/handoffs/'+handoff['id']+'/accept',200,
                            {'expected_version':handoff['version'],'reason':'Tujuan menerima tanggung jawab'})
assert receiver.request('GET',path)['service_owner_org_id']==b
coordinator.request('GET',path,404)
cases.append('Verification guard, default/category ranking, dual mandate, cross-OPD suggestion and acceptance with revocation')

(HERE/'http.json').write_text(json.dumps({'result':'PASS','timestamp':datetime.now(timezone.utc).isoformat(),'cases':cases,'working_database_writes':False},indent=2)+'\n',encoding='utf-8')
print('PASS disposable reporting directory, master scope, ticket classification and Smart Dispatch/handoff')
