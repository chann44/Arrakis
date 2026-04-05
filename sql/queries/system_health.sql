-- name: CreateServiceStatusSnapshot :exec
INSERT INTO service_status_snapshots (
    service,
    status,
    latency_ms,
    uptime_pct,
    note,
    checked_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
);

-- name: ListLatestServiceStatusSnapshots :many
SELECT DISTINCT ON (service)
    id,
    service,
    status,
    latency_ms,
    uptime_pct,
    note,
    checked_at,
    created_at
FROM service_status_snapshots
ORDER BY service, checked_at DESC;

-- name: CountRepositoryDependencySyncByStatus :one
SELECT COUNT(*)
FROM repository_dependency_syncs
WHERE status = $1;

-- name: CountRepositoryDependencySyncSuccessSince :one
SELECT COUNT(*)
FROM repository_dependency_syncs
WHERE status = 'success'
  AND finished_at >= $1;

-- name: CountRepositoryDependencySyncFailedSince :one
SELECT COUNT(*)
FROM repository_dependency_syncs
WHERE status = 'failed'
  AND finished_at >= $1;
