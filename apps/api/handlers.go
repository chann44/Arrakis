package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/chann44/TGE/adapters"
	internal "github.com/chann44/TGE/internals"
	db "github.com/chann44/TGE/internals/db"
)

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type Handler struct {
	cfg     *internal.Config
	redis   *adapters.Redis
	queries *db.Queries
}

func NewHandler(cfg *internal.Config, redisClient *adapters.Redis, queries *db.Queries) *Handler {
	return &Handler{cfg: cfg, redis: redisClient, queries: queries}
}

func (h *Handler) githubLogin(w http.ResponseWriter, r *http.Request) {
	state, err := generateState()
	if err != nil {
		http.Error(w, "failed to generate state", http.StatusInternalServerError)
		return
	}
	stateKey := fmt.Sprintf("github_state:%s", state)
	if err := h.redis.Set(r.Context(), stateKey, "1", 10*time.Minute); err != nil {
		http.Error(w, "failed to set state", http.StatusInternalServerError)
		return
	}
	url := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&state=%s&scope=user:email",
		h.cfg.GithubClientID,
		h.cfg.GithubRedirectURI,
		state,
	)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *Handler) githubCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state == "" {
		http.Error(w, "missing state", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	stateKey := fmt.Sprintf("github_state:%s", state)
	if _, err := h.redis.Get(r.Context(), stateKey); err != nil {
		http.Error(w, "invalid or expired state", http.StatusUnauthorized)
		return
	}
	_ = h.redis.Del(r.Context(), stateKey)

	token, err := adapters.ExchangeGitHubCode(
		r.Context(),
		h.cfg.GithubClientID,
		h.cfg.GithubClientSecret,
		code,
		h.cfg.GithubRedirectURI,
	)
	if err != nil {
		http.Error(w, "failed to exchange github code", http.StatusBadGateway)
		return
	}

	user, err := adapters.GetGitHubUser(r.Context(), token)
	if err != nil {
		http.Error(w, "failed to fetch github user", http.StatusBadGateway)
		return
	}

	dbUser, err := h.queries.UpsertGitHubUser(r.Context(), db.UpsertGitHubUserParams{
		GithubID:  user.ID,
		Login:     user.Login,
		Name:      user.Name,
		Email:     user.Email,
		AvatarUrl: user.AvatarURL,
	})
	if err != nil {
		http.Error(w, "failed to store github user", http.StatusInternalServerError)
		return
	}

	if err := h.queries.UpsertUserOAuthToken(r.Context(), db.UpsertUserOAuthTokenParams{
		UserID:      dbUser.ID,
		Provider:    "github",
		AccessToken: token,
	}); err != nil {
		http.Error(w, "failed to store oauth token", http.StatusInternalServerError)
		return
	}

	repositories, err := adapters.ListGitHubUserRepositories(r.Context(), token)
	if err != nil {
		http.Error(w, "failed to fetch github repositories", http.StatusBadGateway)
		return
	}

	if err := h.queries.DeleteUserRepositories(r.Context(), dbUser.ID); err != nil {
		http.Error(w, "failed to clear repositories", http.StatusInternalServerError)
		return
	}

	for _, repo := range repositories {
		if err := h.queries.UpsertRepository(r.Context(), db.UpsertRepositoryParams{
			UserID:        dbUser.ID,
			GithubRepoID:  repo.ID,
			Name:          repo.Name,
			FullName:      repo.FullName,
			Private:       repo.Private,
			DefaultBranch: repo.DefaultBranch,
			HtmlUrl:       repo.HTMLURL,
		}); err != nil {
			http.Error(w, "failed to store repositories", http.StatusInternalServerError)
			return
		}
	}

	sessionToken, err := internal.CreateSessionToken(
		strconv.FormatInt(dbUser.ID, 10),
		dbUser.Login,
		dbUser.Name,
		dbUser.Email,
		dbUser.AvatarUrl,
		24*time.Hour,
	)
	if err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	frontendURL := strings.TrimRight(h.cfg.FrontendURL, "/")
	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s", frontendURL, url.QueryEscape(sessionToken))
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
