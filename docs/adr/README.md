# Indeks Architecture Decision Records (ADR) Helpdesk M0

Penomoran ADR bersifat unik berurutan (`0001`–`0013`) dan diperiksa oleh gerbang CI lokal (`scripts/ci_local.py`).

| Nomor | Dokumen | Lingkup Keputusan | Status |
|---|---|---|---|
| ADR 0001 | [0001-m0-dan-ownership.md](0001-m0-dan-ownership.md) | Batas arsitektur M0 satu proses & ownership 9 modul (`M1..M9`) | Diterapkan |
| ADR 0002 | [0002-workspace-ui-docker-lokal.md](0002-workspace-ui-docker-lokal.md) | Workspace tetap, PIUI Modern/Zero, dan stack Docker lokal | Diterapkan |
| ADR 0003 | [0003-kontrak-bisnis-dan-migrasi-owner.md](0003-kontrak-bisnis-dan-migrasi-owner.md) | Kontrak OpenAPI/event & migrasi ber-ledger per owner | Diterapkan |
| ADR 0004 | [0004-identitas-lab-katalog-master.md](0004-identitas-lab-katalog-master.md) | Sesi lab sintetis & master M1/M2 terisolasi | Diterapkan |
| ADR 0005 | [0005-ticket-durable-audit-private-uploads.md](0005-ticket-durable-audit-private-uploads.md) | Tiket M3, durable outbox/audit M9 & lampiran privat ClamAV | Diterapkan |
| ADR 0006 | [0006-rm001-auth-scope-media.md](0006-rm001-auth-scope-media.md) | Remediasi RM0-01 autentikasi, scope OPD & reuse media M8 | Diterapkan |
| ADR 0007 | [0007-rm002-lifecycle-assignment.md](0007-rm002-lifecycle-assignment.md) | Fakta tiket M3, Smart Dispatch & proyeksi penugasan M5 | Diterapkan |
| ADR 0008 | [0008-role-module-policy-and-hero.md](0008-role-module-policy-and-hero.md) | Kebijakan akses peran berversi & draf/terbit Banner Hero | Diterapkan |
| ADR 0009 | [0009-resource-envelope-and-rpo-rto-dec-m10.md](0009-resource-envelope-and-rpo-rto-dec-m10.md) | `DEC-M10` anggaran sumber daya dua-tier (R1/R2) & RPO/RTO lab | `DECIDED_LAB_ENVELOPE` |
| ADR 0010 | [0010-technology-stack-upgrade-and-pinning-dec-m11.md](0010-technology-stack-upgrade-and-pinning-dec-m11.md) | `DEC-M11` pembaruan stack terpin (Go 1.27.4, Node 26.13.1, PG 18.7, ClamAV 1.5.4) | `DECIDED_PINNED_STACK` |
| ADR 0011 | [0011-reporting-directory-and-category-routing.md](0011-reporting-directory-and-category-routing.md) | Kategori pelaporan, direktori instansi/Bidang & Smart Dispatch *(rekonsiliasi nomor dari duplikat `0007` 13 Nov 2026)* | Diterapkan (Lab) |
| ADR 0012 | [0012-faq-management-and-m0-c3-f9-architecture-parity.md](0012-faq-management-and-m0-c3-f9-architecture-parity.md) | Pengelolaan FAQ dinamis (`M8`) & kesetaraan rancangan arsitektur `M0`, `C3`, `F9` | Diterapkan di M0 (Riset Multi-Model `DEFERRED_RESEARCH`) |
| ADR 0013 | [0013-technical-availability-workload-performance.md](0013-technical-availability-workload-performance.md) | Pengelolaan roster berbasis akun, proyeksi beban, dan laporan teknis | Diterapkan di M0 lab |
