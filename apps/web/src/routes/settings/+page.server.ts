import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiBaseUrl } from '$lib/server/api-base';

type DomainRecord = {
	type: string;
	name: string;
	value: string;
	ttl: number;
};

type CustomDomain = {
	id: number;
	hostname: string;
	status: string;
	error: string;
	records: DomainRecord[];
};

type DomainsResponse = {
	domains: CustomDomain[];
};

const API_BASE_URL = getApiBaseUrl();

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const session = cookies.get('session');
	if (!session) {
		return { domains: [] as CustomDomain[] };
	}

	const response = await fetch(`${API_BASE_URL}/v1/domains`, {
		headers: {
			Authorization: `Bearer ${session}`
		}
	});

	if (response.status === 401) {
		throw redirect(302, '/auth');
	}

	if (!response.ok) {
		return { domains: [] as CustomDomain[] };
	}

	const payload = (await response.json()) as DomainsResponse;
	return { domains: payload.domains ?? [] };
};

export const actions: Actions = {
	addDomain: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const hostname = String(formData.get('hostname') ?? '').trim();
		if (!hostname) {
			return fail(400, { message: 'Domain is required.' });
		}

		const response = await fetch(`${API_BASE_URL}/v1/domains`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ hostname })
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			return fail(response.status, { message: await response.text() });
		}

		return { success: true };
	},
	verifyDomain: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const domainID = String(formData.get('domainID') ?? '').trim();
		if (!domainID) {
			return fail(400, { message: 'Missing domain id.' });
		}

		const response = await fetch(`${API_BASE_URL}/v1/domains/${domainID}/verify`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session}`
			}
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			return fail(response.status, { message: await response.text() });
		}

		return { success: true };
	},
	deleteDomain: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const domainID = String(formData.get('domainID') ?? '').trim();
		if (!domainID) {
			return fail(400, { message: 'Missing domain id.' });
		}

		const response = await fetch(`${API_BASE_URL}/v1/domains/${domainID}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${session}`
			}
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			return fail(response.status, { message: await response.text() });
		}

		return { success: true };
	}
};
