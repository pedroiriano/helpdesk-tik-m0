ALTER TABLE assignment.routing_rules ADD COLUMN category_id uuid;
ALTER TABLE assignment.routing_rules ADD COLUMN target_org_id uuid;
ALTER TABLE assignment.routing_rules ADD CONSTRAINT cross_org_routing_has_category CHECK(target_org_id IS NULL OR category_id IS NOT NULL);
CREATE INDEX routing_by_service_category_level ON assignment.routing_rules(service_id, level, category_id, version DESC);
