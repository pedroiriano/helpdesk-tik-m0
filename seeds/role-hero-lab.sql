DO $$ BEGIN IF current_setting('helpdesk.environment',true) IS DISTINCT FROM 'synthetic_lab' THEN RAISE EXCEPTION 'LAB_SEED_DISABLED'; END IF; END $$;

-- Introduce only the editorial and role-policy permissions for these existing lab bindings.
UPDATE identity.memberships m
SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(m.permissions || v.permissions) p ORDER BY p),
    version = m.version + 1, updated_at = now()
FROM identity.subjects s, (VALUES
  ('SUPER_ADMIN',ARRAY['identity.role.manage','media.read','media.write','media.reuse','content.read','content.write','content.publish','hero.write','hero.publish']),
  ('EDITOR',ARRAY['hero.write']), ('PUBLISHER',ARRAY['hero.publish'])
) AS v(role_code,permissions)
WHERE s.id = m.subject_id AND s.lab_fixture AND s.role_code = v.role_code
AND m.org_id='10000000-0000-4000-8000-000000000001' AND m.revoked_at IS NULL AND m.valid_until>now()
AND NOT m.permissions @> v.permissions;

UPDATE identity.memberships m SET grant_ceiling=ARRAY(
  SELECT DISTINCT p FROM unnest(m.grant_ceiling || ARRAY['hero.write','hero.publish']) p ORDER BY p),
  version=m.version+1,updated_at=now()
FROM identity.subjects s
WHERE m.subject_id=s.id AND s.lab_fixture AND s.role_code='SUPER_ADMIN'
AND m.org_id='10000000-0000-4000-8000-000000000001' AND m.revoked_at IS NULL AND m.valid_until>now()
AND 'identity.role.manage'=ANY(m.permissions) AND NOT m.grant_ceiling @> ARRAY['hero.write','hero.publish'];
