"""Explicit synthetic HTTP writes/restart proof against this loopback lab only. Never stores credentials."""
import argparse,datetime,hashlib,http.cookiejar,json,secrets,struct,subprocess,time,urllib.request,urllib.error,uuid,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:18090'

class Client:
    next_request=0.0
    def __init__(self):
        self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def csrf(self):
        return next((c.value for c in self.jar if c.name=='helpdesk_csrf'),None) or next((c.value for c in self.jar if c.name=='helpdesk_tracking_csrf'),'')
    def call(self,path,method='GET',body=None,want=200,key=None,token=None,headers=None,binary=False):
        # Stay inside the real gateway rate limit even on a fast local machine.
        time.sleep(max(0.0,Client.next_request-time.monotonic()))
        Client.next_request=time.monotonic()+0.12
        data=body if isinstance(body,bytes) else None if body is None else json.dumps(body).encode()
        head={'Origin':BASE}
        if method!='GET':head.update({'Content-Type':'application/octet-stream' if isinstance(body,bytes) else 'application/json','X-CSRF-Token':self.csrf() if token is None else token,'Idempotency-Key':key or str(uuid.uuid4())})
        head.update(headers or {})
        req=urllib.request.Request(BASE+'/api/v1'+path,data=data,headers=head,method=method)
        try:res=self.http.open(req,timeout=15)
        except urllib.error.HTTPError as error:res=error
        with res:
            raw=res.read()
            # Failure text deliberately excludes headers, credential-bearing bodies and request details.
            if res.status!=want:raise RuntimeError(f'{method} {path}: HTTP {res.status}, expected {want}')
            if binary:return raw,res.headers
            return json.loads(raw)
    def bootstrap(self):
        value=self.call('/auth/bootstrap');assert value['mode']=='SYNTHETIC_LAB';return value['csrf_token']
    def login(self,index):
        nonce=self.bootstrap();self.call('/auth/sessions','POST',{'lab_subject_id':f'20000000-0000-4000-8000-{index:012d}','csrf_token':nonce},201,token=nonce)

def png():
    def chunk(name,body):return struct.pack('!I',len(body))+name+body+struct.pack('!I',zlib.crc32(name+body)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x80\xa0\xc0\x80\xa0\xc0'*2))+chunk(b'IEND',b'')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--allow-lab-writes',action='store_true');parser.add_argument('--restart-proof',action='store_true');args=parser.parse_args()
    if not args.allow_lab_writes:raise SystemExit('NOT_RUN: requires --allow-lab-writes; creates synthetic tickets without deleting existing data')
    report={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'live loopback synthetic HTTP/API and restart only; NOT browser UI/UAT','command':'python scripts/smoke_m0_04_local.py --allow-lab-writes'+(' --restart-proof' if args.restart_proof else ''),'checks':[],'result':'FAIL','credentials_persisted':False}
    def passed(name):report['checks'].append({'name':name,'result':'PASS'})
    try:
        public,guest,other,asn,operator,manager=[Client() for _ in range(6)]
        for c,index in [(public,1),(other,2),(asn,3),(operator,4),(manager,5)]:c.login(index)
        service=public.call('/catalog/services/30000000-0000-4000-8000-000000000001');form=public.call('/catalog/services/'+service['id']+'/form');policy=public.call('/catalog/services/'+service['id']+'/policy')
        answers={f['key']:('2026-11-05' if f['kind']=='date' else '1' if f['kind']=='number' else f['options'][0] if f['kind']=='choice' else 'Fixture sintetis M0-04') for f in form['fields']}
        data={'service_id':service['id'],'service_version':service['version'],'form_version':form['form_version'],'policy_version':policy['policy_version'],'title':'Uji lokal M0-04 '+uuid.uuid4().hex[:8],'description':'Fixture pengujian lokal; bukan laporan operasional nyata.','answers':answers}
        key=str(uuid.uuid4());receipt=public.call('/tickets','POST',data,201,key=key);tid=receipt['id'];assert public.call('/tickets','POST',data,201,key=key)==receipt;passed('authenticated_create_and_same_intent_replay')
        for c in [other,asn,manager]:c.call('/tickets/'+tid,want=404)
        operator.call('/tickets/'+tid);passed('cross_user_ASN_self_scope_and_config_admin_denied_operator_allowed')
        public.call('/tickets/'+tid+'/comments','POST',{'expected_version':1,'body':'Komentar publik sintetis','visibility':'REQUESTER'},201)
        operator.call('/tickets/'+tid+'/comments','POST',{'expected_version':2,'body':'Catatan internal sintetis M0-04','visibility':'INTERNAL'},201)
        assert len(public.call('/tickets/'+tid+'/comments')['items'])==1;assert len(operator.call('/tickets/'+tid+'/comments')['items'])==2;passed('comment_internal_note_projection_and_version')
        image=png();(ROOT/'qa/m0-04/upload-clean.png').write_bytes(image)
        public.call('/tickets/'+tid+'/attachments','POST',image,201,headers={'X-Expected-Version':'3','X-Filename':'lampiran-lab-m004.png','X-File-Mime':'image/png','X-Attachment-Audience':'REQUESTER'})
        attachments=[]
        for _ in range(15):
            attachments=public.call('/tickets/'+tid+'/attachments')['items']
            if attachments and attachments[0]['status']=='CLEAN':break
            time.sleep(1)
        assert attachments and attachments[0]['status']=='CLEAN','real scan not CLEAN'
        aid=attachments[0]['id'];blob,headers=public.call(f'/tickets/{tid}/attachments/{aid}/download',binary=True);assert blob==image and headers['Cache-Control']=='no-store' and headers['Content-Disposition'].startswith('attachment;');other.call(f'/tickets/{tid}/attachments/{aid}/download',want=404);passed('private_upload_real_scan_clean_download_and_scope')
        cap=secrets.token_hex(32);nonce=guest.bootstrap();g=guest.call('/tickets','POST',data,201,token=nonce,headers={'X-Guest-Capability':cap});gid=g['id'];nonce=guest.bootstrap();guest.call('/guest/tracking-session','POST',{'csrf_token':nonce},201,token=nonce,headers={'X-Guest-Capability':cap});guest.call('/tickets/'+gid);guest.call('/tickets/'+tid,want=404);passed('guest_capability_exchange_and_ticket_scope')
        if args.restart_proof:
            p=subprocess.run(['docker','restart','helpdesk-m0'],cwd=ROOT,capture_output=True,text=True,timeout=30);assert p.returncode==0,'local app restart failed'
            ready=False
            for _ in range(30):
                try:public.call('/health/ready');ready=True;break
                except (RuntimeError,urllib.error.URLError):time.sleep(1)
            assert ready,'ready did not recover'
            assert public.call('/tickets/'+tid)['version']==4;guest.call('/tickets/'+gid)
            assert len(public.call('/tickets/'+tid+'/comments')['items'])==1
            assert len(operator.call('/tickets/'+tid+'/comments')['items'])==2
            after,_=public.call(f'/tickets/{tid}/attachments/{aid}/download',binary=True);assert after==image;passed('same_app_restart_persists_account_tracking_ticket_comments_and_private_blob')
        guest.call('/tickets/'+gid+'/capability/revoke','POST',{'expected_version':1,'reason':'Akhir smoke sintetis'},200);guest.call('/tickets/'+gid,want=401);passed('guest_key_revocation_live')
        report.update(result='PASS',data_impact={'public_ticket':tid,'guest_ticket':gid,'guest_capability_revoked':True,'attachment_id':aid,'public_ticket_version':4,'existing_data_reset':False},fixture_sha256=hashlib.sha256(image).hexdigest(),limits=['HTTP proof does not replace browser desktop/mobile/keyboard acceptance','Synthetic tickets/attachment retained for review; no purge/production data or notification send'])
    except Exception as error:report['error']=str(error)
    finally:
        (ROOT/'qa/m0-04/local-http.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(report['result']+' live synthetic M0-04 HTTP/restart; browser NOT_RUN')
    if report['result']!='PASS':print(report.get('error','unknown failure'))
    return 0 if report['result']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
