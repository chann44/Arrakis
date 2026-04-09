import { AsyncLocalStorage } from 'node:async_hooks'

export type ToolTraceEvent = {
	name: string
	phase: 'start' | 'success' | 'error'
	args?: unknown
	result?: unknown
	error?: string
	durationMs?: number
	createdAt: string
}

const traceStorage = new AsyncLocalStorage<{ events: ToolTraceEvent[] }>()

function summarizeValue(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value
	}

	if (typeof value === 'string') {
		if (value.length > 160) {
			return `${value.slice(0, 160)}...(+${value.length - 160} chars)`
		}
		return value
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return value
	}

	if (Array.isArray(value)) {
		return `array(len=${value.length})`
	}

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>
		const summary: Record<string, unknown> = {}
		for (const [key, inner] of Object.entries(obj)) {
			if (key === 'content' || key === 'value' || key === 'decoded' || key === 'files' || key === 'matches') {
				summary[key] = '<omitted>'
				continue
			}
			summary[key] = summarizeValue(inner)
		}
		return summary
	}

	return String(value)
}

export async function runLoggedTool<TArgs, TResult>(
	toolName: string,
	args: TArgs,
	execute: () => Promise<TResult>
): Promise<TResult> {
	const started = Date.now()
	const summarizedArgs = summarizeValue(args)
	console.error(`[ai-tool] start ${toolName} args=${JSON.stringify(summarizedArgs)}`)
	traceStorage.getStore()?.events.push({
		name: toolName,
		phase: 'start',
		args: summarizedArgs,
		createdAt: new Date().toISOString()
	})

	try {
		const result = await execute()
		const durationMs = Date.now() - started
		const summarizedResult = summarizeValue(result)
		console.error(`[ai-tool] success ${toolName} duration_ms=${durationMs} result=${JSON.stringify(summarizedResult)}`)
		traceStorage.getStore()?.events.push({
			name: toolName,
			phase: 'success',
			result: summarizedResult,
			durationMs,
			createdAt: new Date().toISOString()
		})
		return result
	} catch (err) {
		const durationMs = Date.now() - started
		const message = err instanceof Error ? err.message : String(err)
		console.error(`[ai-tool] error ${toolName} duration_ms=${durationMs} error=${message}`)
		traceStorage.getStore()?.events.push({
			name: toolName,
			phase: 'error',
			error: message,
			durationMs,
			createdAt: new Date().toISOString()
		})
		throw err
	}
}

export async function withToolTrace<T>(fn: () => Promise<T>): Promise<{ result: T; events: ToolTraceEvent[] }> {
	const events: ToolTraceEvent[] = []
	const result = await traceStorage.run({ events }, fn)
	return { result, events }
}
