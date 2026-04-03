SHELL := /bin/sh

GOOSE_DIR := sql/migrations
SQLC_CONFIG := sqlc.yaml

.PHONY: help api-dev web-dev dev test fmt codegen migrate-up migrate-down migrate-status migrate-reset migrate-create

help:
	@printf "Available targets:\n"
	@printf "  make api-dev           Run Go API server\n"
	@printf "  make web-dev           Run Svelte web dev server\n"
	@printf "  make dev               Run API + web dev servers\n"
	@printf "  make test              Run Go tests\n"
	@printf "  make fmt               Format Go code\n"
	@printf "  make codegen           Generate sqlc code\n"
	@printf "  make migrate-up        Apply goose migrations\n"
	@printf "  make migrate-down      Roll back one goose migration\n"
	@printf "  make migrate-status    Show goose migration status\n"
	@printf "  make migrate-reset     Roll back all goose migrations\n"
	@printf "  make migrate-create NAME=create_users  Create a new migration\n"

api-dev:
	go run ./apps/api

web-dev:
	npm --prefix apps/web run dev

dev:
	@set -e; \
	trap 'kill 0' INT TERM EXIT; \
	go run ./apps/api & \
	npm --prefix apps/web run dev & \
	wait

test:
	go test ./...

fmt:
	go fmt ./...

codegen:
	sqlc generate -f $(SQLC_CONFIG)

migrate-up:
	@set -e; \
	set -a; . ./.env; set +a; \
	goose -dir $(GOOSE_DIR) postgres "$$DATABASE_URL?sslmode=disable" up

migrate-down:
	@set -e; \
	set -a; . ./.env; set +a; \
	goose -dir $(GOOSE_DIR) postgres "$$DATABASE_URL?sslmode=disable" down

migrate-status:
	@set -e; \
	set -a; . ./.env; set +a; \
	goose -dir $(GOOSE_DIR) postgres "$$DATABASE_URL?sslmode=disable" status

migrate-reset:
	@set -e; \
	set -a; . ./.env; set +a; \
	goose -dir $(GOOSE_DIR) postgres "$$DATABASE_URL?sslmode=disable" reset

migrate-create:
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make migrate-create NAME=create_github_tables"; \
		exit 1; \
	fi
	goose -dir $(GOOSE_DIR) create $(NAME) sql
