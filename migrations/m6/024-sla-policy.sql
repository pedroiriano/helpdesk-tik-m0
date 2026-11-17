ALTER TABLE sla.targets ADD COLUMN priority text NOT NULL DEFAULT 'NORMAL'
  CHECK(priority IN ('LOW','NORMAL','HIGH','CRITICAL'));
CREATE INDEX targets_lookup ON sla.targets (service_id,policy_version,priority,stage);
INSERT INTO sla.calendars (id,code,calendar_version,timezone,work_days,work_start,work_end)
VALUES
  ('61000000-0000-4000-8000-000000000001','CAL-1',1,'Asia/Jakarta',ARRAY[1,2,3,4,5],'08:00','16:00'),
  ('61000000-0000-4000-8000-000000000002','CAL-247',1,'Asia/Jakarta',ARRAY[0,1,2,3,4,5,6],'00:00','23:59:59')
ON CONFLICT(code,calendar_version) DO NOTHING;
