-- Additive FAQ kind, category grouping, sort order, and canonical initial FAQ entries (M8 only).
SET LOCAL timezone = 'UTC';

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'knowledge.content'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE knowledge.content DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE knowledge.content
  ADD CONSTRAINT content_kind_check CHECK (kind IN ('ARTICLE', 'PAGE', 'FAQ')),
  ADD COLUMN IF NOT EXISTS category_label text NOT NULL DEFAULT 'Umum',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order >= 0);

CREATE INDEX IF NOT EXISTS content_faq_order_idx
  ON knowledge.content (kind, sort_order ASC, updated_at DESC, id DESC);

GRANT SELECT, INSERT, UPDATE ON knowledge.content TO helpdesk_m8;

-- Seed 5 FAQ resmi Helpdesk TIK Kota Depok secara idempoten (setara dengan konten awal faqSection)
INSERT INTO knowledge.content (id, kind, slug, title, audience, state, org_id, principal_id, category_label, sort_order)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'FAQ', 'faq-akun-email-depok-go-id', 'Bagaimana cara mengajukan akun email resmi @depok.go.id?', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017', 'Akun & Email Dinas', 10),
  ('c1000000-0000-4000-8000-000000000002', 'FAQ', 'faq-target-sla-gangguan-jaringan', 'Berapa lama target waktu penyelesaian laporan gangguan jaringan (SLA)?', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017', 'Jaringan & SLA', 20),
  ('c1000000-0000-4000-8000-000000000003', 'FAQ', 'faq-pelaporan-insiden-depok-csirt', 'Bagaimana prosedur pelaporan insiden keamanan siber ke Depok-CSIRT?', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017', 'Keamanan Siber (CSIRT)', 30),
  ('c1000000-0000-4000-8000-000000000004', 'FAQ', 'faq-lacak-laporan-masyarakat-tanpa-akun', 'Bagaimana cara masyarakat melacak laporan tanpa memiliki akun ASN?', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017', 'Pelacakan & Tamu', 40),
  ('c1000000-0000-4000-8000-000000000005', 'FAQ', 'faq-verifikasi-sertifikat-tte-bsre', 'Apakah permohonan sertifikat Tanda Tangan Elektronik (TTE) membutuhkan verifikasi tatap muka?', 'PUBLIC_GUEST', 'PUBLISHED', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000017', 'Tanda Tangan Elektronik (TTE)', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id)
SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 1, 'Permohonan akun email kedinasan dapat diajukan oleh ASN melalui menu Katalog Layanan -> Layanan Penerbitan Akun Email Kedinasan. Lampirkan Surat Keputusan (SK) Pengangkatan atau Surat Tugas resmi dari Kepala OPD yang bersangkutan.', '20000000-0000-4000-8000-000000000017'::uuid
WHERE EXISTS (SELECT 1 FROM knowledge.content WHERE id = 'c1000000-0000-4000-8000-000000000001')
ON CONFLICT (content_id, revision) DO NOTHING;

INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id)
SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 1, 'Sesuai Standar Operasional Prosedur (SOP) Diskominfo Kota Depok, laporan gangguan koneksi internet/intranet memiliki target respon maksimal 1 jam dan target resolusi 4 hingga 8 jam kerja (Senin–Jumat 08.00–16.00 WIB).', '20000000-0000-4000-8000-000000000017'::uuid
WHERE EXISTS (SELECT 1 FROM knowledge.content WHERE id = 'c1000000-0000-4000-8000-000000000002')
ON CONFLICT (content_id, revision) DO NOTHING;

INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id)
SELECT 'd1000000-0000-4000-8000-000000000003'::uuid, 'c1000000-0000-4000-8000-000000000003'::uuid, 1, 'Insiden keamanan (seperti defacement, ransomware, atau peretasan akun) dapat dilaporkan baik oleh masyarakat maupun ASN melalui layanan Penanganan Insiden Keamanan Informasi (Depok-CSIRT / TIK-SEC-01) atau melalui Call Center Kedaruratan 112 dengan kalender layanan darurat 24 jam / 7 hari (CAL-247).', '20000000-0000-4000-8000-000000000017'::uuid
WHERE EXISTS (SELECT 1 FROM knowledge.content WHERE id = 'c1000000-0000-4000-8000-000000000003')
ON CONFLICT (content_id, revision) DO NOTHING;

INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id)
SELECT 'd1000000-0000-4000-8000-000000000004'::uuid, 'c1000000-0000-4000-8000-000000000004'::uuid, 1, 'Masyarakat yang mengajukan permohonan melalui layanan publik akan menerima Kunci Pelacakan Rahasia (Capability Token) 64-karakter hex. Kunci tersebut dimasukkan pada halaman Lacak Tiket Tamu untuk melihat status dan berkomunikasi langsung dengan petugas tanpa login.', '20000000-0000-4000-8000-000000000017'::uuid
WHERE EXISTS (SELECT 1 FROM knowledge.content WHERE id = 'c1000000-0000-4000-8000-000000000004')
ON CONFLICT (content_id, revision) DO NOTHING;

INSERT INTO knowledge.revisions (id, content_id, revision, sanitized_body, author_id)
SELECT 'd1000000-0000-4000-8000-000000000005'::uuid, 'c1000000-0000-4000-8000-000000000005'::uuid, 1, 'Penerbitan TTE bekerja sama dengan Balai Sertifikasi Elektronik (BSrE) BSSN. Verifikasi identitas kependudukan dan biometrik dilakukan secara elektronik melalui sistem terintegrasi, dengan konfirmasi akhir dari Verifikator Diskominfo Kota Depok.', '20000000-0000-4000-8000-000000000017'::uuid
WHERE EXISTS (SELECT 1 FROM knowledge.content WHERE id = 'c1000000-0000-4000-8000-000000000005')
ON CONFLICT (content_id, revision) DO NOTHING;
