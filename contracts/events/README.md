# Kontrak event resolusi v1

`resolution-notification.v1.schema.json` mendefinisikan dua pesan pada alur M3 → M9 → M3. Pada ResolutionProposed, aggregate adalah tiket, occurred_at adalah waktu resolusi, dan batas konfirmasi adalah 24 jam kalender kemudian. Pada NotificationStored, aggregate adalah notifikasi dalam aplikasi yang sudah tersimpan untuk pemohon yang berhak. M9 menerbitkan bukti hanya setelah commit durable dan membawa ticket_id serta attempt_id dari proposal. Event memiliki ID sendiri dan meneruskan correlation_id.

aggregate_version mengacu pada aggregate milik producer. Consumer yang berlangganan sebagian tipe tidak mengasumsikan versi tiket berurutan. M3 harus mencocokkan tiket, upaya aktif, deadline, version dan ketiadaan feedback sebelum auto-close. Format pesan tidak membuktikan otorisasi producer, commit, replay atau terpenuhinya guard runtime. Isi pesan, alamat penerima dan capability tidak disertakan di payload kontrak ini.

Dari root proyek, siapkan tooling pengujian pada direktori lokal dengan Python 3.13.

```powershell
python -m pip install --only-binary=:all: --target .local/contract-tools -r tests/contract/requirements.txt
$env:PYTHONPATH = (Resolve-Path .local/contract-tools).Path
python tests/contract/test_resolution_events.py
```

## Event bisnis dan subscription

`business.v1.schema.json` melengkapi tipe bisnis dengan producer allowlist dan payload/envelope minimum. Dua wire format resolusi lama tetap valid. `subscriptions.v1.json` menetapkan consumer, ordering, dedup dan ACK. Sumber definisi ada pada `scripts/build_business_contracts.py` dan diperiksa gate M0-02.

TicketCreated/TicketStateChanged membawa snapshot lengkap untuk projection scope/state/assignment/clock. Consumer membandingkan snapshot version, bukan mengasumsikan semua nomor versi diterima. Intent specialized tidak memajukan snapshot watermark. Pada NotificationStored, aggregate_id adalah notification ID; ticket/attempt ada pada payload. Inbox dan efek commit sebelum ACK, ID sama dengan digest berbeda ditolak, dan context intent yang belum tersedia direkonsiliasi secara durable. M9 tidak melakukan self-relay audit. Detail serta batas runtime ada pada ADR 0003.
