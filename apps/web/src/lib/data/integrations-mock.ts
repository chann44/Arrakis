export type IntegrationStatus = 'connected' | 'needs_attention' | 'not_connected';

export type IntegrationProvider = 'slack' | 'jira' | 'linear' | 'discord';

export type IntegrationSummary = {
	provider: IntegrationProvider;
	name: string;
	status: IntegrationStatus;
	workspace: string;
	lastSync: string;
	messagesSent7d: number;
	itemsCreated7d: number;
	errors7d: number;
	enabled: boolean;
	notifyOnCritical: boolean;
	notifyOnScanComplete: boolean;
	repoFilter: string;
	severityFilter: string;
	targetMapping: string;
	eventFilter: string;
};

export type IntegrationActivity = {
	id: string;
	provider: IntegrationProvider;
	time: string;
	eventType: string;
	target: string;
	result: 'success' | 'failed' | 'retrying';
	details: string;
};

export const integrations: IntegrationSummary[] = [
	{
		provider: 'slack',
		name: 'Slack',
		status: 'connected',
		workspace: 'arrakis-security',
		lastSync: '2m ago',
		messagesSent7d: 142,
		itemsCreated7d: 0,
		errors7d: 2,
		enabled: true,
		notifyOnCritical: true,
		notifyOnScanComplete: false,
		repoFilter: 'api-service, web-frontend',
		severityFilter: 'critical, high',
		targetMapping: '#sec-alerts, #eng-vulns',
		eventFilter: 'finding.opened, finding.resolved, scan.failed'
	},
	{
		provider: 'jira',
		name: 'Jira',
		status: 'connected',
		workspace: 'ARRAKIS / SEC',
		lastSync: '6m ago',
		messagesSent7d: 0,
		itemsCreated7d: 19,
		errors7d: 1,
		enabled: true,
		notifyOnCritical: true,
		notifyOnScanComplete: false,
		repoFilter: 'all repositories',
		severityFilter: 'critical',
		targetMapping: 'Project SEC, Type Bug, Priority Highest',
		eventFilter: 'finding.opened, finding.reopened'
	},
	{
		provider: 'linear',
		name: 'Linear',
		status: 'needs_attention',
		workspace: 'Arrakis Platform',
		lastSync: '1d ago',
		messagesSent7d: 0,
		itemsCreated7d: 7,
		errors7d: 9,
		enabled: true,
		notifyOnCritical: true,
		notifyOnScanComplete: true,
		repoFilter: 'worker, scheduler',
		severityFilter: 'critical, high, medium',
		targetMapping: 'Team Platform, State Triage',
		eventFilter: 'finding.opened, scan.failed, policy.blocked'
	},
	{
		provider: 'discord',
		name: 'Discord',
		status: 'not_connected',
		workspace: '-',
		lastSync: '-',
		messagesSent7d: 0,
		itemsCreated7d: 0,
		errors7d: 0,
		enabled: false,
		notifyOnCritical: false,
		notifyOnScanComplete: false,
		repoFilter: '-',
		severityFilter: '-',
		targetMapping: '-',
		eventFilter: '-'
	}
];

export const integrationActivities: IntegrationActivity[] = [
	{
		id: 'A-1108',
		provider: 'slack',
		time: '2026-04-08T10:42:11Z',
		eventType: 'finding.opened',
		target: '#sec-alerts',
		result: 'success',
		details: 'Posted CVE alert for api-service (critical)'
	},
	{
		id: 'A-1107',
		provider: 'jira',
		time: '2026-04-08T10:39:04Z',
		eventType: 'finding.opened',
		target: 'SEC-481',
		result: 'success',
		details: 'Created issue for vulnerable dependency nanoid@3.1.30'
	},
	{
		id: 'A-1106',
		provider: 'linear',
		time: '2026-04-08T10:31:56Z',
		eventType: 'scan.failed',
		target: 'PLAT-319',
		result: 'retrying',
		details: 'Rate-limited by API, retry scheduled in 60s'
	},
	{
		id: 'A-1105',
		provider: 'slack',
		time: '2026-04-08T09:57:12Z',
		eventType: 'finding.resolved',
		target: '#eng-vulns',
		result: 'success',
		details: 'Posted resolution update for auth-service finding F-008'
	},
	{
		id: 'A-1104',
		provider: 'linear',
		time: '2026-04-08T09:12:44Z',
		eventType: 'finding.opened',
		target: 'PLAT-318',
		result: 'failed',
		details: 'Permission denied while creating issue in team backlog'
	},
	{
		id: 'A-1103',
		provider: 'jira',
		time: '2026-04-08T08:23:18Z',
		eventType: 'finding.reopened',
		target: 'SEC-472',
		result: 'success',
		details: 'Reopened ticket after failed patch verification'
	}
];

export const integrationByProvider = (provider: string) =>
	integrations.find((integration) => integration.provider === provider);

export const integrationActivitiesForProvider = (provider: string) =>
	integrationActivities.filter((entry) => entry.provider === provider);
