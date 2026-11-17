"""M0-05 verification and dispatch wire contract. Runtime status is enabled only on completed operations."""
COMMANDS = {'ListHandoffTargets', 'VerifyTicket', 'DispatchTicket', 'RejectTicket', 'TransitionTicket', 'ReadDispatchProposal', 'ReadVerificationCategories','ReassignTicket','ReadRoutingRule','WriteRoutingRule'}

def extend(s, operation, obj, arr, enum, UUID, TEXT, UTC, VERSION):
    s['Ticket']['properties'].update(
        handling_team_id={'type': ['string', 'null'], 'format': 'uuid'},
        assignee_id={'type': ['string', 'null'], 'format': 'uuid'}
    )
    s['Ticket']['properties'].update(
        episode_id=UUID, active_attempt_id=UUID, reopen_until=UTC,
        classification_decision=obj({'category_id':UUID,'category_name':TEXT,'priority':enum('LOW','NORMAL','HIGH','CRITICAL'),'verified_by':UUID,'verified_at':UTC})
    )
    s['Ticket']['properties']['classification']['properties'].update(category_id=UUID, priority=TEXT,rule_version=VERSION)
    s['Verification']['required'].remove('evidence_digest')
    s['Verification']['properties']['evidence_digest']['deprecated'] = True
    s['Dispatch']['properties'].update(tier=enum('L1','L2'),proposal_digest={'type':'string','pattern':'^[a-f0-9]{64}$'})
    roster=obj({'id':UUID,'version':VERSION,'subject_id':UUID,'team_id':UUID,'skills':arr(TEXT),'available_from':UTC,'available_until':UTC,'active_tickets':{'type':'integer','minimum':0}})
    roster['properties']['projection_as_of']=UTC
    s['DispatchProposal']=obj({'ticket_id':UUID,'ticket_version':VERSION,'status':enum('RECOMMENDED','MANUAL'),'assignee_id':{'type':'string'},'team_id':{'type':'string'},'level':enum('L1','L2'),'digest':{'type':'string'},'explanation':TEXT,'candidates':arr(obj({'roster':roster,'name':TEXT}))})
    s['DispatchProposal']['properties'].update(projection_as_of=UTC,target_org_id=UUID,destination=TEXT)
    s['DispatchProposal']['properties']['status']=enum('RECOMMENDED','MANUAL','HANDOFF')
    operation('get','/tickets/{id}/dispatch-proposal','ReadDispatchProposal','M3','ticket.dispatch','DispatchProposal',fr='FR24',query=('tier','mode'))
    s['VerificationCategories'] = arr(obj({'id':UUID,'name':TEXT,'code':TEXT,'active':{'type':'boolean'},'version':VERSION,'owner_org_id':UUID}))
    operation('get','/tickets/{id}/verification-categories','ReadVerificationCategories','M3','ticket.verify','VerificationCategories',fr='FR24')
    operation('post','/tickets/{id}/reassign','ReassignTicket','M3','ticket.dispatch','Ticket','Dispatch',fr='FR24')
    s['RoutingRule'] = obj({'id':UUID,'version':VERSION,'service_id':UUID,'team_id':UUID,'level':enum('L1','L2'),'required_skills':arr(TEXT),'active':{'type':'boolean'}})
    s['RoutingRule']['properties'].update(category_id=UUID,target_org_id=UUID)
    s['RoutingInput'] = obj({'expected_version':{'type':'integer','minimum':0},'team_id':UUID,'required_skills':arr(TEXT),'active':{'type':'boolean'},'reason':TEXT})
    s['RoutingInput']['properties']['target_org_id']=UUID
    operation('get','/admin/services/{id}/routing/{tier}','ReadRoutingRule','M5','rules.write + catalog.write','RoutingRule',fr='FR24')
    operation('put','/admin/services/{id}/routing/{tier}','WriteRoutingRule','M5','rules.write + catalog.write','RoutingRule','RoutingInput',fr='FR24')
    operation('get','/tickets/{id}/handoff-targets','ListHandoffTargets','M3','ticket.handoff','DirectoryEntry',fr='FR24')
    s['Rejection'] = obj({'expected_version': VERSION, 'rejection_reason': TEXT})
    operation('post', '/tickets/{id}/reject', 'RejectTicket', 'M3', 'ticket.verify', 'Receipt', 'Rejection', fr='FR24')

def customize(entry, command, ref, VERSION):
    if command in COMMANDS and command != 'TransitionTicket':
        entry['security'] = [{'SessionCookie': []}]
    if command == 'RejectTicket':
        entry['responses']['200'] = {
            'description': 'Durable primary result; ticket cancelled',
            'content': {'application/json': {'schema': ref('Receipt')}}
        }
