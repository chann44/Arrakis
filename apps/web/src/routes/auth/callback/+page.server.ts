import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		throw redirect(302, '/auth');
	}

	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 60 * 24
	});

	throw redirect(302, '/');
};
