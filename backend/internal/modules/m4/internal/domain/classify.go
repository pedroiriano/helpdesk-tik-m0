package domain

import (
	"context"
	"helpdesk.local/m0/internal/modules/m4/api"
	"strings"
	"unicode"
)

// Baseline is an explicit deterministic lab lexicon, never final verification.
type Baseline struct{}

func (Baseline) Propose(ctx context.Context, text string) (api.Proposal, error) {
	if err := ctx.Err(); err != nil {
		return api.Proposal{}, err
	}
	tokens := map[string]bool{}
	for _, token := range strings.FieldsFunc(strings.ToLower(text), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) }) {
		tokens[token] = true
	}
	p := api.Proposal{Category: "MANUAL", Explanation: "Tidak ada kecocokan kamus; verifikasi operator diperlukan", Version: "DICT-LAB-v2", RuleVersion: 2, Priority: "NORMAL"}
	specific := []struct {
		category string
		phrases  []string
	}{
		{"CAT-SIPD-BUDGET", []string{"sipd penganggaran", "sipd anggaran", "e budgeting"}},
		{"CAT-SIPD-PLAN", []string{"sipd perencanaan", "e planning"}},
		{"CAT-SIPD-TREASURY", []string{"sipd penatausahaan", "sp2d"}},
		{"CAT-PUBLIC-WIFI", []string{"wifi publik", "wifi gratis", "freehotspot"}},
		{"CAT-INSTALL-NET", []string{"instalasi jaringan", "pemasangan lan"}},
		{"CAT-INTERNET-ACCOUNT", []string{"akun internet", "user internet"}},
		{"CAT-VIDEO", []string{"video conference", "konferensi video", "rapat virtual"}},
		{"CAT-WEB-OPD", []string{"situs web", "website opd"}},
		{"CAT-SEC-INCIDENT", []string{"phishing", "ransomware", "malware", "kebocoran data"}},
		{"CAT-SERVER", []string{"kolokasi", "colocation", "collocation", "pusat data", "server virtual"}},
		{"CAT-TRAINING", []string{"pelatihan aplikasi", "pendampingan aplikasi"}},
		{"CAT-EMAIL", []string{"email", "webmail", "imap", "smtp"}},
		{"CAT-HOSTING", []string{"hosting", "subdomain", "dns"}},
		{"CAT-IDENTITY", []string{"reset kata sandi", "reset password", "mfa", "sso"}},
		{"CAT-DATA", []string{"api", "interoperabilitas", "splp"}},
		{"CAT-BACKUP", []string{"backup", "pencadangan", "pemulihan data"}},
		{"CAT-CERT", []string{"tte", "tanda tangan elektronik", "sertifikat elektronik"}},
		{"CAT-CCTV", []string{"cctv"}},
		{"CAT-PUBLIC-APP", []string{"dsw", "depok single window"}},
	}
	normalized := " " + strings.Join(strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	}), " ") + " "
	for _, rule := range specific {
		for _, phrase := range rule.phrases {
			if !strings.Contains(normalized, " "+phrase+" ") {
				continue
			}
			p.Version, p.RuleVersion = "DICT-LAB-v3", 3
			if p.Confidence > 0 {
				p.Category, p.Confidence = "MANUAL", .3
				p.Explanation = "Beberapa kategori spesifik cocok; perlu peninjauan operator"
				return p, nil
			}
			p.Category, p.Confidence = rule.category, .7
			p.Explanation = "Kamus klasifikasi cocok: " + phrase
			break
		}
	}
	if p.Confidence > 0 {
		return p, nil
	}
	rules := []struct {
		category string
		words    []string
	}{{"NETWORK", []string{"wifi", "wi", "jaringan", "internet"}}, {"APPLICATION", []string{"aplikasi", "login", "sistem"}}, {"DEVICE", []string{"printer", "komputer", "laptop"}}}
	matches := 0
	for _, r := range rules {
		for _, w := range r.words {
			if tokens[w] {
				matches++
				p.Category = r.category
				p.Explanation = "Kamus lab cocok: " + w
				break
			}
		}
	}
	if matches == 1 {
		p.Confidence = 0.7
	} else if matches > 1 {
		p.Category = "MANUAL"
		p.Confidence = 0.3
		p.Explanation = "Lebih dari satu kategori cocok; perlu peninjauan operator"
	}
	return p, nil
}
