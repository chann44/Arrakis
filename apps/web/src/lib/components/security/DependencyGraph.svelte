<script lang="ts">
	import { onMount } from 'svelte';
	import type { Dependency, Finding, Repo } from '$lib/data/security-mock';

	type NodeData = {
		id: string;
		label: string;
		kind: 'repo' | 'dep' | 'finding';
		name?: string;
	};

	let {
		dependencies,
		findings,
		repos,
		focusRepo,
		onSelectDependency = () => {}
	}: {
		dependencies: Dependency[];
		findings: Finding[];
		repos: Repo[];
		focusRepo?: string;
		onSelectDependency?: (name: string) => void;
	} = $props();

	let container: HTMLDivElement | null = null;

	const normDep = (dep: string) => dep.split('@')[0];

	const graphData = $derived.by(() => {
		const sourceFindings = focusRepo ? findings.filter((f) => f.repo === focusRepo) : findings;

		const depNames = new Set(sourceFindings.map((f) => normDep(f.dep)));
		const repoNames = new Set(sourceFindings.map((f) => f.repo));

		const nodes: NodeData[] = [];
		const edges: { id: string; source: string; target: string }[] = [];

		for (const repoName of repoNames) {
			nodes.push({ id: `repo:${repoName}`, label: repoName, kind: 'repo' });
		}

		for (const depName of depNames) {
			const dep = dependencies.find((d) => d.name === depName);
			nodes.push({
				id: `dep:${depName}`,
				label: depName,
				kind: 'dep',
				name: dep?.name ?? depName
			});
		}

		for (const finding of sourceFindings) {
			nodes.push({ id: `finding:${finding.id}`, label: finding.id, kind: 'finding' });

			const depName = normDep(finding.dep);
			edges.push({
				id: `repo->dep:${finding.repo}:${depName}`,
				source: `repo:${finding.repo}`,
				target: `dep:${depName}`
			});
			edges.push({
				id: `dep->finding:${depName}:${finding.id}`,
				source: `dep:${depName}`,
				target: `finding:${finding.id}`
			});
		}

		return {
			nodes: Array.from(new Map(nodes.map((n) => [n.id, n])).values()),
			edges: Array.from(new Map(edges.map((e) => [e.id, e])).values())
		};
	});

	onMount(() => {
		if (!container) return;

		let cyRef: any = null;

		const init = async () => {
			const cytoscape = (await import('cytoscape')).default;
			if (!container) return;

			cyRef = cytoscape({
				container,
				elements: [
					...graphData.nodes.map((n) => ({ data: n })),
					...graphData.edges.map((e) => ({ data: e }))
				],
				style: [
					{
						selector: 'node',
						style: {
							label: 'data(label)',
							'font-size': 10,
							color: '#ece8d7',
							'text-wrap': 'wrap',
							'background-color': '#2e2b23',
							'border-color': '#4b4332',
							'border-width': 1,
							width: 'label',
							height: 20,
							padding: '4px'
						}
					},
					{
						selector: 'node[kind="repo"]',
						style: { 'background-color': '#25322b', 'border-color': '#3b5f4f' }
					},
					{
						selector: 'node[kind="dep"]',
						style: { 'background-color': '#3a3018', 'border-color': '#7a6431' }
					},
					{
						selector: 'node[kind="finding"]',
						style: { 'background-color': '#3d1f1d', 'border-color': '#7d3a35' }
					},
					{
						selector: 'edge',
						style: {
							width: 1,
							'line-color': '#554938',
							'target-arrow-shape': 'triangle',
							'target-arrow-color': '#554938',
							'curve-style': 'bezier'
						}
					}
				],
				layout: {
					name: 'cose',
					animate: false,
					nodeRepulsion: 2600,
					idealEdgeLength: 90
				}
			});

			cyRef.on('tap', 'node[kind="dep"]', (evt: any) => {
				const name = evt.target.data('name');
				if (name) onSelectDependency(name);
			});
		};

		init();

		return () => {
			cyRef?.destroy();
		};
	});
</script>

<div
	class="h-[360px] w-full rounded border border-border bg-background/50"
	bind:this={container}
></div>
