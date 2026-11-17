package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type Manifest struct {
	Variant          string              `json:"variant"`
	Processes        int                 `json:"application_processes"`
	Replicas         int                 `json:"replicas_per_group"`
	HPA              bool                `json:"hpa"`
	Transport        string              `json:"internal_transport"`
	Modules          []string            `json:"module_ids"`
	Groups           map[string][]string `json:"groups"`
	PoolMax          int                 `json:"db_pool_max_per_owner"`
	PoolTotal        int                 `json:"db_pool_total_max"`
	Environment      string              `json:"environment"`
	RealIntegrations bool                `json:"integrations_real_enabled"`
	Budget           struct {
		CPU    int `json:"cpu_m"`
		Memory int `json:"memory_mib"`
	} `json:"app_budget"`
}

func Load(path string) (Manifest, error) {
	var m Manifest
	data, err := os.ReadFile(path)
	if err != nil {
		return m, fmt.Errorf("manifest unavailable")
	}
	if err = json.Unmarshal(data, &m); err != nil {
		return m, fmt.Errorf("invalid manifest JSON")
	}
	return m, m.Validate()
}

func (m Manifest) Validate() error {
	if m.Variant != "M0" || m.Processes != 1 || m.Replicas != 1 || m.HPA || m.Transport != "in_process_ports" || m.Environment != "synthetic_lab" || m.RealIntegrations || m.PoolMax != 4 || m.PoolTotal != 36 || m.Budget.CPU != 2500 || m.Budget.Memory != 4608 {
		return fmt.Errorf("invalid M0 runtime policy")
	}
	if len(m.Groups) != 1 {
		return fmt.Errorf("exactly one group required")
	}
	for _, ids := range [][]string{m.Modules, m.Groups["G1"]} {
		seen := map[string]bool{}
		for _, id := range ids {
			if len(id) != 2 || id[0] != 'M' || id[1] < '1' || id[1] > '9' || seen[id] {
				return fmt.Errorf("invalid or duplicate module")
			}
			seen[id] = true
		}
		if len(seen) != 9 {
			return fmt.Errorf("all nine modules required")
		}
	}
	return nil
}
