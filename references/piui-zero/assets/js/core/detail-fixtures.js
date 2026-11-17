/** Synthetic local records. No authentication or authorization claims. */
export const USERS = [
  {
    "id": "USR-9041",
    "name": "Budi Santoso",
    "email": "budi.sec@piui-zero.internal",
    "role": "Super Admin",
    "status": "Aktif \u2022 FIDO2 Key",
    "lastActivity": "21 Okt 2026, 08:54 WIB",
    "pii": "NIK: 3174\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220001"
  },
  {
    "id": "USR-8812",
    "name": "Nadia Pratiwi",
    "email": "nadia.appsec@piui-zero.internal",
    "role": "AppSec Lead",
    "status": "Aktif \u2022 Passkey",
    "lastActivity": "21 Okt 2026, 08:41 WIB",
    "pii": "NIK: 3273\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220042"
  },
  {
    "id": "USR-7730",
    "name": "Hendra Wijaya",
    "email": "hendra.finops@piui-zero.internal",
    "role": "FinOps Supervisor",
    "status": "Aktif \u2022 TOTP + Key",
    "lastActivity": "21 Okt 2026, 08:19 WIB",
    "pii": "NIK: 3671\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220118"
  },
  {
    "id": "USR-6504",
    "name": "Rizky Ramadhan",
    "email": "rizky.sre@piui-zero.internal",
    "role": "Platform SRE",
    "status": "Ditangguhkan (Anomali IP)",
    "lastActivity": "20 Okt 2026, 22:14 WIB",
    "pii": "NIK: 3578\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220093"
  },
  {
    "id": "USR-5190",
    "name": "Dr. Sinta Maharani",
    "email": "sinta.audit@piui-zero.internal",
    "role": "Compliance Auditor",
    "status": "Menunggu Registrasi Key",
    "lastActivity": "20 Okt 2026, 17:05 WIB",
    "pii": "NIK: 3471\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220027"
  }
];
export const AUDITS = [
  {
    "id": "AUD-2026-0892",
    "time": "21 Okt 2026, 08:52:14",
    "actor": "budi.sec@piui-zero.internal",
    "ip": "10.24.8.19",
    "action": "Pembaruan kebijakan Strict CSP & Trusted Types ( piui-dom-policy )",
    "hash": "sha256:9f84c2a1...e08b",
    "severity": "Risiko Tinggi",
    "actorId": "USR-9041",
    "before": "{\n  \"policyId\": \"CSP-STRICT-PROD\",\n  \"trustedTypesPolicy\": \"piui-dom-policy\",\n  \"requireTrustedTypesFor\": \"'script'\",\n  \"sessionIdleTimeoutSec\": 1800,\n  \"requireHardwareKeyMfa\": false,\n  \"piiAutoRemaskSeconds\": 30\n}",
    "after": "{\n  \"policyId\": \"CSP-STRICT-PROD\",\n  \"trustedTypesPolicy\": \"piui-dom-policy\",\n  \"requireTrustedTypesFor\": \"'script'\",\n  \"sessionIdleTimeoutSec\": 900,\n  \"requireHardwareKeyMfa\": true,\n  \"piiAutoRemaskSeconds\": 10\n}"
  },
  {
    "id": "AUD-2026-0891",
    "time": "21 Okt 2026, 08:44:02",
    "actor": "nadia.appsec@piui-zero.internal",
    "ip": "10.24.8.42",
    "action": "Penangguhan akun USR-6504 karena anomali lokasi login",
    "hash": "sha256:4b12e9d0...71ca",
    "severity": "Risiko Tinggi",
    "actorId": "USR-8812"
  },
  {
    "id": "AUD-2026-0890",
    "time": "21 Okt 2026, 08:39:44",
    "actor": "hendra.finops@piui-zero.internal",
    "ip": "10.24.9.10",
    "action": "Pengajuan otorisasi Dual-Control untuk escrow TRX-2026-9908",
    "hash": "sha256:7c30a8f4...19d2",
    "severity": "Peringatan",
    "actorId": "USR-7730"
  },
  {
    "id": "AUD-2026-0889",
    "time": "21 Okt 2026, 08:25:19",
    "actor": "sinta.audit@piui-zero.internal",
    "ip": "10.24.11.04",
    "action": "Pembukaan sementara masking PII pada entitas USR-9041 (10 dtk)",
    "hash": "sha256:2e91b6c3...88a1",
    "severity": "Peringatan",
    "actorId": "USR-5190"
  },
  {
    "id": "AUD-2026-0888",
    "time": "21 Okt 2026, 08:10:03",
    "actor": "system.settlement@piui-zero.internal",
    "ip": "10.24.0.1",
    "action": "Penyelesaian otomatis kliring TRX-2026-9906 dengan Idempotency-Key",
    "hash": "sha256:8a04d5e2...33f9",
    "severity": "Informasi Normal",
    "actorId": ""
  }
];
