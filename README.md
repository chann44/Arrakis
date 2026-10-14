<div align="center">

<img src="assets/logo.png" width="200" alt="Arrakis">

# Arrakis

**A self-hosted, open-source supply chain security platform.**

[![Go](https://img.shields.io/badge/go-1.25+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![Postgres](https://img.shields.io/badge/db-Postgres-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/queues-Redis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-21bb4a.svg)](#license)

*Scan dependencies. Surface CVEs. Flag the weird stuff before it ships.*

</div>

> [!NOTE]
> Early stage project — APIs and schema may change. PRs and feedback welcome.

## What it does

- Scans repo dependencies, direct and transitive (npm, pip, go)
- Detects known vulnerabilities (CVE / OSV / GHSA / NVD)
- Flags risky patterns — new or untrusted packages, suspicious install scripts, dependency confusion
- Tracks dependency changes over time
- Generates risk reports, with an optional sandboxed AI analyzer

## How it works

1. Connect your GitHub repo
2. Extract dependency manifests (npm, pip, go)
3. Build the dependency graph
4. Run scanners and the rule engine — plus sandboxed agents (supply chain agent, SCA agent) in isolated containers
5. Get findings with a risk score

## Tech stack

- **Go** — API, worker, scheduler, risk engine
- **Bun + Hono + Vercel AI SDK** — sandboxed AI analyzer
- **Postgres** — metadata, **Redis** — jobs and queues, **ClickHouse** — log streaming
- **Docker + Traefik** — self-hosted deployment

## Project structure

```text
apps/         # api, worker, scheduler, ai-analyzer, web, marketing
services/     # parsing, scanning, risk engine, notifier
adapters/     # github, osv, nvd, ghsa, package registries, clickhouse
internals/    # auth, config, jobs, observability
deployments/  # docker compose files for dev and self-hosting
sql/          # migrations (sqlc)
```

## Run locally

```bash
git clone git@github.com:chann44/Arrakis.git
cd Arrakis
cp .env.example .env
docker compose -f deployments/dev.compose.yml up -d
```

API: `http://localhost:8080`

Optional AI analyzer in sandbox mode:

```bash
make docker-build-ai
AI_ANALYZER_ENABLED=true AI_ANALYZER_MODE=docker make worker-dev
```

Scan details include an **AI Analysis** tab with step-by-step logs from sandbox startup, agent progress, and finding merge events.

## Self-host with published images

```bash
git clone git@github.com:chann44/Arrakis.git
cd Arrakis
cp .env.example .env
docker compose -f deployments/selfhost.compose.yml up -d
```

The self-host compose uses Traefik and serves web + API on one domain (`/` and `/api`). Set these required values in `.env` before startup:

```bash
TRAEFIK_ACME_EMAIL=ops@example.com
DOMAIN_RECORD_TYPE=A
DOMAIN_RECORD_VALUE=<your-server-public-ip>
```

Then open `http://<server-ip>/settings` and add your domain in the dashboard. The app shows the DNS records to set — a TXT ownership record (`_tge-challenge.<your-domain>`) and a traffic record (`A`, or `CNAME` if configured). After DNS propagation, click Verify in the dashboard and Traefik publishes HTTPS routes automatically.

Infrastructure requirements:

- Open inbound ports `80` and `443` on your host/cloud firewall
- Ensure your DNS points to `DOMAIN_RECORD_VALUE`

Default images used by compose:

```bash
chann44/tge-backend:latest
chann44/tge-web:latest
```

Publish updated images to Docker Hub:

```bash
docker login
make docker-build
make docker-push
```

Automated publishing is configured via GitHub Actions in `.github/workflows/docker-publish.yml` — push a tag like `v1.0.0` to publish multi-arch images.

To use another registry, override the image names:

```bash
export TGE_BACKEND_IMAGE=your-registry/your-namespace/tge-backend:latest
export TGE_WEB_IMAGE=your-registry/your-namespace/tge-web:latest
docker compose -f deployments/selfhost.compose.yml up -d
```

## Roadmap

- GitHub App integration
- CI integration (fail on high risk)
- Auto PR fixes for dependency updates
- Advanced heuristic rules engine
- Dashboard + alerts

## License

[MIT](#license) © 2026 [Chann](https://github.com/chann44)
