CREATE TABLE identity.role_module_policies (
    id uuid PRIMARY KEY,
    role_code text NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    permissions text[] NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(role_code, version)
);
GRANT SELECT, INSERT ON identity.role_module_policies TO helpdesk_m1;
