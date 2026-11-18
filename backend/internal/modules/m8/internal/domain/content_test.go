package domain

import (
	"testing"

	"helpdesk.local/m0/internal/modules/m8/api"
)

func TestValidateContentWriteFAQ(t *testing.T) {
	okOrder := 10
	badOrder := -1

	valid := api.ContentWriteInput{
		ExpectedVersion: 1,
		Title:           "Bagaimana cara melapor gangguan jaringan?",
		Slug:            "faq-melapor-jaringan",
		Body:            "Gunakan Katalog Layanan TIK lalu pilih layanan internet/intranet.",
		Audience:        "PUBLIC_GUEST",
		CategoryLabel:   "Jaringan & WiFi",
		SortOrder:       &okOrder,
	}
	if err := ValidateContentWrite(valid); err != nil {
		t.Fatalf("expected valid FAQ write input, got %v", err)
	}

	badCat := valid
	badCat.CategoryLabel = "<script>alert(1)</script>"
	if err := ValidateContentWrite(badCat); err == nil {
		t.Fatal("expected HTML tag in category_label to fail")
	}

	negOrder := valid
	negOrder.SortOrder = &badOrder
	if err := ValidateContentWrite(negOrder); err == nil {
		t.Fatal("expected negative sort_order to fail")
	}
}
