package api

const HeroOrganization = "10000000-0000-4000-8000-000000000001"
const HeroID = "80000000-0000-4000-8000-000000000035"

type DirectoryMedia struct {
	ID  string `json:"id"`
	Alt string `json:"alt"`
}

type HeroBanner struct {
	Asset   string `json:"asset,omitempty"`
	MediaID string `json:"media_id,omitempty"`
	Title   string `json:"title"`
	Alt     string `json:"alt"`
}

type HeroState struct {
	Version          int64        `json:"version"`
	PublishedVersion int64        `json:"published_version"`
	Draft            []HeroBanner `json:"draft"`
	Published        []HeroBanner `json:"published"`
}

type HeroChange struct {
	ExpectedVersion int64        `json:"expected_version"`
	Reason          string       `json:"reason"`
	Banners         []HeroBanner `json:"banners,omitempty"`
}
