-- SYNTHETIC LAB ONLY. Repeated seed never overwrites edited records.
DO $$ BEGIN IF current_setting('helpdesk.environment',true) IS DISTINCT FROM 'synthetic_lab' THEN RAISE EXCEPTION 'LAB_SEED_DISABLED'; END IF; END $$;
INSERT INTO identity.organizations(id,code,name) VALUES('10000000-0000-4000-8000-000000000001','LAB-1','OPD Lab 1') ON CONFLICT DO NOTHING;
INSERT INTO identity.teams(id,org_id,name) VALUES('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Tim Lab 1') ON CONFLICT DO NOTHING;
INSERT INTO catalog.categories(id,code,name,owner_org_id) VALUES('40000000-0000-4000-8000-000000000001','LAB-CAT-1','Layanan Lab 1','10000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO identity.organizations(id,code,name) VALUES('10000000-0000-4000-8000-000000000002','LAB-2','OPD Lab 2') ON CONFLICT DO NOTHING;
INSERT INTO identity.teams(id,org_id,name) VALUES('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Tim Lab 2') ON CONFLICT DO NOTHING;
INSERT INTO catalog.categories(id,code,name,owner_org_id) VALUES('40000000-0000-4000-8000-000000000002','LAB-CAT-2','Layanan Lab 2','10000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000001','PUBLIC','LAB-SUBJECT-1','Publik A','PUBLIC',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000002','PUBLIC','LAB-SUBJECT-2','Publik B','PUBLIC',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000003','ASN','LAB-SUBJECT-3','ASN OPD A','ASN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',ARRAY['session.read','session.revoke','ticket.create','ticket.read','ticket.comment','ticket.attach','ticket.confirm','ticket.transition','draft.read','draft.write','media.read','media.write','notification.read','operation.read']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000004','STAFF','LAB-SUBJECT-4','Operator OPD A','OPERATOR',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',ARRAY['ticket.read','ticket.verify','ticket.dispatch','ticket.comment','ticket.attach','ticket.transition','operation.read','media.read','ticket.bulk']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000005','STAFF','LAB-SUBJECT-5','Admin Lab OPD A','PLATFORM_ADMIN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',ARRAY['identity.grant','catalog.write','rules.write','system.maintenance','system.job','system.health','identity.organization.create']::text[],ARRAY['audit.read','catalog.write','content.publish','content.read','content.write','draft.read','draft.write','identity.grant','media.read','media.reuse','media.write','notification.binding','notification.read','operation.read','report.export','report.read','rules.write','session.read','session.revoke','system.health','system.job','system.maintenance','ticket.archive','ticket.attach','ticket.auto_close','ticket.bulk','ticket.comment','ticket.confirm','ticket.create','ticket.dispatch','ticket.escalate','ticket.handoff','ticket.handoff.accept','ticket.pause','ticket.read','ticket.resolve','ticket.transition','ticket.vendor','ticket.verify','ticket.worklog']::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000006','STAFF','LAB-SUBJECT-6','Admin OPD B','ADMIN_OPD',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002',ARRAY['identity.grant','catalog.write','rules.write','system.health']::text[],ARRAY['audit.read','catalog.write','content.publish','content.read','content.write','draft.read','draft.write','identity.grant','media.read','media.reuse','media.write','notification.binding','notification.read','operation.read','report.export','report.read','rules.write','session.read','session.revoke','system.health','system.job','system.maintenance','ticket.archive','ticket.attach','ticket.auto_close','ticket.bulk','ticket.comment','ticket.confirm','ticket.create','ticket.dispatch','ticket.escalate','ticket.handoff','ticket.handoff.accept','ticket.pause','ticket.read','ticket.resolve','ticket.transition','ticket.vendor','ticket.verify','ticket.worklog']::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000007','STAFF','LAB-SUBJECT-7','Teknisi OPD B','TECHNICIAN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002',ARRAY['ticket.read','ticket.resolve','ticket.comment','ticket.attach','ticket.transition','ticket.vendor','ticket.escalate','operation.read','media.read','ticket.worklog']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000008','ASN','LAB-SUBJECT-8','ASN OPD B','ASN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000002',ARRAY['session.read','session.revoke','ticket.create','ticket.read','ticket.comment','ticket.attach','ticket.confirm','ticket.transition','draft.read','draft.write','media.read','media.write','notification.read','operation.read']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000001','LAB-SVC-1','Bantuan TIK Lab 1','PUBLIC_GUEST','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000002','LAB-SVC-2','Bantuan TIK Lab 2','PUBLIC_AUTH','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000003','LAB-SVC-3','Bantuan TIK Lab 3','ASN_AUTH','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000004','LAB-SVC-4','Bantuan TIK Lab 4','STAFF_ONLY','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000005','LAB-SVC-5','Bantuan TIK Lab 5','ASN_AUTH','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000002']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO catalog.services(id,code,name,access_mode,owner_org_id,category_id) VALUES('30000000-0000-4000-8000-000000000006','LAB-SVC-6','Bantuan TIK Lab 6','STAFF_ONLY','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO catalog.service_forms(id,service_id,form_version,fields) VALUES('60000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006',1,'[{"key": "ringkasan", "label": "Ringkasan kebutuhan", "kind": "text", "required": true, "options": []}, {"key": "tanggal", "label": "Tanggal kejadian", "kind": "date", "required": false, "options": []}]') ON CONFLICT DO NOTHING;
INSERT INTO catalog.policies(id,service_id,policy_version,upload_max_bytes,allowed_mime,audience_org_ids,effective_at) VALUES('80000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006',1,10485760,ARRAY['image/png','image/jpeg','application/pdf'],ARRAY['10000000-0000-4000-8000-000000000002']::uuid[],now()) ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000009','STAFF','LAB-SUBJECT-9','Teknisi L1 OPD A','TECHNICIAN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001',ARRAY['ticket.read','ticket.resolve','ticket.comment','ticket.attach','ticket.transition','ticket.vendor','ticket.escalate','operation.read','media.read','ticket.worklog']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000010','STAFF','LAB-SUBJECT-10','Teknisi L2 OPD A','TECHNICIAN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',ARRAY['ticket.read','ticket.resolve','ticket.comment','ticket.attach','ticket.transition','ticket.vendor','ticket.escalate','operation.read','media.read','ticket.worklog']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO assignment.routing_rules(id,service_id,team_id,level,required_skills,active) VALUES('90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','L1',ARRAY['hardware','network'],true) ON CONFLICT DO NOTHING;
INSERT INTO assignment.routing_rules(id,service_id,team_id,level,required_skills,active) VALUES('90000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','L2',ARRAY['system','security'],true) ON CONFLICT DO NOTHING;
INSERT INTO assignment.rosters(id,subject_id,team_id,skills,available_from,available_until) VALUES('91000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000009','50000000-0000-4000-8000-000000000001',ARRAY['hardware','network'],'2020-01-01T00:00:00Z','2035-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO assignment.rosters(id,subject_id,team_id,skills,available_from,available_until) VALUES('91000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000010','50000000-0000-4000-8000-000000000001',ARRAY['system','security'],'2020-01-01T00:00:00Z','2035-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000011','STAFF','LAB-SUBJECT-11','Koordinator OPD A','COORDINATOR',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001',ARRAY['ticket.read','ticket.dispatch','ticket.transition','ticket.comment','ticket.pause','ticket.handoff','ticket.handoff.accept','ticket.escalate','report.read','report.export','operation.read','ticket.bulk','ticket.archive','media.write','media.reuse','notification.read','notification.binding']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000012','STAFF','LAB-SUBJECT-12','Koordinator OPD B','COORDINATOR',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000002',ARRAY['ticket.read','ticket.dispatch','ticket.transition','ticket.comment','ticket.pause','ticket.handoff','ticket.handoff.accept','ticket.escalate','report.read','report.export','operation.read','ticket.bulk','ticket.archive','media.write','media.reuse','notification.read','notification.binding']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000013','STAFF','LAB-SUBJECT-13','Pimpinan Pemkot','LEADERSHIP',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001',ARRAY['ticket.read','ticket.escalate','report.read','report.export','operation.read']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO assignment.rosters(id,subject_id,team_id,skills,available_from,available_until) VALUES('91000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000007','50000000-0000-4000-8000-000000000002',ARRAY['hardware','network','system'],'2020-01-01T00:00:00Z','2035-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000014','STAFF','LAB-SUBJECT-14','Editor Konten OPD A','EDITOR',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001',ARRAY['content.read','content.write','media.read','media.write','media.reuse','draft.read','draft.write']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000015','STAFF','LAB-SUBJECT-15','Penerbit Konten OPD A','PUBLISHER',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001',ARRAY['content.read','content.write','content.publish','media.read','media.reuse','notification.read','notification.binding']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000016','STAFF','LAB-SUBJECT-16','Auditor Kota Depok','AUDITOR',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001',ARRAY['audit.read','report.read','report.export']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000017','STAFF','LAB-SUBJECT-17','Super Admin Kota Depok','SUPER_ADMIN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000017','20000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001',ARRAY['identity.grant','catalog.write','rules.write','system.maintenance','system.job','system.health','system.purge.request','identity.organization.create','notification.read','notification.binding','ticket.archive','ticket.read']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO identity.subjects(id,kind,external_ref,display_name,role_code,lab_fixture) VALUES('20000000-0000-4000-8000-000000000018','STAFF','LAB-SUBJECT-18','Second Admin Approver','PLATFORM_ADMIN',true) ON CONFLICT DO NOTHING;
INSERT INTO identity.memberships(id,subject_id,org_id,permissions,grant_ceiling,valid_until) VALUES('70000000-0000-4000-8000-000000000018','20000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001',ARRAY['identity.grant','catalog.write','rules.write','system.maintenance','system.job','system.health','identity.organization.create','notification.read','notification.binding','ticket.archive','ticket.read']::text[],ARRAY[]::text[],'2030-12-31T00:00:00Z') ON CONFLICT DO NOTHING;
-- 1. Pembaruan Nama Organisasi Resmi
UPDATE identity.organizations SET name = 'Dinas Komunikasi dan Informatika Kota Depok' WHERE id = '10000000-0000-4000-8000-000000000001';
UPDATE identity.organizations SET name = 'Dinas Kesehatan Kota Depok' WHERE id = '10000000-0000-4000-8000-000000000002';
UPDATE identity.teams SET name = 'Tim Infrastruktur & Operasional TIK Depok' WHERE id = '50000000-0000-4000-8000-000000000001';
UPDATE identity.teams SET name = 'Tim Sistem Informasi Kesehatan Dinkes' WHERE id = '50000000-0000-4000-8000-000000000002';

-- 2. Kategori Layanan Resmi TIK Kota Depok
INSERT INTO catalog.categories (id, code, name, owner_org_id, active) VALUES
('40000000-0000-4000-8000-000000000010', 'CAT-INFRA', 'Infrastruktur Jaringan & Komunikasi', '10000000-0000-4000-8000-000000000001', true),
('40000000-0000-4000-8000-000000000020', 'CAT-APTIKA', 'Aplikasi Informatika & SPBE', '10000000-0000-4000-8000-000000000001', true),
('40000000-0000-4000-8000-000000000030', 'CAT-TATA-KELOLA', 'Tata Kelola SPBE & Administrasi Pemerintahan', '10000000-0000-4000-8000-000000000001', true),
('40000000-0000-4000-8000-000000000040', 'CAT-PERSANDIAN', 'Keamanan Informasi, Persandian & CSIRT', '10000000-0000-4000-8000-000000000001', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, owner_org_id = EXCLUDED.owner_org_id, active = true;

-- 3. 16 Katalog Layanan Resmi TIK Diskominfo Kota Depok
INSERT INTO catalog.services (id, code, name, access_mode, owner_org_id, category_id, active) VALUES
-- 1. Akses Jaringan Internet & Intranet OPD
('30000000-0000-4000-8000-000000000011', 'TIK-NET-01', 'Layanan Akses Jaringan Internet & Intranet OPD', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 2. Penerbitan Akun Email Kedinasan @depok.go.id
('30000000-0000-4000-8000-000000000012', 'TIK-EML-01', 'Layanan Penerbitan Akun Email Kedinasan @depok.go.id', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000030', true),
-- 3. Pembuatan Subdomain & Hosting Portal Resmi OPD
('30000000-0000-4000-8000-000000000013', 'TIK-DOM-01', 'Layanan Pembuatan Subdomain & Hosting Portal Resmi OPD', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 4. Integrasi Aplikasi & Interoperabilitas SPBE (SPLP/API)
('30000000-0000-4000-8000-000000000014', 'TIK-INT-01', 'Layanan Integrasi Aplikasi & Interoperabilitas SPBE (SPLP/API)', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 5. Penerbitan Sertifikat Elektronik & Tanda Tangan Elektronik (TTE BSrE)
('30000000-0000-4000-8000-000000000015', 'TIK-TTE-01', 'Layanan Penerbitan Sertifikat Elektronik & Tanda Tangan Elektronik (TTE BSrE)', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000040', true),
-- 6. Penanganan Insiden Keamanan Informasi (Depok-CSIRT)
('30000000-0000-4000-8000-000000000016', 'TIK-SEC-01', 'Layanan Penanganan Insiden Keamanan Informasi (Depok-CSIRT)', 'PUBLIC_GUEST', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000040', true),
-- 7. Fasilitasi Video Conference / Rapat Virtual Pimpinan
('30000000-0000-4000-8000-000000000017', 'TIK-VIC-01', 'Layanan Fasilitasi Video Conference / Rapat Virtual Pimpinan', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 8. Pemeliharaan Server Virtual / Colocation Data Center
('30000000-0000-4000-8000-000000000018', 'TIK-SRV-01', 'Layanan Pemeliharaan Server Virtual / Colocation Data Center', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 9. Instalasi & Pemeliharaan Perangkat Jaringan LAN/WiFi OPD
('30000000-0000-4000-8000-000000000019', 'TIK-LAN-01', 'Layanan Instalasi & Pemeliharaan Perangkat Jaringan LAN/WiFi OPD', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 10. Dukungan Teknis Aplikasi Kepegawaian & Layanan ASN (SIMPEG/Kinerja)
('30000000-0000-4000-8000-000000000020', 'TIK-SIM-01', 'Layanan Dukungan Teknis Aplikasi Kepegawaian & Layanan ASN (SIMPEG/Kinerja)', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 11. Dukungan Sistem Keuangan Daerah (SIPD / SIMDA)
('30000000-0000-4000-8000-000000000021', 'TIK-KEU-01', 'Layanan Dukungan Sistem Keuangan Daerah (SIPD / SIMDA)', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 12. Dukungan Aplikasi Pelayanan Publik Terpadu (Depok Single Window / DSW)
('30000000-0000-4000-8000-000000000022', 'TIK-DSW-01', 'Layanan Dukungan Aplikasi Pelayanan Publik Terpadu (Depok Single Window / DSW)', 'PUBLIC_GUEST', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 13. Pemasangan & Pemeliharaan Jaringan CCTV Pengawasan Kota
('30000000-0000-4000-8000-000000000023', 'TIK-CCT-01', 'Layanan Pemasangan & Pemeliharaan Jaringan CCTV Pengawasan Kota', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 14. Fasilitasi Jaringan Internet Publik (WiFi Alun-Alun / Taman Kelurahan)
('30000000-0000-4000-8000-000000000024', 'TIK-PUB-01', 'Layanan Fasilitasi Jaringan Internet Publik (WiFi Alun-Alun / Taman Kelurahan)', 'PUBLIC_GUEST', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', true),
-- 15. Permohonan Pendampingan Pembuatan Aplikasi Baru OPD
('30000000-0000-4000-8000-000000000025', 'TIK-DEV-01', 'Layanan Permohonan Pendampingan Pembuatan Aplikasi Baru OPD', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000020', true),
-- 16. Pemulihan Akses / Reset Kredensial Akun SPBE Terpadu
('30000000-0000-4000-8000-000000000026', 'TIK-ACC-01', 'Layanan Pemulihan Akses / Reset Kredensial Akun SPBE Terpadu', 'ASN_AUTH', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000030', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, access_mode = EXCLUDED.access_mode, owner_org_id = EXCLUDED.owner_org_id, category_id = EXCLUDED.category_id, active = true;

-- 4. Formulir Dinamis untuk 16 Layanan
INSERT INTO catalog.service_forms (id, service_id, form_version, fields) VALUES
('60000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 1, '[
  {"key": "lokasi_gedung", "label": "Lokasi Gedung / Ruangan OPD", "kind": "text", "required": true, "options": []},
  {"key": "nomor_kontak", "label": "Nomor Kontak WhatsApp Penanggung Jawab", "kind": "text", "required": true, "options": []},
  {"key": "gejala_kendala", "label": "Uraian Gejala Kendala Jaringan", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', 1, '[
  {"key": "nip_asn", "label": "Nomor Induk Pegawai (NIP) ASN", "kind": "text", "required": true, "options": []},
  {"key": "nama_lengkap", "label": "Nama Lengkap & Gelar", "kind": "text", "required": true, "options": []},
  {"key": "opd_asal", "label": "Perangkat Daerah Asal", "kind": "text", "required": true, "options": []},
  {"key": "usulan_username", "label": "Usulan Nama Pengguna Email (misal: nama.pegawai)", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000013', 1, '[
  {"key": "nama_subdomain", "label": "Usulan Subdomain (.depok.go.id)", "kind": "text", "required": true, "options": []},
  {"key": "tujuan_penggunaan", "label": "Tujuan Portal / Aplikasi", "kind": "text", "required": true, "options": []},
  {"key": "ip_server_hosting", "label": "Kebutuhan Hosting / Alamat IP Sasaran", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000014', 1, '[
  {"key": "nama_aplikasi_asal", "label": "Nama Sistem / Aplikasi Pemohon", "kind": "text", "required": true, "options": []},
  {"key": "nama_aplikasi_tujuan", "label": "Nama Layanan / API Sasaran Interoperabilitas", "kind": "text", "required": true, "options": []},
  {"key": "dasar_kebutuhan", "label": "Justifikasi Pertukaran Data SPBE", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000015', 1, '[
  {"key": "nik_pegawai", "label": "Nomor Induk Kependudukan (NIK) Sesuai KTP", "kind": "text", "required": true, "options": []},
  {"key": "nip_pegawai", "label": "NIP Pegawai ASN", "kind": "text", "required": true, "options": []},
  {"key": "jabatan_resmi", "label": "Jabatan Struktural / Fungsional", "kind": "text", "required": true, "options": []},
  {"key": "email_dinas", "label": "Alamat Email Resmi @depok.go.id", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000016', 1, '[
  {"key": "indikasi_insiden", "label": "Jenis Indikasi Insiden (Deface/Phishing/Malware/Data Leak)", "kind": "text", "required": true, "options": []},
  {"key": "target_sistem", "label": "URL Web / Sistem yang Terdampak", "kind": "text", "required": true, "options": []},
  {"key": "waktu_terdeteksi", "label": "Waktu Kejadian Terdeteksi Pertama Kali", "kind": "text", "required": true, "options": []},
  {"key": "kontak_pelapor", "label": "Nomor Telepon / WhatsApp Pelapor", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000017', 1, '[
  {"key": "nama_acara", "label": "Nama Agenda / Acara Rapat Kedinasan", "kind": "text", "required": true, "options": []},
  {"key": "waktu_pelaksanaan", "label": "Hari / Tanggal dan Waktu Pelaksanaan", "kind": "text", "required": true, "options": []},
  {"key": "lokasi_vicon", "label": "Ruang Rapat / Lokasi Studio Vicon Balai Kota", "kind": "text", "required": true, "options": []},
  {"key": "jumlah_peserta", "label": "Perkiraan Jumlah Titik / Peserta Terhubung", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000018', 1, '[
  {"key": "nama_server", "label": "Hostname / Nama Server / Virtual Machine", "kind": "text", "required": true, "options": []},
  {"key": "spesifikasi_resource", "label": "Kebutuhan vCPU / RAM / Storage Tambahan", "kind": "text", "required": true, "options": []},
  {"key": "alasan_kebutuhan", "label": "Uraian Kebutuhan Penyesuaian Server", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000019', 1, '[
  {"key": "perangkat_daerah", "label": "Nama Instansi / Perangkat Daerah", "kind": "text", "required": true, "options": []},
  {"key": "ruang_kerja", "label": "Nama Ruangan Kerja / Lantai Gedung", "kind": "text", "required": true, "options": []},
  {"key": "kebutuhan_teknis", "label": "Kebutuhan Penarikan Kabel LAN / Access Point WiFi", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000020', 1, '[
  {"key": "nip_asn", "label": "NIP Aparatur Sipil Negara", "kind": "text", "required": true, "options": []},
  {"key": "modul_aplikasi", "label": "Modul Aplikasi yang Bermasalah (Kinerja/Absensi/Cuti)", "kind": "text", "required": true, "options": []},
  {"key": "uraian_masalah", "label": "Uraian Kendala Input / Sinkronisasi Data", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000021', 1, '[
  {"key": "opd_pemohon", "label": "Nama OPD / Unit Kerja Penatausahaan", "kind": "text", "required": true, "options": []},
  {"key": "jenis_dokumen", "label": "Tahapan SIPD (Perencanaan/Penganggaran/Penatausahaan)", "kind": "text", "required": true, "options": []},
  {"key": "pesan_kesalahan", "label": "Pesan Error / Kendala Proses Transaksi", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000022', 1, '[
  {"key": "nik_atau_username", "label": "NIK Pengguna / Username Akun DSW", "kind": "text", "required": true, "options": []},
  {"key": "fitur_layanan", "label": "Layanan DSW yang Terkendala (Kesehatan/PBB/Perizinan)", "kind": "text", "required": true, "options": []},
  {"key": "kronologi_kendala", "label": "Uraian Kronologis Kendala Aplikasi", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000023', 1, '[
  {"key": "lokasi_titik_cctv", "label": "Nama Titik Simpang / Lokasi CCTV", "kind": "text", "required": true, "options": []},
  {"key": "gejala_kerusakan", "label": "Status Kerusakan (Mati Total/Gambar Buram/Offline)", "kind": "text", "required": true, "options": []},
  {"key": "instansi_pelapor", "label": "Instansi Pemohon (Dishub/Satpol PP/OPD)", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000024', 1, '[
  {"key": "nama_taman_alunalun", "label": "Nama Lokasi Taman / Ruang Terbuka Publik", "kind": "text", "required": true, "options": []},
  {"key": "ssid_wifi", "label": "Nama SSID WiFi Publik yang Terdeteksi", "kind": "text", "required": true, "options": []},
  {"key": "kendala_koneksi", "label": "Deskripsi Gangguan Akses Internet Publik", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000025', 1, '[
  {"key": "nama_usulan_sistem", "label": "Nama Rencana Sistem Informasi / Aplikasi", "kind": "text", "required": true, "options": []},
  {"key": "tujuan_inovasi", "label": "Maksud dan Tujuan Inovasi Layanan Publik/SPBE", "kind": "text", "required": true, "options": []},
  {"key": "landasan_regulasi", "label": "Dasar Hukum / Peraturan Walikota Terkait", "kind": "text", "required": true, "options": []}
]'),
('60000000-0000-4000-8000-000000000026', '30000000-0000-4000-8000-000000000026', 1, '[
  {"key": "nip_aparatur", "label": "NIP Aparatur Sipil Negara Pemohon", "kind": "text", "required": true, "options": []},
  {"key": "akun_layanan", "label": "Akun Sistem yang Mengalami Lupa Kata Sandi", "kind": "text", "required": true, "options": []},
  {"key": "alasan_reset", "label": "Alasan Permohonan Reset Kredensial", "kind": "text", "required": true, "options": []}
]')
ON CONFLICT (service_id, form_version) DO NOTHING;

-- 5. Kebijakan Kebijakan Lampiran (Policies) untuk 16 Layanan
INSERT INTO catalog.policies (id, service_id, policy_version, upload_max_bytes, allowed_mime, audience_org_ids, effective_at) VALUES
('80000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000013', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000014', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000015', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000016', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000017', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000018', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000019', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000020', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000021', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000022', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000023', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000024', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000025', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now()),
('80000000-0000-4000-8000-000000000026', '30000000-0000-4000-8000-000000000026', 1, 10485760, ARRAY['image/png','image/jpeg','application/pdf'], ARRAY['10000000-0000-4000-8000-000000000001']::uuid[], now())
ON CONFLICT (service_id, policy_version) DO NOTHING;

-- 6. Aturan Penugasan (Assignment Routing Rules) untuk 16 Layanan
INSERT INTO assignment.routing_rules (id, service_id, team_id, level, required_skills, active) VALUES
('90000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['network','hardware'], true),
('90000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['governance','account'], true),
('90000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000001', 'L2', ARRAY['web','server'], true),
('90000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000001', 'L2', ARRAY['api','integration'], true),
('90000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['security','certificate'], true),
('90000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000016', '50000000-0000-4000-8000-000000000001', 'L2', ARRAY['csirt','security'], true),
('90000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000017', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['multimedia','network'], true),
('90000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000018', '50000000-0000-4000-8000-000000000001', 'L2', ARRAY['server','storage'], true),
('90000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000019', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['network','lan'], true),
('90000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000020', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['software','simpeg'], true),
('90000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000021', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['software','finance'], true),
('90000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000022', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['mobile','portal'], true),
('90000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000023', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['cctv','surveillance'], true),
('90000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000024', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['wifi','public'], true),
('90000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000025', '50000000-0000-4000-8000-000000000001', 'L2', ARRAY['consulting','architecture'], true),
('90000000-0000-4000-8000-000000000026', '30000000-0000-4000-8000-000000000026', '50000000-0000-4000-8000-000000000001', 'L1', ARRAY['identity','credential'], true)
ON CONFLICT (id) DO NOTHING;

-- 7. Portal Navigasi Resmi Kota Depok (M2)
DELETE FROM catalog.portal_navigation;
INSERT INTO catalog.portal_navigation (id, route, label, audience, position, feature_code) VALUES
('b0000000-0000-4000-8000-000000000001', '/', 'Beranda', 'PUBLIC_GUEST', 1, 'HOME'),
('b0000000-0000-4000-8000-000000000002', '/layanan', 'Katalog Layanan', 'PUBLIC_GUEST', 2, 'SERVICES'),
('b0000000-0000-4000-8000-000000000003', '/panduan', 'Basis Pengetahuan', 'PUBLIC_GUEST', 3, 'KNOWLEDGE'),
('b0000000-0000-4000-8000-000000000004', '/faq', 'Tanya Jawab', 'PUBLIC_GUEST', 4, 'FAQ'),
('b0000000-0000-4000-8000-000000000005', '/status', 'Status Layanan', 'PUBLIC_GUEST', 5, 'STATUS'),
('b0000000-0000-4000-8000-000000000006', '/kontak', 'Kontak Resmi', 'PUBLIC_GUEST', 6, 'CONTACT'),
('b0000000-0000-4000-8000-000000000007', '/tiket/lacak', 'Lacak Laporan', 'PUBLIC_GUEST', 7, 'TRACK'),
('b0000000-0000-4000-8000-000000000008', '/tiket/baru', 'Buat Tiket', 'PUBLIC_GUEST', 8, 'CREATE_TICKET'),
('b0000000-0000-4000-8000-000000000009', '/masuk', 'Portal ASN', 'PUBLIC_GUEST', 9, 'LOGIN'),
('b0000000-0000-4000-8000-000000000010', '/dasbor', 'Dasbor Pengguna', 'ASN_AUTH', 10, 'DASHBOARD');

-- 8. Artikel Panduan Resmi TIK Kota Depok (M8)
DELETE FROM knowledge.content_media_refs WHERE content_id IN (SELECT id FROM knowledge.content WHERE slug LIKE 'panduan-%' OR slug LIKE 'standar-%' OR slug LIKE 'tata-cara-%');
DELETE FROM knowledge.revisions WHERE content_id IN (SELECT id FROM knowledge.content WHERE slug LIKE 'panduan-%' OR slug LIKE 'standar-%' OR slug LIKE 'tata-cara-%');
DELETE FROM knowledge.content WHERE slug LIKE 'panduan-%' OR slug LIKE 'standar-%' OR slug LIKE 'tata-cara-%';

-- Artikel 1: Email Dinas
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id) VALUES
('c0000000-0000-4000-8000-000000000001', 'ARTICLE', 'panduan-konfigurasi-email-depok-go-id', 'Panduan Konfigurasi Email Kedinasan @depok.go.id pada Mail Client', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017');
INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id) VALUES
('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 1, '<p>Setiap ASN di lingkungan Pemerintah Kota Depok berhak mendapatkan akun email resmi dengan domain @depok.go.id. Untuk mengonfigurasi email pada aplikasi desktop (seperti Mozilla Thunderbird atau Microsoft Outlook) serta ponsel pintar Android/iOS, gunakan parameter IMAP/SMTP resmi berikut:</p><h3>Parameter Server IMAP (Pesan Masuk)</h3><ul><li><strong>Server:</strong> mail.depok.go.id</li><li><strong>Port:</strong> 993 (SSL/TLS)</li><li><strong>Autentikasi:</strong> Kata sandi normal (NIP & password dinas)</li></ul><h3>Parameter Server SMTP (Pesan Keluar)</h3><ul><li><strong>Server:</strong> smtp.depok.go.id</li><li><strong>Port:</strong> 465 (SSL/TLS) atau 587 (STARTTLS)</li><li><strong>Autentikasi:</strong> Diperlukan (Gunakan kredensial yang sama dengan IMAP)</li></ul><p>Pastikan Anda tidak pernah membagikan kata sandi email dinas kepada pihak mana pun.</p>', '20000000-0000-4000-8000-000000000017');

-- Artikel 2: TTE BSrE
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id) VALUES
('c0000000-0000-4000-8000-000000000002', 'ARTICLE', 'panduan-pengajuan-tte-bsre', 'Tata Cara Pengajuan Sertifikat Elektronik & Tanda Tangan Elektronik (TTE BSrE) bagi ASN Depok', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017');
INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id) VALUES
('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 1, '<p>Layanan Tanda Tangan Elektronik (TTE) tersertifikasi diselenggarakan melalui kerja sama Diskominfo Kota Depok dengan Balai Sertifikasi Elektronik (BSrE) BSSN. Berikut adalah tahapan permohonan sertifikat elektronik bagi pejabat struktural dan fungsional ASN Kota Depok:</p><ol><li>Siapkan berkas scan KTP asli, SK Pengangkatan/Jabatan terakhir, dan surat rekomendasi kepala OPD.</li><li>Pastikan data NIK dan email dinas @depok.go.id telah terverifikasi aktif pada SIMPEG BKPSDM.</li><li>Ajukan permohonan melalui layanan TIK-TTE-01 pada portal Helpdesk TIK ini.</li><li>Tim Verifikator Diskominfo akan memverifikasi kesesuaian identitas dan meneruskan permohonan ke BSrE.</li><li>Pemohon akan menerima tautan aktivasi dan pembuatan Passphrase langsung dari BSrE melalui email dinas.</li></ol>', '20000000-0000-4000-8000-000000000017');

-- Artikel 3: CSIRT Depok
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id) VALUES
('c0000000-0000-4000-8000-000000000003', 'ARTICLE', 'panduan-penanganan-insiden-csirt', 'Prosedur Tanggap Darurat dan Pelaporan Insiden Siber ke Depok-CSIRT', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017');
INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id) VALUES
('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 1, '<p>Depok Computer Security Incident Response Team (Depok-CSIRT) bertugas menangani insiden keamanan informasi di lingkungan Pemkot Depok. Jika Anda menemukan indikasi peretasan (web defacement, malware/ransomware, pencurian data, atau phishing):</p><ul><li><strong>Isolasi Perangkat:</strong> Segera cabut kabel jaringan LAN atau putuskan koneksi WiFi dari perangkat yang dicurigai terinfeksi. Jangan matikan server secara paksa agar bukti memori (RAM) tidak hilang.</li><li><strong>Catat Bukti:</strong> Ambil foto/tangkapan layar tampilan error atau pesan tebusan, serta catat waktu kejadian pertama kali.</li><li><strong>Kirim Laporan Darurat:</strong> Gunakan formulir Layanan Penanganan Insiden Keamanan Informasi (TIK-SEC-01) pada Helpdesk TIK ini atau hubungi hotline kedaruratan CSIRT Diskominfo.</li><li>Petugas CSIRT akan segera melakukan triase 24x7 (SLA CAL-247) untuk mitigasi dan penelusuran forensik digital.</li></ul>', '20000000-0000-4000-8000-000000000017');

-- Artikel 4: WiFi Balai Kota
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id) VALUES
('c0000000-0000-4000-8000-000000000004', 'ARTICLE', 'panduan-koneksi-wifi-balaikota', 'Panduan Akses Jaringan Intranet dan WiFi ASN di Lingkungan Balai Kota Depok', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017');
INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id) VALUES
('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 1, '<p>Jaringan nirkabel resmi di lingkungan Gedung Dibaleka I, Dibaleka II, dan Balai Rakyat Kota Depok terbagi menjadi dua SSID:</p><ul><li><strong>SSID ASN-DEPOK:</strong> Diperuntukkan khusus pegawai ASN dengan autentikasi WPA2-Enterprise menggunakan akun NIP dan password terpusat SPBE. Jaringan ini memiliki akses langsung ke intranet OPD dan server aplikasi lokal.</li><li><strong>SSID DEPOK-PUBLIK:</strong> Diperuntukkan bagi masyarakat umum pengunjung kantor pemerintahan dengan portal masuk berbasis persetujuan ketentuan layanan (terms of service). Akses dibatasi pada layanan internet umum.</li></ul><p>Jika mengalami kendala gagal tersambung, periksa apakah perangkat Anda mendapatkan IP otomatis (DHCP) atau hubungi petugas Helpdesk TIK Gedung Dibaleka II Lt. 7.</p>', '20000000-0000-4000-8000-000000000017');

-- Artikel 5: Standar Keamanan Password
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id) VALUES
('c0000000-0000-4000-8000-000000000005', 'ARTICLE', 'panduan-standar-keamanan-password-spbe', 'Standar Keamanan Kata Sandi dan Perlindungan Akun SPBE Terpadu', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017');
INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id) VALUES
('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 1, '<p>Untuk menjaga keamanan data kedinasan Pemerintah Kota Depok, seluruh aparatur diwajibkan menerapkan standar kata sandi yang kuat sesuai Peraturan Walikota tentang Tata Kelola SPBE:</p><ul><li>Panjang kata sandi minimal 10 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol khusus (@, #, $, dsb.).</li><li>Dilarang menggunakan kata sandi yang mudah ditebak seperti tanggal lahir, nama instansi, atau urutan angka standar (misal: Depok123, Bappeda2026).</li><li>Lakukan pembaruan kata sandi berkala setiap 90 hari sekali dan aktifkan autentikasi dua faktor (2FA) jika tersedia.</li><li>Jangan pernah mencatat kata sandi pada kertas terbuka atau menyimpannya pada peramban di komputer bersama.</li></ul>', '20000000-0000-4000-8000-000000000017');
