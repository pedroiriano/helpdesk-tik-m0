# M3 / intake

004-contracts.sql berisi DDL kontrak domain M3, referensi lokal, idempotency, outbox/inbox dan audit intent. Lihat ../README.md untuk ledger serta batas penerapan. Setelah dipakai, migrasi berikutnya harus additive dengan ID baru. Runtime tidak memiliki DDL atau akses owner lain.
