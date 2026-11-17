-- Scope and provenance for snapshots consumed after RM0-02.
ALTER TABLE assignment.load_projection ADD COLUMN service_owner_org_id uuid;
ALTER TABLE assignment.assignment_proposals ADD COLUMN tier text CHECK(tier IN ('L1','L2'));
ALTER TABLE assignment.assignment_proposals ADD COLUMN proposal_digest text;
ALTER TABLE assignment.assignment_proposals ADD COLUMN recommended_assignee_id uuid;
CREATE INDEX load_projection_active_org ON assignment.load_projection(service_owner_org_id,assignee_id)
  WHERE state IN ('ASSIGNED','IN_PROGRESS');
