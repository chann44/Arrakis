import { Pool } from 'pg'

type CheckResult = {
	name: string
	ok: boolean
	detail: string
}

function trimEnv(name: string): string {
	return (process.env[name] ?? '').trim()
}

async function checkDatabase(connectionString: string): Promise<CheckResult> {
	let pool: Pool | null = null
	try {
		pool = new Pool({ connectionString })
		const res = await pool.query<{ now: string }>('select now()::text as now')
		return {
			name: 'database',
			ok: true,
			detail: `connected (now=${res.rows[0]?.now ?? 'unknown'})`
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return {
			name: 'database',
			ok: false,
			detail: `connect failed: ${message}`
		}
	} finally {
		await pool?.end()
	}
}

async function checkNPMRegistry(): Promise<CheckResult> {
	try {
		const response = await fetch('https://registry.npmjs.org/ctx')
		if (!response.ok) {
			return {
				name: 'npm_registry',
				ok: false,
				detail: `status=${response.status}`
			}
		}
		const payload = (await response.json()) as { 'dist-tags'?: { latest?: string } }
		return {
			name: 'npm_registry',
			ok: true,
			detail: `reachable (ctx latest=${payload['dist-tags']?.latest ?? 'unknown'})`
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return {
			name: 'npm_registry',
			ok: false,
			detail: `request failed: ${message}`
		}
	}
}

async function checkOpenRouter(apiKey: string, baseURL: string): Promise<CheckResult> {
	const endpoint = `${baseURL.replace(/\/$/, '')}/models`
	try {
		const response = await fetch(endpoint, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		})
		if (!response.ok) {
			const body = await response.text()
			return {
				name: 'openrouter',
				ok: false,
				detail: `status=${response.status} body=${body.slice(0, 200)}`
			}
		}
		const payload = (await response.json()) as { data?: Array<{ id?: string }> }
		return {
			name: 'openrouter',
			ok: true,
			detail: `reachable (models=${payload.data?.length ?? 0})`
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return {
			name: 'openrouter',
			ok: false,
			detail: `request failed: ${message}`
		}
	}
}

async function main() {
	const databaseURL = trimEnv('AI_ANALYZER_DATABASE_URL') || trimEnv('DATABASE_URL')
	const openRouterKey = trimEnv('OPENROUTER_API_KEY')
	const openRouterBaseURL = trimEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1'

	const missingEnv: string[] = []
	if (databaseURL === '') {
		missingEnv.push('AI_ANALYZER_DATABASE_URL or DATABASE_URL')
	}
	if (openRouterKey === '') {
		missingEnv.push('OPENROUTER_API_KEY')
	}

	console.log('connectivity check starting...')
	if (missingEnv.length > 0) {
		console.log(`missing env: ${missingEnv.join(', ')}`)
	}

	const results: CheckResult[] = []

	if (databaseURL !== '') {
		results.push(await checkDatabase(databaseURL))
	} else {
		results.push({
			name: 'database',
			ok: false,
			detail: 'skipped (no database url configured)'
		})
	}

	results.push(await checkNPMRegistry())

	if (openRouterKey !== '') {
		results.push(await checkOpenRouter(openRouterKey, openRouterBaseURL))
	} else {
		results.push({
			name: 'openrouter',
			ok: false,
			detail: 'skipped (OPENROUTER_API_KEY is empty)'
		})
	}

	for (const result of results) {
		const badge = result.ok ? 'PASS' : 'FAIL'
		console.log(`[${badge}] ${result.name}: ${result.detail}`)
	}

	const hasFailure = results.some((result) => !result.ok)
	if (hasFailure) {
		process.exitCode = 1
	}
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err)
	console.error(`fatal connectivity check error: ${message}`)
	process.exitCode = 1
})
