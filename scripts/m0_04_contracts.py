"""M0-04 intake wire contract. Runtime status is enabled only on completed operations."""
COMMANDS={'ReadReportingCategories','CreateTicket','ListTickets','ReadTicket','ListTicketHistory','ListComments','AddComment','UploadTicketAttachment','DownloadTicketAttachment','ListTicketAttachments','ExchangeGuestCapability','ReadTrackingSession','LogoutTrackingSession','RevokeGuestCapability'}
def extend(s,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION):
    s['TicketCreate']['properties'].update(service_version=VERSION,policy_version=VERSION)
    s['TicketCreate']['properties'].update(reporting_org_id=UUID,reporting_division_id=UUID,reported_category_id=UUID)
    s['Ticket']['properties']['reporting_context']={'$ref':'#/components/schemas/ReportingContext'}
    s['Ticket']['properties']['reported_category']={'$ref':'#/components/schemas/DirectoryEntry'}
    s['ReportingCategories']=obj({'items':arr({'$ref':'#/components/schemas/DirectoryEntry'}),'suggested_id':{'type':['string','null'],'format':'uuid'}})
    operation('get','/reporting/services/{id}/categories','ReadReportingCategories','M3','catalog.read','ReportingCategories',fr='FR11 FR24',public=True)
    s['TicketCreate']['required']+=['service_version','policy_version']
    s['TicketCreate']['properties']['answers']={'type':'object','maxProperties':100,'additionalProperties':{'type':'string','maxLength':4000}}
    s['Ticket']['properties'].update(form_version=VERSION,resolution_due_at=UTC,calendar_version=TEXT,answers={'type':'object','additionalProperties':{'type':'string'}},classification={'type':'object','properties':{'category':TEXT,'confidence':{'type':'number','minimum':0,'maximum':1},'explanation':TEXT,'classifier_version':TEXT},'required':['category','confidence','explanation','classifier_version'],'additionalProperties':False})
    s['Ticket']['required']+=['form_version','resolution_due_at','calendar_version','answers','classification']
    s['TrackingExchange']=obj({'csrf_token':TEXT})
    s['TrackingSession']=obj({'id':UUID,'version':VERSION,'ticket_id':UUID,'expires_at':UTC})
    s['HistoryEntry']=obj({'id':UUID,'version':VERSION,'action':TEXT,'summary':TEXT,'created_at':UTC})
    s['TicketAttachment']=obj({'id':UUID,'version':VERSION,'name':TEXT,'mime':enum('image/png','image/jpeg','application/pdf'),'size_bytes':{'type':'integer','minimum':1,'maximum':10485760},'status':enum('PENDING','QUARANTINED','CLEAN','REJECTED','MISSING'),'audience':enum('REQUESTER','INTERNAL'),'scan_detail':TEXT})
    operation('get','/tickets/{id}/attachments','ListTicketAttachments','M3','ticket.read','TicketAttachment',fr='FR19')
    operation('get','/guest/tracking-session','ReadTrackingSession','M3','ticket.read','TrackingSession',fr='FR29',public=True)
    operation('post','/guest/tracking-session/logout','LogoutTrackingSession','M3','ticket.read','Receipt','VersionedReason',fr='FR29',public=True)
    operation('post','/tickets/{id}/capability/revoke','RevokeGuestCapability','M3','ticket.read','Receipt','VersionedReason',fr='FR29',public=True)

def customize(entry,command,ref,VERSION):
    if command in ('ListComments','ListTicketHistory'):
        for param in entry['parameters']:
            if param['name']=='sort':param['schema']={'type':'string','enum':['created_asc' if command=='ListComments' else 'version_asc']}

    if command in ('CreateTicket','AddComment'):
        entry['responses']['201']['content']['application/json']['schema']=ref('Receipt')
        entry['responses']['201']['content']['application/json']['example']={'id':'00000000-0000-4000-8000-000000000001','version':1}
    if command in COMMANDS and command not in ('CreateTicket','ExchangeGuestCapability'):
        entry['security']=[{'SessionCookie':[]},{'GuestTracking':[]}]
    if command=='ExchangeGuestCapability':
        entry['requestBody']={'required':True,'content':{'application/json':{'schema':ref('TrackingExchange'),'example':{'csrf_token':'synthetic-nonce-placeholder'}}}}
        entry['responses']['201']={'description':'Tracking session cookie; never returns credential JSON','content':{'application/json':{'schema':ref('TrackingSession')}}}
    if command in ('ListTicketHistory','ListTicketAttachments'):
        entity='HistoryEntry' if command=='ListTicketHistory' else 'TicketAttachment'
        entry['responses']['200']['content']['application/json']['schema']={'type':'object','properties':{'items':{'type':'array','items':ref(entity)},'next_cursor':{'type':['string','null'],'format':'uuid'},'as_of':{'type':'string','format':'date-time'}},'required':['items','next_cursor','as_of'],'additionalProperties':False}
    if command in ('CreateTicket','ExchangeGuestCapability'):
        entry['parameters']=[p for p in entry['parameters'] if p['name']!='X-Guest-Capability']
        entry['parameters'].append({'name':'X-Guest-Capability','in':'header','required':False,'schema':{'type':'string','pattern':'^[a-f0-9]{64}$'},'description':'Sensitive 256-bit client-generated secret; redact logs, never URL/storage/draft.'})
    if command=='UploadTicketAttachment':
        entry['requestBody']={'required':True,'content':{'application/octet-stream':{'schema':{'type':'string','format':'binary','maxLength':10485760},'example':'synthetic-file-bytes'}}}
        entry['parameters'] += [{'name':'X-Expected-Version','in':'header','required':True,'schema':VERSION},{'name':'X-Filename','in':'header','required':True,'schema':{'type':'string','maxLength':200}},{'name':'X-File-Mime','in':'header','required':True,'schema':{'type':'string','enum':['image/png','image/jpeg','application/pdf']}},{'name':'X-Attachment-Audience','in':'header','required':True,'schema':{'type':'string','enum':['REQUESTER','INTERNAL']}}]
        entry['responses']['201']={'description':'Durable attachment receipt; scan may remain quarantined','content':{'application/json':{'schema':ref('Receipt')}}}
    if command=='DownloadTicketAttachment':
        entry['responses']['200']['content']={'application/octet-stream':{'schema':{'type':'string','format':'binary','maxLength':10485760},'example':'synthetic-clean-file-bytes'}}
