<script lang="ts">
	import { page } from '$app/state';
	import { DependencyGraph, EcoBadge, RiskScore, SeverityBadge } from '$lib/components/security';
	import { dependencies, findings, repos } from '$lib/data/security-mock';

	const rows = $derived(dependencies.filter((d) => d.risk > 20));
	let view = $state<'table' | 'graph'>('table');
	let selectedDep = $state<string | null>(null);
	const repoFindings = $derived(findings.filter((f) => f.repo === page.params.repoId));
	const selected = $derived(
		selectedDep ? dependencies.find((d) => d.name === selectedDep) : (rows[0] ?? null)
	);
	const selectedFindings = $derived(
		selected ? repoFindings.filter((f) => f.dep.startsWith(selected.name)) : []
	);
</script>

<div class="soc-page">
	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Repository Dependencies</h1>
		<div class="flex gap-1">
			<button class="soc-btn" type="button" onclick={() => (view = 'table')}>table</button><button
				class="soc-btn"
				type="button"
				onclick={() => (view = 'graph')}>graph</button
			>
		</div>
	</div>
	<p class="soc-subtle">Dependencies for repo: {page.params.repoId}</p>
	{#if view === 'table'}
		<section class="soc-section">
			<table class="soc-table">
				<thead
					><tr
						><th>Package</th><th>Version</th><th>Ecosystem</th><th>Type</th><th>Risk</th><th
							>Flags</th
						></tr
					></thead
				>
				<tbody>
					{#each rows as d}
						<tr class="soc-table-row-link" onclick={() => (selectedDep = d.name)}>
							<td class="font-medium">{d.name}</td>
							<td class="text-primary">{d.ver}</td>
							<td><EcoBadge value={d.eco} /></td>
							<td class="soc-subtle">{d.type}</td>
							<td><RiskScore value={d.risk} /></td>
							<td class="text-[10px]"
								>{d.flag ? 'flagged' : '-'} {d.vuln > 0 ? `· CVE ${d.vuln}` : ''}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{:else}
		<section class="soc-grid-2">
			<div class="soc-section p-2">
				<DependencyGraph
					{dependencies}
					{findings}
					{repos}
					focusRepo={page.params.repoId}
					onSelectDependency={(name) => (selectedDep = name)}
				/>
			</div>
			<div class="soc-section p-3 text-xs">
				{#if selected}
					<p class="text-sm font-semibold text-primary">{selected.name}</p>
					<p class="soc-subtle mb-2">
						Findings linked in this repository: {selectedFindings.length}
					</p>
					<div class="space-y-1">
						{#each selectedFindings as f}
							<div class="rounded border border-border px-2 py-1">
								<div class="flex items-center justify-between">
									<span>{f.id}</span><SeverityBadge value={f.sev} />
								</div>
								<p class="soc-subtle truncate">{f.title}</p>
							</div>
						{/each}
						{#if selectedFindings.length === 0}<p class="soc-subtle">
								No findings for this dependency in {page.params.repoId}.
							</p>{/if}
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>
