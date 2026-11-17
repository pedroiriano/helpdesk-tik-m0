package config

import "testing"

func TestManifest(t *testing.T) {
	good, err := Load("../../../../configs/M0.json")
	if err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(*Manifest){
		"duplicate":        func(m *Manifest) { m.Modules = []string{"M1", "M1", "M3", "M4", "M5", "M6", "M7", "M8", "M9"} },
		"missing":          func(m *Manifest) { m.Modules = []string{"M1"} },
		"unknown":          func(m *Manifest) { m.Modules = []string{"M0", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"} },
		"empty group":      func(m *Manifest) { m.Groups = map[string][]string{"G1": {}} },
		"wrong group":      func(m *Manifest) { m.Groups = map[string][]string{"G2": m.Modules} },
		"processes":        func(m *Manifest) { m.Processes = 9 },
		"pool":             func(m *Manifest) { m.PoolMax = 5 },
		"real integration": func(m *Manifest) { m.RealIntegrations = true },
		"budget":           func(m *Manifest) { m.Budget.CPU = 3000 },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			m := good
			change(&m)
			if m.Validate() == nil {
				t.Fatal("invalid manifest accepted")
			}
		})
	}
}
