import unittest
from check_boundaries import check, PREFIX

class Boundaries(unittest.TestCase):
    def test_allowed_port(self):
        check([{'ImportPath':PREFIX+'modules/m3/internal/app','Imports':[PREFIX+'modules/m2/api']}],{'M3':['M2']})
    def test_reject_cross_owner_and_reverse_dependencies(self):
        for source,target in [('modules/m3/internal/app','modules/m2/internal/store'),('modules/m3/api','modules/m3/internal/domain'),('modules/m3/internal/app','modules/m2'),('modules/m3/internal/app','modules/m9/api'),('platform/clock','modules/m2/api'),('modules/m3/internal/app','bootstrap')]:
            with self.subTest(source=source,target=target),self.assertRaises(ValueError):
                check([{'ImportPath':PREFIX+source,'Imports':[PREFIX+target]}],{'M3':['M2']})

if __name__=='__main__':unittest.main()
