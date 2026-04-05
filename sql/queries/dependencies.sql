-- name: UpsertDependencyPackage :one
INSERT INTO dependency_packages (
    manager,
    registry,
    normalized_name,
    display_name
) VALUES (
    $1,
    $2,
    $3,
    $4
)
ON CONFLICT (manager, registry, normalized_name)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = NOW()
RETURNING id, manager, registry, normalized_name, display_name, created_at, updated_at;

-- name: UpsertDependencyPackageVersion :one
INSERT INTO dependency_package_versions (
    package_id,
    version,
    creator,
    description,
    license,
    homepage,
    repository_url,
    registry_url,
    released_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
)
ON CONFLICT (package_id, version)
DO UPDATE SET
    creator = EXCLUDED.creator,
    description = EXCLUDED.description,
    license = EXCLUDED.license,
    homepage = EXCLUDED.homepage,
    repository_url = EXCLUDED.repository_url,
    registry_url = EXCLUDED.registry_url,
    released_at = EXCLUDED.released_at,
    updated_at = NOW()
RETURNING id, package_id, version, creator, description, license, homepage, repository_url, registry_url, released_at, created_at, updated_at;

-- name: UpsertDependencyVersionDependency :exec
INSERT INTO dependency_version_dependencies (
    from_version_id,
    to_version_id,
    dependency_type,
    version_spec
) VALUES (
    $1,
    $2,
    $3,
    $4
)
ON CONFLICT (from_version_id, to_version_id, dependency_type)
DO UPDATE SET
    version_spec = EXCLUDED.version_spec,
    updated_at = NOW();

-- name: DeleteRepositoryDependencyFilesByRepo :exec
DELETE FROM repository_dependency_files
WHERE repository_id = $1;

-- name: UpsertRepositoryDependencyFile :exec
INSERT INTO repository_dependency_files (
    repository_id,
    path,
    file,
    manager,
    registry
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
ON CONFLICT (repository_id, path)
DO UPDATE SET
    file = EXCLUDED.file,
    manager = EXCLUDED.manager,
    registry = EXCLUDED.registry,
    updated_at = NOW();

-- name: DeleteRepositoryDependenciesByRepo :exec
DELETE FROM repository_dependencies
WHERE repository_id = $1;

-- name: UpsertRepositoryDependency :exec
INSERT INTO repository_dependencies (
    repository_id,
    package_id,
    source_file,
    scope,
    version_spec,
    resolved_version_id
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
ON CONFLICT (repository_id, package_id, source_file, scope, version_spec)
DO UPDATE SET
    resolved_version_id = EXCLUDED.resolved_version_id,
    updated_at = NOW();

-- name: CreateRepositoryDependencySync :one
INSERT INTO repository_dependency_syncs (
    repository_id,
    status,
    trigger,
    error_message,
    started_at,
    finished_at
) VALUES (
    $1,
    $2,
    $3,
    '',
    NOW(),
    NULL
)
RETURNING id, repository_id, status, trigger, error_message, started_at, finished_at, created_at, updated_at;

-- name: MarkRepositoryDependencySyncSuccess :exec
UPDATE repository_dependency_syncs
SET status = 'success',
    error_message = '',
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: MarkRepositoryDependencySyncFailed :exec
UPDATE repository_dependency_syncs
SET status = 'failed',
    error_message = $2,
    finished_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: ListLatestRepositoryDependencySync :many
SELECT id, repository_id, status, trigger, error_message, started_at, finished_at, created_at, updated_at
FROM repository_dependency_syncs
WHERE repository_id = $1
ORDER BY started_at DESC
LIMIT 1;

-- name: ListRepositoryDependencyFiles :many
SELECT id, repository_id, path, file, manager, registry, created_at, updated_at
FROM repository_dependency_files
WHERE repository_id = $1
ORDER BY path;

-- name: ListRepositoryDependenciesDetailed :many
SELECT
    rd.id,
    rd.repository_id,
    rd.package_id,
    rd.source_file,
    rd.scope,
    rd.version_spec,
    rd.resolved_version_id,
    dp.manager,
    dp.registry,
    dp.display_name,
    dpv.version AS resolved_version,
    dpv.creator,
    dpv.description,
    dpv.license,
    dpv.homepage,
    dpv.repository_url,
    dpv.registry_url,
    dpv.released_at,
    rd.created_at,
    rd.updated_at
FROM repository_dependencies rd
INNER JOIN dependency_packages dp ON dp.id = rd.package_id
LEFT JOIN dependency_package_versions dpv ON dpv.id = rd.resolved_version_id
WHERE rd.repository_id = $1
ORDER BY dp.manager, dp.display_name;

-- name: ListDependencyEdgesByFromVersion :many
SELECT
    dvd.id,
    dvd.from_version_id,
    dvd.to_version_id,
    dvd.dependency_type,
    dvd.version_spec,
    child_package.display_name AS child_name,
    child_package.manager AS child_manager,
    child_package.registry AS child_registry,
    child_version.version AS child_version,
    child_version.creator AS child_creator,
    child_version.description AS child_description,
    child_version.license AS child_license,
    child_version.homepage AS child_homepage,
    child_version.repository_url AS child_repository_url,
    child_version.registry_url AS child_registry_url,
    child_version.released_at AS child_released_at
FROM dependency_version_dependencies dvd
INNER JOIN dependency_package_versions child_version ON child_version.id = dvd.to_version_id
INNER JOIN dependency_packages child_package ON child_package.id = child_version.package_id
WHERE dvd.from_version_id = $1
ORDER BY child_package.display_name;
