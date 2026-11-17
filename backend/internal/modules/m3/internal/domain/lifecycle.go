package domain

import "helpdesk.local/m0/internal/platform/web"

// LifecycleNext only handles actions whose inputs do not carry an assignment or resolution.
func LifecycleNext(action, state string) (string, error) {
	switch action {
	case "REQUEST_INFORMATION":
		if state == "OPEN" || state == "TRIAGED" {
			return "NEEDS_INFORMATION", nil
		}
	case "SUPPLY_INFORMATION":
		if state == "NEEDS_INFORMATION" {
			return "OPEN", nil
		}
	case "START":
		if state == "ASSIGNED" {
			return "IN_PROGRESS", nil
		}
	case "CANCEL":
		if state == "OPEN" || state == "TRIAGED" || state == "NEEDS_INFORMATION" {
			return "CANCELLED", nil
		}
	case "REOPEN":
		if state == "CLOSED" {
			return "OPEN", nil
		}
	default:
		return "", web.Fail(422, "Tindakan lifecycle tidak dikenal")
	}
	return "", web.Fail(409, "Status tiket berubah atau tidak mendukung tindakan ini. Muat ulang detail tiket")
}
