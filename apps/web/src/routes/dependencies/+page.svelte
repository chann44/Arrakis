<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import RepoDependencyGraph from '$lib/components/repos/DependencyGraph.svelte';
	import { RiskScore, SeverityBadge, StatusBadge } from '$lib/components/security';

	let { data }: { data: any } = $props();

	const initialParams = page.url.searchParams;
	const rawSeverity = (initialParams.get('severity') ?? 'all').toLowerCase();
	const rawTab = (initialParams.get('tab') ?? 'repos').toLowerCase();

	let query = $state(initialParams.get('q') ?? '');
	let manager = $state(initialParams.get('manager') ?? 'all');
	let scope = $state(initialParams.get('scope') ?? 'all');
	let minSeverity = $state<'all' | 'critical' | 'high' | 'medium' | 'low'>(
		rawSeverity === 'critical' || rawSeverity === 'high' || rawSeverity === 'medium' || rawSeverity === 'low'
			? rawSeverity
			: 'all'
	);
	let onlyWithFindings = $state(initialParams.get('with_findings') === '1');
	let onlyWithPeerGraph = $state(initialParams.get('with_graph') === '1');
	let graphPeerOnly = $state(initialParams.get('peer_only') !== '0');
	let inspectorTab = $state<'repos' | 'findings' | 'graph'>(
		rawTab === 'findings' || rawTab === 'graph' ? rawTab : 'repos'
	);
	let selectedKey = $state(initialParams.get('dep') ?? '');

	const allDependencies = $derived((data.dependencies ?? []) as any[]);

	const managers = $derived(
		Array.from(new Set(allDependencies.map((item) => item.manager))).sort((a, b) => a.localeCompare(b))
	);

	const scopes = $derived(
		Array.from(new Set(allDependencies.flatMap((item) => item.scopes ?? []))).sort((a, b) =>
			a.localeCompare(b)
		)
	);

	const severityRank = (severity: string) => {
		if (severity === 'critical') return 4;
		if (severity === 'high') return 3;
		if (severity === 'medium') return 2;
		if (severity === 'low') return 1;
		return 0;
	};

	const minSeverityRank = $derived(severityRank(minSeverity));

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return allDependencies.filter((item) => {
			if (manager !== 'all' && item.manager !== manager) return false;
			if (scope !== 'all' && !(item.scopes ?? []).includes(scope)) return false;
			if (onlyWithFindings && (item.findings?.length ?? 0) === 0) return false;
			if (onlyWithPeerGraph && (item.peerEdges?.length ?? 0) === 0) return false;

			if (minSeverity !== 'all') {
				const maxRank = Math.max(
					item.findingCounts?.critical > 0 ? 4 : 0,
					item.findingCounts?.high > 0 ? 3 : 0,
					item.findingCounts?.medium > 0 ? 2 : 0,
					item.findingCounts?.low > 0 ? 1 : 0
				);
				if (maxRank < minSeverityRank) return false;
			}

			if (!q) return true;
			const searchable = [
				item.name,
				item.manager,
				item.registry,
				(item.repos ?? []).map((repo: any) => repo.repoName).join(' '),
				(item.versions ?? []).join(' '),
				(item.latestVersions ?? []).join(' ')
			]
				.join(' ')
				.toLowerCase();
			return searchable.includes(q);
		});
	});

	$effect(() => {
		if (filtered.length === 0) {
			selectedKey = '';
			return;
		}
		if (!selectedKey || !filtered.some((item) => item.key === selectedKey)) {
			selectedKey = filtered[0].key;
		}
	});

	const selected = $derived(filtered.find((item) => item.key === selectedKey) ?? null);

	const graphModel = $derived.by(() => {
		if (!selected) return { nodes: [], edges: [], rootId: '' };

		const nodes: Array<{ id: string; label: string; type: string }> = [];
		const edges: Array<{ source: string; target: string; type: string }> = [];

		const seenNodes = new Set<string>();
		const seenEdges = new Set<string>();

		const addNode = (id: string, label: string, type: string) => {
			if (seenNodes.has(id)) return;
			seenNodes.add(id);
			nodes.push({ id, label, type });
		};

		const addEdge = (source: string, target: string, type: string) => {
			const key = `${source}|${target}|${type}`;
			if (seenEdges.has(key)) return;
			seenEdges.add(key);
			edges.push({ source, target, type });
		};

		const rootId = `dep:${selected.key}`;
		addNode(rootId, selected.name, 'root');

		for (const repo of selected.repos ?? []) {
			const id = `repo:${repo.repoID}`;
			addNode(id, repo.repoName, 'direct');
			addEdge(rootId, id, 'direct');
		}

		for (const edge of selected.peerEdges ?? []) {
			if (graphPeerOnly && edge.type !== 'peer') continue;

			const repoNode = `repo:${edge.repoID}`;
			const parentId = edge.from.trim().toLowerCase() === selected.name.trim().toLowerCase()
				? rootId
				: `node:${edge.from.toLowerCase()}`;
			const childId = `node:${edge.to.toLowerCase()}`;

			if (parentId !== rootId) {
				addNode(parentId, edge.from, edge.type || 'default');
				if (seenNodes.has(repoNode)) {
					addEdge(repoNode, parentId, edge.type || 'default');
				} else {
					addEdge(rootId, parentId, edge.type || 'default');
				}
			}

			addNode(childId, edge.to, edge.type || 'default');
			addEdge(parentId, childId, edge.type || 'default');
		}

		return { nodes, edges, rootId };
	});

	const fmtDate = (value: string) => {
		if (!value) return '-';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '-';
		return d.toLocaleDateString();
	};

	$effect(() => {
		if (!browser) return;

		const next = new URL(window.location.href);
		const setOrDelete = (key: string, value: string, defaultValue: string) => {
			if (value === defaultValue) {
				next.searchParams.delete(key);
				return;
			}
			next.searchParams.set(key, value);
		};

		setOrDelete('q', query.trim(), '');
		setOrDelete('manager', manager, 'all');
		setOrDelete('scope', scope, 'all');
		setOrDelete('severity', minSeverity, 'all');
		setOrDelete('tab', inspectorTab, 'repos');
		setOrDelete('dep', selectedKey, '');

		if (onlyWithFindings) next.searchParams.set('with_findings', '1');
		else next.searchParams.delete('with_findings');

		if (onlyWithPeerGraph) next.searchParams.set('with_graph', '1');
		else next.searchParams.delete('with_graph');

		if (!graphPeerOnly) next.searchParams.set('peer_only', '0');
		else next.searchParams.delete('peer_only');

		const nextURL = `${next.pathname}${next.search}${next.hash}`;
		const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (nextURL !== currentURL) {
			window.history.replaceState(window.history.state, '', nextURL);
		}
	});
</script>

<div class="soc-page">
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="soc-page-title">Dependencies</h1>
		<p class="soc-subtle">Single-page dependency intelligence across all connected repositories.</p>
	</div>

	<section class="soc-grid-4">
		<div class="soc-stat">
			<p class="soc-stat-label">Dependencies</p>
			<p class="soc-stat-value">{data.summary.totalDependencies}</p>
		</div>
		<div class="soc-stat">
			<p class="soc-stat-label">Connected Repos</p>
			<p class="soc-stat-value">{data.summary.totalRepos}</p>
		</div>
		<div class="soc-stat">
			<p class="soc-stat-label">Mapped Findings</p>
			<p class="soc-stat-value">{data.summary.totalFindings}</p>
		</div>
		<div class="soc-stat">
			<p class="soc-stat-label">With Graph</p>
			<p class="soc-stat-value">{data.summary.depsWithPeerGraph}</p>
		</div>
	</section>

	<section class="soc-section p-3">
		<div class="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
			<input class="soc-input" bind:value={query} placeholder="Search dependency, version, repo..." />
			<select class="soc-input" bind:value={manager}>
				<option value="all">All managers</option>
				{#each managers as item}<option value={item}>{item}</option>{/each}
			</select>
			<select class="soc-input" bind:value={scope}>
				<option value="all">All scopes</option>
				{#each scopes as item}<option value={item}>{item}</option>{/each}
			</select>
			<select class="soc-input" bind:value={minSeverity}>
				<option value="all">Any severity</option>
				<option value="critical">Critical+</option>
				<option value="high">High+</option>
				<option value="medium">Medium+</option>
				<option value="low">Low+</option>
			</select>
		</div>
		<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
			<button class={onlyWithFindings ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (onlyWithFindings = !onlyWithFindings)}>with findings</button>
			<button class={onlyWithPeerGraph ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (onlyWithPeerGraph = !onlyWithPeerGraph)}>with graph</button>
			<span class="soc-subtle">{filtered.length} / {allDependencies.length} dependencies</span>
		</div>
	</section>

	<section class="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
		<div class="soc-section overflow-hidden">
			<div class="max-h-[68vh] overflow-auto">
				<table class="soc-table text-xs">
					<thead>
						<tr>
							<th>Dependency</th>
							<th>Version(s)</th>
							<th>Repos</th>
							<th>Findings</th>
							<th>Risk</th>
							<th>Scope</th>
						</tr>
					</thead>
					<tbody>
						{#if filtered.length === 0}
							<tr><td colspan="6" class="soc-subtle">No dependencies match current filters.</td></tr>
						{:else}
							{#each filtered as item}
								<tr
									class={`cursor-pointer ${selectedKey === item.key ? 'bg-primary/5' : ''}`}
									onclick={() => (selectedKey = item.key)}
								>
									<td>
										<div class="font-medium">{item.name}</div>
										<div class="soc-subtle">{item.manager} / {item.registry}</div>
									</td>
									<td class="soc-subtle">{item.latestVersions[0] || item.versions[0] || '-'}</td>
									<td>{item.repoCount}</td>
									<td>
										<div class="flex flex-wrap gap-1">
											{#if item.findingCounts.critical > 0}<span class="soc-badge soc-sev-critical">C {item.findingCounts.critical}</span>{/if}
											{#if item.findingCounts.high > 0}<span class="soc-badge soc-sev-high">H {item.findingCounts.high}</span>{/if}
											{#if item.findingCounts.medium > 0}<span class="soc-badge soc-sev-medium">M {item.findingCounts.medium}</span>{/if}
											{#if item.findingCounts.low > 0}<span class="soc-badge soc-sev-low">L {item.findingCounts.low}</span>{/if}
											{#if item.findings.length === 0}<span class="soc-subtle">-</span>{/if}
										</div>
									</td>
									<td><RiskScore value={item.riskScore} /></td>
									<td class="soc-subtle">{(item.scopes ?? []).join(', ') || '-'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

		<div class="soc-section p-3 text-xs">
			{#if !selected}
				<p class="soc-subtle">Select a dependency to inspect repos, findings, and graph.</p>
			{:else}
				<div class="mb-2">
					<p class="text-sm font-semibold text-primary">{selected.name}</p>
					<p class="soc-subtle">{selected.manager} / {selected.registry}</p>
				</div>

				<div class="mb-2 flex items-center gap-2">
					<button class={inspectorTab === 'repos' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (inspectorTab = 'repos')}>repos ({selected.repos.length})</button>
					<button class={inspectorTab === 'findings' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (inspectorTab = 'findings')}>findings ({selected.findings.length})</button>
					<button class={inspectorTab === 'graph' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (inspectorTab = 'graph')}>graph</button>
				</div>

				{#if inspectorTab === 'repos'}
					<div class="max-h-[56vh] overflow-auto rounded border border-border">
						<table class="soc-table text-xs">
							<thead><tr><th>Repo</th><th>Usage</th><th>Scopes</th><th>Version(s)</th></tr></thead>
							<tbody>
								{#each selected.repos as repo}
									<tr>
										<td class="font-medium"><a class="hover:text-primary" href={`/repos/${repo.repoID}`}>{repo.repoName}</a></td>
										<td>{repo.usageCount}</td>
										<td class="soc-subtle">{repo.scopes.join(', ') || '-'}</td>
										<td class="soc-subtle">{repo.versions.join(', ') || '-'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else if inspectorTab === 'findings'}
					<div class="mb-2 rounded border border-border p-2 text-[11px]">
						<div class="flex flex-wrap gap-1">
							<span class="soc-badge soc-sev-critical">critical {selected.findingCounts.critical}</span>
							<span class="soc-badge soc-sev-high">high {selected.findingCounts.high}</span>
							<span class="soc-badge soc-sev-medium">medium {selected.findingCounts.medium}</span>
							<span class="soc-badge soc-sev-low">low {selected.findingCounts.low}</span>
							<StatusBadge value={selected.findingCounts.open > 0 ? 'open' : 'resolved'} />
						</div>
					</div>
					<div class="max-h-[52vh] space-y-1 overflow-auto">
						{#if selected.findings.length === 0}
							<p class="soc-subtle">No findings mapped to this dependency.</p>
						{:else}
							{#each selected.findings as finding}
								<div class="rounded border border-border p-2">
									<div class="flex items-center justify-between gap-2">
										<p class="truncate font-medium">{finding.title}</p>
										<SeverityBadge value={finding.severity} />
									</div>
									<div class="mt-1 flex items-center justify-between gap-2 text-[11px]">
										<a class="hover:text-primary" href={`/repos/${finding.repoID}`}>{finding.repoName}</a>
										<span class="soc-subtle">{finding.advisoryID || '-'}</span>
										<span class="soc-subtle">{finding.version}</span>
										<span class="soc-subtle">{fmtDate(finding.createdAt)}</span>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{:else}
					<div class="mb-2 flex items-center gap-2">
						<button class={graphPeerOnly ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (graphPeerOnly = !graphPeerOnly)}>
							{graphPeerOnly ? 'peer-only graph' : 'all dependency types'}
						</button>
						<span class="soc-subtle">{graphModel.nodes.length} nodes / {graphModel.edges.length} edges</span>
					</div>
					<RepoDependencyGraph
						nodes={graphModel.nodes}
						edges={graphModel.edges}
						rootId={graphModel.rootId}
						height="52vh"
					/>
				{/if}
			{/if}
		</div>
	</section>
</div>
