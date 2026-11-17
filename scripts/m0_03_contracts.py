"""M0-03 additive operations and concrete runtime DTOs; called by canonical builder."""
def extend(schemas,operation,obj,arr,enum,UUID,TEXT,UTC,VERSION):
    actor_membership=obj({'id':UUID,'organization_id':UUID,'organization_active':{'type':'boolean'},'team_id':{'type':['string','null'],'format':'uuid'},'permissions':arr(TEXT),'grant_ceiling':arr(TEXT)})
    subject=obj({'id':UUID,'name':TEXT,'kind':enum('PUBLIC','ASN','STAFF'),'role':TEXT})
    actor=obj({'subject_id':UUID,'name':TEXT,'kind':enum('PUBLIC','ASN','STAFF'),'role':TEXT,'memberships':arr(actor_membership)})
    schemas['Session']['properties'].update(actor=actor,mode=enum('SYNTHETIC_LAB','PUBLIC_AUTH_LAB'))
    schemas['Session']['required']+=['actor','mode']
    schemas['Bootstrap']=obj({'mode':{'type':'string','const':'SYNTHETIC_LAB'},'csrf_token':{'type':'string','pattern':'^[a-f0-9]{64}$'},'subjects':arr(subject)})
    schemas['Subject']=subject
    schemas['Organization']=obj({'id':UUID,'version':VERSION,'code':TEXT,'name':TEXT,'active':{'type':'boolean'}})
    schemas['OrganizationWrite']=obj({'expected_version':VERSION,'code':TEXT,'name':TEXT,'active':{'type':'boolean'}},optional=('expected_version',))
    schemas['Team']=obj({'id':UUID,'version':VERSION,'organization_id':UUID,'name':TEXT,'active':{'type':'boolean'}})
    schemas['TeamWrite']=obj({'expected_version':VERSION,'organization_id':UUID,'name':TEXT,'active':{'type':'boolean'}},optional=('expected_version',))
    schemas['Team']['properties']['division_id']=UUID
    schemas['TeamWrite']['properties']['division_id']={'oneOf':[UUID,{'type':'string','const':''}]}
    schemas['Membership']=obj({'id':UUID,'version':VERSION,'subject_id':UUID,'organization_id':UUID,'team_id':{'type':['string','null'],'format':'uuid'},'permissions':arr(TEXT),'expires_at':UTC,'revoked':{'type':'boolean'}})
    schemas['MembershipWrite']=obj({'expected_version':VERSION,'subject_id':UUID,'organization_id':UUID,'team_id':{'type':['string','null'],'format':'uuid'},'permissions':arr(TEXT),'expires_at':UTC,'revoked':{'type':'boolean'},'reason':TEXT},optional=('expected_version','team_id','revoked'))
    schemas['Category']=obj({'id':UUID,'version':VERSION,'code':TEXT,'name':TEXT,'owner_org_id':UUID,'active':{'type':'boolean'}})
    schemas['CategoryWrite']=obj({'expected_version':VERSION,'code':TEXT,'name':TEXT,'owner_org_id':UUID,'active':{'type':'boolean'}},optional=('expected_version',))
    for name in ('Service','ServiceWrite'):
        schemas[name]['properties']['category_id']={'type':['string','null'],'format':'uuid'}
        if name=='Service':schemas[name]['required'].append('category_id')
    schemas['Form']['properties']['form_version']=VERSION;schemas['Form']['required'].append('form_version')
    schemas['Policy']=obj({'id':UUID,'version':VERSION,'policy_version':VERSION,'upload_max_bytes':{'type':'integer','minimum':1,'maximum':10485760},'allowed_mime':arr(enum('image/png','image/jpeg','application/pdf')),'audience_org_ids':arr(UUID)})
    schemas['PolicyWrite']=obj({k:v for k,v in schemas['Policy']['properties'].items() if k not in ('id','version')}|{'expected_version':VERSION})
    operation('get','/auth/bootstrap','ReadLabBootstrap','M1','session.create','Bootstrap',fr='FR29',public=True)
    schemas['Organization']['properties']['reporting_visible']={'type':'boolean'}
    schemas['Organization']['required'].append('reporting_visible')
    schemas['OrganizationWrite']['properties']['reporting_visible']={'type':'boolean'}
    schemas['Division']=obj({'id':UUID,'version':VERSION,'organization_id':UUID,'name':TEXT,'active':{'type':'boolean'}})
    schemas['DivisionWrite']=obj({'expected_version':VERSION,'organization_id':UUID,'name':TEXT,'active':{'type':'boolean'}},optional=('expected_version',))
    directory_entry=obj({'id':UUID,'name':TEXT})
    schemas['DirectoryEntry']=directory_entry
    schemas['ReportingContext']=obj({'organization':directory_entry,'division':directory_entry,'verified':{'type':'boolean'}},optional=('division',))
    operation('get','/reporting/directory','ListReportingDirectory','M1','public directory or live ASN ticket.create','DirectoryEntry',fr='FR17 FR29',public=True)
    for plural,entity in [('organizations','Organization'),('divisions','Division'),('teams','Team'),('memberships','Membership')]:
        operation('get','/admin/'+plural,'List'+entity,'M1','identity.grant',entity,fr='FR17 FR29')
        if plural!='memberships':operation('post','/admin/'+plural,'Create'+entity,'M1','identity.organization.create' if plural=='organizations' else 'identity.grant','Receipt',entity+'Write',201,'FR17')
        operation('put','/admin/'+plural+'/{id}','Update'+entity,'M1','identity.grant','Receipt',entity+'Write',fr='FR17 FR29')
    operation('get','/admin/services','ListAdminServices','M2','catalog.write','Service',fr='FR17')
    operation('get','/admin/services/{id}','ReadAdminService','M2','catalog.write','Service',fr='FR17')
    operation('get','/admin/services/{id}/form','ReadAdminServiceForm','M2','catalog.write','Form',fr='FR11 FR17')
    operation('get','/admin/categories','ListCategories','M2','catalog.write','Category',fr='FR17')
    operation('post','/admin/categories','CreateCategory','M2','catalog.write','Category','CategoryWrite',201,'FR17')
    operation('put','/admin/categories/{id}','UpdateCategory','M2','catalog.write','Category','CategoryWrite',fr='FR17')
    for prefix,permission in [('catalog','catalog.read'),('admin','catalog.write')]:
        operation('get','/'+prefix+'/services/{id}/policy','Read'+prefix.title()+'ServicePolicy','M2',permission,'Policy',fr='FR11 FR17',public=prefix=='catalog')
    operation('put','/admin/services/{id}/policy','UpdateServicePolicy','M2','catalog.write','Policy','PolicyWrite',fr='FR11 FR17')


def type_source(schemas):
    def render(s):
        if 'oneOf' in s:return ' | '.join('('+render(v)+')' for v in s['oneOf'])
        if '$ref' in s:return 'Components['+repr(s['$ref'].split('/')[-1])+']'
        if 'const' in s:return repr(s['const']) if isinstance(s['const'],str) else str(s['const']).lower()
        if 'enum' in s:return ' | '.join(repr(v) for v in s['enum'])
        kind=s.get('type');types=kind if isinstance(kind,list) else [kind]
        if len(types)>1:return ' | '.join(render({**s,'type':t}) for t in types)
        if kind=='object':
            if 'properties' not in s:return 'Record<string, unknown>'
            return '{ '+ '; '.join(repr(k)+('' if k in s.get('required',[]) else '?')+': '+render(v) for k,v in s['properties'].items())+' }'
        if kind=='array':return '('+render(s['items'])+')[]'
        return {'string':'string','integer':'number','number':'number','boolean':'boolean','null':'null'}.get(kind,'unknown')
    return '// Generated from executable business schemas. Do not edit.\nexport interface Components {\n'+''.join('  '+repr(k)+': '+render(v)+';\n' for k,v in schemas.items())+'}\n'
