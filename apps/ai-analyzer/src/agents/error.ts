export function formatAgentError(err: unknown): string {
	if (err instanceof Error) {
		const lines: string[] = []
		if (err.message) {
			lines.push(err.message)
		}

		const withCause = err as Error & { cause?: unknown }
		if (withCause.cause) {
			if (withCause.cause instanceof Error) {
				if (withCause.cause.message) {
					lines.push(`cause: ${withCause.cause.message}`)
				}
			} else {
				lines.push(`cause: ${String(withCause.cause)}`)
			}
		}

		const withStatus = err as Error & { statusCode?: number; responseBody?: string }
		if (typeof withStatus.statusCode === 'number') {
			lines.push(`status: ${withStatus.statusCode}`)
		}
		if (typeof withStatus.responseBody === 'string' && withStatus.responseBody.trim() !== '') {
			lines.push(`response: ${withStatus.responseBody.trim().slice(0, 300)}`)
		}

		if (lines.length > 0) {
			return lines.join(' | ')
		}
	}

	return String(err)
}
