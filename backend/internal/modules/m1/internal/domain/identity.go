package domain

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode/utf8"
)

func Derive(key []byte, label, value string) string {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(label + "\x00" + value))
	return hex.EncodeToString(h.Sum(nil))
}
func Digest(value string) []byte { v := sha256.Sum256([]byte(value)); return v[:] }
func EqualHash(value string, hash []byte) bool {
	return len(value) == 64 && hmac.Equal(Digest(value), hash)
}
func Text(value string, max int) bool {
	return strings.TrimSpace(value) != "" && utf8.RuneCountInString(value) <= max
}
func Subset(values, ceiling []string) bool {
	for _, v := range values {
		found := false
		for _, p := range ceiling {
			if p == v {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
