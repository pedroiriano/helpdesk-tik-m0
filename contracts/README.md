# Kontrak rancangan

Kontrak pada folder ini adalah rancangan M0. module_registry.csv mempertahankan ID, schema dan budget sumber. dependencies.json membatasi port sinkron dan mencatat event, termasuk NotificationStored M9 ke M3 untuk guard auto-close. capability_map.csv menjelaskan subkemampuan tanpa menambah proses.

acceptance.csv memisahkan pengujian M0 dari parity penelitian yang ditunda. feature_coverage.csv memetakan seluruh 29 kelompok kebutuhan sumber ke bab M0. Status SPECIFIED_NOT_IMPLEMENTED berarti spesifikasi tersedia, bukan fitur berjalan.

Kontrak M0-02 berada pada `openapi/business.json`, `events/business.v1.schema.json`, `events/subscriptions.v1.json` dan `policy/`. Definisi API/event berasal dari `scripts/build_business_contracts.py`. [Pemetaan dan batas bukti](M0_02_TRACEABILITY.md) menjelaskan acceptance fase ini. Instruksi gate ada pada `tests/contract/README.md`. Artefak executable tidak berarti handler bisnis sudah tersedia. Jangan mengurangi requirement sumber hanya karena test belum dibuat.

M0-03 memperluas OpenAPI secara additive ke 1.1.0. Operasi dengan x-runtime-status IMPLEMENTED_M0_03 mempunyai handler M1/M2; operasi lain tetap NOT_IMPLEMENTED. [Traceability M0-03](M0_03_TRACEABILITY.md) memisahkan scope yang terbukti dari acceptance global yang belum selesai. Generator kanonis meliputi scripts/m0_03_contracts.py dan DTO TypeScript generated.

M0-04 menambah wire contract 1.2.0 untuk tiket, tracking, byte stream dan receipt. [Cakupan bukti M0-04](M0_04_TRACEABILITY.md) membedakan kandidat berjalan, hardening final dan acceptance global.
