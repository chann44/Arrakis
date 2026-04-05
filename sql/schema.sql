CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    login TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_oauth_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS repositories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    private BOOLEAN NOT NULL DEFAULT FALSE,
    default_branch TEXT NOT NULL DEFAULT '',
    html_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, github_repo_id)
);

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

CREATE TABLE IF NOT EXISTS dependency_packages (
    id BIGSERIAL PRIMARY KEY,
    manager TEXT NOT NULL,
    registry TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (manager, registry, normalized_name)
);

CREATE TABLE IF NOT EXISTS dependency_package_versions (
    id BIGSERIAL PRIMARY KEY,
    package_id BIGINT NOT NULL REFERENCES dependency_packages(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    creator TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    license TEXT NOT NULL DEFAULT '',
    homepage TEXT NOT NULL DEFAULT '',
    repository_url TEXT NOT NULL DEFAULT '',
    registry_url TEXT NOT NULL DEFAULT '',
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (package_id, version)
);

CREATE TABLE IF NOT EXISTS dependency_version_dependencies (
    id BIGSERIAL PRIMARY KEY,
    from_version_id BIGINT NOT NULL REFERENCES dependency_package_versions(id) ON DELETE CASCADE,
    to_version_id BIGINT NOT NULL REFERENCES dependency_package_versions(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'default',
    version_spec TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (dependency_type IN ('prod', 'dev', 'peer', 'optional', 'default')),
    UNIQUE (from_version_id, to_version_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS repository_dependency_files (
    id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    path TEXT NOT NULL,
    file TEXT NOT NULL,
    manager TEXT NOT NULL,
    registry TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, path)
);

CREATE TABLE IF NOT EXISTS repository_dependencies (
    id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    package_id BIGINT NOT NULL REFERENCES dependency_packages(id) ON DELETE CASCADE,
    source_file TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'default',
    version_spec TEXT NOT NULL DEFAULT '',
    resolved_version_id BIGINT REFERENCES dependency_package_versions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (scope IN ('prod', 'dev', 'peer', 'optional', 'default')),
    UNIQUE (repository_id, package_id, source_file, scope, version_spec)
);

CREATE TABLE IF NOT EXISTS repository_dependency_syncs (
    id BIGSERIAL PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    status TEXT NOT NULL,
    trigger TEXT NOT NULL,
    error_message TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('queued', 'running', 'success', 'failed')),
    CHECK (trigger IN ('connect', 'manual'))
);

CREATE INDEX IF NOT EXISTS dependency_packages_lookup_idx
ON dependency_packages (manager, registry, normalized_name);

CREATE INDEX IF NOT EXISTS dependency_package_versions_package_id_idx
ON dependency_package_versions (package_id);

CREATE INDEX IF NOT EXISTS dependency_version_dependencies_from_version_idx
ON dependency_version_dependencies (from_version_id);

CREATE INDEX IF NOT EXISTS dependency_version_dependencies_to_version_idx
ON dependency_version_dependencies (to_version_id);

CREATE INDEX IF NOT EXISTS repository_dependency_files_repository_id_idx
ON repository_dependency_files (repository_id);

CREATE INDEX IF NOT EXISTS repository_dependencies_repository_id_idx
ON repository_dependencies (repository_id);

CREATE INDEX IF NOT EXISTS repository_dependencies_package_id_idx
ON repository_dependencies (package_id);

CREATE INDEX IF NOT EXISTS repository_dependency_syncs_repository_id_idx
ON repository_dependency_syncs (repository_id, started_at DESC);

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
