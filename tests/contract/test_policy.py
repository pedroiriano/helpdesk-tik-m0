import importlib.util
import json
import unittest
from copy import deepcopy
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('contract_policy', ROOT/'contracts/policy/evaluator.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
DATA = json.loads((ROOT/'tests/contract/policy.v1.fixture.json').read_text())


class PolicyFixtures(unittest.TestCase):
    def test_acl_independent_expectations(self):
        for case in DATA['acl_cases']:
            with self.subTest(case=case['name']):
                actor = {**DATA['actor'], **case.get('actor',{})}
                resource = {**DATA['ticket'], **case.get('resource',{})}
                self.assertEqual(policy.authorize(actor,case['permission'],resource,DATA['now'],internal=case.get('internal',False)),case['expected'])

    def test_lifecycle_independent_expectations(self):
        for case in DATA['state_cases']:
            with self.subTest(case=case['name']):
                ticket = {**DATA['ticket'],**case.get('ticket',{})}
                before = deepcopy(ticket)
                actor = {**DATA['actor'],**case.get('actor',{})}
                now = case.get('now',DATA['now'])
                result = policy.transition(ticket,case['action'],actor,now,case.get('expected_version',7),**case.get('context',{}))
                self.assertEqual(result['status'],case['expected'])
                self.assertEqual(ticket,before)
                if case['expected'] == 200:
                    self.assertEqual(result['state'],case['to'])
                    self.assertEqual(result['accepted_at'],ticket['accepted_at'])
                    self.assertEqual(result['version'],ticket['version']+1)
                    if case['action'] != 'REOPEN':
                        self.assertEqual(result['episode_id'],ticket['episode_id'])
                    if case['action'] == 'RESOLVE':
                        self.assertEqual(policy.instant(result['confirmation_due_at'])-policy.instant(now),timedelta(hours=24))
                    if case['action'] == 'FEEDBACK':
                        self.assertTrue(result['feedback_committed'])
                    if case['action'] == 'ACCEPT_HANDOFF':
                        self.assertEqual(result['org_id'],'depok-b')
                    if case['action'] == 'REQUEST_HANDOFF':
                        self.assertEqual(result['org_id'],'depok-a')

    def test_feedback_then_job_and_old_job_after_new_attempt(self):
        actor, ticket, now = DATA['actor'], DATA['ticket'], DATA['now']
        feedback = policy.transition(ticket,'FEEDBACK',actor,now,7,attempt_id='attempt-1')
        worker = {**actor,'role':'AUTO_CLOSE_SERVICE','ticket_id':'ticket-a'}
        self.assertEqual(policy.transition(feedback,'AUTO_CLOSE',worker,now,8,attempt_id='attempt-1')['status'],422)
        updated = {**ticket,'active_attempt_id':'attempt-2','version':9}
        self.assertEqual(policy.transition(updated,'AUTO_CLOSE',worker,now,7,attempt_id='attempt-1')['status'],409)
        self.assertEqual(policy.transition(updated,'AUTO_CLOSE',worker,now,9,attempt_id='attempt-1')['status'],422)

    def test_scope_before_count_search_export_and_revoked_download(self):
        own = {**DATA['ticket'],'scan_state':'CLEAN'}
        other = {**own,'id':'other-ticket','requester_id':'other','org_id':'depok-b'}
        for surface in policy.PERMISSIONS['read_surfaces']:
            with self.subTest(surface=surface):
                visible = policy.visible_records(DATA['actor'],'ticket.read',[own,other],DATA['now'])
                self.assertEqual([r['id'] for r in visible],['ticket-a'])
        revoked = {**DATA['actor'],'revoked':True}
        self.assertEqual(policy.authorize(revoked,'media.read',own,DATA['now']),401)

    def test_all_transition_rules_have_positive_and_negative_coverage(self):
        cases = DATA['state_cases']
        for rule in policy.MACHINE['transitions']:
            if rule['action'] in ('CREATE','REASSIGN'):
                continue  # exercised separately below
            self.assertTrue(any(c['action']==rule['action'] and c['expected']==200 for c in cases),rule['action'])
        self.assertEqual(policy.transition(DATA['ticket'],'UNKNOWN',DATA['actor'],DATA['now'],7)['status'],422)
        created = policy.transition({**DATA['ticket'],'state':'NONE'},'CREATE',DATA['actor'],DATA['now'],None,service_active=True,audience_allowed=True,form_valid=True)
        self.assertEqual(created['state'],'OPEN')
        invalid = policy.transition({**DATA['ticket'],'state':'NONE'},'CREATE',DATA['actor'],DATA['now'],None,service_active=True,audience_allowed=False,form_valid=True)
        self.assertEqual(invalid['status'],422)
        reassigned = policy.transition({**DATA['ticket'],'state':'IN_PROGRESS'},'REASSIGN',{**DATA['actor'],'role':'COORDINATOR'},DATA['now'],7,assignment_valid=True)
        self.assertEqual(reassigned['state'],'IN_PROGRESS')

    def test_lab_calendar_boundaries_holiday_and_pause_union(self):
        cases = json.loads((ROOT/'tests/contract/calendar.v1.fixture.json').read_text())
        for case in cases:
            with self.subTest(case=case['name']):
                self.assertEqual(policy.business_due(case['start'],case['minutes'],holidays=case.get('holidays',()),pauses=case.get('pauses',())),case['expected'])
        with self.assertRaises(ValueError):
            policy.business_due(DATA['now'],0)
        with self.assertRaises(ValueError):
            policy.merge_intervals([['2026-11-05T03:00:00Z','2026-11-04T03:00:00Z']])

    def test_grant_ceiling_and_private_media_reuse(self):
        actor = {**DATA['actor'],'role':'ADMIN_OPD','grant_ceiling':['catalog.write']}
        self.assertTrue(policy.grant_allowed(actor,['catalog.write'],'depok-a',DATA['now']))
        self.assertFalse(policy.grant_allowed(actor,['ticket.read'],'depok-a',DATA['now']))
        self.assertFalse(policy.grant_allowed(actor,['catalog.write'],'depok-b',DATA['now']))
        editor = {**DATA['actor'],'role':'EDITOR'}
        source = {**DATA['ticket'],'visibility':'PRIVATE','scan_state':'CLEAN'}
        target = {**source,'visibility':'PUBLIC','owner':'M8'}
        self.assertFalse(policy.media_reuse_allowed(editor,source,target,DATA['now']))
        self.assertTrue(policy.media_reuse_allowed(editor,source,target,DATA['now'],sanitized_copy=True,approved=True))
        self.assertFalse(policy.media_reuse_allowed(editor,source,{**target,'org_id':'depok-b'},DATA['now'],sanitized_copy=True,approved=True))


if __name__ == '__main__':
    unittest.main()
