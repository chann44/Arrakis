import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type GitHubRepository = {
	id: number;
	name: string;
	full_name: string;
	private: boolean;
	default_branch: string;
	html_url: string;
	connected: boolean;
};

type GitHubRepositoriesResponse = {
	repositories: GitHubRepository[];
	page: number;
	page_size: number;
	total: number;
	total_pages: number;
};

type ConnectRepositoryResponse = {
	connected: boolean;
	repo_id: number;
	install_needed?: boolean;
	redirect_url?: string;
};

const API_BASE_URL = 'http://localhost:8080';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const session = cookies.get('session');
	const appSetup = url.searchParams.get('app_setup');
	const connected = url.searchParams.get('connected') === '1';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const pageSize = Math.max(
		1,
		Math.min(100, Number.parseInt(url.searchParams.get('page_size') ?? '20', 10) || 20)
	);
	if (!session) {
		return {
			repositories: [] as GitHubRepository[],
			appSetup,
			connected,
			page,
			pageSize,
			total: 0,
			totalPages: 0
		};
	}

	const response = await fetch(`${API_BASE_URL}/v1/github/repositories?page=${page}&page_size=${pageSize}`, {
		headers: {
			Authorization: `Bearer ${session}`
		}
	});

	if (response.status === 401) {
		throw redirect(302, '/auth');
	}

	if (!response.ok) {
		return {
			repositories: [] as GitHubRepository[],
			appSetup,
			connected,
			page,
			pageSize,
			total: 0,
			totalPages: 0
		};
	}

	const payload = (await response.json()) as GitHubRepositoriesResponse;
	return {
		repositories: payload.repositories ?? [],
		appSetup,
		connected,
		page: payload.page ?? page,
		pageSize: payload.page_size ?? pageSize,
		total: payload.total ?? 0,
		totalPages: payload.total_pages ?? 0
	};
};

export const actions: Actions = {
	connect: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const repoId = String(formData.get('repoId') ?? '').trim();
		if (!repoId) {
			return fail(400, { message: 'Missing repository id' });
		}

		const response = await fetch(`${API_BASE_URL}/v1/github/repositories/${repoId}/connect`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session}`
			}
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			return fail(response.status, { message: 'Failed to connect repository' });
		}

		const payload = (await response.json()) as ConnectRepositoryResponse;
		if (payload.install_needed && payload.redirect_url) {
			return {
				success: false,
				installRedirect: payload.redirect_url
			};
		}

		return { success: payload.connected };
	}
};
