package domain

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
)

const PasswordIterations = 600000

// HashPassword uses the pinned Go standard library and a per-credential salt.
func HashPassword(password string) (string, error) {
	if len(password) < 1 || len(password) > 1024 {
		return "", fmt.Errorf("kata sandi harus 8–1024 byte")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, PasswordIterations, 32)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("pbkdf2-sha256$v1$%d$%x$%x", PasswordIterations, salt, key), nil
}

// VerifyPassword allows legacy verification only with proof of the original
// password. A successful legacy verification must be upgraded by the caller.
func VerifyPassword(encoded, password string) (valid, upgrade bool) {
	if password == "" || len(password) > 1024 {
		return false, false
	}
	if strings.HasPrefix(encoded, "legacy-sha256$") {
		encoded = strings.TrimPrefix(encoded, "legacy-sha256$")
	}
	if len(encoded) == 64 {
		old, err := hex.DecodeString(encoded)
		actual := sha256.Sum256([]byte(password))
		return err == nil && subtle.ConstantTimeCompare(old, actual[:]) == 1, true
	}
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[0] != "pbkdf2-sha256" || parts[1] != "v1" {
		return false, false
	}
	iterations, err := strconv.Atoi(parts[2])
	if err != nil || iterations < PasswordIterations || iterations > 2000000 {
		return false, false
	}
	salt, err := hex.DecodeString(parts[3])
	if err != nil || len(salt) != 16 {
		return false, false
	}
	expected, err := hex.DecodeString(parts[4])
	if err != nil || len(expected) != 32 {
		return false, false
	}
	actual, err := pbkdf2.Key(sha256.New, password, salt, iterations, 32)
	return err == nil && subtle.ConstantTimeCompare(expected, actual) == 1, false
}
