# Runbook Cutover & Operasional Produksi — Helpdesk TIK Kota Depok (M0)

## 1. Tujuan dan Arsitektur Produksi
Dokumen ini memandu operator Diskominfo Kota Depok dalam memindahkan Helpdesk TIK M0 dari lingkungan lab ke lingkungan produksi (`compose.yaml` + `compose.prod.yml`) dengan tetap mempertahankan batas arsitektur monolith modular satu proses Go, satu build frontend React/PIUI, dan satu instance PostgreSQL 18.7 terisolasi (`9` schema & role DB).

Prasyarat kebijakan (`planning/decisions.csv`):
- `DEC-M01`: Mekanisme registrasi & kredensial akun publik/warga di produksi (`HELPDESK_PUBLIC_AUTH=1`).
- `DEC-M02`: Konfigurasi penyedia OIDC/PKCE SSO ASN Pemkot Depok (`HELPDESK_SSO_*`).
- `DEC-M07`: Aktivasi persetujuan dua Super Admin untuk pemusnahan retensi tiket (`HELPDESK_PURGE_ENABLED=1`, default mati `0`).
- `DEC-M09`: Aktivasi saluran notifikasi produksi Bot Telegram dan/atau SMTP kedinasan.

## 2. Penyiapan Secret & Sertifikat TLS (Di Luar Git)
Jangan pernah menyimpan file secret atau kunci privat ke Git (`security_gate.py` akan memblokir). Siapkan direktori aman di server target:

1. **Sertifikat TLS Edge (`/run/tls`)**:
   - Siapkan `./.local/tls/tls.crt` (fullchain PEM) dan `./.local/tls/tls.key` (readable oleh UID `101` nginx, izin `0440`, group `101`).
   - Nginx produksi (`infra/nginx/nginx.prod.conf`) mewajibkan TLSv1.2/TLSv1.3, menonaktifkan session tickets, mengaktifkan HSTS `max-age=31536000; includeSubDomains`, dan mengalihkan HTTP (`:80`) -> `301 https://$host$request_uri` (kecuali `/healthz` loopback lokal).
2. **Secret Kunci Sesi & Password Role Database (`.local/secrets`)**:
   - `session_key` (wajib >= 32 byte acak kriptografis; digunakan HMAC cookie SSO + kemampuan pelacakan guest).
   - `postgres`, `m1`..`m9` (password unik min 32 karakter per role owner schema PostgreSQL 18.7).
3. **Secret Integrasi Opsional (`/run/secrets` atau env server aman)**:
   - `oidc_client_secret` (atau `HELPDESK_SSO_CLIENT_SECRET`)
   - `telegram_bot_token` (atau `HELPDESK_TELEGRAM_BOT_TOKEN`)
   - `smtp_pass` (atau `HELPDESK_SMTP_PASS`)

## 3. Registrasi SSO ASN Kedinasan (OIDC + PKCE S256)
- Daftarkan Redirect URI exact pada Identity Provider Pemkot Depok:
  `https://<domain-resmi>/api/v1/auth/sso/callback`
- Nonaktifkan seluruh identitas lab (`HELPDESK_LAB_AUTH=0`). Pastikan hanya akun ASN/Staf aktif (`lab_fixture = false`, dengan `external_ref`/NIP atau email terverifikasi tunggal) yang terdaftar.
- Backend memverifikasi signature JWT `RS256`/`ES256` via `HELPDESK_SSO_JWKS_URL`, `state`, `nonce`, dan `code_verifier` PKCE `S256` serta cookie `HttpOnly` `SameSite=Lax` bertanda tangan HMAC. Akun tak dikenal ditolak `403`.

## 4. Antivirus ClamAV & `freshclam`
- Overlay `compose.prod.yml` mengaktifkan pembaruan definisi virus berkala (`CLAMAV_NO_FRESHCLAMD: 'false'`) dan menyimpan database tanda tangan pada volume persisten `clamav-db:/var/lib/clamav`.
- Bila server produksi berada di belakang jaringan terkurung, konfigurasikan mirror internal CVD pada host atau pastikan akses keluar hanya ke mirror definisi ClamAV resmi sebelum container `app` menerima unggahan pertama.

## 5. Prosedur Backup, Migrasi, & Cutover Terkendali
1. **Verifikasi prasyarat & keamanan pra-cutover**:
   ```bash
   python -X utf8 scripts/security_gate.py
   python -X utf8 scripts/test_fase3_hardening.py
   docker compose -f compose.yaml -f compose.prod.yml config --quiet
   ```
2. **Backup pra-cutover database PostgreSQL 18.7** (contoh via `pg_dump` terenkripsi ke penyimpanan cadangan terpisah — buktikan restore minimal sekali via `scripts/drill_rm0_03_restore.py` sebelum rilis):
   ```bash
   docker exec helpdesk-m0-db pg_dump -U postgres -Fc -d helpdesk > backup_pre_cutover.dump
   ```
3. **Terapkan migrasi aditif terverifikasi (`001–040`)**:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yml run --rm migrate
   ```
4. **Bangun image deterministik & naikkan stack produksi**:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yml build --pull=false app web
   docker compose -f compose.yaml -f compose.prod.yml up -d --wait
   ```
5. **Smoke check pasca-cutover**:
   - Pastikan `http://127.0.0.1` mengarah `301 https://...`
   - Pastikan `https://<domain>/api/v1/auth/config` mengembalikan `mode: "PRODUCTION"`, `lab_auth_enabled: false`.
   - Verifikasi `GET /api/v1/admin/health` dan tidak ada akun `lab_fixture=true` pada `/api/v1/admin/subjects`.

## 6. Operasional Hari-Ke-2 (Antrean M9 & Retensi Purge M1/M3)
- **Antrean Pengiriman Telegram & Email (M9)**: Worker latar belakang `RunDispatcher` mengirim notifikasi berstatus `PENDING` / `FAILED` dengan backoff bertingkat hingga 5 kali sebelum masuk `DEAD_LETTER`. Staf berwenang (`operation.read` atau `system.job`) dapat memantau target teredaksi serta melakukan **Replay** melalui *Pusat Bantuan → Notifikasi* (`GET /api/v1/admin/delivery-jobs` & `POST /api/v1/admin/delivery-jobs/{id}/replay`).
- **Retensi & Purge Terkendali (M1 + M3)**: Koordinator menetapkan penahanan hukum (`legal_hold`) dan `retention_until` melalui `POST /api/v1/tickets/{id}/retention`. Bila `HELPDESK_PURGE_ENABLED=1`, permohonan `PURGE_REQUEST` diverifikasi preflight (harus `CLOSED`/`CANCELLED`, terarsip, tidak `legal_hold`, masa retensi lewat, tanpa handoff `PENDING`), wajib disetujui **dua Super Admin berbeda** (`DEC-M07`), lalu eksekusi membersihkan PII judul/deskripsi serta blob lampiran tak terpakai sementara jejak audit `notify_audit.audit_entries` & `intake.ticket_versions` tetap utuh.

## 7. Rencana Rollback
- Jika regresi berat muncul sebelum penulisan data baru yang tak kompatibel, turunkan `app`/`web` ke tag rilis stabil sebelumnya atau jalankan `pg_restore` dari `backup_pre_cutover.dump` ke database bersih lalu verifikasi `/livez` dan `/readyz`. Karena seluruh migrasi `001–040` bersifat **aditif** (kolom baru nullable/defaulted atau perluasan CHECK constraint), rollback biner minor aman dilakukan sambil mempertahankan skema.
