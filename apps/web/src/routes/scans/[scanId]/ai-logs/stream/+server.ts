import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getApiBaseUrl } from '$lib/server/api-base'

const API_BASE_URL = getApiBaseUrl()

export const GET: RequestHandler = async ({ cookies, fetch, params, url }) => {
	const session = cookies.get('session')
	if (!session) {
		throw redirect(302, '/auth')
	}

	const query = new URLSearchParams()
	const cursor = (url.searchParams.get('cursor') ?? '').trim()
	if (cursor) {
		query.set('cursor', cursor)
	}

	let response: Response
	try {
		response = await fetch(
			`${API_BASE_URL}/v1/scans/${encodeURIComponent(params.scanId)}/ai/logs/stream?${query.toString()}`,
			{
				headers: {
					Authorization: `Bearer ${session}`
				}
			}
		)
	} catch {
		return new Response('ai logs upstream unavailable', { status: 503 })
	}

	if (response.status === 401) {
		throw redirect(302, '/auth')
	}

	if (!response.ok || !response.body) {
		return new Response('failed to open ai logs stream', { status: response.status || 500 })
	}

	return new Response(response.body, {
		status: 200,
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	})
}
