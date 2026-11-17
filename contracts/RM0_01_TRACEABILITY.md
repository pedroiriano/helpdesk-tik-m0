# RM0-01 — Cakupan acceptance kandidat lab

Status resmi per butir dan hasil command terdapat di `qa/remediation/rm0-01/completion.json`. Bukti dari M0 terdahulu dipertahankan sebagai historis. Klaim fase tidak mencakup acceptance lintas model atau UAT manusia.

| ID | Temuan / AC | Jalur yang diperiksa | Bukti |
|---|---|---|---|
| R1-A | F01 / AC06 | M1 bootstrap, session, verifikasi password, status akun, expiry/revoke, guard non-lab | `TestRM001Integration/R1-A`, `R1-F`, `TestPasswordVerifier` |
| R1-B | F01 / AC02 AC06 | M1 registrasi, validasi, transaksi subject dan session, unique identifier, key replay | `TestRM001Integration/R1-B` |
| R1-C | F02 / AC07 AC18 | M8 metadata, upload lease, pemilik dan scope, scan, unduh, rekonsiliasi bersama M3 | `TestRM001Integration/R1-C` |
| R1-D | F03 / AC07 AC18 | Approval/revoke/reuse M8, pembacaan sumber M3 melalui port, versi/audience/mandat, unduhan byte hasil redaksi | `TestRM001Integration/R1-D`, `R1-E-scoped-M3-library-and-search` |
| R1-E | F04 / AC06 AC07 AC23 | M2 predicate katalog, M3 tiket/media, M8 konten/media, M9 agregat serta ekspor dengan grant terkini | `TestRM001Integration/R1-E-*` |
| R1-F | F01 F02 / AC06 AC18 | Migrasi 019–020, ledger dan readiness, upgrade hash pada login, inventaris lokal agregat | `integration.json`, `local-before.json`, `local-after.json` |
| R1-G | F01 F02 F03 F14 / AC02 AC11 AC18 | Handler runtime, generated contract, consumer PIUI, audit durable dan smoke browser | `integration.json`, `browser.json`, `completion.json` |
| R1-H | F13 F14 | Manifest awal/akhir, keputusan terbuka, pengesahan dan handoff | `baseline-source.json`, `source-manifest.json`, `completion.json`, draf rilis dan `status/evidence.jsonl` |

| Handler runtime | OpenAPI `/api/v1` | Operation ID |
|---|---|---|
| `m1/internal/app/http.go` | POST `/auth/sessions` | `CreateLabSession` |
| `m1/internal/app/http.go` | POST `/auth/register` | `RegisterPublicSubject` |
| `m8/internal/app/http.go` | POST `/media` | `UploadMedia` |
| `m8/internal/app/http.go` | PUT `/media/{id}/content` | `StoreQuarantineBlob` |
| `m8/internal/app/http.go` | GET `/media/{id}/content` dan GET `/media/{id}/download` | `DownloadCleanBlob` dan `DownloadMedia` |
| `m8/internal/app/http.go` | POST `/media/{id}/approvals` | `ApproveSanitizedMedia` |
| `m8/internal/app/http.go` | POST `/media/approvals/{id}/revoke` | `RevokeMediaApproval` |
| `m8/internal/app/http.go` | POST `/media/{id}/reuse` | `ReuseMedia` |

DEC-M02 (SSO dan verifikasi identitas, Pengelola identitas), DEC-M06 (mandat dan delegasi, Pemilik proses) dan DEC-M08 (kebijakan media/draft, Pemilik data dan keamanan) masih OPEN. UAT manusia dan otorisasi organisasi dilacak untuk RM0-05.
