// Code generated from contracts/policy/permissions.v1.json; DO NOT EDIT.
package domain

var RolePermissions = map[string][]string{
	"GUEST":              {"ticket.create", "ticket.read", "ticket.comment", "ticket.attach", "ticket.confirm", "ticket.transition", "draft.read", "draft.write", "media.read", "media.write", "operation.read"},
	"PUBLIC":             {"session.read", "session.revoke", "ticket.create", "ticket.read", "ticket.comment", "ticket.attach", "ticket.confirm", "ticket.transition", "draft.read", "draft.write", "media.read", "media.write", "media.reuse", "notification.read", "notification.binding", "operation.read"},
	"ASN":                {"session.read", "session.revoke", "ticket.create", "ticket.read", "ticket.comment", "ticket.attach", "ticket.confirm", "ticket.transition", "draft.read", "draft.write", "media.read", "media.write", "notification.read", "operation.read", "notification.binding"},
	"OPERATOR":           {"ticket.read", "ticket.verify", "ticket.dispatch", "ticket.comment", "ticket.attach", "ticket.transition", "operation.read", "media.read", "ticket.bulk"},
	"TECHNICIAN":         {"ticket.read", "ticket.resolve", "ticket.comment", "ticket.attach", "ticket.transition", "ticket.vendor", "ticket.escalate", "operation.read", "media.read", "ticket.worklog"},
	"COORDINATOR":        {"ticket.read", "ticket.dispatch", "ticket.transition", "ticket.comment", "ticket.pause", "ticket.handoff", "ticket.handoff.accept", "ticket.escalate", "report.read", "report.export", "operation.read", "ticket.bulk", "ticket.archive", "media.write", "media.reuse", "notification.read", "notification.binding"},
	"LEADERSHIP":         {"ticket.read", "ticket.escalate", "report.read", "report.export"},
	"ADMIN_OPD":          {"identity.grant", "catalog.write", "rules.write", "system.health", "notification.read", "notification.binding"},
	"PLATFORM_ADMIN":     {"identity.grant", "catalog.write", "rules.write", "system.maintenance", "system.job", "system.health", "identity.organization.create", "notification.read", "notification.binding"},
	"SUPER_ADMIN":        {"identity.grant", "catalog.write", "rules.write", "system.maintenance", "system.job", "system.health", "system.purge.request", "identity.organization.create", "notification.read", "notification.binding", "identity.role.manage", "media.read", "media.write", "media.reuse", "content.read", "content.write", "content.publish", "hero.write", "hero.publish"},
	"EDITOR":             {"content.read", "content.write", "media.read", "media.write", "media.reuse", "draft.read", "draft.write", "hero.write"},
	"PUBLISHER":          {"content.read", "content.write", "content.publish", "media.read", "media.reuse", "hero.publish"},
	"AUDITOR":            {"audit.read", "report.read", "report.export"},
	"AUTO_CLOSE_SERVICE": {"ticket.auto_close"},
	"VENDOR":             {},
}
