"""Validate the shared wire contract, without starting an application or sending notifications."""
import json
import unittest
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]


def load(relative):
    return json.loads((ROOT / relative).read_text(encoding="utf8"))


class ResolutionContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = load("contracts/events/resolution-notification.v1.schema.json")
        Draft202012Validator.check_schema(schema)
        cls.validator = Draft202012Validator(schema, format_checker=FormatChecker())
        cls.proposal, cls.proof = load("tests/contract/resolution-notification.v1.fixture.json")

    def test_reference_exchange(self):
        for event in (self.proposal, self.proof):
            self.validator.validate(event)
        self.assertEqual(self.proof["payload"]["ticket_id"], self.proposal["aggregate_id"])
        self.assertEqual(self.proof["payload"]["attempt_id"], self.proposal["payload"]["attempt_id"])
        self.assertEqual(self.proof["correlation_id"], self.proposal["correlation_id"])
        self.assertNotEqual(self.proof["event_id"], self.proposal["event_id"])
        resolve = datetime.fromisoformat(self.proposal["occurred_at"])
        deadline = datetime.fromisoformat(self.proposal["payload"]["confirmation_due_at"])
        self.assertEqual(deadline - resolve, timedelta(hours=24))

    def test_invalid_envelopes(self):
        for original in (self.proposal, self.proof):
            for field, value in (("event_id", "invalid"), ("aggregate_version", 0),
                                 ("occurred_at", "2026-02-30T10:00:00Z"),
                                 ("schema_version", 2), ("event_type", "Unknown"),
                                 ("producer", "M1"), ("secret", "synthetic")):
                with self.subTest(event=original["event_type"], field=field):
                    self.assertFalse(self.validator.is_valid({**original, field: value}))
            for field in original["payload"]:
                with self.subTest(missing=field):
                    event = deepcopy(original)
                    del event["payload"][field]
                    self.assertFalse(self.validator.is_valid(event))
        self.assertFalse(self.validator.is_valid({**self.proof, "producer": "M3"}))
        self.assertFalse(self.validator.is_valid({**self.proposal, "producer": "M9"}))
        self.assertFalse(self.validator.is_valid({**self.proof, "payload": self.proposal["payload"]}))
        private_payload = {**self.proof["payload"], "recipient_email": "fixture@example.invalid"}
        self.assertFalse(self.validator.is_valid({**self.proof, "payload": private_payload}))


if __name__ == "__main__":
    unittest.main()
