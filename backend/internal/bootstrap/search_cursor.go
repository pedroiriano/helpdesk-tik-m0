package bootstrap

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"

	"helpdesk.local/m0/internal/platform/web"
)

func searchNext(id *string) string {
	if id == nil {
		return ""
	}
	return *id
}

func signSearchCursor(key []byte, id string, fields []string) string {
	mac := hmac.New(sha256.New, key)
	binding, _ := json.Marshal(fields)
	mac.Write([]byte("helpdesk:global-search:v1:" + id))
	mac.Write(binding)
	return id + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func readSearchCursor(key []byte, token string, fields []string) (string, error) {
	id, _, valid := strings.Cut(token, ".")
	if !valid || len(token) != 80 || !web.UUID(id) ||
		!hmac.Equal([]byte(token), []byte(signSearchCursor(key, id, fields))) {
		return "", web.Fail(400, "Cursor pencarian tidak valid untuk pencarian ini")
	}
	return id, nil
}
