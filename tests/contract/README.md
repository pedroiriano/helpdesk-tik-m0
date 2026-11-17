Kontrak health ada di contracts/openapi/health.json; uji HTTP ada di backend/internal/platform/httpserver.

## Gate terkini M0-04

Gunakan Python 3.13 dari root proyek. Tooling OpenAPI terpisah dari lock event awal agar versi jsonschema tidak berbenturan.

```powershell
python -m pip install --only-binary=:all: --target .local/openapi-tools -r tests/contract/openapi-requirements.txt
python scripts/verify_m0_04.py
python scripts/test_owner_migrations.py --report qa/m0-04/migrations.json
python scripts/verify_package.py
```

Gate kontrak menjalankan generation drift checks, OAS/schema/contoh/negative cases, pemetaan requirement/event/dependency, fixture state/ACL/kalender dan regresi dua event lama. Laporan ada pada `qa/m0-04/contracts.json`. Evaluator Python merupakan model referensi kontrak yang tidak terhubung HTTP/DB. Kasus fixture perlu diuji lagi terhadap enforcement Go pada fase bisnis.

Gate migrasi membutuhkan Docker serta image PostgreSQL terpin yang sudah tersedia lokal. Ia membuat dan membersihkan kontainer tes sendiri, tanpa port host/volume persisten, serta tidak menerapkan DDL ke DB kerja. Laporan ada pada `qa/m0-04/migrations.json`. Tes negatif checksum/rollback sengaja mengubah SQL hanya di kontainer disposable.

Fixture PASS bukan bukti autentikasi nyata, retry use case, worker/scheduler, UI operasional, benchmark, UAT atau deployment.

Enforcement Go/HTTP/PostgreSQL M1/M2 diuji terpisah dengan `python scripts/test_m0_03.py`. Jangan menjalankan wrapper M0-02 dengan output default pada source baru: laporan qa/m0-02 adalah snapshot historis yang dipertahankan.

Untuk M0-04, `python scripts/test_m0_04.py` membuktikan runtime tiket/audit, SQL disposable dan scanner nyata. Regresi M0-03 pada source baru memakai `python scripts/test_m0_03.py --report qa/m0-04/m0-03-regression.json`. Laporan fase lama tetap historis.
