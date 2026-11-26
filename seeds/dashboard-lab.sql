DO $$ BEGIN
  IF current_setting('helpdesk.environment', true) IS DISTINCT FROM 'synthetic_lab' THEN
    RAISE EXCEPTION 'LAB_SEED_DISABLED';
  END IF;
END $$;

UPDATE identity.memberships m
SET permissions = array_append(m.permissions, 'report.read'),
    version = m.version + 1,
    updated_at = now()
FROM identity.subjects s
WHERE s.id = m.subject_id AND s.lab_fixture AND s.kind = 'STAFF' AND s.role_code = 'SUPER_ADMIN' AND s.active
  AND s.id = '20000000-0000-4000-8000-000000000017'
  AND m.org_id = '10000000-0000-4000-8000-000000000001' AND m.team_id IS NULL
  AND m.revoked_at IS NULL AND m.valid_until > now()
  AND NOT ('report.read' = ANY(m.permissions));
