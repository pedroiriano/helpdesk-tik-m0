package domain

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	catalog "helpdesk.local/m0/internal/modules/m2/api"
	"helpdesk.local/m0/internal/modules/m3/api"
	"helpdesk.local/m0/internal/platform/web"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

func Hash(v string) []byte { h := sha256.Sum256([]byte(v)); return h[:] }
func Secret(v string) bool {
	b, e := hex.DecodeString(v)
	return e == nil && len(b) == 32 && strings.ToLower(v) == v
}
func Derive(key []byte, label, value string) string {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(label + "\x00" + value))
	return hex.EncodeToString(h.Sum(nil))
}
func Text(v string, max int) bool {
	return strings.TrimSpace(v) != "" && utf8.RuneCountInString(v) <= max && !strings.ContainsRune(v, 0)
}
func Validate(in *api.Create, s catalog.Snapshot) error {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	if !Text(in.Title, 200) || !Text(in.Description, 4000) || in.Answers == nil || len(in.Answers) > 100 {
		return web.Fail(422, "Judul, uraian dan field formulir diperlukan")
	}
	if in.ServiceVersion != s.Service.Version || in.FormVersion != s.Form.FormVersion || in.PolicyVersion != s.Policy.PolicyVersion {
		return web.Fail(409, "Layanan/formulir/policy berubah; tinjau versi terbaru")
	}
	known := map[string]bool{}
	for _, f := range s.Form.Fields {
		known[f.Key] = true
		v := strings.TrimSpace(in.Answers[f.Key])
		if f.Required && v == "" {
			return web.Fail(422, "Field wajib belum lengkap: "+f.Label)
		}
		if utf8.RuneCountInString(v) > 4000 {
			return web.Fail(422, "Field terlalu panjang")
		}
		if v != "" {
			switch f.Kind {
			case "number":
				n, e := strconv.ParseFloat(v, 64)
				if e != nil || math.IsNaN(n) || math.IsInf(n, 0) {
					return web.Fail(422, "Angka tidak valid")
				}
			case "date":
				if _, e := time.Parse("2006-01-02", v); e != nil {
					return web.Fail(422, "Tanggal tidak valid")
				}
			case "choice":
				found := false
				for _, o := range f.Options {
					if o == v {
						found = true
					}
				}
				if !found {
					return web.Fail(422, "Pilihan tidak valid")
				}
			}
		}
		if _, present := in.Answers[f.Key]; present {
			in.Answers[f.Key] = v
		}
	}
	for k := range in.Answers {
		if !known[k] {
			return web.Fail(422, "Field formulir tidak dikenal")
		}
	}
	return nil
}

func ValidateVerification(in *api.VerificationInput, categoryChanged bool) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if !web.UUID(in.CategoryID) {
		return web.Fail(422, "Kategori tidak valid")
	}
	if in.Priority != "LOW" && in.Priority != "NORMAL" && in.Priority != "HIGH" && in.Priority != "CRITICAL" {
		return web.Fail(422, "Prioritas tidak valid")
	}
	if in.ClassifierVersion < 1 {
		return web.Fail(422, "Versi classifier tidak valid")
	}
	b, err := hex.DecodeString(in.EvidenceDigest)
	if in.EvidenceDigest != "" && (err != nil || len(b) != 32) {
		return web.Fail(422, "Digest bukti verifikasi harus 32 byte hex")
	}
	reason := strings.TrimSpace(in.Reason)
	if categoryChanged {
		if reason == "" || utf8.RuneCountInString(reason) < 5 {
			return web.Fail(400, "Alasan override wajib disertakan (minimal 5 karakter)")
		}
	} else if reason == "" {
		return web.Fail(400, "Alasan verifikasi diperlukan")
	}
	if utf8.RuneCountInString(reason) > 4000 {
		return web.Fail(422, "Alasan terlalu panjang")
	}
	in.Reason = reason
	return nil
}

func ValidateDispatch(in *api.DispatchInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if !web.UUID(in.TeamID) {
		return web.Fail(422, "ID tim tidak valid")
	}
	if !web.UUID(in.AssigneeID) {
		return web.Fail(422, "ID teknisi tidak valid")
	}
	if in.ProposalVersion < 1 {
		return web.Fail(422, "Versi proposal tidak valid")
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if !Text(in.Reason, 4000) {
		return web.Fail(422, "Catatan penugasan/disposisi diperlukan")
	}
	return nil
}

func ValidateReject(in *api.RejectInput) (string, error) {
	if in.ExpectedVersion < 1 {
		return "", web.Fail(422, "Versi tiket diperlukan")
	}
	reason := strings.TrimSpace(in.RejectionReason)
	if reason == "" {
		reason = strings.TrimSpace(in.Reason)
	}
	if reason == "" {
		return "", web.Fail(400, "Alasan penolakan wajib disertakan")
	}
	if utf8.RuneCountInString(reason) > 4000 {
		return "", web.Fail(422, "Alasan penolakan terlalu panjang")
	}
	return reason, nil
}

func ValidateResolution(in *api.ResolutionInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	summary := strings.TrimSpace(in.Summary)
	if summary == "" {
		summary = strings.TrimSpace(in.ActionNotes)
	}
	if summary == "" || utf8.RuneCountInString(summary) < 5 {
		return web.Fail(400, "Uraian perbaikan/resolusi wajib disertakan (minimal 5 karakter)")
	}
	if utf8.RuneCountInString(summary) > 4000 {
		return web.Fail(422, "Uraian resolusi terlalu panjang")
	}
	in.Summary = summary
	return nil
}

func ValidateConfirmation(in *api.ConfirmationInput) error {
	if in.ExpectedVersion < 1 || (in.AttemptID != "" && !web.UUID(in.AttemptID)) {
		return web.Fail(422, "Versi tiket atau ID upaya tidak valid")
	}
	decision := strings.ToUpper(strings.TrimSpace(in.Decision))
	if decision != "ACCEPT" && decision != "REJECT" && decision != "FEEDBACK" {
		return web.Fail(422, "Keputusan konfirmasi tidak valid; harus ACCEPT, REJECT, atau FEEDBACK")
	}
	if decision == "REJECT" {
		reason := strings.TrimSpace(in.RejectionReason)
		if reason == "" {
			reason = strings.TrimSpace(in.Reason)
		}
		if reason == "" || utf8.RuneCountInString(reason) < 5 {
			return web.Fail(400, "Alasan penolakan wajib disertakan (minimal 5 karakter)")
		}
		if utf8.RuneCountInString(reason) > 4000 {
			return web.Fail(422, "Alasan penolakan terlalu panjang")
		}
		in.RejectionReason = reason
		in.Reason = reason
	} else if decision == "FEEDBACK" {
		feedback := strings.TrimSpace(in.Feedback)
		if feedback == "" {
			feedback = strings.TrimSpace(in.Reason)
		}
		if feedback == "" {
			return web.Fail(400, "Tanggapan/feedback pemohon wajib disertakan")
		}
		if utf8.RuneCountInString(feedback) > 4000 {
			return web.Fail(422, "Tanggapan terlalu panjang")
		}
		in.Feedback = feedback
	}
	in.Decision = decision
	return nil
}

func ValidateAutoClose(in *api.AutoCloseInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if !web.UUID(in.AttemptID) {
		return web.Fail(422, "ID attempt tidak valid")
	}
	return nil
}

func ValidateVendorCase(in *api.VendorCaseInput, now time.Time) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if !web.UUID(in.VendorID) {
		return web.Fail(422, "ID vendor tidak valid")
	}
	if !web.UUID(in.InternalPICID) {
		return web.Fail(422, "PIC internal wajib disertakan dan harus berupa UUID valid")
	}
	if in.ExternalReference == "" && in.ReferenceNo != "" {
		in.ExternalReference = in.ReferenceNo
	}
	in.ExternalReference = strings.TrimSpace(in.ExternalReference)
	if in.ExternalReference == "" || utf8.RuneCountInString(in.ExternalReference) < 3 {
		return web.Fail(400, "Nomor tiket/referensi eksternal vendor diperlukan (minimal 3 karakter)")
	}
	if in.ContractReference == "" {
		if in.Summary != "" {
			in.ContractReference = in.Summary
		} else {
			in.ContractReference = "KONTRAK-" + in.ExternalReference
		}
	}
	in.ContractReference = strings.TrimSpace(in.ContractReference)
	if in.ContractReference == "" || utf8.RuneCountInString(in.ContractReference) < 3 {
		return web.Fail(400, "Nomor kontrak/garansi vendor diperlukan (minimal 3 karakter)")
	}
	if in.ExpectedReturnAt == nil || in.ExpectedReturnAt.IsZero() {
		future := now.Add(24 * time.Hour)
		in.ExpectedReturnAt = &future
	} else if !in.ExpectedReturnAt.After(now) {
		return web.Fail(400, "Estimasi waktu kembali harus waktu di masa depan")
	}
	if in.NextFollowupAt == nil || in.NextFollowupAt.IsZero() {
		future := now.Add(4 * time.Hour)
		in.NextFollowupAt = &future
	} else if !in.NextFollowupAt.After(now) {
		return web.Fail(400, "Jadwal tindak lanjut PIC harus waktu di masa depan")
	}
	return nil
}

func ValidatePause(in *api.PauseInput, now time.Time) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if in.PolicyVersion < 1 {
		in.PolicyVersion = 1
	}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" || utf8.RuneCountInString(reason) < 5 {
		return web.Fail(400, "Alasan jeda layanan wajib disertakan (minimal 5 karakter)")
	}
	if in.Until == nil || in.Until.IsZero() {
		dur := 60
		if in.DurationMinutes > 7*24*60 {
			return web.Fail(422, "Jeda lab maksimal tujuh hari")
		}
		if in.DurationMinutes > 0 {
			dur = in.DurationMinutes
		}
		future := now.Add(time.Duration(dur) * time.Minute)
		in.Until = &future
	} else if !in.Until.After(now) {
		return web.Fail(400, "Batas waktu jeda layanan harus waktu di masa depan")
	}
	if in.Until.Sub(now) > 7*24*time.Hour {
		return web.Fail(422, "Jeda lab maksimal tujuh hari")
	}
	in.Reason = reason
	return nil
}

func ValidateHandoff(in *api.HandoffInput, currentOwnerOrg string) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	if !web.UUID(in.TargetOrgID) {
		return web.Fail(422, "ID OPD tujuan tidak valid")
	}
	if !web.UUID(in.TargetTeamID) {
		return web.Fail(422, "ID tim tujuan tidak valid")
	}
	if in.TargetOrgID == currentOwnerOrg {
		return web.Fail(400, "OPD tujuan transfer harus berbeda dengan OPD pemilik tiket saat ini")
	}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" || utf8.RuneCountInString(reason) < 5 {
		return web.Fail(400, "Alasan transfer handoff wajib disertakan (minimal 5 karakter)")
	}
	in.Reason = reason
	return nil
}

func ValidateAcceptHandoff(in *api.AcceptHandoffInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" {
		reason = "Handoff diterima oleh OPD tujuan"
	}
	in.Reason = reason
	return nil
}

func ValidateEscalate(in *api.EscalateInput) error {
	if in.ExpectedVersion < 1 {
		return web.Fail(422, "Versi tiket diperlukan")
	}
	level := strings.ToUpper(strings.TrimSpace(in.Level))
	if level != "L2" && level != "COORDINATOR" && level != "LEADERSHIP" {
		return web.Fail(422, "Level eskalasi tidak valid; harus L2, COORDINATOR, atau LEADERSHIP")
	}
	in.Level = level
	reason := strings.TrimSpace(in.Reason)
	if reason == "" || utf8.RuneCountInString(reason) < 5 {
		return web.Fail(400, "Alasan eskalasi wajib disertakan (minimal 5 karakter)")
	}
	in.Reason = reason
	return nil
}
