COMMANDS = {
    'ReadAuthConfig',
    'StartSSOLogin',
    'CompleteSSOCallback',
    'ListAdminSubjects',
    'CreateSubject',
    'UpdateSubject',
    'ReadPublicMaintenanceStatus',
    'ListMaintenanceWindows',
    'ListKnowledgeFAQs',
    'CreateKnowledgeFAQ',
    'ReadKnowledgeFAQ',
    'UpdateKnowledgeFAQ',
    'TransitionKnowledgeFAQ',
    'ListDeliveryJobs',
    'ReplayDeliveryJob',
    'ConfigureRetention',
}


def extend(schemas, operation, obj, arr, enum, ref, UUID, TEXT, UTC, VERSION):
    null_date = {'type': ['string', 'null'], 'format': 'date-time'}
    null_text = {'type': ['string', 'null'], 'maxLength': 120}
    nonneg = {'type': 'integer', 'minimum': 0}

    schemas['AuthConfig'] = obj(
        {
            'mode': enum('SYNTHETIC_LAB', 'PRODUCTION'),
            'csrf_token': TEXT,
            'lab_auth_enabled': {'type': 'boolean'},
            'public_auth_enabled': {'type': 'boolean'},
            'sso_enabled': {'type': 'boolean'},
            'sso_provider_label': TEXT,
            'sso_login_url': TEXT,
            'purge_enabled': {'type': 'boolean'},
            'subjects': arr(ref('Subject')),
        },
        optional=('subjects',),
    )
    schemas['SSORedirect'] = obj({'location': TEXT})
    schemas['DeliveryJobRecord'] = obj(
        {
            'id': UUID,
            'version': VERSION,
            'notification_id': UUID,
            'title': TEXT,
            'channel': enum('SINK', 'TELEGRAM', 'EMAIL'),
            'target_masked': TEXT,
            'state': enum('PENDING', 'LEASED', 'ACKED', 'FAILED', 'DEAD_LETTER'),
            'attempts': nonneg,
            'last_error_code': null_text,
            'next_attempt_at': UTC,
            'delivered_at': null_date,
            'created_at': UTC,
        },
        optional=('last_error_code', 'delivered_at'),
    )
    schemas['RetentionInput'] = obj(
        {
            'expected_version': VERSION,
            'legal_hold': {'type': 'boolean'},
            'retention_until': null_date,
            'reason': TEXT,
        },
        optional=('retention_until',),
    )
    schemas['RetentionStatus'] = obj(
        {
            'ticket_id': UUID,
            'version': VERSION,
            'legal_hold': {'type': 'boolean'},
            'retention_until': null_date,
            'purged_at': null_date,
        },
        optional=('retention_until', 'purged_at'),
    )
    schemas['TelegramBinding'] = obj(
        {
            'expected_version': VERSION,
            'verification_code': {**TEXT, 'maxLength': 128},
            'scope_org_id': UUID,
            'channel': enum('SINK', 'TELEGRAM'),
            'chat_ref': {**TEXT, 'maxLength': 64},
        },
        optional=('chat_ref',),
    )
    schemas['Session']['properties']['mode'] = TEXT
    schemas['Subject']['properties'].update({
        'version': VERSION,
        'external_ref': null_text,
        'email': {'type': ['string', 'null'], 'maxLength': 200},
        'phone': {'type': ['string', 'null'], 'maxLength': 40},
        'active': {'type': 'boolean'},
    })
    schemas['SubjectWrite'] = obj(
        {
            'expected_version': VERSION,
            'name': {**TEXT, 'minLength': 2, 'maxLength': 200},
            'kind': enum('PUBLIC', 'ASN', 'STAFF'),
            'role': {**TEXT, 'minLength': 1, 'maxLength': 64},
            'external_ref': {'type': 'string', 'maxLength': 120},
            'email': {'type': 'string', 'maxLength': 200},
            'phone': {'type': 'string', 'maxLength': 40},
            'password': {'type': 'string', 'maxLength': 128},
            'active': {'type': 'boolean'},
        },
        optional=('expected_version', 'external_ref', 'email', 'phone', 'password'),
    )
    schemas['Maintenance']['properties']['mode'] = enum('READ_ONLY', 'DRAIN', 'NORMAL')
    schemas['Maintenance']['properties'].update({
        'schedule_kind': enum('SCHEDULED', 'UNSCHEDULED'),
        'display_mode': enum('BANNER', 'FULL_SCREEN'),
        'target_id': UUID,
    })
    schemas['MaintenanceWindow'] = obj(
        {
            'id': UUID,
            'version': VERSION,
            'org_id': {'type': ['string', 'null'], 'format': 'uuid'},
            'mode': enum('READ_ONLY', 'DRAIN', 'NORMAL'),
            'schedule_kind': enum('SCHEDULED', 'UNSCHEDULED'),
            'display_mode': enum('BANNER', 'FULL_SCREEN'),
            'starts_at': UTC,
            'ends_at': UTC,
            'message': TEXT,
            'created_at': UTC,
            'updated_at': UTC,
        },
        optional=('org_id',),
    )
    schemas['PublicMaintenanceStatus'] = obj(
        {
            'active': {'anyOf': [{'$ref': '#/components/schemas/MaintenanceWindow'}, {'type': 'null'}]},
            'upcoming': arr({'$ref': '#/components/schemas/MaintenanceWindow'}),
            'observed_at': UTC,
        }
    )
    schemas['AdminMaintenanceOverview'] = obj(
        {
            'active': {'anyOf': [{'$ref': '#/components/schemas/MaintenanceWindow'}, {'type': 'null'}]},
            'upcoming': arr({'$ref': '#/components/schemas/MaintenanceWindow'}),
            'recent': arr({'$ref': '#/components/schemas/MaintenanceWindow'}),
            'observed_at': UTC,
        }
    )
    schemas['Content']['properties'].update({
        'kind': enum('ARTICLE', 'PAGE', 'FAQ'),
        'category_label': {'type': 'string', 'maxLength': 80},
        'sort_order': {'type': 'integer', 'minimum': 0, 'maximum': 9999},
    })
    schemas['ContentWrite']['properties'].update({
        'category_label': {'type': 'string', 'maxLength': 80},
        'sort_order': {'type': 'integer', 'minimum': 0, 'maximum': 9999},
    })
    schemas['SearchHit']['properties']['kind'] = enum('SERVICE', 'TICKET', 'ARTICLE', 'PAGE', 'FAQ', 'MEDIA')

    operation('get', '/auth/config', 'ReadAuthConfig', 'M1', 'session.create', 'AuthConfig', fr='FR29', public=True)
    operation('get', '/auth/sso/login', 'StartSSOLogin', 'M1', 'session.create', 'SSORedirect', status=302, fr='FR29', public=True)
    operation(
        'get',
        '/auth/sso/callback',
        'CompleteSSOCallback',
        'M1',
        'session.create',
        'SSORedirect',
        status=303,
        fr='FR29',
        public=True,
        query=('code', 'state', 'error'),
    )
    operation('get', '/admin/subjects', 'ListAdminSubjects', 'M1', 'identity.grant', 'Subject', fr='FR17 FR29', query=('include_inactive',))
    operation('post', '/admin/subjects', 'CreateSubject', 'M1', 'identity.grant', 'Receipt', 'SubjectWrite', status=201, fr='FR17 FR29')
    operation('put', '/admin/subjects/{id}', 'UpdateSubject', 'M1', 'identity.grant', 'Receipt', 'SubjectWrite', fr='FR17 FR29')
    operation(
        'get',
        '/admin/delivery-jobs',
        'ListDeliveryJobs',
        'M9',
        'operation.read|system.job',
        'DeliveryJobRecord',
        fr='FR18 FR21',
        query=('state',),
    )
    operation(
        'post',
        '/admin/delivery-jobs/{id}/replay',
        'ReplayDeliveryJob',
        'M9',
        'operation.read|system.job',
        'DeliveryJobRecord',
        'VersionedReason',
        fr='FR18 FR21',
    )
    operation('get', '/maintenance/status', 'ReadPublicMaintenanceStatus', 'M1', 'catalog.read', 'PublicMaintenanceStatus', fr='FR18', public=True)
    operation('get', '/admin/maintenance', 'ListMaintenanceWindows', 'M1', 'system.maintenance', 'AdminMaintenanceOverview', fr='FR18', query=('organization_id',))
    operation('get', '/knowledge/faqs', 'ListKnowledgeFAQs', 'M8', 'content.read', 'Content', fr='FR05 FR12 FR18', public=True, query=('view', 'q'))
    operation('get', '/knowledge/faqs/{id}', 'ReadKnowledgeFAQ', 'M8', 'content.read', 'Content', fr='FR05 FR12 FR18', public=True, query=('view',))
    operation('post', '/knowledge/faqs', 'CreateKnowledgeFAQ', 'M8', 'content.write', 'Content', 'ContentWrite', 201, 'FR05 FR12 FR18')
    operation('put', '/knowledge/faqs/{id}', 'UpdateKnowledgeFAQ', 'M8', 'content.write', 'Content', 'ContentWrite', fr='FR05 FR12 FR18')
    operation('post', '/knowledge/faqs/{id}/transitions', 'TransitionKnowledgeFAQ', 'M8', 'content.publish', 'Content', 'EditorialTransition', fr='FR05 FR12 FR18')
    operation(
        'post',
        '/tickets/{id}/retention',
        'ConfigureRetention',
        'M3',
        'ticket.archive',
        'RetentionStatus',
        'RetentionInput',
        fr='FR22',
    )
