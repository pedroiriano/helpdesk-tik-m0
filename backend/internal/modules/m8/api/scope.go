package api

// Scope contains live, server-authenticated grants. It is never request JSON.
type Scope struct {
	Kind        string
	Principal   string
	Orgs        []string
	Read        []string
	Write       []string
	Publish     []string
	MediaRead   []string
	MediaWrite  []string
	Reuse       []string
	HeroWrite   []string
	HeroPublish []string
}

func Contains(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

func ScopeValue(scopes []Scope) Scope {
	if len(scopes) != 1 {
		return Scope{}
	}
	return scopes[0]
}

func (s Scope) ReadContent(item ContentItem, audiences []string) bool {
	if item.State == "PUBLISHED" && Contains(audiences, item.Audience) && Contains(s.Audiences(), item.Audience) {
		return item.Audience == "PUBLIC_GUEST" || item.OrgID == nil || Contains(s.Orgs, *item.OrgID)
	}
	return item.OrgID != nil && Contains(s.Read, *item.OrgID) || item.OrgID == nil && item.PrincipalID == s.Principal && len(s.Read) > 0
}

func (s Scope) WriteContent(item ContentItem, publish bool) bool {
	grants := s.Write
	if publish {
		grants = s.Publish
	}
	return item.OrgID != nil && Contains(grants, *item.OrgID) || item.OrgID == nil && item.PrincipalID == s.Principal && len(grants) > 0
}

func (s Scope) ReadMedia(item MediaItem) bool {
	return item.Status == "CLEAN" && item.Visibility == "PUBLIC" || item.OrgID == nil && item.PrincipalID == s.Principal || item.OrgID != nil && (Contains(s.MediaRead, *item.OrgID) || item.PrincipalID == s.Principal && Contains(s.MediaWrite, *item.OrgID))
}

func (s Scope) Audiences() []string {
	if s.Principal != "" && len(s.Orgs) == 0 {
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH"}
	}
	switch s.Kind {
	case "STAFF":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH", "STAFF_ONLY"}
	case "ASN":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH", "ASN_AUTH"}
	case "PUBLIC":
		return []string{"PUBLIC_GUEST", "PUBLIC_AUTH"}
	default:
		return []string{"PUBLIC_GUEST"}
	}
}

func (s Scope) WriteMedia(item MediaItem) bool {
	return item.PrincipalID == s.Principal && item.OrgID != nil && Contains(s.MediaWrite, *item.OrgID)
}
