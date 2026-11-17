from pathlib import Path
from zipfile import ZipFile
import hashlib,json,re,subprocess
from lxml import etree
from pypdf import PdfReader
from verify_package import verify

ROOT=Path(__file__).resolve().parents[1]
STEM='Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0'
report=verify()
docx=ROOT/(STEM+'.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(docx) as z:
    assert z.testzip() is None
    xml=etree.fromstring(z.read('word/document.xml'))
    text=[''.join(p.xpath('.//w:t/text()',namespaces=ns)) for p in xml.xpath('//w:p',namespaces=ns)]
expected=[]
for line in (ROOT/'qa'/(STEM+'.md')).read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if not line:continue
    if line.startswith('|'):
        vals=[v.strip() for v in line.strip('|').split('|')]
        if all(re.fullmatch(r'[:\- ]+',v) for v in vals):continue
    else:vals=[re.sub(r'^#{1,3} ','',line)]
    expected.extend(v.replace('**','') for v in vals)
assert all(v in text for v in expected),'DOCX text/cell mismatch'
dest=ROOT/'qa'/STEM
pdf=dest/(STEM+'.pdf')
pages=PdfReader(pdf).pages
assert all(len(p.extract_text().strip())>80 for p in pages),'Unexpected blank page'
renderer=Path(r'C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1026-487-0_26.1026.487.0_x64__3k8sg7r9htsxt\dependencies\native\poppler\Library\bin\pdftoppm.exe')
subprocess.run([str(renderer),'-scale-to','1400','-png',str(pdf),str(dest/'page')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
assert len(list(dest.glob('page-*.png')))==len(pages)
prov=json.loads((ROOT/'references/provenance.json').read_text(encoding='utf-8'))
for src in prov['sources']:
    assert hashlib.sha256(Path(src['path']).read_bytes()).hexdigest()==src['sha256'],'External source changed'
report.update(docx_sha256=hashlib.sha256(docx.read_bytes()).hexdigest(),pages=len(pages),paragraphs_and_cells_checked=len(expected),source_hashes_unchanged=True,visual_review='PENDING',render_engine='Microsoft Word COM export and bundled Poppler')
(ROOT/'qa/verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'PASS DOCX text and tables {len(expected)}; pages {len(pages)}; source hashes unchanged')
