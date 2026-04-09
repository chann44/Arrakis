import { Hono } from 'hono'
import { z } from 'zod'
import { analyzeRepository } from './analyzer'

const app = new Hono()

const requestSchema = z.object({
	scanRunId: z.number().int().positive(),
	repoId: z.number().int().positive(),
	maxDependencies: z.number().int().positive().optional(),
	dependencies: z
		.array(
			z.object({
				name: z.string().min(1),
				manager: z.string().min(1),
				registry: z.string().min(1),
				versionSpec: z.string(),
				resolvedVersion: z.string(),
				sourceFile: z.string()
			})
		)
		.max(500)
})

app.get('/health', (c) => {
	return c.json({ ok: true, service: 'ai-analyzer' })
})

app.post('/v1/analyze/repository', async (c) => {
	const authToken = (process.env.AI_ANALYZER_TOKEN ?? '').trim()
	if (authToken !== '') {
		const header = c.req.header('x-ai-analyzer-token') ?? ''
		if (header.trim() !== authToken) {
			return c.json({ error: 'unauthorized' }, 401)
		}
	}

	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		return c.json({ error: 'invalid json body' }, 400)
	}

	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) {
		return c.json({ error: 'invalid request body', details: parsed.error.flatten() }, 400)
	}

	const result = await analyzeRepository(parsed.data)
	return c.json(result)
})

const port = Number(process.env.PORT ?? '8090')

console.log(`ai-analyzer listening on :${port}`)

export default {
	port,
	fetch: app.fetch
}
