import { createOpenAI, openai } from '@ai-sdk/openai'

export function hasAIModelConfig(): boolean {
	const openAIKey = (process.env.OPENAI_API_KEY ?? '').trim()
	const openRouterKey = (process.env.OPENROUTER_API_KEY ?? '').trim()
	return openAIKey !== '' || openRouterKey !== ''
}

export function getModelDebugInfo() {
	const openAIKey = (process.env.OPENAI_API_KEY ?? '').trim()
	const openRouterKey = (process.env.OPENROUTER_API_KEY ?? '').trim()
	const provider = openRouterKey ? 'openrouter' : 'openai'
	const model = (process.env.AI_ANALYZER_MODEL ?? '').trim()
	const resolvedModel =
		model || (provider === 'openrouter' ? 'openai/gpt-4.1-mini' : 'gpt-4.1-mini')

	return {
		provider,
		model: resolvedModel,
		hasOpenAIKey: openAIKey !== '',
		hasOpenRouterKey: openRouterKey !== ''
	}
}

export function getAIModel() {
	const model = getModelDebugInfo().model
	const openRouterKey = (process.env.OPENROUTER_API_KEY ?? '').trim()

	if (openRouterKey) {
		const headers: Record<string, string> = {}
		const siteURL = (process.env.OPENROUTER_SITE_URL ?? '').trim()
		const appName = (process.env.OPENROUTER_APP_NAME ?? '').trim()
		if (siteURL) {
			headers['HTTP-Referer'] = siteURL
		}
		if (appName) {
			headers['X-Title'] = appName
		}

		const openRouter = createOpenAI({
			apiKey: openRouterKey,
			baseURL: (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').trim(),
			headers
		})
		return openRouter(model)
	}

	return openai(model)
}
