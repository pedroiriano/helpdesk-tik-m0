-- M0-04 owner-scoped durable delivery leases.
ALTER TABLE catalog.outbox_delivery ADD COLUMN lease_token uuid;
ALTER TABLE catalog.outbox_delivery ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
