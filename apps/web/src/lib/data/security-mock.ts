export type Repo = {
	id: number;
	name: string;
	branch: string;
	eco: string[];
	scan: string;
	risk: number;
	crit: number;
	high: number;
	policy: 'pass' | 'fail';
	sync: 'ok' | 'stale';
};

export type Finding = {
	id: string;
	sev: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	repo: string;
	dep: string;
	rule: string;
	detected: string;
	status: 'open' | 'reviewing' | 'resolved';
};

export type Scan = {
	id: string;
	repo: string;
	branch: string;
	trigger: 'pr' | 'scheduled' | 'manual';
	dur: string;
	status: 'done' | 'failed';
	findings: number;
	diff: string;
};

export type Policy = {
	id: string;
	name: string;
	condition: string;
	sev: 'critical' | 'high' | 'medium' | 'low';
	action: 'block' | 'flag' | 'warn';
	enabled: boolean;
};

export type Dependency = {
	name: string;
	ver: string;
	latest: string;
	eco: 'npm' | 'go' | 'pip';
	type: 'direct' | 'transitive';
	risk: number;
	vuln: number;
	stale: boolean;
	flag: boolean;
};

export const repos: Repo[] = [
	{
		id: 1,
		name: 'api-service',
		branch: 'main',
		eco: ['npm', 'go'],
		scan: '2m ago',
		risk: 87,
		crit: 3,
		high: 8,
		policy: 'fail',
		sync: 'ok'
	},
	{
		id: 2,
		name: 'web-frontend',
		branch: 'main',
		eco: ['npm'],
		scan: '5m ago',
		risk: 42,
		crit: 0,
		high: 2,
		policy: 'pass',
		sync: 'ok'
	},
	{
		id: 3,
		name: 'data-pipeline',
		branch: 'main',
		eco: ['pip'],
		scan: '1h ago',
		risk: 71,
		crit: 2,
		high: 5,
		policy: 'fail',
		sync: 'ok'
	},
	{
		id: 4,
		name: 'auth-service',
		branch: 'main',
		eco: ['npm', 'go'],
		scan: '3h ago',
		risk: 28,
		crit: 0,
		high: 0,
		policy: 'pass',
		sync: 'ok'
	},
	{
		id: 5,
		name: 'ml-worker',
		branch: 'dev',
		eco: ['pip'],
		scan: '6h ago',
		risk: 55,
		crit: 1,
		high: 3,
		policy: 'fail',
		sync: 'stale'
	},
	{
		id: 6,
		name: 'infra-tools',
		branch: 'main',
		eco: ['go'],
		scan: '1d ago',
		risk: 15,
		crit: 0,
		high: 1,
		policy: 'pass',
		sync: 'ok'
	}
];

export const findings: Finding[] = [
	{
		id: 'F-001',
		sev: 'critical',
		title: 'CVE-2024-45337 in golang.org/x/crypto',
		repo: 'api-service',
		dep: 'golang.org/x/crypto@0.17.0',
		rule: 'CVE',
		detected: '2h ago',
		status: 'open'
	},
	{
		id: 'F-002',
		sev: 'critical',
		title: 'CVE-2024-55565 in nanoid',
		repo: 'api-service',
		dep: 'nanoid@3.1.30',
		rule: 'CVE',
		detected: '2h ago',
		status: 'open'
	},
	{
		id: 'F-003',
		sev: 'high',
		title: 'Postinstall script detected',
		repo: 'api-service',
		dep: 'esbuild@0.19.2',
		rule: 'postinstall',
		detected: '2h ago',
		status: 'open'
	},
	{
		id: 'F-004',
		sev: 'critical',
		title: 'CVE-2024-21538 in cross-spawn',
		repo: 'data-pipeline',
		dep: 'cross-spawn@7.0.3',
		rule: 'CVE',
		detected: '1h ago',
		status: 'open'
	},
	{
		id: 'F-005',
		sev: 'high',
		title: 'Package published 3 days ago',
		repo: 'data-pipeline',
		dep: '@scope/new-pkg@1.0.0',
		rule: 'new-pkg',
		detected: '1h ago',
		status: 'open'
	},
	{
		id: 'F-006',
		sev: 'medium',
		title: 'Dependency confusion risk',
		repo: 'ml-worker',
		dep: 'internal-utils@2.1.0',
		rule: 'dep-confusion',
		detected: '6h ago',
		status: 'reviewing'
	},
	{
		id: 'F-007',
		sev: 'high',
		title: 'CVE-2024-4067 in micromatch',
		repo: 'web-frontend',
		dep: 'micromatch@4.0.5',
		rule: 'CVE',
		detected: '5m ago',
		status: 'open'
	},
	{
		id: 'F-008',
		sev: 'low',
		title: 'Unmaintained package (2yr)',
		repo: 'auth-service',
		dep: 'node-uuid@1.4.8',
		rule: 'unmaintained',
		detected: '3h ago',
		status: 'open'
	}
];

export const scans: Scan[] = [
	{
		id: 'SCN-0041',
		repo: 'web-frontend',
		branch: 'main',
		trigger: 'pr',
		dur: '12s',
		status: 'done',
		findings: 3,
		diff: '+1'
	},
	{
		id: 'SCN-0040',
		repo: 'api-service',
		branch: 'main',
		trigger: 'scheduled',
		dur: '28s',
		status: 'done',
		findings: 11,
		diff: '+3'
	},
	{
		id: 'SCN-0039',
		repo: 'data-pipeline',
		branch: 'main',
		trigger: 'manual',
		dur: '45s',
		status: 'done',
		findings: 7,
		diff: '-2'
	},
	{
		id: 'SCN-0038',
		repo: 'ml-worker',
		branch: 'dev',
		trigger: 'scheduled',
		dur: '31s',
		status: 'failed',
		findings: 0,
		diff: '—'
	},
	{
		id: 'SCN-0037',
		repo: 'auth-service',
		branch: 'main',
		trigger: 'pr',
		dur: '9s',
		status: 'done',
		findings: 1,
		diff: '0'
	},
	{
		id: 'SCN-0036',
		repo: 'infra-tools',
		branch: 'main',
		trigger: 'manual',
		dur: '14s',
		status: 'done',
		findings: 1,
		diff: '0'
	}
];

export const policies: Policy[] = [
	{
		id: 'P-01',
		name: 'Block new packages (<7d)',
		condition: 'package_age < 7d',
		sev: 'critical',
		action: 'block',
		enabled: true
	},
	{
		id: 'P-02',
		name: 'Flag postinstall scripts',
		condition: 'has_postinstall = true',
		sev: 'high',
		action: 'flag',
		enabled: true
	},
	{
		id: 'P-03',
		name: 'Fail on critical CVEs',
		condition: 'cve_severity = critical',
		sev: 'critical',
		action: 'block',
		enabled: true
	},
	{
		id: 'P-04',
		name: 'Dependency confusion risk',
		condition: 'pkg_name matches internal pattern',
		sev: 'medium',
		action: 'warn',
		enabled: true
	},
	{
		id: 'P-05',
		name: 'Unmaintained packages (>2yr)',
		condition: 'last_commit_age > 730d',
		sev: 'low',
		action: 'warn',
		enabled: true
	},
	{
		id: 'P-06',
		name: 'Deprecated registry packages',
		condition: 'registry_status = deprecated',
		sev: 'medium',
		action: 'flag',
		enabled: false
	}
];

export const dependencies: Dependency[] = [
	{
		name: 'express',
		ver: '4.18.2',
		latest: '4.21.2',
		eco: 'npm',
		type: 'direct',
		risk: 22,
		vuln: 0,
		stale: false,
		flag: false
	},
	{
		name: 'nanoid',
		ver: '3.1.30',
		latest: '5.0.9',
		eco: 'npm',
		type: 'direct',
		risk: 91,
		vuln: 2,
		stale: true,
		flag: true
	},
	{
		name: 'golang.org/x/crypto',
		ver: '0.17.0',
		latest: '0.29.0',
		eco: 'go',
		type: 'direct',
		risk: 88,
		vuln: 1,
		stale: true,
		flag: false
	},
	{
		name: 'esbuild',
		ver: '0.19.2',
		latest: '0.24.2',
		eco: 'npm',
		type: 'direct',
		risk: 65,
		vuln: 0,
		stale: false,
		flag: true
	},
	{
		name: 'numpy',
		ver: '1.24.0',
		latest: '2.1.3',
		eco: 'pip',
		type: 'direct',
		risk: 30,
		vuln: 0,
		stale: false,
		flag: false
	},
	{
		name: 'lodash',
		ver: '4.17.21',
		latest: '4.17.21',
		eco: 'npm',
		type: 'transitive',
		risk: 12,
		vuln: 0,
		stale: false,
		flag: false
	},
	{
		name: '@scope/new-pkg',
		ver: '1.0.0',
		latest: '1.0.0',
		eco: 'npm',
		type: 'direct',
		risk: 78,
		vuln: 0,
		stale: false,
		flag: true
	},
	{
		name: 'cross-spawn',
		ver: '7.0.3',
		latest: '7.0.6',
		eco: 'npm',
		type: 'transitive',
		risk: 82,
		vuln: 1,
		stale: false,
		flag: false
	},
	{
		name: 'micromatch',
		ver: '4.0.5',
		latest: '4.0.8',
		eco: 'npm',
		type: 'transitive',
		risk: 55,
		vuln: 1,
		stale: false,
		flag: false
	},
	{
		name: 'requests',
		ver: '2.28.0',
		latest: '2.32.3',
		eco: 'pip',
		type: 'direct',
		risk: 18,
		vuln: 0,
		stale: false,
		flag: false
	}
];

export const evidenceMap: Record<string, string[]> = {
	CVE: [
		'Matched CVE advisory in OSV database',
		'Installed version within affected range',
		'No patch applied in lock file'
	],
	postinstall: [
		'package.json contains postinstall script',
		'Script executes: node scripts/postinstall.js',
		'Script not audited; network calls detected'
	],
	'new-pkg': [
		'Package first published 3 days ago',
		'No prior version history',
		'Registry: npmjs.com'
	],
	'dep-confusion': [
		'Package name matches internal naming pattern',
		'Public registry version exists',
		'Could shadow private registry package'
	],
	unmaintained: [
		'Last commit: 2022-01-14',
		'No maintainer activity in 730+ days',
		'0 open issue responses'
	]
};
