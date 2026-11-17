ALTER TABLE identity.system_operation_requests DROP CONSTRAINT system_operation_requests_state_check;
ALTER TABLE identity.system_operation_requests ADD CONSTRAINT system_operation_requests_state_check
 CHECK(state IN ('PENDING','REQUESTED','APPROVED','QUEUED','RUNNING','SUCCEEDED','FAILED','DISABLED'));
ALTER TABLE identity.system_operation_requests ADD COLUMN execution_receipt jsonb;
ALTER TABLE identity.system_operation_requests ADD COLUMN approved_at timestamptz;
