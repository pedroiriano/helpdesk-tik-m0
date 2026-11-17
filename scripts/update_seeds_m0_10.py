from pathlib import Path

p = Path('seeds/m0-03-lab.sql')
text = p.read_text(encoding='utf-8')

# Update Subject 11 and 12
old_perm = "'media.reuse']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;"
new_perm = "'media.reuse','notification.read','notification.binding']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;"

if old_perm in text:
    text = text.replace(old_perm, new_perm)

auditor_sql = (
    "INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) "
    "VALUES('20000000-0000-4000-8000-000000000016','STAFF','LAB-SUBJECT-16','Auditor Kota Depok','AUDITOR',true) "
    "ON CONFLICT DO NOTHING;\n"
    "INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) "
    "VALUES('70000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001',"
    "ARRAY['audit.read','report.read','report.export']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') "
    "ON CONFLICT DO NOTHING;\n"
)

if 'LAB-SUBJECT-16' not in text:
    text = text + auditor_sql

p.write_text(text, encoding='utf-8', newline='\n')
print('Updated seeds/m0-03-lab.sql successfully')
