"""Role module policy and Banner Hero wire contracts."""

COMMANDS = {'ReadRolePolicies','SetRoleModulePolicy','ReadAssignableRole','ReadHeroDraft',
            'ListHeroCandidates','SaveHeroDraft','PublishHero','ReadPublishedHero','ReadHeroImage'}


def extend(s, operation, obj, arr, ref, UUID, TEXT):
    revision = {'type':'integer','minimum':0}
    permissions = arr(TEXT)
    s['RolePolicy'] = obj({'role':TEXT,'version':revision,'permissions':permissions,
                           'available':permissions,'editable':{'type':'boolean'}})
    s['RolePolicies'] = obj({'items':arr(ref('RolePolicy'))})
    s['RolePolicyWrite'] = obj({'expected_version':revision,'permissions':permissions,'reason':TEXT})
    s['AssignableRole'] = obj({'permissions':permissions})
    s['HeroBanner'] = obj({'asset':TEXT,'media_id':UUID,'title':TEXT,'alt':TEXT},optional=('asset','media_id'))
    banners = {**arr(ref('HeroBanner')), 'maxItems':5}
    s['HeroState'] = obj({'version':revision,'published_version':revision,'draft':banners,'published':banners})
    s['PublishedHero'] = obj({'version':revision,'banners':banners})
    s['HeroCandidate'] = obj({'id':UUID,'alt':TEXT})
    s['HeroDraftWrite'] = obj({'expected_version':revision,'reason':TEXT,'banners':{**banners,'minItems':5}})
    s['HeroPublishWrite'] = obj({'expected_version':revision,'reason':TEXT})
    s['Upload']['properties']['hero_candidate'] = {'type':'boolean'}
    operation('get','/admin/role-policies','ReadRolePolicies','M1','identity.role.manage','RolePolicies',fr='FR29')
    operation('put','/admin/role-policies/{role}','SetRoleModulePolicy','M1','identity.role.manage','Receipt','RolePolicyWrite',fr='FR29')
    operation('get','/admin/assignable-role/{role}','ReadAssignableRole','M1','identity.grant','AssignableRole',fr='FR29')
    operation('get','/admin/hero','ReadHeroDraft','M8','hero.write|hero.publish','HeroState',fr='FR18 FR19')
    operation('get','/admin/hero/media','ListHeroCandidates','M8','hero.write|hero.publish','HeroCandidate',fr='FR19')
    operation('put','/admin/hero','SaveHeroDraft','M8','hero.write','Receipt','HeroDraftWrite',fr='FR18')
    operation('post','/admin/hero/publish','PublishHero','M8','hero.publish','Receipt','HeroPublishWrite',fr='FR18')
    operation('get','/portal/hero','ReadPublishedHero','M8','content.read','PublishedHero',fr='FR18',public=True)
    operation('get','/portal/hero/media/{id}','ReadHeroImage','M8','content.read','HeroCandidate',fr='FR19',public=True)


def customize(entry, command):
    if command=='ReadHeroImage':
        entry['parameters'].append({'name':'v','in':'query','required':True,'schema':{'type':'integer','minimum':1}})
        entry['responses']['200'] = {'description':'Active published Hero image', 'content':{
            mime:{'schema':{'type':'string','format':'binary'}} for mime in ('image/png','image/jpeg')}}
    if command in ('ReadPublishedHero','ReadHeroImage'):
        entry['security'] = [{}]
