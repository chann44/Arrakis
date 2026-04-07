import type { PageServerLoad } from './$types';
import { getApiBaseUrl } from '$lib/server/api-base';

const API_BASE_URL = getApiBaseUrl();

type Repo = {
	id: number;
	name: string;
	full_name: string;
	connected: boolean;
};

type Finding = {
	severity: 'critical' | 'high' | 'medium' | 'low' | string;
	repository?: string;
	package_name: string;
	manager: string;
	registry: string;
	resolved_version?: string;
	version_spec?: string;
};

type Scan = {
	id: number;
	repository: string;
	trigger: string;
	status: string;
	duration?: string;
	findings_total: number;
	started_at: string;
	finished_at?: string;
};

const emptyData = {
	stats: {
		repositories: 0,
		criticalFindings: 0,
		highRiskDeps: 0,
		scansToday: 0,
		lastScanLabel: '-'
	},
	severity: [
		{ label: 'critical', count: 0 },
		{ label: 'high', count: 0 },
		{ label: 'medium', count: 0 },
		{ label: 'low', count: 0 }
	],
	totalFindings: 0,
	policyStatus: [] as Array<{ name: string; risk: number; policy: 'pass' | 'fail' }>,
	recentScans: [] as Array<{
		id: string;
		repo: string;
		trigger: string;
		dur: string;
		findings: number;
		status: string;
	}>
};

function safeDate(value?: string): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed;
}

function utcDayKey(value: Date): string {
	return `${value.getUTCFullYear()}-${value.getUTCMonth()}-${value.getUTCDate()}`;
}

function formatSince(date: Date): string {
	const ms = Date.now() - date.getTime();
	if (ms < 0) return 'just now';
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	return `${day}d ago`;
}

function computeRiskScore(counts: { critical: number; high: number; medium: number; low: number }): number {
	const weighted = counts.critical * 30 + counts.high * 15 + counts.medium * 6 + counts.low * 2;
	return Math.min(100, weighted);
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const session = cookies.get('session');
	if (!session) {
		return emptyData;
	}

	const headers = { Authorization: `Bearer ${session}` };

	const [reposRes, findingsRes, scansRes] = await Promise.all([
		fetch(`${API_BASE_URL}/v1/github/repositories?page=1&page_size=100`, { headers }),
		fetch(`${API_BASE_URL}/v1/findings`, { headers }),
		fetch(`${API_BASE_URL}/v1/scans`, { headers })
	]);

	const repositories: Repo[] = reposRes.ok
		? ((((await reposRes.json()) as { repositories?: Repo[] }).repositories ?? []) as Repo[])
		: [];
	const findings: Finding[] = findingsRes.ok
		? ((((await findingsRes.json()) as { findings?: Finding[] }).findings ?? []) as Finding[])
		: [];
	const scans: Scan[] = scansRes.ok
		? ((((await scansRes.json()) as { scans?: Scan[] }).scans ?? []) as Scan[])
		: [];

	const connectedRepos = repositories.filter((repo) => repo.connected);

	const severityCounts = {
		critical: findings.filter((finding) => finding.severity === 'critical').length,
		high: findings.filter((finding) => finding.severity === 'high').length,
		medium: findings.filter((finding) => finding.severity === 'medium').length,
		low: findings.filter((finding) => finding.severity === 'low').length
	};

	const highRiskDepSet = new Set<string>();
	for (const finding of findings) {
		if (finding.severity !== 'critical' && finding.severity !== 'high') continue;
		highRiskDepSet.add(
			[
				finding.manager,
				finding.registry,
				finding.package_name,
				finding.resolved_version || finding.version_spec || ''
			].join('|')
		);
	}

	const todayKey = utcDayKey(new Date());
	const scansToday = scans.filter((scan) => {
		const startedAt = safeDate(scan.started_at);
		if (!startedAt) return false;
		return utcDayKey(startedAt) === todayKey;
	}).length;

	const lastScan = scans
		.map((scan) => safeDate(scan.started_at))
		.filter((date): date is Date => date !== null)
		.sort((a, b) => b.getTime() - a.getTime())[0];

	const findingsByRepo = new Map<string, { critical: number; high: number; medium: number; low: number }>();
	for (const finding of findings) {
		const key = (finding.repository ?? '').trim();
		if (!key) continue;
		const current = findingsByRepo.get(key) ?? { critical: 0, high: 0, medium: 0, low: 0 };
		if (finding.severity === 'critical') current.critical++;
		else if (finding.severity === 'high') current.high++;
		else if (finding.severity === 'medium') current.medium++;
		else if (finding.severity === 'low') current.low++;
		findingsByRepo.set(key, current);
	}

	const policyChecks = await Promise.all(
		connectedRepos.slice(0, 50).map(async (repo) => {
			const response = await fetch(`${API_BASE_URL}/v1/github/repositories/${repo.id}/policy`, { headers });
			if (response.ok) {
				return { repoID: repo.id, policy: 'pass' as const };
			}
			if (response.status === 404) {
				return { repoID: repo.id, policy: 'fail' as const };
			}
			return { repoID: repo.id, policy: 'fail' as const };
		})
	);

	const policyByRepoID = new Map<number, 'pass' | 'fail'>();
	for (const check of policyChecks) {
		policyByRepoID.set(check.repoID, check.policy);
	}

	const policyStatus = connectedRepos
		.map((repo) => {
			const counts = findingsByRepo.get(repo.full_name) ?? { critical: 0, high: 0, medium: 0, low: 0 };
			return {
				name: repo.name,
				risk: computeRiskScore(counts),
				policy: policyByRepoID.get(repo.id) ?? 'fail'
			};
		})
		.sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));

	const recentScans = scans.slice(0, 5).map((scan) => ({
		id: String(scan.id),
		repo: scan.repository,
		trigger: scan.trigger,
		dur: scan.duration || '-',
		findings: scan.findings_total,
		status: scan.status
	}));

	return {
		stats: {
			repositories: connectedRepos.length,
			criticalFindings: severityCounts.critical,
			highRiskDeps: highRiskDepSet.size,
			scansToday,
			lastScanLabel: lastScan ? formatSince(lastScan) : '-'
		},
		severity: [
			{ label: 'critical', count: severityCounts.critical },
			{ label: 'high', count: severityCounts.high },
			{ label: 'medium', count: severityCounts.medium },
			{ label: 'low', count: severityCounts.low }
		],
		totalFindings: findings.length,
		policyStatus,
		recentScans
	};
};
