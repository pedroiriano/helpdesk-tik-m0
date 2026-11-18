-- Fase 3 additive OIDC SSO & production auth metadata (M1 only).
SET LOCAL timezone = 'UTC';

ALTER TABLE identity.subjects
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'LOCAL' CHECK(auth_provider IN ('LOCAL','OIDC')),
  ADD COLUMN IF NOT EXISTS oidc_issuer text,
  ADD COLUMN IF NOT EXISTS oidc_subject text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_oidc_identity_unique
  ON identity.subjects(oidc_issuer, oidc_subject)
  WHERE oidc_issuer IS NOT NULL AND oidc_subject IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON identity.subjects TO helpdesk_m1;
