ALTER TABLE assignment.load_projection ADD COLUMN awaiting_vendor boolean;
CREATE INDEX load_projection_technician ON assignment.load_projection(assignee_id, state)
  WHERE state IN ('ASSIGNED','IN_PROGRESS','RESOLVED');
