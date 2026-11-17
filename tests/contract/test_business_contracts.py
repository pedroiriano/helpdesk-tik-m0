import csv
import json
from pathlib import Path
import re
import unittest
from jsonschema import Draft202012Validator, FormatChecker
from scripts.contract_validation import validate_spec as validate

ROOT = Path(__file__).resolve().parents[2]


class BusinessContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = json.loads((ROOT / "contracts/openapi/business.json").read_text(encoding="utf-8"))
        cls.events = json.loads((ROOT / "contracts/events/business.v1.schema.json").read_text(encoding="utf-8"))
        cls.subscriptions = json.loads((ROOT / "contracts/events/subscriptions.v1.json").read_text(encoding="utf-8"))
        cls.fixtures = json.loads((ROOT / "tests/contract/business-events.v1.fixture.json").read_text(encoding="utf-8"))

    def test_openapi_contract_valid_and_consistent(self):
        validate(self.api)
        self.assertEqual(self.api["openapi"], "3.1.0")
        self.assertEqual(len(self.api["servers"]), 1)
        self.assertEqual(self.api["servers"][0]["url"], "/")

    def test_event_schemas_valid_and_match_subscriptions(self):
        Draft202012Validator.check_schema(self.events)
        names = {s["properties"]["event_type"]["const"] for s in self.events["oneOf"]}
        subs = {s["event_type"] for s in self.subscriptions["subscriptions"]}
        self.assertEqual(names, subs)
        for s in self.subscriptions["subscriptions"]:
            self.assertEqual(s["schema_version"], 1)
            self.assertFalse(s["self_relay"])
            self.assertTrue(all(p.startswith("M") for p in s["producers"]))
            self.assertTrue(all(c.startswith("M") for c in s["consumers"]))

    def test_event_fixtures_match_schemas(self):
        validator = Draft202012Validator(self.events, format_checker=FormatChecker())
        self.assertEqual(len(self.fixtures), len(self.subscriptions["subscriptions"]))
        for fixture in self.fixtures:
            errors = list(validator.iter_errors(fixture))
            self.assertEqual(errors, [], f"failed on {fixture.get('event_type')}")

    def test_paths_aliases_auth_and_concurrency_contract(self):
        paths = self.api["paths"]
        self.assertIn("/api/v1/tickets", paths)
        self.assertIn("/api/v1/tickets/{id}", paths)
        self.assertIn("/api/v1/tickets/{id}/verify", paths)
        self.assertIn("/api/v1/tickets/{id}/triage", paths)
        self.assertIn("/api/v1/tickets/{id}/dispatch", paths)
        self.assertIn("/api/v1/tickets/{id}/assign", paths)
        self.assertIn("/api/v1/tickets/{id}/resolution-attempts", paths)
        self.assertIn("/api/v1/tickets/{id}/resolve", paths)
        self.assertIn("/api/v1/tickets/{id}/transitions/resolve", paths)
        pairs = [
            ("/api/v1/tickets/{id}/verify", "/api/v1/tickets/{id}/triage"),
            ("/api/v1/tickets/{id}/dispatch", "/api/v1/tickets/{id}/assign"),
            ("/api/v1/tickets/{id}/resolution-attempts", "/api/v1/tickets/{id}/resolve"),
            ("/api/v1/tickets/{id}/resolution-attempts", "/api/v1/tickets/{id}/transitions/resolve"),
        ]
        for canonical, alias in pairs:
            a = paths[canonical]["post"]
            b = paths[alias]["post"]
            self.assertEqual(a["x-owner"], b["x-owner"])
            self.assertEqual(a["x-permission"], b["x-permission"])
            self.assertEqual(a["x-command"], b["x-command"])
            self.assertEqual(a["requestBody"], b["requestBody"])
        close = paths["/api/v1/tickets/{id}/close"]["post"]
        self.assertEqual(close["x-permission"], "ticket.confirm")
        ids = []
        for path, methods in paths.items():
            for method, op in methods.items():
                ids.append(op["operationId"])
                self.assertIn(op["x-runtime-status"], ("NOT_IMPLEMENTED", "IMPLEMENTED_M0_03", "IMPLEMENTED_M0_04", "IMPLEMENTED_M0_05", "IMPLEMENTED_M0_06", "IMPLEMENTED_M0_07", "IMPLEMENTED_M0_08", "IMPLEMENTED_M0_09", "IMPLEMENTED_M0_10", "IMPLEMENTED_M0_11", "IMPLEMENTED_RM0_04"))
                if method != "get":
                    self.assertTrue(any(p["name"] == "Idempotency-Key" and p["required"] for p in op["parameters"]))
                if "202" in op["responses"]:
                    self.assertIn(op["x-poll-path"], paths)
                    self.assertIn("get", paths[op["x-poll-path"]])
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(paths["/api/v1/tickets"]["post"]["x-runtime-status"], "IMPLEMENTED_M0_04")
        self.assertEqual(paths["/api/v1/auth/me"]["get"]["x-runtime-status"], "IMPLEMENTED_M0_03")
        self.assertEqual(paths["/api/v1/admin/services"]["post"]["x-runtime-status"], "IMPLEMENTED_M0_03")

    def test_ticket_stream_tracking_and_future_workflow_boundary(self):
        paths = self.api["paths"]
        upload = paths["/api/v1/tickets/{id}/attachments"]["post"]
        self.assertIn("application/octet-stream", upload["requestBody"]["content"])
        self.assertEqual(upload["x-runtime-status"], "IMPLEMENTED_M0_04")
        download = paths["/api/v1/tickets/{id}/attachments/{attachment_id}/download"]["get"]
        self.assertIn("application/octet-stream", download["responses"]["200"]["content"])
        self.assertIn({"GuestTracking": []}, download["security"])
        self.assertEqual(self.api["components"]["securitySchemes"]["GuestTracking"]["name"], "helpdesk_tracking")
        for path in ["/api/v1/tickets/{id}/verify", "/api/v1/tickets/{id}/dispatch"]:
            self.assertEqual(paths[path]["post"]["x-runtime-status"], "IMPLEMENTED_M0_05")
        for path in ["/api/v1/tickets/{id}/resolution-attempts", "/api/v1/tickets/{id}/confirmation"]:
            self.assertEqual(paths[path]["post"]["x-runtime-status"], "IMPLEMENTED_M0_06")
        self.assertEqual(paths["/api/v1/tickets/{id}/sla"]["get"]["x-runtime-status"], "IMPLEMENTED_M0_06")
        for path in ["/api/v1/tickets/{id}/vendor-cases", "/api/v1/tickets/{id}/pauses", "/api/v1/tickets/{id}/handoffs", "/api/v1/tickets/{id}/handoffs/{handoff_id}/accept", "/api/v1/tickets/{id}/escalations"]:
            self.assertEqual(paths[path]["post"]["x-runtime-status"], "IMPLEMENTED_M0_07")
        self.assertEqual(paths["/api/v1/operations/{id}"]["get"]["x-runtime-status"], "IMPLEMENTED_M0_07")
        for path in ["/api/v1/media", "/api/v1/drafts"]:
            self.assertEqual(paths[path]["get"]["x-runtime-status"], "IMPLEMENTED_M0_08")
        self.assertEqual(paths["/api/v1/media/{id}/reuse"]["post"]["x-runtime-status"], "IMPLEMENTED_M0_08")

    def test_traceability_uses_real_requirements_and_owners(self):
        rows = list(csv.DictReader((ROOT / "contracts/business_traceability.csv").read_text(encoding="utf-8").splitlines()))
        fr = {r["id"] for r in csv.DictReader((ROOT / "contracts/feature_coverage.csv").read_text(encoding="utf-8-sig").splitlines())}
        owners = {f"M{i}" for i in range(1, 10)}
        self.assertEqual(len(rows), sum(len(v) for v in self.api["paths"].values()))
        for row in rows:
            self.assertTrue(set(row["owner"].split("|")) <= owners)
            self.assertTrue(set(row["source_requirements"].split()) <= fr)

    def test_schemas_have_no_excessive_types(self):
        schemas = self.api["components"]["schemas"]
        self.assertIn("Error", schemas)
        self.assertIn("Ticket", schemas)
        self.assertIn("Verification", schemas)
        self.assertIn("Dispatch", schemas)
        for name, s in schemas.items():
            if s.get("type") == "object" and "properties" in s:
                self.assertFalse(s.get("additionalProperties", True), f"{name} allows arbitrary keys")

    def test_guest_secret_and_idempotency_patterns(self):
        create = self.api["paths"]["/api/v1/tickets"]["post"]
        self.assertTrue(any(p["name"] == "X-Guest-Capability" and not p["required"] for p in create["parameters"]))
        self.assertTrue(any(p["name"] == "Idempotency-Key" and p["required"] for p in create["parameters"]))


if __name__ == "__main__":
    unittest.main()
