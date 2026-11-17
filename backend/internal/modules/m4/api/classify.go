package api

import (
	"context"
)

type Proposal struct {
	CategoryID  *string `json:"category_id,omitempty"`
	Priority    string  `json:"priority,omitempty"`
	RuleVersion int     `json:"rule_version,omitempty"`
	Category    string  `json:"category"`
	Confidence  float64 `json:"confidence"`
	Explanation string  `json:"explanation"`
	Version     string  `json:"classifier_version"`
}
type Port interface {
	Propose(context.Context, string) (Proposal, error)
}
