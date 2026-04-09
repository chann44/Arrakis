import { analyzeRepository } from './analyzer'
import type { AnalyzeRepositoryRequest } from './types'

async function readStdin(): Promise<string> {
	const decoder = new TextDecoder()
	let out = ''
	for await (const chunk of Bun.stdin.stream()) {
		out += decoder.decode(chunk, { stream: true })
	}
	out += decoder.decode()
	return out
}

async function main() {
	const raw = (await readStdin()).trim()
	if (raw === '') {
		console.error('ai-analyzer job: missing stdin payload')
		process.exit(1)
	}

	let payload: AnalyzeRepositoryRequest
	try {
		payload = JSON.parse(raw) as AnalyzeRepositoryRequest
	} catch (err) {
		console.error(`ai-analyzer job: invalid json payload: ${err instanceof Error ? err.message : 'unknown error'}`)
		process.exit(1)
	}

	const result = await analyzeRepository(payload)
	process.stdout.write(`${JSON.stringify(result)}\n`)
}

main().catch((err) => {
	console.error(`ai-analyzer job failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
	process.exit(1)
})
