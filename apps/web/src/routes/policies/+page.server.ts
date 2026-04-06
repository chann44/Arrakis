import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const API_BASE_URL = 'http://localhost:8080';

type PolicySummary = {
	id: number;
	name: string;
	enabled: boolean;
	repository_count: number;
	created_at: string;
	updated_at: string;
};

type PoliciesResponse = {
	items?: PolicySummary[];
};

type GitHubRepository = {
	id: number;
	name: string;
	full_name: string;
	connected: boolean;
};

type GitHubRepositoriesResponse = {
	repositories?: GitHubRepository[];
};

const has = (form: FormData, key: string) => form.get(key) !== null;

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const headers = { Authorization: `Bearer ${session}` };
	const [policiesRes, reposRes] = await Promise.all([
		fetch(`${API_BASE_URL}/v1/policies`, { headers }),
		fetch(`${API_BASE_URL}/v1/github/repositories`, { headers })
	]);

	if (policiesRes.status === 401 || reposRes.status === 401) {
		throw redirect(302, '/auth');
	}

	const policiesPayload = policiesRes.ok
		? (((await policiesRes.json()) as PoliciesResponse) ?? {})
		: {};
	const reposPayload = reposRes.ok
		? (((await reposRes.json()) as GitHubRepositoriesResponse) ?? {})
		: {};

	return {
		policies: policiesPayload.items ?? [],
		repositories: (reposPayload.repositories ?? []).filter((repo) => repo.connected)
	};
};

export const actions: Actions = {
	createPolicy: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) {
			return fail(400, {
				action: 'createPolicy',
				success: false,
				message: 'Policy name is required.'
			});
		}

		const branches = String(form.get('trigger_branches') ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);

		const payload = {
			name,
			enabled: has(form, 'enabled'),
			triggers: [
				{
					type: String(form.get('trigger_type') ?? 'manual').trim(),
					branches,
					cron: String(form.get('trigger_cron') ?? '').trim(),
					timezone: String(form.get('trigger_timezone') ?? 'UTC').trim()
				}
			],
			sources: {
				registry_first: has(form, 'registry_first'),
				registry_max_age_days: Number(form.get('registry_max_age_days') ?? 7),
				registry_only: has(form, 'registry_only'),
				osv_enabled: has(form, 'osv_enabled'),
				ghsa_enabled: has(form, 'ghsa_enabled'),
				ghsa_token_ref: String(form.get('ghsa_token_ref') ?? '').trim(),
				nvd_enabled: has(form, 'nvd_enabled'),
				nvd_api_key_ref: String(form.get('nvd_api_key_ref') ?? '').trim(),
				govulncheck_enabled: has(form, 'govulncheck_enabled')
			},
			sast: {
				enabled: has(form, 'sast_enabled'),
				patterns_enabled: has(form, 'patterns_enabled'),
				rulesets: String(form.get('rulesets') ?? '')
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean),
				min_severity: String(form.get('min_severity') ?? 'medium').trim(),
				exclude_paths: String(form.get('exclude_paths') ?? '')
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean),
				ai_enabled: has(form, 'ai_enabled'),
				ai_max_files_per_scan: Number(form.get('ai_max_files_per_scan') ?? 50),
				ai_reachability: has(form, 'ai_reachability'),
				ai_suggest_fix: has(form, 'ai_suggest_fix')
			},
			registry: {
				push_enabled: has(form, 'push_enabled'),
				push_url: String(form.get('push_url') ?? '').trim(),
				push_signing_key_ref: String(form.get('push_signing_key_ref') ?? '').trim(),
				pull_enabled: has(form, 'pull_enabled'),
				pull_url: String(form.get('pull_url') ?? '').trim(),
				pull_trusted_keys: String(form.get('pull_trusted_keys') ?? '')
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean),
				pull_max_age_days: Number(form.get('pull_max_age_days') ?? 7)
			}
		};

		const response = await fetch(`${API_BASE_URL}/v1/policies`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			const errorText = (await response.text()).trim();
			return fail(response.status, {
				action: 'createPolicy',
				success: false,
				message: errorText || 'Failed to create policy.'
			});
		}

		const created = (await response.json()) as { id?: number };
		if (created.id) {
			throw redirect(302, `/policies/${created.id}?created=1`);
		}

		return { action: 'createPolicy', success: true, message: 'Policy created.' };
	},

	assignPolicy: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const form = await request.formData();
		const repoID = String(form.get('repo_id') ?? '').trim();
		const policyID = String(form.get('policy_id') ?? '').trim();

		if (!repoID || !policyID) {
			return fail(400, {
				action: 'assignPolicy',
				success: false,
				message: 'Select both repository and policy.'
			});
		}

		const response = await fetch(`${API_BASE_URL}/v1/github/repositories/${repoID}/policy`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${session}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ policy_id: Number(policyID) })
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			const errorText = (await response.text()).trim();
			return fail(response.status, {
				action: 'assignPolicy',
				success: false,
				message: errorText || 'Failed to assign policy.'
			});
		}

		return { action: 'assignPolicy', success: true, message: 'Policy assigned to repository.' };
	},

	deletePolicy: async ({ cookies, fetch, request }) => {
		const session = cookies.get('session');
		if (!session) {
			throw redirect(302, '/auth');
		}

		const form = await request.formData();
		const policyID = String(form.get('policy_id') ?? '').trim();
		if (!policyID) {
			return fail(400, {
				action: 'deletePolicy',
				success: false,
				message: 'Policy id is required.'
			});
		}

		const response = await fetch(`${API_BASE_URL}/v1/policies/${policyID}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${session}`
			}
		});

		if (response.status === 401) {
			throw redirect(302, '/auth');
		}

		if (!response.ok) {
			const errorText = (await response.text()).trim();
			return fail(response.status, {
				action: 'deletePolicy',
				success: false,
				message: errorText || 'Failed to delete policy.'
			});
		}

		return { action: 'deletePolicy', success: true, message: 'Policy deleted.' };
	}
};
