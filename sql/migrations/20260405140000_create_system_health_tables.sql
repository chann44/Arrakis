-- +goose Up
CREATE TABLE IF NOT EXISTS service_status_snapshots (
    id BIGSERIAL PRIMARY KEY,
    service TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    uptime_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('ok', 'degraded', 'down'))
);

CREATE INDEX IF NOT EXISTS service_status_snapshots_service_checked_at_idx
ON service_status_snapshots (service, checked_at DESC);

-- +goose Down
DROP INDEX IF EXISTS service_status_snapshots_service_checked_at_idx;
DROP TABLE IF EXISTS service_status_snapshots;
