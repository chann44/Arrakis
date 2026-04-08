import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { integrationActivities, integrations } from '$lib/data/integrations-mock';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const pageParam = Number(url.searchParams.get('page') ?? '1');
	const pageSize = 5;
	const total = integrationActivities.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const page = Number.isFinite(pageParam) ? Math.min(Math.max(1, Math.floor(pageParam)), totalPages) : 1;
	const start = (page - 1) * pageSize;
	const activities = integrationActivities.slice(start, start + pageSize);

	return {
		integrations,
		activities,
		pagination: {
			page,
			pageSize,
			total,
			totalPages
		}
	};
};
