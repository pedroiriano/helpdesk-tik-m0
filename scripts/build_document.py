from pathlib import Path
import re, json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT=Path(__file__).resolve().parents[1]
refs={r['id']:r for r in json.loads((ROOT/'references/sources.json').read_text(encoding='utf-8'))}

def inline(p,text):
    for part in re.split(r'(\*\*.*?\*\*)',text):
        if part.startswith('**') and part.endswith('**'):
            r=p.add_run(part[2:-2]); r.bold=True
        else: p.add_run(part)

def url(p,target,label='Sumber primer'):
    rel=p.part.relate_to(target,RT.HYPERLINK,is_external=True)
    h=OxmlElement('w:hyperlink'); h.set(qn('r:id'),rel)
    r=OxmlElement('w:r'); prop=OxmlElement('w:rPr')
    c=OxmlElement('w:color'); c.set(qn('w:val'),'245579'); prop.append(c)
    u=OxmlElement('w:u'); u.set(qn('w:val'),'single'); prop.append(u)
    r.append(prop); t=OxmlElement('w:t'); t.text=label; r.append(t); h.append(r); p._p.append(h)

def widths(rows):
    n=len(rows[0]); total=6.77
    if n==2: return [total*.36,total*.64]
    if n==3:
        first=max(len(x[0]) for x in rows)
        if first<8: return [0.55,2.20,total-2.75]
        if first<20: return [1.20,2.50,total-3.70]
        return [2.05,2.4,total-4.45]
    if n==4: return [1.12,1.35,1.12,total-3.59]
    if n==7: return [1.37]+[(total-1.37)/6]*6
    return [total/n]*n

def mk_table(doc,rows):
    tab=doc.add_table(rows=1,cols=len(rows[0])); tab.alignment=WD_TABLE_ALIGNMENT.CENTER; tab.autofit=False
    ws=widths(rows)
    for c,w in zip(tab.columns,ws): c.width=Inches(w)
    pr=tab._tbl.tblPr
    borders=OxmlElement('w:tblBorders')
    for side in ('top','left','bottom','right','insideH','insideV'):
        b=OxmlElement('w:'+side); b.set(qn('w:val'),'single'); b.set(qn('w:sz'),'4'); b.set(qn('w:color'),'D9D9D9'); borders.append(b)
    pr.append(borders)
    for i,vals in enumerate(rows):
        row=tab.rows[0] if i==0 else tab.add_row()
        trpr=row._tr.get_or_add_trPr()
        no=OxmlElement('w:cantSplit'); trpr.append(no)
        if i==0: trpr.append(OxmlElement('w:tblHeader'))
        for j,(cell,val) in enumerate(zip(row.cells,vals)):
            cell.width=Inches(ws[j]); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cp=cell._tc.get_or_add_tcPr()
            sh=OxmlElement('w:shd'); sh.set(qn('w:fill'),'DCE7EF' if i==0 else ('F6F8FA' if i%2==0 else 'FFFFFF')); cp.append(sh)
            margins=OxmlElement('w:tcMar')
            for side in ('top','bottom','left','right'):
                el=OxmlElement('w:'+side); el.set(qn('w:w'),'90'); el.set(qn('w:type'),'dxa'); margins.append(el)
            cp.append(margins)
            p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(2); p.paragraph_format.space_before=Pt(2); p.paragraph_format.line_spacing=1.04
            inline(p,val)
            if i==0: p.paragraph_format.keep_with_next=True
            for r in p.runs:
                r.font.size=Pt(9 if len(rows[0])<5 else 8.5); r.bold=i==0; r.font.color.rgb=RGBColor(0,0,0)
            if j==0 and len(val)<8 or (len(rows[0])>4 and j>0): p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(1); p.paragraph_format.space_before=Pt(0); p.paragraph_format.line_spacing=0.4; p.add_run().font.size=Pt(2)

def build(src):
    raw=src.read_text(encoding='utf-8'); lines=raw.splitlines(); doc=Document(); s=doc.sections[0]
    s.page_width=Inches(8.27); s.page_height=Inches(11.69)
    s.top_margin=s.bottom_margin=Inches(.68); s.left_margin=s.right_margin=Inches(.75)
    s.footer_distance=Inches(.32)
    for sn in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3']:
        st=doc.styles[sn]; st.font.name='Calibri'; st.font.color.rgb=RGBColor(0,0,0)
        st._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Calibri')
    normal=doc.styles['Normal']; normal.font.size=Pt(10.5); normal.paragraph_format.line_spacing=1.12; normal.paragraph_format.space_after=Pt(6)
    normal.paragraph_format.widow_control=True
    doc.styles['Title'].font.size=Pt(23); doc.styles['Title'].font.bold=True; doc.styles['Title'].paragraph_format.space_after=Pt(10)
    for border in doc.styles['Title']._element.xpath('.//w:pBdr'):
        border.getparent().remove(border)
    for name,size in [('Heading 1',15),('Heading 2',12),('Heading 3',11)]:
        st=doc.styles[name]; st.font.size=Pt(size); st.font.bold=True; st.paragraph_format.space_before=Pt(12); st.paragraph_format.space_after=Pt(6); st.paragraph_format.keep_with_next=True
    p=s.footer.paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    r=p.add_run('M0 1.0  |  '); r.font.size=Pt(8); r.font.color.rgb=RGBColor.from_string('555555')
    field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); p._p.append(field)
    i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1; continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+',v) for v in cells): rows.append(cells)
                i+=1
            mk_table(doc,rows); continue
        if line.startswith('# '): doc.add_paragraph(line[2:],'Title')
        elif line.startswith('## '): doc.add_paragraph(line[3:],'Heading 1')
        elif line.startswith('### '): doc.add_paragraph(line[4:],'Heading 2')
        else:
            p=doc.add_paragraph(); inline(p,line)
            if i<6: p.paragraph_format.space_after=Pt(7)
        i+=1
    used=sorted(set(re.findall(r'S\d\d',raw)))
    # Audit references the complete register explicitly.
    if src.stem=='00_Audit': used=sorted(refs)
    doc.add_paragraph('References' if src.stem.startswith('03_') else 'Daftar sumber','Heading 1')
    doc.add_paragraph('Access recorded on 2 and 3 November 2026. Source access levels are recorded in the accompanying literature matrix.' if src.stem.startswith('03_') else 'Rujukan teknis dan tingkat pemeriksaan tersedia pada references/sources.json. Rujukan agent serta stack diperiksa pada 3 November 2026.')
    for key in used:
        rr=refs[key]; p=doc.add_paragraph(); p.paragraph_format.keep_together=True
        inline(p,f"[{key}] {rr['authors']}. {rr['title']}. ")
        if rr['doi']: p.add_run('DOI '+rr['doi']+'. ')
        url(p,rr['url'],'Primary source' if src.stem.startswith('03_') else 'Sumber primer')
    doc.core_properties.title=lines[0].removeprefix('# '); doc.core_properties.subject='Blueprint pembangunan Helpdesk Monolith Modular'; doc.core_properties.author=''; doc.core_properties.comments='M0 1.0; tidak memuat hasil eksperimen.'
    dest=ROOT/(src.stem+'.docx'); doc.save(dest)
    return dest

if __name__=='__main__':
    docs=[ROOT/'docs/01_BLUEPRINT_M0.md',ROOT/'docs/02_ATURAN_PEMBANGUNAN.md',ROOT/'docs/03_PANDUAN_AGENT_AI.md']
    target=ROOT/'qa/Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.md'
    target.parent.mkdir(exist_ok=True)
    target.write_text('\n\n'.join(p.read_text(encoding='utf-8') for p in docs),encoding='utf-8')
    print('PASS '+str(build(target)))
