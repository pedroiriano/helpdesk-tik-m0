CREATE TABLE knowledge.hero_publication (
    id uuid PRIMARY KEY CHECK (id = '80000000-0000-4000-8000-000000000035'),
    version bigint NOT NULL CHECK (version > 0),
    draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'array' AND jsonb_array_length(draft) = 5),
    published jsonb CHECK (jsonb_typeof(published) = 'array' AND jsonb_array_length(published) = 5),
    published_version bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON knowledge.hero_publication TO helpdesk_m8;
ALTER TABLE knowledge.media ADD COLUMN hero_candidate boolean NOT NULL DEFAULT false;
