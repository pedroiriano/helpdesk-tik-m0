"""Check package consistency only. Does not run or certify the application."""
from pathlib import Path
import csv, hashlib, json, re, sys

ROOT=Path(__file__).resolve().parents[1]
MODULES={f'M{i}' for i in range(1,10)}
TASK_STATUS={'NOT_STARTED','IN_PROGRESS','PARTIAL','DONE_VERIFIED','FAIL','BLOCKED_DOMAIN','BLOCKED_ENV','BLOCKED_AUTHORIZATION'}

def check(condition,message):
    if not condition: raise ValueError(message)

def validate_manifest(m):
    check(m.get('variant')=='M0','Only M0 is allowed')
    groups=m.get('groups',{})
    check(set(groups)=={'G1'},'M0 must have exactly group G1')
    flat=[x for vals in groups.values() for x in vals]
    check(len(flat)==9 and set(flat)==MODULES,'Duplicate missing or unknown module')
    ids=m.get('module_ids',[])
    check(len(ids)==9 and set(ids)==MODULES,'Registry module IDs mismatch')
    check(m.get('application_processes')==1 and m.get('replicas_per_group')==1,'M0 requires one application process and replica')
    check(m.get('internal_transport')=='in_process_ports','M0 internal calls must use local ports')
    check(m.get('db_pool_max_per_owner')==4 and m.get('db_pool_total_max')==36,'Baseline owner pool budget must remain explicit and equal')
    check(m.get('hpa') is False,'HPA is outside the M0 baseline')

def validate_dependencies(data):
    graph=data['sync_business_ports']
    check(set(graph)==MODULES,'Dependency owner IDs mismatch')
    visiting,done=set(),set()
    def visit(n):
        check(n not in visiting,'Synchronous module cycle')
        if n in done:return
        visiting.add(n)
        check(len(graph[n])==len(set(graph[n])),'Duplicate dependency')
        for dest in graph[n]:
            check(dest in MODULES and dest!=n,'Unknown or self synchronous dependency')
            visit(dest)
        visiting.remove(n);done.add(n)
    for n in graph:visit(n)

def validate_backlog(rows,evidence):
    ids=[r['id'] for r in rows]
    check(len(ids)==len(set(ids)) and len(ids)>0,'Duplicate or empty task list')
    graph={r['id']:r['depends_on'].split() for r in rows}
    seen,active=set(),set()
    def visit(n):
        check(n in graph,'Unknown task dependency')
        check(n not in active,'Cyclic task dependency')
        if n in seen:return
        active.add(n)
        for d in graph[n]:visit(d)
        active.remove(n);seen.add(n)
    for r in rows:
        visit(r['id'])
        check(r['status'] in TASK_STATUS,'Unknown task status')
        check(set(r['modules'].split())<=MODULES,'Unknown task module')
        check(set(r['acceptance'].split())<={f'AC{i:02d}' for i in range(1,26)},'Unknown acceptance reference')
        if r['status']=='DONE_VERIFIED':
            check(bool(r['evidence'].strip()),'Completed task requires evidence reference')
            check(any(e.get('task_id')==r['id'] and e.get('scope')=='application' and e.get('result')=='PASS' for e in evidence),'Completed application task lacks actual PASS evidence')

def verify(root=ROOT):
    def readj(p):return json.loads((root/p).read_text(encoding='utf-8'))
    def readcsv(p):
        with (root/p).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
    required=['AGENTS.md','GEMINI.md','.agents/rules/helpdesk-context.md','README.md','docs/01_BLUEPRINT_M0.md','docs/02_ATURAN_PEMBANGUNAN.md','docs/03_PANDUAN_AGENT_AI.md','status/PROJECT_STATE.md','status/evidence.jsonl','references/BLUEPRINT_SUMBER_v3.2.md','Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.docx']
    for p in required:check((root/p).is_file(),'Missing '+p)
    check((root/'AGENTS.md').stat().st_size<12000,'Keep shared agent instructions compact')
    rule=(root/'.agents/rules/helpdesk-context.md').read_text(encoding='utf-8')
    check(rule.startswith('---\ntrigger: always_on\n'),'Antigravity rule activation missing')
    check('AGENTS.md' in (root/'GEMINI.md').read_text(encoding='utf-8'),'Gemini must use canonical rules')
    m=readj('configs/M0.json');validate_manifest(m)
    modules=readcsv('contracts/module_registry.csv')
    check(len(modules)==9 and {r['module_id'] for r in modules}==MODULES,'Module registry mismatch')
    check(sum(int(r['db_pool_max']) for r in modules)==m['db_pool_total_max'],'Pool budget mismatch')
    check(sum(int(r['cpu_credit_m']) for r in modules)==m['app_budget']['cpu_m'],'CPU budget mismatch')
    check(sum(int(r['memory_credit_mib']) for r in modules)==m['app_budget']['memory_mib'],'Memory budget mismatch')
    validate_dependencies(readj('contracts/dependencies.json'))
    ac=readcsv('contracts/acceptance.csv')
    check(len(ac)==25 and {r['id'] for r in ac}=={f'AC{i:02d}' for i in range(1,26)},'AC coverage must be complete and unique')
    for r in ac:
        check(bool(r['m0_scope']),'Acceptance needs explicit M0 scope')
        if r['status']=='PASS':check(bool(r['evidence'].strip()),'PASS acceptance without evidence')
    features=readcsv('contracts/feature_coverage.csv')
    check(len(features)==29 and {r['id'] for r in features}=={f'FR{i:02d}' for i in range(1,30)},'Source requirement coverage mismatch')
    for r in features:
        check(all(1<=int(n)<=14 for n in r['m0_sections'].split()),'Unknown product section')
    evidence=[json.loads(line) for line in (root/'status/evidence.jsonl').read_text(encoding='utf-8').splitlines() if line.strip()]
    tasks=readcsv('planning/backlog.csv');validate_backlog(tasks,evidence)
    p=readj('references/provenance.json')
    check(hashlib.sha256((root/p['copied_source']).read_bytes()).hexdigest()==p['copied_source_sha256'],'Copied source modified')
    sources=readj('references/sources.json');ids={r['id'] for r in sources}
    check(len(ids)==len(sources),'Duplicate reference ID')
    combined='\n\n'.join((root/('docs/'+name)).read_text(encoding='utf-8') for name in ['01_BLUEPRINT_M0.md','02_ATURAN_PEMBANGUNAN.md','03_PANDUAN_AGENT_AI.md'])
    check(set(re.findall(r'\[(S\d\d)\]',combined))<=ids,'Unresolved citation')
    numbers=[int(x) for x in re.findall(r'^## (\d+) ',combined,re.M)]
    check(numbers==list(range(1,22)),'Canonical chapter numbering must be 1 through 21')
    check((root/'qa/Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.md').read_text(encoding='utf-8')==combined,'Word build source is stale')
    commands=readj('planning/command_registry.json')['application_commands']
    for c in commands:
        if c['status']=='NOT_IMPLEMENTED':check(c['command'] is None,'Unimplemented command must not look runnable')
    return {'scope':'package_only','result':'PASS','modules':9,'tasks':len(tasks),'acceptance':25,'source_requirement_groups':29,'chapters':21,'application_tests_run':False,'agent_runtime_loading_tested':False}

if __name__=='__main__':
    try:
        result=verify()
        print(f"PASS package consistency: {result['modules']} modules, {result['tasks']} tasks, "
              f"{result['acceptance']} acceptance, {result['source_requirement_groups']} source groups, {result['chapters']} chapters")
        print('NOT_RUN application tests, agent runtime loading, UAT and deployment')
    except (ValueError,KeyError,OSError,json.JSONDecodeError) as e:
        print('FAIL '+str(e));sys.exit(1)
