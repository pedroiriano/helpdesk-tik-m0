COMMANDS = {
    'ReadAuthConfig',
    'StartSSOLogin',
    'CompleteSSOCallback',
    'ListAdminSubjects',
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
    operation('get', '/admin/subjects', 'ListAdminSubjects', 'M1', 'identity.grant', 'Subject', fr='FR17 FR29')
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
