import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getApiBaseUrl } from '$lib/server/api-base';

const API_BASE_URL = getApiBaseUrl();

export const GET: RequestHandler = async ({ cookies, fetch, url }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const params = new URLSearchParams();
	const service = (url.searchParams.get('service') ?? '').trim();
	const level = (url.searchParams.get('level') ?? '').trim();
	const cursor = (url.searchParams.get('cursor') ?? '').trim();
	if (service) params.set('service', service);
	if (level) params.set('level', level);
	if (cursor) params.set('cursor', cursor);

	const response = await fetch(`${API_BASE_URL}/v1/system-health/logs/stream?${params.toString()}`, {
		headers: {
			Authorization: `Bearer ${session}`
		}
	});

	if (response.status === 401) {
		throw redirect(302, '/auth');
	}

	if (!response.ok || !response.body) {
		return new Response('failed to open logs stream', { status: response.status || 500 });
	}

	return new Response(response.body, {
		status: 200,
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
