CREATE TABLE escalation.job_replays (
 job_id uuid NOT NULL REFERENCES escalation.jobs(id),
 actor_id uuid NOT NULL,
 request_key text NOT NULL,
 expected_version bigint NOT NULL,
 result_version bigint NOT NULL,
 reason text NOT NULL,
 correlation_id uuid NOT NULL,
 replayed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,actor_id,request_key)
);
GRANT SELECT, INSERT ON escalation.job_replays TO helpdesk_m7;
