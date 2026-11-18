---
trigger: always_on
description: "Gunakan aturan canonical dan scope Monolith Modular Helpdesk TIK Kota Depok."
---

Baca AGENTS.md pada root workspace ini. Aturan arsitektur, keamanan, workflow dan pelaporan berada di sana. GEMINI.md hanya pengarah dan tidak menggantikan aturan canonical. Sebelum mengubah source, cocokkan task dengan status/PROJECT_STATE.md serta planning/backlog.csv. Paket ini menargetkan satu proses Go M0; jangan membuat implementasi microservices. Semua status kelulusan harus mempunyai bukti aktual.

## Prinsip Testing Minimal (Hemat Waktu & Token)

- Jalankan **hanya minimum test set yang relevan dengan berkas/fitur yang diubah** (sejalan dengan `AGENTS.md`, untuk menghemat waktu dan token):
  - Perubahan frontend-only (TypeScript/CSS/MJS): cukup `tsc --noEmit` + `npm run build`, `python -X utf8 scripts/test_piui_build.py`, Node `.mjs` unit tests terkait, dan **satu verifikasi browser terarah** untuk fitur UI yang diubah; jangan mengulang test Go backend, migrasi PostgreSQL, atau drill backup/restore bila backend/SQL tidak berubah.
  - Perubahan backend/SQL spesifik: jalankan paket test Go terkait saja (mis. `go test ./internal/modules/<modul>/...` atau `-run TestNama`) sebelum regresi lebih luas bila memang diperlukan.
  - Seluruh klaim kelulusan wajib tetap berasal dari eksekusi aktual pasca-edit terakhir dan tidak boleh mengendurkan rule keamanan/ACL atau assertion test.
