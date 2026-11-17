DO $$ BEGIN
  IF current_setting('helpdesk.environment', true) IS DISTINCT FROM 'synthetic_lab' THEN
    RAISE EXCEPTION 'RM0-03 SLA fixtures require synthetic_lab';
  END IF;
END $$;
-- Synthetic CAL-247 fixture for TIK-SEC-01 policy v1. No policy inference from a service title.
INSERT INTO sla.targets(id,service_id,calendar_id,policy_version,stage,priority,target_minutes)
SELECT fixture.id::uuid,'30000000-0000-4000-8000-000000000016',c.id,1,fixture.stage,fixture.priority,fixture.minutes
FROM sla.calendars c CROSS JOIN (VALUES
  ('62000000-0000-4000-8000-000000000001','RESPONSE','LOW',60),
  ('62000000-0000-4000-8000-000000000002','RESOLUTION','LOW',1440),
  ('62000000-0000-4000-8000-000000000003','RESPONSE','NORMAL',30),
  ('62000000-0000-4000-8000-000000000004','RESOLUTION','NORMAL',480),
  ('62000000-0000-4000-8000-000000000005','RESPONSE','HIGH',15),
  ('62000000-0000-4000-8000-000000000006','RESOLUTION','HIGH',240),
  ('62000000-0000-4000-8000-000000000007','RESPONSE','CRITICAL',10),
  ('62000000-0000-4000-8000-000000000008','RESOLUTION','CRITICAL',120)
) AS fixture(id,stage,priority,minutes)
WHERE c.code='CAL-247' AND c.calendar_version=1
ON CONFLICT(id) DO NOTHING;
