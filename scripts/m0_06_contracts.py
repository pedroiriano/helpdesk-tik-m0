"""M0-06 SLA, resolution, and confirmation wire contract."""
COMMANDS = {'ResolveTicket', 'ConfirmResolution', 'AcceptResolution', 'ReadTicketSLA'}

def extend(s, operation, obj, arr, enum, UUID, TEXT, UTC, VERSION):
    s['ResolveReceipt']=obj({'id':UUID,'version':VERSION,'state':enum('RESOLVED'),'active_attempt_id':UUID})
    s['ConfirmReceipt']=obj({'id':UUID,'version':VERSION,'state':enum('CLOSED','RESOLVED','IN_PROGRESS'),'decision':enum('ACCEPT','REJECT','FEEDBACK')})
    s['ResolutionCreate']=obj({'expected_version':VERSION,'summary':TEXT})
    s['ResolutionCreate']['properties']['action_notes']=TEXT
    s['Confirmation']['required']=['expected_version','attempt_id','decision']
    s['Confirmation']['properties'].update(feedback=TEXT,rejection_reason=TEXT)

def customize(entry, command, ref, VERSION):
    if command in COMMANDS:
        pass
