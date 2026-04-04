-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_github_installations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT NOT NULL,
    app_slug TEXT NOT NULL DEFAULT '',
    account_login TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL DEFAULT '',
    html_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS user_github_installations_user_id_idx
ON user_github_installations (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS user_github_installations_user_id_idx;
DROP TABLE IF EXISTS user_github_installations;
-- +goose StatementEnd
