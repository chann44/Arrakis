package internal

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

func CreateSessionToken(userID, login, name, email, avatarURL string, ttl time.Duration) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("userID is required")
	}

	headerRaw, err := json.Marshal(map[string]string{
		"alg": "none",
		"typ": "JWT",
	})
	if err != nil {
		return "", fmt.Errorf("marshal token header: %w", err)
	}

	payloadRaw, err := json.Marshal(map[string]any{
		"sub":        userID,
		"login":      login,
		"name":       name,
		"email":      email,
		"avatar_url": avatarURL,
		"exp":        time.Now().Add(ttl).Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal token payload: %w", err)
	}

	header := base64.RawURLEncoding.EncodeToString(headerRaw)
	payload := base64.RawURLEncoding.EncodeToString(payloadRaw)

	return header + "." + payload + "." + strconv.FormatInt(time.Now().UnixNano(), 36), nil
}
