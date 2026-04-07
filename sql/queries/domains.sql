-- name: ListUserCustomDomains :many
SELECT id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at
FROM custom_domains
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListActiveCustomDomains :many
SELECT id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at
FROM custom_domains
WHERE status = 'active'
ORDER BY id ASC;

-- name: CreateCustomDomain :one
INSERT INTO custom_domains (
  user_id,
  hostname,
  status,
  verification_token,
  dns_record_type,
  dns_record_name,
  dns_record_value
) VALUES (
  $1,
  $2,
  'pending_dns',
  $3,
  $4,
  $5,
  $6
)
RETURNING id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at;

-- name: GetUserCustomDomainByID :one
SELECT id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at
FROM custom_domains
WHERE id = $1 AND user_id = $2;

-- name: GetCustomDomainByHostname :one
SELECT id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at
FROM custom_domains
WHERE hostname = $1;

-- name: MarkCustomDomainActive :one
UPDATE custom_domains
SET status = 'active',
    last_error = '',
    verified_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at;

-- name: MarkCustomDomainError :one
UPDATE custom_domains
SET status = 'error',
    last_error = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at;

-- name: MarkCustomDomainPendingDNS :one
UPDATE custom_domains
SET status = 'pending_dns',
    last_error = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, hostname, status, verification_token, dns_record_type, dns_record_name, dns_record_value, last_error, verified_at, created_at, updated_at;

-- name: DeleteUserCustomDomain :execrows
DELETE FROM custom_domains
WHERE id = $1 AND user_id = $2;
