import { env } from '$env/dynamic/private';

export function getApiBaseUrl(): string {
	return env.API_BASE_URL || 'http://localhost:8080';
}
