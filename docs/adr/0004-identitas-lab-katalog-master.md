# ADR 0004 — Identitas lab, katalog dan master M0-03

4 November 2026. Implementasi M1/M2 pada satu proses Go. Tidak mengaktifkan SSO, kanal nyata, tiket M0-04 atau varian penelitian.

## Identitas dan izin

Adapter hanya aktif dengan manifest synthetic_lab, flag HELPDESK_LAB_AUTH dan origin loopback yang tervalidasi. Default tanpa flag gagal tertutup. Delapan subject sintetis ditentukan allowlist server dan seed lab ber-guard. Tidak ada password produksi, penentuan ASN dari email, atau role/org dari body/header klien.

Login memakai nonce cookie HttpOnly, Origin yang cocok, CSRF dan Idempotency-Key. Token sesi dan CSRF diturunkan dengan HMAC berlabel terpisah dari session_key lokal; DB hanya menyimpan hash. Derivasi deterministik memungkinkan replay login tanpa menyimpan token mentah pada idempotency response. Replay sesi expired/revoked ditolak. Sesi berlaku dua jam, HttpOnly/SameSite=Strict, Secure pada HTTPS. HTTP tanpa Secure terbatas pada origin loopback lab; tidak mengubah proteksi produksi. Cookie/credential tidak disimpan di localStorage, URL atau log.

Setiap use case memuat sesi dan membership aktif dari M1. M2 memanggil public port M1 secara lokal. Permission DB diinterseksikan dengan ceiling peran kanonis, dan grant membership dibatasi grant_ceiling serta ceiling peran target. Tidak ada hak baca tiket implisit untuk config admin. identity.organization.create merupakan permission eksplisit platform admin untuk organisasi baru; hanya binding creator yang diturunkan dari mandat yang memberi hak tersebut. Tidak memberikan akses ke organisasi lain yang sudah ada. Scope pengelolaan identity tetap memungkinkan reaktivasi organisasi nonaktif, sementara audience katalog memakai membership organisasi aktif.

GET/list/detail memakai filter scope sebelum limit/cursor. Hidden object 404, visible forbidden action 403, unauthenticated 401. Mutation memeriksa CSRF pada use case dan Origin/Host pada transport. Session, kind, role dan organization header bebas tidak menjadi authority. Token tidak dimasukkan dalam response JSON. Revocation diperiksa kembali pada request baru, tanpa cache izin lama.

## Data dan batas modul

Migrasi 001–010 dipertahankan, 011–012 additive. Schema version foundation tetap 1; identity.domain_version dan catalog.domain_version wajib 3 sebelum consumer aktif. Runtime tidak mendapat akses ledger/migrator. Kategori dimiliki organisasi, dan form/policy lama tidak mendapat UPDATE dari role runtime.

Mutasi master/session mengomit data, hasil idempotency, audit intent, outbox dan target delivery M9 dalam transaksi owner yang sama. Key terikat actor, command, target dan digest request typed yang dinormalisasi. Retry intent sama mengembalikan receipt tersimpan; intent berbeda atau versi usang menghasilkan 409. Audit memiliki correlation server tanpa credential. Delivery worker M9 belum dijalankan; record PENDING bukan bukti notifikasi terkirim.

M3 tidak diakses atau ditulis oleh M1/M2. Capability tiket/create/track tetap M0-04. SQL tetap dalam store owner, dengan port M1 untuk data authority lintas modul. Sembilan role/pool maksimal empat koneksi tetap dipertahankan. Tidak ada HTTP loopback antar modul.

## UI dan bukti

Consumer menggunakan shell/form/dialog/card/table asli PIUI Modern dan PIUI Zero. Implementasi dilakukan pada adapter build serta client TypeScript dari schema bisnis, bukan mengganti references. Halaman umum/detail tetap memakai aturan UI publik v1.1. Data API dirender dengan textContent dan elemen DOM aman. Pagination dan pilihan master bertahap berasal dari server. Versi formulir/policy lama dipertahankan, dan conflict tidak di-overwrite diam-diam. Broadcast sesi hanya berisi pemberitahuan perubahan, tanpa credential.

Label MFA, mTLS, NIST dan sertifikasi WCAG contoh pada login diganti dengan penjelasan lab yang faktual. Keputusan ini tidak mengklaim sertifikasi aksesibilitas atau keamanan produksi. Gate source, PostgreSQL/HTTP dan pemeriksaan browser dicatat pada qa/m0-03. AC06/AC11 global tetap PARTIAL karena tiket dan permukaan fase selanjutnya belum diimplementasikan. C3/F9/G-OPT, UAT dan produksi tetap di luar fase.
