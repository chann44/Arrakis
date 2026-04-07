-- +goose Up
CREATE TABLE IF NOT EXISTS custom_domains (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending_dns',
    verification_token TEXT NOT NULL,
    dns_record_type TEXT NOT NULL,
    dns_record_name TEXT NOT NULL,
    dns_record_value TEXT NOT NULL,
    last_error TEXT NOT NULL DEFAULT '',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('pending_dns', 'active', 'error')),
    CHECK (dns_record_type IN ('A', 'CNAME'))
);

CREATE INDEX IF NOT EXISTS custom_domains_user_id_idx
ON custom_domains (user_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS custom_domains_user_id_idx;
DROP TABLE IF EXISTS custom_domains;
