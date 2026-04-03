import type { Handle } from '@sveltejs/kit';

type TokenPayload = {
	sub?: string;
	login?: string;
	name?: string;
	email?: string;
	avatar_url?: string;
	exp?: number;
};

function decodeBase64URL(value: string): string {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function verifyToken(token: string): App.Locals['user'] {
	if (!token) return null;

	const parts = token.split('.');
	if (parts.length !== 3) {
		return {
			id: token.slice(0, 12),
			login: 'user'
		};
	}

	try {
		const payload = JSON.parse(decodeBase64URL(parts[1])) as TokenPayload;
		if (payload.exp && payload.exp * 1000 < Date.now()) {
			return null;
		}

		const id = payload.sub ?? payload.email ?? payload.login;
		if (!id) return null;

		return {
			id,
			login: payload.login ?? payload.email ?? 'user',
			name: payload.name,
			email: payload.email,
			avatarUrl: payload.avatar_url
		};
	} catch {
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session') ?? '';
	event.locals.user = verifyToken(token);
	return resolve(event);
};
