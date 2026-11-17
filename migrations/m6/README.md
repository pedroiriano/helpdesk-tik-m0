# M6 / sla

007-contracts.sql berisi DDL kontrak domain M6, referensi lokal, idempotency, outbox/inbox dan audit intent. Lihat ../README.md untuk ledger serta batas penerapan. Setelah dipakai, migrasi berikutnya harus additive dengan ID baru. Runtime tidak memiliki DDL atau akses owner lain.
