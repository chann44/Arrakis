import { Hono } from 'hono'
import { z } from 'zod'
import { analyzeRepository } from './analyzer'
import { enqueueAnalyzeRepositoryJob, getAnalyzeRepositoryJob } from './queue'

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

function requireAuth(c: { req: { header: (name: string) => string | undefined } }) {
	const authToken = (process.env.AI_ANALYZER_TOKEN ?? '').trim()
	if (authToken !== '') {
		const header = c.req.header('x-ai-analyzer-token') ?? ''
		if (header.trim() !== authToken) {
			return false
		}
	}

	return true
}

async function parseRequestBody(c: { req: { json: () => Promise<unknown> } }) {
	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		return { error: { error: 'invalid json body' }, status: 400 as const }
	}

	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) {
		return {
			error: { error: 'invalid request body', details: parsed.error.flatten() },
			status: 400 as const
		}
	}

	return { data: parsed.data }
}

app.post('/v1/analyze/repository', async (c) => {
	if (!requireAuth(c)) {
		return c.json({ error: 'unauthorized' }, 401)
	}

	const parsed = await parseRequestBody(c)
	if ('error' in parsed) {
		return c.json(parsed.error, parsed.status)
	}

	const result = await analyzeRepository(parsed.data)
	return c.json(result)
})

app.post('/v1/analyze/repository/queue', async (c) => {
	if (!requireAuth(c)) {
		return c.json({ error: 'unauthorized' }, 401)
	}

	const parsed = await parseRequestBody(c)
	if ('error' in parsed) {
		return c.json(parsed.error, parsed.status)
	}

	const job = await enqueueAnalyzeRepositoryJob(parsed.data)
	return c.json({ jobId: job.id, status: 'queued' })
})

app.get('/v1/analyze/repository/jobs/:jobId', async (c) => {
	if (!requireAuth(c)) {
		return c.json({ error: 'unauthorized' }, 401)
	}

	const jobId = c.req.param('jobId')
	const job = await getAnalyzeRepositoryJob(jobId)
	if (!job) {
		return c.json({ error: 'job not found' }, 404)
	}

	const state = await job.getState()
	return c.json({
		jobId,
		name: job.name,
		state,
		attemptsMade: job.attemptsMade,
		failedReason: job.failedReason ?? '',
		result: state === 'completed' ? job.returnvalue : null
	})
})

const port = Number(process.env.PORT ?? '8090')

console.log(`ai-analyzer listening on :${port}`)

export default {
	port,
	fetch: app.fetch
}
