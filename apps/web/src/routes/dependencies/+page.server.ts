import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getApiBaseUrl } from '$lib/server/api-base';

const API_BASE_URL = getApiBaseUrl();

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

type Repo = {
	id: number;
	name: string;
	full_name: string;
	connected: boolean;
};

type DependenciesResponse = {
	dependencies?: RepoDependency[];
	total_pages?: number;
};

type RepoDependency = {
	name: string;
	version_spec: string;
	version_specs?: string[];
	latest_version: string;
	manager: string;
	registry: string;
	scope: string;
	scopes?: string[];
	usage_count: number;
	used_in_files?: string[];
	last_updated: string;
	dependency_graph?: Array<{
		name: string;
		parent?: string;
		depth: number;
		dependency_type?: string;
		version_spec: string;
		latest_version: string;
		manager: string;
		registry: string;
	}>;
};

type RepoFinding = {
	id: number;
	repository?: string;
	package_name: string;
	manager: string;
	registry: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | string;
	status: string;
	title: string;
	advisory_id: string;
	resolved_version?: string;
	version_spec?: string;
	created_at?: string;
	updated_at?: string;
};

type DependencyOverview = {
	key: string;
	name: string;
	manager: string;
	registry: string;
	versions: string[];
	latestVersions: string[];
	scopes: string[];
	repoCount: number;
	repos: Array<{
		repoID: number;
		repoName: string;
		fullName: string;
		usageCount: number;
		scopes: string[];
		versions: string[];
		lastUpdated: string;
	}>;
	findingCounts: {
		critical: number;
		high: number;
		medium: number;
		low: number;
		open: number;
		resolved: number;
	};
	findings: Array<{
		id: number;
		repoID: number;
		repoName: string;
		severity: string;
		status: string;
		title: string;
		advisoryID: string;
		version: string;
		createdAt: string;
	}>;
	peerEdges: Array<{
		from: string;
		to: string;
		type: string;
		repoID: number;
		repoName: string;
	}>;
	riskScore: number;
};

const toKey = (manager: string, registry: string, name: string) =>
	`${manager.trim().toLowerCase()}|${registry.trim().toLowerCase()}|${name.trim().toLowerCase()}`;

const unique = (values: string[]) => Array.from(new Set(values.filter((value) => value.trim() !== ''))).sort();

const calcRiskScore = (counts: { critical: number; high: number; medium: number; low: number }) => {
	const weighted = counts.critical * 30 + counts.high * 15 + counts.medium * 6 + counts.low * 2;
	return Math.min(100, weighted);
};

async function fetchConnectedRepos(fetchFn: FetchFn, headers: { Authorization: string }): Promise<Repo[]> {
	const first = await fetchFn(`${API_BASE_URL}/v1/github/repositories?page=1&page_size=100`, { headers });
	if (!first.ok) return [];
	const firstPayload = (await first.json()) as { repositories?: Repo[]; total_pages?: number };
	const repos = [...(firstPayload.repositories ?? [])];
	const totalPages = Math.max(1, Number(firstPayload.total_pages ?? 1));
	if (totalPages <= 1) {
		return repos.filter((repo) => repo.connected);
	}

	const remaining = await Promise.all(
		Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2).map(async (page) => {
			const response = await fetchFn(`${API_BASE_URL}/v1/github/repositories?page=${page}&page_size=100`, {
				headers
			});
			if (!response.ok) return [] as Repo[];
			const payload = (await response.json()) as { repositories?: Repo[] };
			return payload.repositories ?? [];
		})
	);

	return [...repos, ...remaining.flat()].filter((repo) => repo.connected);
}

async function fetchAllDependenciesForRepo(
	fetchFn: FetchFn,
	headers: { Authorization: string },
	repoID: number
): Promise<RepoDependency[]> {
	const first = await fetchFn(
		`${API_BASE_URL}/v1/github/repositories/${repoID}/dependencies?page=1&page_size=100`,
		{ headers }
	);
	if (!first.ok) return [];
	const firstPayload = (await first.json()) as DependenciesResponse;
	const deps = [...(firstPayload.dependencies ?? [])];
	const totalPages = Math.max(1, Number(firstPayload.total_pages ?? 1));
	if (totalPages <= 1) return deps;

	const remaining = await Promise.all(
		Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2).map(async (page) => {
			const response = await fetchFn(
				`${API_BASE_URL}/v1/github/repositories/${repoID}/dependencies?page=${page}&page_size=100`,
				{ headers }
			);
			if (!response.ok) return [] as RepoDependency[];
			const payload = (await response.json()) as DependenciesResponse;
			return payload.dependencies ?? [];
		})
	);

	return [...deps, ...remaining.flat()];
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const session = cookies.get('session');
	if (!session) {
		throw redirect(302, '/auth');
	}

	const headers = { Authorization: `Bearer ${session}` };
	const repos = await fetchConnectedRepos(fetch, headers);

	const perRepoData = await Promise.all(
		repos.map(async (repo) => {
			const [dependencies, findingsRes] = await Promise.all([
				fetchAllDependenciesForRepo(fetch, headers, repo.id),
				fetch(`${API_BASE_URL}/v1/github/repositories/${repo.id}/findings`, { headers })
			]);

			const findings: RepoFinding[] = findingsRes.ok
				? (((await findingsRes.json()) as { findings?: RepoFinding[] }).findings ?? [])
				: [];

			return { repo, dependencies, findings };
		})
	);

	const dependencyMap = new Map<string, DependencyOverview>();

	for (const { repo, dependencies, findings } of perRepoData) {
		const findingsByDep = new Map<string, RepoFinding[]>();
		for (const finding of findings) {
			const fKey = toKey(finding.manager, finding.registry, finding.package_name);
			const current = findingsByDep.get(fKey) ?? [];
			current.push(finding);
			findingsByDep.set(fKey, current);
		}

		for (const dep of dependencies) {
			const key = toKey(dep.manager, dep.registry, dep.name);
			let entry = dependencyMap.get(key);
			if (!entry) {
				entry = {
					key,
					name: dep.name,
					manager: dep.manager,
					registry: dep.registry,
					versions: [],
					latestVersions: [],
					scopes: [],
					repoCount: 0,
					repos: [],
					findingCounts: { critical: 0, high: 0, medium: 0, low: 0, open: 0, resolved: 0 },
					findings: [],
					peerEdges: [],
					riskScore: 0
				};
				dependencyMap.set(key, entry);
			}

			entry.versions = unique([
				...entry.versions,
				dep.version_spec,
				...(dep.version_specs ?? [])
			]);
			entry.latestVersions = unique([...entry.latestVersions, dep.latest_version]);
			entry.scopes = unique([...entry.scopes, dep.scope, ...(dep.scopes ?? [])]);

			const existingRepo = entry.repos.find((item) => item.repoID === repo.id);
			if (existingRepo) {
				existingRepo.usageCount += dep.usage_count || 1;
				existingRepo.scopes = unique([...existingRepo.scopes, dep.scope, ...(dep.scopes ?? [])]);
				existingRepo.versions = unique([
					...existingRepo.versions,
					dep.version_spec,
					...(dep.version_specs ?? [])
				]);
				if (!existingRepo.lastUpdated && dep.last_updated) {
					existingRepo.lastUpdated = dep.last_updated;
				}
			} else {
				entry.repos.push({
					repoID: repo.id,
					repoName: repo.name,
					fullName: repo.full_name,
					usageCount: dep.usage_count || 1,
					scopes: unique([dep.scope, ...(dep.scopes ?? [])]),
					versions: unique([dep.version_spec, ...(dep.version_specs ?? [])]),
					lastUpdated: dep.last_updated
				});
			}

			for (const graphDep of dep.dependency_graph ?? []) {
				entry.peerEdges.push({
					from: (graphDep.parent ?? dep.name).trim() || dep.name,
					to: graphDep.name,
					type: graphDep.dependency_type || 'default',
					repoID: repo.id,
					repoName: repo.name
				});
			}

			for (const finding of findingsByDep.get(key) ?? []) {
				entry.findings.push({
					id: finding.id,
					repoID: repo.id,
					repoName: repo.name,
					severity: finding.severity,
					status: finding.status,
					title: finding.title || finding.advisory_id,
					advisoryID: finding.advisory_id,
					version: finding.resolved_version || finding.version_spec || '-',
					createdAt: finding.created_at || finding.updated_at || ''
				});
				if (finding.severity === 'critical') entry.findingCounts.critical++;
				else if (finding.severity === 'high') entry.findingCounts.high++;
				else if (finding.severity === 'medium') entry.findingCounts.medium++;
				else if (finding.severity === 'low') entry.findingCounts.low++;

				if ((finding.status || '').toLowerCase() === 'resolved') entry.findingCounts.resolved++;
				else entry.findingCounts.open++;
			}
		}
	}

	const dependencies = [...dependencyMap.values()].map((entry) => {
		const dedupFindings = new Map<string, DependencyOverview['findings'][number]>();
		for (const finding of entry.findings) {
			dedupFindings.set(`${finding.id}:${finding.repoID}`, finding);
		}
		entry.findings = [...dedupFindings.values()].sort((a, b) => {
			const weight = (severity: string) =>
				severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
			return weight(b.severity) - weight(a.severity) || a.repoName.localeCompare(b.repoName);
		});
		entry.repoCount = entry.repos.length;
		entry.repos.sort((a, b) => a.repoName.localeCompare(b.repoName));
		entry.riskScore = calcRiskScore(entry.findingCounts);
		return entry;
	});

	dependencies.sort((a, b) => b.riskScore - a.riskScore || b.repoCount - a.repoCount || a.name.localeCompare(b.name));

	return {
		summary: {
			totalDependencies: dependencies.length,
			totalRepos: repos.length,
			totalFindings: dependencies.reduce((sum, item) => sum + item.findings.length, 0),
			depsWithPeerGraph: dependencies.filter((item) => item.peerEdges.length > 0).length
		},
		dependencies
	};
};
