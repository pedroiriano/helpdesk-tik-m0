from pathlib import Path
import csv, json, hashlib, shutil

ROOT=Path(__file__).resolve().parents[1]
WS=ROOT.parent
SOURCE=WS/'Penyempurnaan'
def write_json(rel,obj):
    p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def write_csv(rel,fields,rows):
    p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

# Initial package authoring only. Never use this script to reset development status.
if (ROOT/'planning/backlog.csv').exists():
    raise SystemExit('STOP existing planning state; edit canonical files instead of reinitializing')
for name in ['references','contracts','configs','planning','status','docs/adr','qa']:
    (ROOT/name).mkdir(parents=True,exist_ok=True)
source_md=SOURCE/'sources/02_Blueprint_Helpdesk.md'
source_docx=SOURCE/'02_Blueprint_Helpdesk.docx'
shutil.copy2(source_md,ROOT/'references/BLUEPRINT_SUMBER_v3.2.md')
shutil.copy2(SOURCE/'v3.1/pendukung/module_registry.csv',ROOT/'contracts/module_registry.csv')
shutil.copy2(SOURCE/'revisi_helpdesk_v3.2/capability_map.csv',ROOT/'contracts/capability_map.csv')
write_json('references/provenance.json',{'package_version':'M0 1.0','product_version':'3.2','created':'2026-11-03','sources':[{'path':str(p),'sha256':sha(p)} for p in [source_md,source_docx]],'copied_source':'references/BLUEPRINT_SUMBER_v3.2.md','copied_source_sha256':sha(source_md)})
refs=json.loads((SOURCE/'revisi_helpdesk_v3.2/references.json').read_text(encoding='utf-8'))
extra=[
('S27','OpenAI','Custom instructions with AGENTS.md','https://learn.chatgpt.com/docs/agent-configuration/agents-md'),
('S28','Google Antigravity','Rules','https://antigravity.google/docs/rules/'),
('S29','Go','net/http package','https://pkg.go.dev/net/http'),
('S30','jackc pgx maintainers','pgx PostgreSQL driver and toolkit for Go','https://github.com/jackc/pgx'),
('S31','Vite','Getting Started','https://vite.dev/guide/'),
('S32','Google Antigravity','Workflows and retirement notice','https://antigravity.google/docs/ide/workflows/')]
for key,authors,title,url in extra:
    refs.append({'id':key,'authors':authors,'title':title,'url':url,'doi':'','verification':'PRIMARY_DOCUMENTATION_SELECTED_SECTIONS','accessed':'2026-11-03','limitation':'Dokumentasi diperiksa; runtime agent dan aplikasi tidak diuji oleh paket spesifikasi.'})
write_json('references/sources.json',refs)
mods=[f'M{i}' for i in range(1,10)]
write_json('configs/M0.json',{'schema_version':1,'status':'DESIGN_NOT_DEPLOYED','variant':'M0','application_processes':1,'replicas_per_group':1,'hpa':False,'internal_transport':'in_process_ports','external_transport':'http_json','module_ids':mods,'groups':{'G1':mods},'app_budget':{'cpu_m':2500,'memory_mib':4608},'db_pool_max_per_owner':4,'db_pool_total_max':36,'environment':'synthetic_lab','integrations_real_enabled':False})
write_json('contracts/dependencies.json',{'schema_version':1,'status':'DESIGN_RULES_NOT_ENFORCED_BY_APPLICATION_YET','sync_business_ports':{'M1':[],'M2':['M1'],'M3':['M1','M2','M4','M5','M6'],'M4':[],'M5':['M1'],'M6':[],'M7':['M3','M6'],'M8':['M1','M2'],'M9':['M1']},'event_subscriptions':[{'producer':'M3','consumer':'M5','purpose':'assignment load projection'},{'producer':'M3','consumer':'M6','purpose':'clock projection'},{'producer':'M3','consumer':'M7','purpose':'schedule lifecycle jobs'},{'producer':'M3','consumer':'M9','purpose':'audit notifications and reports'},{'producer':'M9','consumer':'M3','purpose':'durable NotificationStored proof per resolution attempt'},{'producer':'ALL_OWNERS','consumer':'M9','purpose':'audit stream; M9 handles own audit locally without self-relay loop'}],'constraints':['No cross-owner SQL','No cross-owner foreign key','No transaction across owners','No sibling private imports','No synchronous business dependency cycles','One Go application process']})
write_json('planning/technology-lock.json',{'status':'UNRESOLVED_AT_BOOTSTRAP','go':None,'node':None,'react':None,'typescript':None,'vite':None,'pgx':None,'postgresql':None,'migration_tool':None,'test_tools':None,'container_base_digest':None,'gateway_digest':None,'scanner':None,'storage_adapter':None,'operating_system':None,'container_runtime':None,'notes':'Pin exact compatible versions and digests during M0-01. No latest or fabricated versions.'})
commands=['backend_format_vet','backend_unit','module_boundary','database_integration','migration_roles','api_contract','frontend_lint_typecheck','frontend_unit','frontend_build','browser_smoke','security_candidate','recovery_drill']
write_json('planning/command_registry.json',{'application_commands':[{'id':x,'status':'NOT_IMPLEMENTED','command':None,'working_directory':None} for x in commands],'package_check':{'command':'python scripts/verify_package.py','scope':'documentation_and_manifest_only'}})
tasks=[
('M0-01','Fondasi stack dan struktur','', 'M1 M2 M3 M4 M5 M6 M7 M8 M9','AC01 AC09 AC10','Pin stack; structure Go/React; design tokens; config; actual command registry; boundary gate'),
('M0-02','Kontrak data API event dan permission','M0-01','M1 M2 M3 M4 M5 M6 M7 M8 M9','AC02 AC03 AC06 AC08','OpenAPI executable; owner migrations; event schemas; state and ACL fixtures'),
('M0-03','Identitas katalog dan master','M0-02','M1 M2','AC06 AC11','Lab sessions; guest/public/ASN scopes; catalog/form; admin master persistence'),
('M0-04','Tiket dan durable events','M0-03','M3 M9','AC03 AC05 AC06 AC07 AC11','Create/track/list/comments/upload core; lost-response replay; outbox/inbox and audit sink'),
('M0-05','Verifikasi klasifikasi dan dispatch','M0-04','M3 M4 M5','AC04 AC13','Verified guard; operator override; L1/L2 routing; CAS; real UI'),
('M0-06','SLA resolusi dan scheduler','M0-05','M3 M6 M7 M9','AC05 AC08 AC14 AC15','Calendar; attempt/feedback; 24h job; NotificationStored proof; races and restart'),
('M0-07','Vendor eskalasi dan handoff OPD','M0-06','M1 M3 M5 M6 M7','AC06 AC16 AC17','PIC; vendor wait and approved pauses; leadership intervention; atomic accepted handoff'),
('M0-08','Media terpadu dan draft','M0-04','M2 M3 M8','AC07 AC18 AC19 AC20','Two-owner media; scan/reuse; drafts; offline/tab/account recovery'),
('M0-09','Portal konten dan pencarian','M0-08','M2 M8','AC20 AC23 AC24','Editorial workflow; navigation; sanitization; scope-safe search/count'),
('M0-10','Notifikasi dasbor laporan dan audit','M0-07 M0-09','M1 M3 M9','AC21 AC23','Center and sink; verified Telegram binding; reports/export; visitor aggregates; no real sends'),
('M0-11','Administrasi sistem dan recovery','M0-10','M1 M2 M3 M8 M9','AC22 AC24','Maintenance; archive/purge disabled pending policy; scoped runner; isolated restore drill'),
('M0-12','Integrasi dan kandidat final','M0-11','M1 M2 M3 M4 M5 M6 M7 M8 M9','AC01 AC02 AC03 AC04 AC05 AC06 AC07 AC08 AC09 AC10 AC11 AC12 AC13 AC14 AC15 AC16 AC17 AC18 AC19 AC20 AC21 AC22 AC23 AC24 AC25','All M0 acceptance evidence; final candidate gate; operational documentation'),
('M0-13','UAT dan keputusan rilis','M0-12','M1 M2 M3 M4 M5 M6 M7 M8 M9','AC11 AC25','Human domain UAT; organizational gates; release approval distinct from technical PASS')]
write_csv('planning/backlog.csv',['id','title','depends_on','modules','acceptance','deliverable','status','evidence'],[dict(zip(['id','title','depends_on','modules','acceptance','deliverable'],t),status='NOT_STARTED',evidence='') for t in tasks])
ac_source=[]
for line in source_md.read_text(encoding='utf-8').splitlines():
    if line.startswith('| AC'):
        vals=[x.strip() for x in line.strip('|').split('|')]
        ac_source.append(vals)
deferred={'AC02','AC09','AC10','AC12','AC25'}
ac=[]
for key,requirement,evidence in ac_source:
    note='Implementasi dan bukti M0; perbandingan beberapa arsitektur belum dijalankan.' if key in deferred else 'Berlaku penuh pada implementasi M0.'
    if key=='AC01': note='Satu group G1 berisi M1-M9 tepat sekali, satu proses; manifest invalid ditolak.'
    if key=='AC12': note='Provenance source dan evidence M0 diperiksa; G-OPT serta HELD_OUT bukan task paket ini.'
    ac.append({'id':key,'source_requirement':requirement,'source_evidence':evidence,'m0_scope':note,'research_scope':'DEFERRED_RESEARCH' if key in deferred else 'NOT_APPLICABLE','status':'NOT_IMPLEMENTED','evidence':''})
write_csv('contracts/acceptance.csv',list(ac[0]),ac)
locations=['3 4 12','9 10','9 10 11','10','10','10','10','10','10','10','9 10','10','8 10','10','10','9 11','3 11','10 11 12','8 10','8 11','11','10 11','3 11','6','7','7','9 11','5 7','5']
source_trace=list(csv.DictReader((SOURCE/'revisi_helpdesk_v3.2/requirements_traceability.csv').open(encoding='utf-8-sig')))
assert len(source_trace)==len(locations)==29
write_csv('contracts/feature_coverage.csv',['id','source_requirement','m0_sections','acceptance_evidence','status'],[{'id':f'FR{i:02d}','source_requirement':r['source_requirement'],'m0_sections':loc,'acceptance_evidence':r['acceptance_evidence'],'status':'SPECIFIED_NOT_IMPLEMENTED'} for i,(r,loc) in enumerate(zip(source_trace,locations),1)])
decisions=[
('DEC-M01','Katalog layanan dan scope OPD','Pemilik layanan','G01 P01 A01 sintetis','Sebelum UAT layanan resmi'),
('DEC-M02','SSO dan verifikasi guest','Pengelola identitas','Lab identity; real provider disabled','Sebelum integrasi nyata'),
('DEC-M03','SLA kalender dan target tahap','Pemilik layanan','CAL-1; confirmation 24h calendar','Sebelum UAT domain'),
('DEC-M04','Pause vendor dan escalation','Koordinator dan pengelola kontrak','Default SLA terus berjalan','Sebelum policy layanan resmi'),
('DEC-M05','Reopen feedback dan notification policy','Pemilik layanan','Reject melanjutkan episode; unresolved feedback menahan close','Sebelum UAT lifecycle'),
('DEC-M06','Mandat pimpinan dan delegasi','Pemilik proses','Explicit fixture scopes; default deny','Sebelum akses data nyata'),
('DEC-M07','Retensi purge dan hold','Penanggung jawab data','Archive only; purge disabled','Sebelum purge/produksi'),
('DEC-M08','Batas media dan draft','Pemilik data dan keamanan','Bounded synthetic files; safe draft fields','Sebelum penggunaan nyata'),
('DEC-M09','Telegram analytics dan retensi kanal','Pengelola layanan','Sink deterministic; verified fake binding','Sebelum real sends'),
('DEC-M10','RPO RTO dan kapasitas','Infrastruktur','Budget lab awal; isolated recovery','Sebelum produksi'),
('DEC-M11','Versi stack dan tools','Lead implementer','Null until compatibility check','M0-01'),
('DEC-M12','Design system dan lisensi library','Lead implementer dan pemilik produk','Shared React components and tokens','M0-01 sebelum halaman turunan')]
write_csv('planning/decisions.csv',['id','decision','owner','lab_default','gate','status'],[dict(zip(['id','decision','owner','lab_default','gate'],d),status='OPEN') for d in decisions])
(ROOT/'status/evidence.jsonl').write_text('',encoding='utf-8')
write_json('status/package_manifest.json',{'package':'Helpdesk TIK Kota Depok M0','version':'1.0','product_baseline':'3.2','implementation':'NOT_STARTED','application_test_runs':0,'benchmark_runs':0,'agent_runtime_loading':'NOT_TESTED','deployment':'NOT_STARTED'})

# Reuse the verified house layout; output content comes from canonical M0 documents only.
layout=(SOURCE/'revisi_helpdesk_v3.2/build_documents.py').read_text(encoding='utf-8')
layout=layout.replace("(Path(__file__).parent/'references.json')","(ROOT/'references/sources.json')")
layout=layout.replace('Versi 3.2','M0 1.0').replace('Rancangan penelitian dan Helpdesk empat model','Blueprint pembangunan Helpdesk Monolith Modular')
layout=layout.replace('Akses tercatat pada 2 dan 3 November 2026. Tingkat pemeriksaan dan batas akses dicatat dalam literature_matrix.csv; daftar ini tidak menyatakan systematic review selesai.','Rujukan teknis dan tingkat pemeriksaan tersedia pada references/sources.json. Rujukan agent serta stack diperiksa pada 3 November 2026.')
layout=layout[:layout.index("if __name__=='__main__':")]+'''if __name__=='__main__':
    docs=[ROOT/'docs/01_BLUEPRINT_M0.md',ROOT/'docs/02_ATURAN_PEMBANGUNAN.md',ROOT/'docs/03_PANDUAN_AGENT_AI.md']
    target=ROOT/'qa/Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.md'
    target.parent.mkdir(exist_ok=True)
    target.write_text('\\n\\n'.join(p.read_text(encoding='utf-8') for p in docs),encoding='utf-8')
    print('PASS '+str(build(target)))
'''
(ROOT/'scripts/build_document.py').write_text(layout,encoding='utf-8')
render=(SOURCE/'v3.1/audit/render_word.ps1').read_text(encoding='utf-8')
render=render.replace("$files = Get-ChildItem -LiteralPath $packageRoot -Filter '*.docx'","$files = Get-ChildItem -LiteralPath $packageRoot -Filter 'Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.docx'")
(ROOT/'scripts/render_word.ps1').write_text(render,encoding='utf-8')
print('PASS package manifests, 13 tasks, 25 acceptance, 29 requirement groups and source provenance')
