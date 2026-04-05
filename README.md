# 🔐 TGE

Self-hosted supply chain security scanner for your codebase.

Scan dependencies, track updates, and detect risky or suspicious behavior beyond known vulnerabilities.

## 🚀 What it does

- Scans your repo dependencies (direct + transitive)
- Detects known vulnerabilities (CVE / OSV)
- Flags risky patterns:
  - new/untrusted packages
  - suspicious install scripts
  - dependency confusion risks
- Tracks dependency changes over time
- Generates simple risk reports

## ⚙️ How it works

1. Connect your GitHub repo
2. Extract dependency manifests (npm, pip, go, etc.)
3. Build dependency graph
4. Run scanners + rule engine
5. Output findings with risk score

## 🧱 Tech stack

- Go (backend)
- Postgres (metadata)
- Redis (jobs / queues)
- Docker (self-hosted deployment)

## 🏗️ Project structure

```text
apps/        # api, worker, web
domain/      # core models (dependency, scan, findings)
services/    # parsing, scanning, risk engine
adapters/    # github, osv, registries
deployments/ # docker / k8s
```

## 🐳 Run locally

```bash
git clone git@github.com:chann44/TGE.git
cd TGE

cp .env.example .env
docker compose -f deployments/dev.compose.yml up -d
```

API: `http://localhost:8080`

For system-health log streaming, set these `.env` values:

```bash
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=9000
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse
CLICKHOUSE_DATABASE=default
```

## 📌 Roadmap

- GitHub App integration
- CI integration (fail on high risk)
- Auto PR fixes for dependency updates
- Advanced heuristic rules engine
- Dashboard + alerts

## ⚠️ Status

Early stage project - APIs and schema may change.

## 🤝 Contributing

PRs and feedback welcome.

## 📄 License

MIT
