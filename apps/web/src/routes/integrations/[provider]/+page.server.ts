import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { integrationActivitiesForProvider, integrationByProvider } from '$lib/data/integrations-mock';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const integration = integrationByProvider(params.provider);
	if (!integration) {
		throw error(404, 'Integration not found');
	}

	return {
		integration,
		activities: integrationActivitiesForProvider(params.provider)
	};
};
