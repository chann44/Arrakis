<script lang="ts">
	import {
		Background,
		Controls,
		MarkerType,
		MiniMap,
		SvelteFlow,
		type Edge as FlowEdge,
		type Node as FlowNode
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	let tab = $state<'dependency-files' | 'dependencies'>('dependency-files');
	let dependenciesView = $state<'table' | 'graph'>('table');
	let selectedGraphNodeId = $state<string>('');
	let graphFilterPeer = $state<boolean>(true);
	let graphFilterDev = $state<boolean>(true);
	let graphFilterOptional = $state<boolean>(true);
	let flowNodes = $state.raw<FlowNode[]>([]);
	let flowEdges = $state.raw<FlowEdge[]>([]);

	type GraphNode = {
		id: string;
		name: string;
		depth: number;
		x: number;
		y: number;
		latestVersion: string;
		versionSpec: string;
		dependencyType: string;
		registry: string;
		manager: string;
		creator: string;
		description: string;
		license: string;
		homepage: string;
		repositoryUrl: string;
		registryUrl: string;
		lastUpdated: string;
		iconUrl: string;
		iconLabel: string;
	};

	type GraphEdge = {
		id: string;
		from: string;
		to: string;
		dependencyType: string;
	};

	const formattedUpdatedAt = $derived(
		data.repo?.updated_at ? new Date(data.repo.updated_at).toLocaleString() : '-'
	);

	const repositoryRegistries = $derived.by(() => {
		const registries = new Set<string>();
		for (const file of data.dependencyFiles ?? []) {
			if (file.registry) {
				registries.add(file.registry);
			}
		}
		return [...registries].sort((a, b) => a.localeCompare(b));
	});

	const shouldShowFetchDeps = $derived(
		(data.dependencies?.length ?? 0) === 0 || (data.dependencyFiles?.length ?? 0) === 0
	);

	const graphableDependencies = $derived(data.dependencies ?? []);

	const iconLabelForManager = (manager: string): string => {
		switch ((manager || '').toLowerCase()) {
			case 'npm':
				return 'N';
			case 'pip':
				return 'P';
			case 'go':
				return 'G';
			default:
				return 'D';
		}
	};

	const faviconFromUrl = (rawUrl: string): string => {
		if (!rawUrl) return '';
		try {
			const parsed = new URL(rawUrl);
			return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
		} catch {
			return '';
		}
	};

	const graphModel = $derived.by(() => {
		const deps = graphableDependencies;
		if (!deps || deps.length === 0) {
			return { nodes: [] as GraphNode[], edges: [] as GraphEdge[], width: 900, height: 260, rootId: '' };
		}

		const maxRenderedNodes = 1400;
		const depthGap = 320;
		const laneGap = 108;
		const blockGap = 96;
		const horizontalPadding = 80;
		const verticalPadding = 48;

		const shouldIncludeByType = (dependencyType: string): boolean => {
			switch (dependencyType) {
				case 'peer':
					return graphFilterPeer;
				case 'dev':
					return graphFilterDev;
				case 'optional':
					return graphFilterOptional;
				default:
					return true;
			}
		};

		const byDepth = new Map<number, GraphNode[]>();
		const nodesById = new Map<string, GraphNode>();
		const rootDepthNameIndex = new Map<string, string>();
		let firstRootId = '';
		let currentBlockTop = verticalPadding;
		let maxDepthSeen = 1;

		for (const dep of deps as any[]) {
			if (nodesById.size >= maxRenderedNodes) break;

			const rootId = `root:${dep.name}:${dep.latest_version || dep.version_spec || '-'}`;
			if (!firstRootId) firstRootId = rootId;
			const root: GraphNode = {
				id: rootId,
				name: dep.name,
				depth: 0,
				x: 0,
				y: 0,
				latestVersion: dep.latest_version || '-',
				versionSpec: dep.version_spec || '-',
				dependencyType: 'root',
				registry: dep.registry || '-',
				manager: dep.manager || '-',
				creator: dep.creator || '-',
				description: dep.description || '',
				license: dep.license || '-',
				homepage: dep.homepage || '',
				repositoryUrl: dep.repository_url || '',
				registryUrl: dep.registry_url || '',
				lastUpdated: dep.last_updated || '',
				iconUrl: faviconFromUrl(dep.registry_url || dep.repository_url || ''),
				iconLabel: iconLabelForManager(dep.manager)
			};
			nodesById.set(root.id, root);
			if (!byDepth.has(0)) byDepth.set(0, []);
			byDepth.get(0)?.push(root);
			rootDepthNameIndex.set(`${rootId}|0|${dep.name}`, root.id);

			const filteredChildren = (dep.dependency_graph ?? []).filter((child: any) =>
				shouldIncludeByType(child.dependency_type || 'default')
			);
			const localByDepth = new Map<number, GraphNode[]>();

			for (const child of filteredChildren) {
				if (nodesById.size >= maxRenderedNodes) break;

				const depth = Math.max(1, Number(child.depth || 1));
				const depType = child.dependency_type || 'default';
				const id = `${rootId}:${depth}:${depType}:${child.parent || dep.name}:${child.name}:${child.latest_version || child.version_spec || '-'}`;
				if (!nodesById.has(id)) {
					const node: GraphNode = {
						id,
						name: child.name,
						depth,
						x: 0,
						y: 0,
						latestVersion: child.latest_version || '-',
						versionSpec: child.version_spec || '-',
						dependencyType: child.dependency_type || 'default',
						registry: child.registry || '-',
						manager: child.manager || '-',
						creator: child.creator || '-',
						description: child.description || '',
						license: child.license || '-',
						homepage: child.homepage || '',
						repositoryUrl: child.repository_url || '',
						registryUrl: child.registry_url || '',
						lastUpdated: child.last_updated || '',
						iconUrl: faviconFromUrl(child.registry_url || child.repository_url || ''),
						iconLabel: iconLabelForManager(child.manager)
					};
					nodesById.set(id, node);
					if (!byDepth.has(depth)) byDepth.set(depth, []);
					byDepth.get(depth)?.push(node);
					if (!localByDepth.has(depth)) localByDepth.set(depth, []);
					localByDepth.get(depth)?.push(node);
					if (!rootDepthNameIndex.has(`${rootId}|${depth}|${child.name}`)) {
						rootDepthNameIndex.set(`${rootId}|${depth}|${child.name}`, node.id);
					}
				}
			}

			const localDepths = [0, ...localByDepth.keys()];
			const localMaxDepth = Math.max(1, ...localDepths);
			if (localMaxDepth > maxDepthSeen) maxDepthSeen = localMaxDepth;
			const localTallest = Math.max(1, ...(localDepths.map((d) => (d === 0 ? 1 : (localByDepth.get(d)?.length ?? 0)))));
			const blockHeight = Math.max(190, localTallest * laneGap + 84);

			for (const depth of localDepths) {
				const depthNodes = depth === 0 ? [root] : (localByDepth.get(depth) ?? []);
				depthNodes.sort((a, b) => {
					if (a.dependencyType !== b.dependencyType) {
						return a.dependencyType.localeCompare(b.dependencyType);
					}
					return a.name.localeCompare(b.name);
				});

				const localColumnHeight = (depthNodes.length - 1) * laneGap;
				const startY = currentBlockTop + Math.max(26, (blockHeight-localColumnHeight) / 2);
				depthNodes.forEach((node, idx) => {
					node.x = horizontalPadding + depth * depthGap + (depth % 2 === 0 ? 0 : 10);
					node.y = startY + idx * laneGap;
				});
			}

			root.x = horizontalPadding;
			root.y = currentBlockTop + blockHeight / 2;
			currentBlockTop += blockHeight + blockGap;

		}

		const widthHint = horizontalPadding * 2 + (maxDepthSeen + 1) * depthGap;
		const width = Math.max(1200, widthHint);
		const height = Math.max(640, currentBlockTop + verticalPadding);

		const edges: GraphEdge[] = [];
		for (const dep of deps as any[]) {
			const rootId = `root:${dep.name}:${dep.latest_version || dep.version_spec || '-'}`;
			const filteredChildren = (dep.dependency_graph ?? []).filter((child: any) =>
				shouldIncludeByType(child.dependency_type || 'default')
			);
			for (const child of filteredChildren) {
				const depth = Math.max(1, Number(child.depth || 1));
				const depType = child.dependency_type || 'default';
				const childId = `${rootId}:${depth}:${depType}:${child.parent || dep.name}:${child.name}:${child.latest_version || child.version_spec || '-'}`;
				if (!nodesById.has(childId)) continue;

				let from = rootId;
				if (depth > 1) {
					const indexedParent = rootDepthNameIndex.get(`${rootId}|${depth - 1}|${child.parent}`);
					if (indexedParent) from = indexedParent;
				}
				edges.push({
					id: `${from}->${childId}`,
					from,
					to: childId,
					dependencyType: child.dependency_type || 'default'
				});
			}
		}

		return { nodes: [...nodesById.values()], edges, width, height, rootId: firstRootId };
	});

	const selectedGraphNode = $derived.by(() => {
		const { nodes } = graphModel;
		if (nodes.length === 0 || !selectedGraphNodeId) return null;
		return nodes.find((n) => n.id === selectedGraphNodeId) ?? null;
	});

	const highlightedGraphPath = $derived.by(() => {
		const selected = selectedGraphNode;
		const { edges, nodes } = graphModel;
		const highlightedNodeIds = new Set<string>();
		const highlightedEdgeIds = new Set<string>();
		if (!selected) {
			return { highlightedNodeIds, highlightedEdgeIds };
		}

		const nodeByID = new Map(nodes.map((node) => [node.id, node]));

		const edgesByTo = new Map<string, GraphEdge[]>();
		for (const edge of edges) {
			if (!edgesByTo.has(edge.to)) {
				edgesByTo.set(edge.to, []);
			}
			edgesByTo.get(edge.to)?.push(edge);
		}

		let current = selected.id;
		highlightedNodeIds.add(current);
		while ((nodeByID.get(current)?.depth ?? 0) > 0) {
			const incoming = edgesByTo.get(current);
			if (!incoming || incoming.length === 0) break;
			const edge = incoming[0];
			highlightedEdgeIds.add(edge.id);
			highlightedNodeIds.add(edge.from);
			current = edge.from;
		}

		return { highlightedNodeIds, highlightedEdgeIds };
	});

	$effect(() => {
		const { nodes } = graphModel;
		if (nodes.length === 0) {
			selectedGraphNodeId = '';
			return;
		}
		if (selectedGraphNodeId && !nodes.some((node) => node.id === selectedGraphNodeId)) {
			selectedGraphNodeId = '';
		}
	});

	function resetGraphViewport() {
		selectedGraphNodeId = '';
	}

	const flowGraphNodes = $derived.by(() =>
		graphModel.nodes.map((node) => {
			const highlighted = highlightedGraphPath.highlightedNodeIds.has(node.id);
			const selected = selectedGraphNodeId === node.id;
			const labelPrefix = node.iconLabel ? `${node.iconLabel} ` : '';
			return {
				id: node.id,
				position: { x: node.x, y: node.y },
				data: { label: `${labelPrefix}${node.name}` },
				type: 'default',
				draggable: false,
				selectable: true,
				style: `background: var(--color-primary); color: var(--color-primary-foreground); border: 2px solid ${selected ? 'var(--color-foreground)' : highlighted ? nodeStroke(node.dependencyType) : 'var(--color-primary)'}; border-radius: 10px; opacity: ${selectedGraphNodeId ? (highlighted ? 1 : 0.55) : 1}; font-size: 11px; font-weight: 600; padding: 8px 10px; min-width: 130px;`
			} satisfies FlowNode;
		})
	);

	const flowGraphEdges = $derived.by(() =>
		graphModel.edges.map((edge) => {
			const highlighted = highlightedGraphPath.highlightedEdgeIds.has(edge.id);
			return {
				id: edge.id,
				source: edge.from,
				target: edge.to,
				type: 'smoothstep',
				animated: highlighted,
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: highlighted ? 'var(--color-primary)' : edgeStroke(edge.dependencyType)
				},
				style: `stroke: ${highlighted ? 'var(--color-primary)' : edgeStroke(edge.dependencyType)}; stroke-width: ${highlighted ? 2.8 : 1.5}; opacity: ${selectedGraphNodeId ? (highlighted ? 1 : 0.35) : 0.95}; ${edge.dependencyType === 'peer' ? 'stroke-dasharray: 4 3;' : ''}`
			} satisfies FlowEdge;
		})
	);

	$effect(() => {
		flowNodes = flowGraphNodes;
		flowEdges = flowGraphEdges;
	});

	function onFlowNodeClick(event: { node: { id: string } }) {
		selectedGraphNodeId = event.node.id;
	}

	const nodeStroke = (dependencyType: string): string => {
		switch (dependencyType) {
			case 'peer':
				return '#f59e0b';
			case 'dev':
				return '#38bdf8';
			case 'optional':
				return '#22c55e';
			case 'root':
				return '#111827';
			default:
				return 'var(--color-primary)';
		}
	};

	const edgeStroke = (dependencyType: string): string => {
		switch (dependencyType) {
			case 'peer':
				return '#f59e0b';
			case 'dev':
				return '#0ea5e9';
			case 'optional':
				return '#22c55e';
			default:
				return '#94a3b8';
		}
	};
</script>

<div class="soc-page">
	{#if form && typeof form === 'object' && 'queued' in form && form.queued}
		<section class="soc-section mb-3 border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
			Dependency fetch job queued (status: {form.syncStatus ?? 'queued'}). Refresh in a moment to see updated results.
		</section>
	{/if}

	{#if form && typeof form === 'object' && 'message' in form && form.message}
		<section class="soc-section mb-3 border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
			{form.message}
		</section>
	{/if}

	<div class="flex items-center gap-2 text-xs">
		<a class="text-primary" href="/repos">&larr; repos</a>
		<span class="text-muted-foreground">/</span>
		<h1 class="soc-page-title text-base">{data.repo?.name ?? 'Repository'}</h1>
	</div>

	{#if !data.repo}
		<section class="soc-section p-4 text-sm text-muted-foreground">Repository not found.</section>
	{:else}
		<section class="soc-grid-4">
			<div class="soc-section p-3 text-xs">
				<p class="soc-subtle">Status</p>
				<p class="mt-1 text-sm font-semibold {data.repo.connected ? 'text-emerald-600' : ''}">
					{data.repo.connected ? 'Connected' : 'Not connected'}
				</p>
			</div>
			<div class="soc-section p-3 text-xs">
				<p class="soc-subtle">Stars</p>
				<p class="mt-1 text-sm font-semibold">{data.repo.stargazers_count}</p>
			</div>
			<div class="soc-section p-3 text-xs">
				<p class="soc-subtle">Forks</p>
				<p class="mt-1 text-sm font-semibold">{data.repo.forks_count}</p>
			</div>
			<div class="soc-section p-3 text-xs">
				<p class="soc-subtle">Open Issues</p>
				<p class="mt-1 text-sm font-semibold">{data.repo.open_issues_count}</p>
			</div>
		</section>

		<section class="soc-grid-2">
			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Repository Info</p></div>
				<div class="space-y-2 p-3 text-xs">
					<div class="flex justify-between"><span class="soc-subtle">Name</span><span>{data.repo.name}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Full Name</span><span>{data.repo.full_name}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Visibility</span><span>{data.repo.private ? 'Private' : 'Public'}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Default Branch</span><span>{data.repo.default_branch}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Language</span><span>{data.repo.language || '-'}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Registry</span><span>{repositoryRegistries.length > 0 ? repositoryRegistries.join(', ') : '-'}</span></div>
					<div class="flex justify-between"><span class="soc-subtle">Last Update</span><span>{formattedUpdatedAt}</span></div>
				</div>
			</div>

			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Actions</p></div>
				<div class="space-y-2 p-3 text-xs">
					<a class="soc-btn-primary inline-block" href={data.repo.html_url} target="_blank" rel="noreferrer">
						Open on GitHub
					</a>
					<form method="POST" action="?/fetchDeps" class="inline-block">
						<button class={shouldShowFetchDeps ? 'soc-btn-primary' : 'soc-btn'} type="submit">
							Fetch Deps
						</button>
					</form>
					{#if data.syncStatus}
						<div class="rounded border border-border p-2 text-[11px]">
							<div class="flex items-center justify-between">
								<span class="soc-subtle">Sync status</span>
								<span>{data.syncStatus}</span>
							</div>
							{#if data.lastSyncedAt}
								<div class="flex items-center justify-between">
									<span class="soc-subtle">Last synced</span>
									<span>{new Date(data.lastSyncedAt).toLocaleString()}</span>
								</div>
							{/if}
							{#if data.syncError}
								<p class="mt-1 text-rose-700">{data.syncError}</p>
							{/if}
						</div>
					{/if}
					<p class="soc-subtle">Description</p>
					<p class="text-sm">{data.repo.description || 'No description available.'}</p>
				</div>
			</div>
		</section>

		<div class="flex items-center gap-2">
			<button class="soc-btn" type="button" onclick={() => (tab = 'dependency-files')}
				>Dependency Files</button
			>
			<button class="soc-btn" type="button" onclick={() => (tab = 'dependencies')}>Dependencies</button>
		</div>

		{#if tab === 'dependency-files'}
			<section class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Dependency Files</p></div>
				<div class="p-3 text-xs">
					{#if (data.dependencyFiles?.length ?? 0) === 0}
						<p class="soc-subtle">No supported dependency files found.</p>
					{:else}
						<table class="soc-table">
							<thead>
								<tr>
									<th>File</th>
									<th>Path</th>
									<th>Language Manager</th>
									<th>Registry</th>
								</tr>
							</thead>
							<tbody>
								{#each data.dependencyFiles as file}
									<tr>
										<td class="font-medium">{file.file}</td>
										<td class="soc-subtle">{file.path}</td>
										<td>{file.manager}</td>
										<td class="text-primary">{file.registry}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</section>
		{:else}
			<section class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Dependencies</p></div>
				<div class="p-3 text-xs">
					<div class="mb-3 flex items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<button class="soc-btn" type="button" onclick={() => (dependenciesView = 'table')}>Table View</button>
							<button class="soc-btn" type="button" onclick={() => (dependenciesView = 'graph')}>Graph View</button>
						</div>
						{#if dependenciesView === 'graph'}
							<div class="flex flex-wrap items-center gap-2">
								<button class="soc-btn" type="button" onclick={resetGraphViewport}>Reset View</button>
								<button
									type="button"
									class={graphFilterPeer ? 'soc-btn-primary' : 'soc-btn'}
									onclick={() => (graphFilterPeer = !graphFilterPeer)}
								>
									peer
								</button>
								<button
									type="button"
									class={graphFilterDev ? 'soc-btn-primary' : 'soc-btn'}
									onclick={() => (graphFilterDev = !graphFilterDev)}
								>
									dev
								</button>
								<button
									type="button"
									class={graphFilterOptional ? 'soc-btn-primary' : 'soc-btn'}
									onclick={() => (graphFilterOptional = !graphFilterOptional)}
								>
									optional
								</button>
								<span class="rounded border border-border bg-muted px-2 py-1 text-[11px]">
									{graphModel.nodes.length} nodes / {graphModel.edges.length} edges
								</span>
								<span class="rounded border border-amber-300/50 bg-amber-100/10 px-2 py-1 text-[11px] text-amber-700">peer</span>
								<span class="rounded border border-sky-300/50 bg-sky-100/10 px-2 py-1 text-[11px] text-sky-700">dev</span>
								<span class="rounded border border-emerald-300/50 bg-emerald-100/10 px-2 py-1 text-[11px] text-emerald-700">optional</span>
							</div>
						{/if}
					</div>

					{#if (data.dependencies?.length ?? 0) === 0}
						<p class="soc-subtle">No dependencies extracted yet.</p>
					{:else if dependenciesView === 'graph'}
						{#if graphModel.nodes.length === 0}
							<p class="soc-subtle">No graph data available yet for dependencies.</p>
						{:else}
							<div class="relative">
								<div
									class="repo-flow h-[74vh] overflow-hidden rounded border border-border bg-gradient-to-b from-background via-background to-muted/20 p-2 shadow-inner ring-1 ring-primary/15"
								>
									<SvelteFlow
										bind:nodes={flowNodes}
										bind:edges={flowEdges}
										fitView
										fitViewOptions={{ padding: 0.28, minZoom: 0.2, maxZoom: 1.8 }}
										onnodeclick={onFlowNodeClick}
										proOptions={{ hideAttribution: true }}
										colorMode="dark"
										panOnScroll
										selectionOnDrag
									>
										<Background bgColor="transparent" patternColor="var(--color-border)" gap={20} />
										<MiniMap
											zoomable
											pannable
											bgColor="var(--color-card)"
											nodeColor={(node) => {
												const id = String(node.id);
												if (id.includes(':peer:')) return '#f59e0b';
												if (id.includes(':dev:')) return '#0ea5e9';
												if (id.includes(':optional:')) return '#22c55e';
												return 'var(--color-primary)';
											}}
											maskColor="color-mix(in oklab, var(--color-primary) 16%, transparent)"
											maskStrokeColor="var(--color-primary)"
										/>
										<Controls showLock={false} class="repo-flow-controls" />
									</SvelteFlow>
								</div>
								{#if selectedGraphNode}
									<div class="absolute right-3 top-3 w-80 rounded border border-border bg-muted/90 p-3 text-xs shadow-lg backdrop-blur">
										<div class="mb-2 flex items-center justify-between gap-2">
											<p class="text-sm font-semibold">{selectedGraphNode.name}</p>
											<button class="soc-btn" type="button" onclick={() => (selectedGraphNodeId = '')}>Close</button>
										</div>
										<div class="space-y-1">
											<div class="flex justify-between"><span class="soc-subtle">Type</span><span>{selectedGraphNode.dependencyType}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Depth</span><span>{selectedGraphNode.depth}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Version</span><span>{selectedGraphNode.versionSpec}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Latest</span><span>{selectedGraphNode.latestVersion}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Registry</span><span>{selectedGraphNode.registry}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Manager</span><span>{selectedGraphNode.manager}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Creator</span><span>{selectedGraphNode.creator || '-'}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">License</span><span>{selectedGraphNode.license || '-'}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Last Updated</span><span>{selectedGraphNode.lastUpdated ? new Date(selectedGraphNode.lastUpdated).toLocaleDateString() : '-'}</span></div>
											{#if selectedGraphNode.description}
												<p class="pt-1 text-[11px] text-muted-foreground">{selectedGraphNode.description}</p>
											{/if}
											{#if selectedGraphNode.registryUrl}
												<a class="soc-btn mt-2 inline-block" href={selectedGraphNode.registryUrl} target="_blank" rel="noreferrer">Open Registry</a>
											{/if}
										</div>
									</div>
								{/if}
								<!--
								<div class="rounded border border-border bg-muted/10 p-3 text-xs">
									{#if selectedGraphNode}
										<p class="mb-2 text-sm font-semibold">{selectedGraphNode.name}</p>
										<div class="space-y-1">
											<div class="flex justify-between"><span class="soc-subtle">Type</span><span>{selectedGraphNode.dependencyType}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Depth</span><span>{selectedGraphNode.depth}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Version</span><span>{selectedGraphNode.versionSpec}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Latest</span><span>{selectedGraphNode.latestVersion}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Registry</span><span>{selectedGraphNode.registry}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Manager</span><span>{selectedGraphNode.manager}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Creator</span><span>{selectedGraphNode.creator || '-'}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">License</span><span>{selectedGraphNode.license || '-'}</span></div>
											<div class="flex justify-between"><span class="soc-subtle">Last Updated</span><span>{selectedGraphNode.lastUpdated ? new Date(selectedGraphNode.lastUpdated).toLocaleDateString() : '-'}</span></div>
											{#if selectedGraphNode.description}
												<p class="pt-1 text-[11px] text-muted-foreground">{selectedGraphNode.description}</p>
											{/if}
											{#if selectedGraphNode.registryUrl}
												<a class="soc-btn mt-2 inline-block" href={selectedGraphNode.registryUrl} target="_blank" rel="noreferrer">Open Registry</a>
											{/if}
										</div>
									{/if}
								</div>
								-->
							</div>
						{/if}
					{:else}
						<table class="soc-table">
							<thead>
								<tr>
									<th>Name</th>
									<th>Versions</th>
									<th>Latest</th>
									<th>Creator</th>
									<th>Registry</th>
									<th>Scopes</th>
									<th>Used In</th>
									<th>Last Updated</th>
									<th>Graph</th>
									<th>Link</th>
								</tr>
							</thead>
							<tbody>
								{#each data.dependencies as dep}
									<tr>
										<td class="font-medium">{dep.name}</td>
										<td class="soc-subtle">{dep.version_specs && dep.version_specs.length > 0 ? dep.version_specs.join(', ') : dep.version_spec || '-'}</td>
										<td>{dep.latest_version || '-'}</td>
										<td>{dep.creator || '-'}</td>
										<td class="text-primary">{dep.registry}</td>
										<td>{dep.scopes && dep.scopes.length > 0 ? dep.scopes.join(', ') : dep.scope}</td>
										<td class="soc-subtle">{dep.usage_count > 0 ? `${dep.usage_count} file(s)` : (dep.used_in_files?.length ?? 0) > 0 ? `${dep.used_in_files?.length} file(s)` : '-'}</td>
										<td class="soc-subtle">{dep.last_updated ? new Date(dep.last_updated).toLocaleDateString() : '-'}</td>
										<td>
											{#if dep.dependency_graph && dep.dependency_graph.length > 0}
												<details>
													<summary class="cursor-pointer text-primary">{dep.dependency_graph.length} deps</summary>
													<div class="mt-1 max-h-56 overflow-auto rounded border border-border">
														<table class="soc-table text-[11px]">
															<thead>
																<tr>
																	<th>Name</th>
																	<th>Parent</th>
																	<th>Depth</th>
																	<th>Version</th>
																	<th>Latest</th>
																	<th>Creator</th>
																	<th>Registry</th>
																	<th>Last Updated</th>
																	<th>Link</th>
																</tr>
															</thead>
															<tbody>
																{#each dep.dependency_graph as child}
																	<tr>
																		<td class="font-medium">{child.name}</td>
																		<td class="soc-subtle">{child.parent || '-'}</td>
																		<td>{child.depth}</td>
																		<td class="soc-subtle">{child.version_spec || '-'}</td>
																		<td>{child.latest_version || '-'}</td>
																		<td>{child.creator || '-'}</td>
																		<td class="text-primary">{child.registry || '-'}</td>
																		<td class="soc-subtle">{child.last_updated ? new Date(child.last_updated).toLocaleDateString() : '-'}</td>
																		<td>
																			{#if child.registry_url}
																				<a class="soc-btn" href={child.registry_url} target="_blank" rel="noreferrer">Open</a>
																			{:else}
																				<span class="soc-subtle">-</span>
																			{/if}
																		</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												</details>
											{:else}
												<span class="soc-subtle">-</span>
											{/if}
										</td>
										<td>
											{#if dep.registry_url}
												<a class="soc-btn" href={dep.registry_url} target="_blank" rel="noreferrer">Open</a>
											{:else}
												<span class="soc-subtle">-</span>
											{/if}
										</td>
									</tr>
									{#if (dep.scopes && dep.scopes.includes('peer')) || dep.scope === 'peer'}
										<tr>
											<td colspan="10" class="bg-amber-50/70">
												<details>
													<summary class="cursor-pointer py-1 text-[11px] font-medium text-amber-900">
														Peer dependency details for {dep.name}
													</summary>
													<div class="mt-1 space-y-1 rounded border border-amber-200 bg-white p-2 text-[11px]">
														<div class="flex items-center justify-between">
															<span class="soc-subtle">Scopes</span>
															<span>{dep.scopes && dep.scopes.length > 0 ? dep.scopes.join(', ') : dep.scope}</span>
														</div>
														<div class="flex items-center justify-between">
															<span class="soc-subtle">Declared Versions</span>
															<span>{dep.version_specs && dep.version_specs.length > 0 ? dep.version_specs.join(', ') : dep.version_spec || '-'}</span>
														</div>
														<div class="flex items-center justify-between">
															<span class="soc-subtle">Used In</span>
															<span>{dep.used_in_files && dep.used_in_files.length > 0 ? dep.used_in_files.join(', ') : dep.source_file || '-'}</span>
														</div>
													</div>
												</details>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	:global(.repo-flow .svelte-flow__node) {
		box-shadow: 0 6px 20px color-mix(in oklab, var(--color-primary) 20%, transparent);
		transition: box-shadow 140ms ease, transform 140ms ease;
	}

	:global(.repo-flow .svelte-flow__node:hover) {
		box-shadow: 0 10px 26px color-mix(in oklab, var(--color-primary) 28%, transparent);
		transform: translateY(-1px);
	}

	:global(.repo-flow .svelte-flow__controls) {
		border: 1px solid var(--color-border);
		background: color-mix(in oklab, var(--color-card) 88%, transparent);
		border-radius: 10px;
		overflow: hidden;
	}

	:global(.repo-flow .svelte-flow__controls button) {
		background: transparent;
		color: var(--color-foreground);
		border-color: var(--color-border);
	}
</style>
