ALTER TABLE assignment.rosters
  ADD COLUMN capacity integer CHECK (capacity BETWEEN 1 AND 100);

CREATE TABLE assignment.technician_absences (
  id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  cancelled boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX technician_absences_subject_period
  ON assignment.technician_absences(subject_id, starts_at, ends_at) WHERE NOT cancelled;
GRANT SELECT, INSERT, UPDATE ON assignment.technician_absences TO helpdesk_m5;
