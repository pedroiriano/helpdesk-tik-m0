"""Fase 2 (RM0-05) operational completion, scheduler listing, staff directory, and rule configuration contracts."""

COMMANDS = {
    'BulkTicketCommand',
    'RecordWorkLog',
    'ConfigureClassification',
    'ConfigureRouting',
    'ConfigureSla',
    'ConfigureEscalation',
    'ListHandoffs',
    'RejectHandoff',
    'CancelHandoff',
    'ReadOperationalRecords',
    'CloseVendorCase',
    'ResumePause',
    'ListTicketSchedulerJobs',
    'ListAdminSchedulerJobs',
    'ListStaffDirectory',
    'ListAdminOperations',
    'ListMediaApprovals',
    'ListClassificationRules',
    'ListRoutingRules',
    'ListSlaRules',
    'ListEscalationRules',
}


def extend(s, operation, obj, arr, enum, ref, UUID, TEXT, UTC, VERSION):
    s['RuleView'] = obj({
        'id': UUID,
        'owner': TEXT,
        'code': TEXT,
        'version': VERSION,
        'rule_version': VERSION,
        'active': {'type': 'boolean'},
        'summary': TEXT,
    })
    s['RuleList'] = obj({'items': arr(ref('RuleView'))})
    s['HandoffSummary'] = obj({
        'id': UUID,
        'version': VERSION,
        'direction': enum('INCOMING', 'OUTGOING'),
        'ticket_id': UUID,
        'ticket_number': TEXT,
        'ticket_title': TEXT,
        'ticket_version': VERSION,
        'from_org_id': UUID,
        'target_org_id': UUID,
        'target_team_id': UUID,
        'requested_by': UUID,
        'reason': TEXT,
        'state': enum('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'),
        'response_reason': TEXT,
        'responded_at': UTC,
        'created_at': UTC,
    }, optional=('direction', 'ticket_number', 'ticket_title', 'response_reason', 'responded_at'))
    s['HandoffList'] = obj({'items': arr(ref('HandoffSummary'))})
    s['VendorCaseRecord'] = obj({
        'id': UUID,
        'version': VERSION,
        'ticket_id': UUID,
        'vendor_id': UUID,
        'internal_pic_id': UUID,
        'external_reference': TEXT,
        'contract_reference': TEXT,
        'expected_return_at': UTC,
        'next_followup_at': UTC,
        'state': enum('OPEN', 'CLOSED'),
        'closed_at': UTC,
        'resolution_note': TEXT,
        'created_at': UTC,
    }, optional=('closed_at', 'resolution_note'))
    s['PauseRecord'] = obj({
        'id': UUID,
        'version': VERSION,
        'starts_at': UTC,
        'ends_at': UTC,
        'approved_by': UUID,
        'policy_version': VERSION,
        'reason': TEXT,
        'resumed_early_at': UTC,
        'resume_reason': TEXT,
    }, optional=('resumed_early_at', 'resume_reason'))
    s['WorkLogRecord'] = obj({
        'id': UUID,
        'version': VERSION,
        'ticket_id': UUID,
        'actor_id': UUID,
        'started_at': UTC,
        'ended_at': UTC,
        'summary': TEXT,
        'created_at': UTC,
    })
    s['OperationalRecords'] = obj({
        'vendor_cases': arr(ref('VendorCaseRecord')),
        'pauses': arr(ref('PauseRecord')),
        'handoffs': arr(ref('HandoffSummary')),
        'work_logs': arr(ref('WorkLogRecord')),
    })
    s['SchedulerJobView'] = obj({
        'id': UUID,
        'ticket_id': UUID,
        'kind': TEXT,
        'state': enum('PENDING', 'LEASED', 'ACKED', 'DEAD_LETTER'),
        'version': VERSION,
        'expected_version': VERSION,
        'attempts': {'type': 'integer', 'minimum': 0},
        'due_at': UTC,
        'retry_at': UTC,
        'last_error_code': TEXT,
        'attempt_id': UUID,
        'updated_at': UTC,
    }, optional=('retry_at', 'last_error_code', 'attempt_id'))
    s['SchedulerJobList'] = obj({'items': arr(ref('SchedulerJobView'))})
    s['StaffDirectoryEntry'] = obj({'id': UUID, 'name': TEXT, 'kind': TEXT, 'role': TEXT})
    s['StaffDirectoryList'] = obj({'items': arr(ref('StaffDirectoryEntry'))})
    s['SystemJobList'] = obj({'items': arr(ref('SystemJobResult'))})
    s['MediaApprovalItem'] = obj({
        'id': UUID,
        'version': VERSION,
        'source_id': UUID,
        'source_owner': enum('M3', 'M8'),
        'copy_id': UUID,
        'target_id': UUID,
        'target_audience': TEXT,
        'organization_id': UUID,
        'approved_by': UUID,
        'reason': TEXT,
        'expires_at': UTC,
        'used_at': UTC,
        'revoked_at': UTC,
        'created_at': UTC,
    }, optional=('used_at', 'revoked_at'))
    s['MediaApprovalList'] = obj({'items': arr(ref('MediaApprovalItem'))})

    operation('get', '/handoffs', 'ListHandoffs', 'M3', 'ticket.handoff.accept', 'HandoffList', fr='FR28')
    operation('post', '/tickets/{id}/handoffs/{handoff_id}/reject', 'RejectHandoff', 'M3', 'ticket.handoff.accept', 'Ticket', 'VersionedReason', fr='FR28')
    operation('post', '/tickets/{id}/handoffs/{handoff_id}/cancel', 'CancelHandoff', 'M3', 'ticket.handoff', 'Ticket', 'VersionedReason', fr='FR28')
    operation('get', '/tickets/{id}/operational-records', 'ReadOperationalRecords', 'M3', 'ticket.read', 'OperationalRecords', fr='FR25 FR27')
    operation('post', '/tickets/{id}/vendor-cases/{case_id}/close', 'CloseVendorCase', 'M3', 'ticket.vendor', 'Receipt', 'VersionedReason', fr='FR27')
    operation('post', '/tickets/{id}/pauses/{pause_id}/resume', 'ResumePause', 'M3', 'ticket.pause', 'Receipt', 'VersionedReason', fr='FR27')
    operation('get', '/tickets/{id}/scheduler-jobs', 'ListTicketSchedulerJobs', 'M7', 'system.job', 'SchedulerJobList', fr='FR17')
    operation('get', '/admin/scheduler-jobs', 'ListAdminSchedulerJobs', 'M7', 'system.job', 'SchedulerJobList', fr='FR17')
    operation('get', '/staff/directory', 'ListStaffDirectory', 'M1', 'ticket.read', 'StaffDirectoryList', fr='FR27')
    operation('get', '/admin/operations', 'ListAdminOperations', 'M1', 'operation.read', 'SystemJobList', fr='FR18')
    operation('get', '/media/approvals', 'ListMediaApprovals', 'M8', 'media.reuse', 'MediaApprovalList', fr='FR19')
    for owner, suffix, fr in (('M4', 'classification', 'FR14'), ('M5', 'routing', 'FR15'), ('M6', 'sla', 'FR16'), ('M7', 'escalation', 'FR17')):
        operation('get', '/admin/' + suffix + '-rules', 'List' + suffix.title() + 'Rules', owner, 'rules.write', 'RuleList', fr=fr)
