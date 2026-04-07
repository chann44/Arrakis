import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getApiBaseUrl } from '$lib/server/api-base';

const API_BASE_URL = getApiBaseUrl();

type SummaryResponse = {
	services_up?: number;
	services_total?: number;
	queue_backlog?: number;
	dependency_sync_throughput_1h?: number;
	scan_throughput_1h?: number;
	version?: string;
};

type ServicesResponse = {
	services?: Array<{
		key: string;
		name: string;
		status: string;
		latency_ms: number;
		uptime_pct: number;
		last_checked_at: string;
		note: string;
	}>;
};

type LogServicesResponse = {
	services?: Array<{
		key: string;
		name: string;
	}>;
	containers?: Array<{
		id: string;
		name: string;
		service: string;
		state: string;
		status: string;
	}>;
};

type QueuesResponse = {
	queues?: Array<{
		queue: string;
		job_type: string;
		pending: number;
		running: number;
		failed: number;
		sampled_at: string;
	}>;
};

type LogsResponse = {
	items?: Array<{
		id: number;
		service: string;
		container?: string;
		stream?: string;
		level: string;
		message: string;
		metadata: Record<string, unknown>;
		source?: string;
		created_at: string;
	}>;
	next_cursor?: number;
};

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const serviceFilter = (url.searchParams.get('service') ?? '').trim();
	const containerFilter = (url.searchParams.get('container') ?? '').trim();
	const levelFilter = (url.searchParams.get('level') ?? '').trim();
	const cursor = (url.searchParams.get('cursor') ?? '').trim();
	const logTab = (url.searchParams.get('logs_tab') ?? 'service').trim() === 'docker' ? 'docker' : 'service';
	const logSource = logTab === 'docker' ? 'docker' : 'service';

	const headers = { Authorization: `Bearer ${session}` };
	const logsQuery = new URLSearchParams();
	if (serviceFilter) logsQuery.set('service', serviceFilter);
	if (containerFilter) logsQuery.set('container', containerFilter);
	if (levelFilter) logsQuery.set('level', levelFilter);
	if (cursor) logsQuery.set('cursor', cursor);
	logsQuery.set('source', logSource);
	logsQuery.set('limit', '50');
	const logServiceQuery = new URLSearchParams({ source: logSource });

	const [summaryRes, servicesRes, queuesRes, logServicesRes, logsRes] = await Promise.all([
		fetch(`${API_BASE_URL}/v1/system-health/summary`, { headers }),
		fetch(`${API_BASE_URL}/v1/system-health/services`, { headers }),
		fetch(`${API_BASE_URL}/v1/system-health/queues`, { headers }),
		fetch(`${API_BASE_URL}/v1/system-health/logs/services?${logServiceQuery.toString()}`, { headers }),
		fetch(`${API_BASE_URL}/v1/system-health/logs?${logsQuery.toString()}`, { headers })
	]);

	if (
		summaryRes.status === 401 ||
		servicesRes.status === 401 ||
		queuesRes.status === 401 ||
		logServicesRes.status === 401 ||
		logsRes.status === 401
	) {
		throw redirect(302, '/auth');
	}

	const summary = summaryRes.ok ? (((await summaryRes.json()) as SummaryResponse) ?? {}) : {};
	const services = servicesRes.ok ? (((await servicesRes.json()) as ServicesResponse) ?? {}) : {};
	const queues = queuesRes.ok ? (((await queuesRes.json()) as QueuesResponse) ?? {}) : {};
	const logServices = logServicesRes.ok
		? (((await logServicesRes.json()) as LogServicesResponse) ?? {})
		: {};
	const logs = logsRes.ok ? (((await logsRes.json()) as LogsResponse) ?? {}) : {};

	return {
		summary,
		services: services.services ?? [],
		queues: queues.queues ?? [],
		logServices: logServices.services ?? [],
		logContainers: logServices.containers ?? [],
		logs: logs.items ?? [],
		nextCursor: logs.next_cursor ?? 0,
		logsTab: logTab,
		filters: {
			service: serviceFilter,
			container: containerFilter,
			level: levelFilter,
			source: logSource
		}
	};
};
