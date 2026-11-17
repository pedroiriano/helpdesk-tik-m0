import json,unittest
from pathlib import Path
from verify_package import validate_manifest,validate_dependencies,validate_backlog

ROOT=Path(__file__).resolve().parents[1]
class PackageGuardTests(unittest.TestCase):
    def setUp(self):
        self.manifest=json.loads((ROOT/'configs/M0.json').read_text())
        self.dependencies=json.loads((ROOT/'contracts/dependencies.json').read_text())
    def test_valid_m0(self):
        validate_manifest(self.manifest);validate_dependencies(self.dependencies)
    def test_duplicate_module_rejected(self):
        self.manifest['groups']['G1'][-1]='M1'
        with self.assertRaisesRegex(ValueError,'Duplicate'):validate_manifest(self.manifest)
    def test_second_process_group_rejected(self):
        self.manifest['groups']['G2']=['M9']
        with self.assertRaisesRegex(ValueError,'exactly'):validate_manifest(self.manifest)
    def test_sync_cycle_rejected(self):
        self.dependencies['sync_business_ports']['M1']=['M3']
        with self.assertRaisesRegex(ValueError,'cycle'):validate_dependencies(self.dependencies)
    def test_done_without_evidence_rejected(self):
        row={'id':'M0-01','depends_on':'','modules':'M1','acceptance':'AC01','status':'DONE_VERIFIED','evidence':''}
        with self.assertRaisesRegex(ValueError,'evidence'):validate_backlog([row],[])
    def test_fake_package_pass_not_application_evidence(self):
        row={'id':'M0-01','depends_on':'','modules':'M1','acceptance':'AC01','status':'DONE_VERIFIED','evidence':'qa/package.json'}
        with self.assertRaisesRegex(ValueError,'actual'):validate_backlog([row],[{'task_id':'M0-01','scope':'package_only','result':'PASS'}])

if __name__=='__main__':unittest.main()
