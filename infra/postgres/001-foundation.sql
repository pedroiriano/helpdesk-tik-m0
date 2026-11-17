\set ON_ERROR_STOP on
REVOKE ALL ON DATABASE helpdesk FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
\getenv password M1_PASSWORD
SELECT format('CREATE ROLE helpdesk_m1 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m1') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m1;
CREATE SCHEMA IF NOT EXISTS identity;
REVOKE ALL ON SCHEMA identity FROM PUBLIC;
GRANT USAGE ON SCHEMA identity TO helpdesk_m1;
CREATE TABLE IF NOT EXISTS identity.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO identity.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON identity.schema_version TO helpdesk_m1;
\getenv password M2_PASSWORD
SELECT format('CREATE ROLE helpdesk_m2 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m2') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m2;
CREATE SCHEMA IF NOT EXISTS catalog;
REVOKE ALL ON SCHEMA catalog FROM PUBLIC;
GRANT USAGE ON SCHEMA catalog TO helpdesk_m2;
CREATE TABLE IF NOT EXISTS catalog.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO catalog.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON catalog.schema_version TO helpdesk_m2;
\getenv password M3_PASSWORD
SELECT format('CREATE ROLE helpdesk_m3 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m3') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m3;
CREATE SCHEMA IF NOT EXISTS intake;
REVOKE ALL ON SCHEMA intake FROM PUBLIC;
GRANT USAGE ON SCHEMA intake TO helpdesk_m3;
CREATE TABLE IF NOT EXISTS intake.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO intake.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON intake.schema_version TO helpdesk_m3;
\getenv password M4_PASSWORD
SELECT format('CREATE ROLE helpdesk_m4 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m4') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m4;
CREATE SCHEMA IF NOT EXISTS classification;
REVOKE ALL ON SCHEMA classification FROM PUBLIC;
GRANT USAGE ON SCHEMA classification TO helpdesk_m4;
CREATE TABLE IF NOT EXISTS classification.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO classification.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON classification.schema_version TO helpdesk_m4;
\getenv password M5_PASSWORD
SELECT format('CREATE ROLE helpdesk_m5 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m5') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m5;
CREATE SCHEMA IF NOT EXISTS assignment;
REVOKE ALL ON SCHEMA assignment FROM PUBLIC;
GRANT USAGE ON SCHEMA assignment TO helpdesk_m5;
CREATE TABLE IF NOT EXISTS assignment.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO assignment.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON assignment.schema_version TO helpdesk_m5;
\getenv password M6_PASSWORD
SELECT format('CREATE ROLE helpdesk_m6 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m6') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m6;
CREATE SCHEMA IF NOT EXISTS sla;
REVOKE ALL ON SCHEMA sla FROM PUBLIC;
GRANT USAGE ON SCHEMA sla TO helpdesk_m6;
CREATE TABLE IF NOT EXISTS sla.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO sla.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON sla.schema_version TO helpdesk_m6;
\getenv password M7_PASSWORD
SELECT format('CREATE ROLE helpdesk_m7 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m7') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m7;
CREATE SCHEMA IF NOT EXISTS escalation;
REVOKE ALL ON SCHEMA escalation FROM PUBLIC;
GRANT USAGE ON SCHEMA escalation TO helpdesk_m7;
CREATE TABLE IF NOT EXISTS escalation.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO escalation.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON escalation.schema_version TO helpdesk_m7;
\getenv password M8_PASSWORD
SELECT format('CREATE ROLE helpdesk_m8 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m8') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m8;
CREATE SCHEMA IF NOT EXISTS knowledge;
REVOKE ALL ON SCHEMA knowledge FROM PUBLIC;
GRANT USAGE ON SCHEMA knowledge TO helpdesk_m8;
CREATE TABLE IF NOT EXISTS knowledge.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO knowledge.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON knowledge.schema_version TO helpdesk_m8;
\getenv password M9_PASSWORD
SELECT format('CREATE ROLE helpdesk_m9 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_m9') \gexec
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_m9;
CREATE SCHEMA IF NOT EXISTS notify_audit;
REVOKE ALL ON SCHEMA notify_audit FROM PUBLIC;
GRANT USAGE ON SCHEMA notify_audit TO helpdesk_m9;
CREATE TABLE IF NOT EXISTS notify_audit.schema_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version > 0));
INSERT INTO notify_audit.schema_version VALUES (true,1) ON CONFLICT DO NOTHING;
GRANT SELECT ON notify_audit.schema_version TO helpdesk_m9;
