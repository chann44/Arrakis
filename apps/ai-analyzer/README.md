# AI Analyzer Service

TypeScript service for sandboxed AI dependency analysis.

## Endpoints

- `GET /health`
- `POST /v1/analyze/repository`

## Modes

- HTTP mode: run as long-lived service with Hono.
- Job mode: `bun src/job.ts` consumes JSON payload via stdin and returns result JSON on stdout.

## Environment

- `PORT` (default `8090`)
- `AI_ANALYZER_TOKEN` (optional shared token for API calls)
- `OPENAI_API_KEY` (optional, enables LLM confidence/severity calibration)
- `AI_ANALYZER_MODEL` (default `gpt-4.1-mini`)

OpenRouter support (optional):

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)
- `OPENROUTER_SITE_URL` (recommended)
- `OPENROUTER_APP_NAME` (recommended)

If `OPENROUTER_API_KEY` is set, the analyzer uses OpenRouter for model calls.
