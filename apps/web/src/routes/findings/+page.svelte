<script lang="ts">
	import { DependencyGraph, SeverityBadge } from '$lib/components/security';
	import { dependencies, findings, repos } from '$lib/data/security-mock';

	let filter = $state<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
	let view = $state<'table' | 'graph'>('table');
	let selectedDep = $state<string | null>(null);
	const rows = $derived(filter === 'all' ? findings : findings.filter((f) => f.sev === filter));
	const selectedDepName = $derived(selectedDep ?? '');
	const selectedFindings = $derived(
		selectedDepName ? rows.filter((f) => f.dep.startsWith(selectedDepName)) : rows.slice(0, 8)
	);
</script>

<div class="soc-page">
	<div class="flex items-center gap-2">
		<h1 class="soc-page-title">Findings</h1>
		<div class="ml-auto flex gap-1">
			<button class="soc-btn" type="button" onclick={() => (view = 'table')}>table</button>
			<button class="soc-btn" type="button" onclick={() => (view = 'graph')}>graph</button>
			{#each ['all', 'critical', 'high', 'medium', 'low'] as s}
				<button class="soc-btn" type="button" onclick={() => (filter = s as typeof filter)}
					>{s}</button
				>
			{/each}
		</div>
	</div>
	{#if view === 'table'}
		<section class="soc-section">
			<table class="soc-table">
				<thead
					><tr
						><th>Severity</th><th>Finding</th><th>Repository</th><th>Package</th><th>Rule</th><th
							>Detected</th
						><th>Status</th></tr
					></thead
				>
				<tbody>
					{#each rows as f}
						<tr class="soc-table-row-link" onclick={() => (selectedDep = f.dep.split('@')[0])}>
							<td><SeverityBadge value={f.sev} /></td>
							<td><a class="hover:text-primary" href={`/findings/${f.id}`}>{f.title}</a></td>
							<td>{f.repo}</td>
							<td class="text-primary">{f.dep}</td>
							<td class="soc-subtle">{f.rule}</td>
							<td class="soc-subtle">{f.detected}</td>
							<td class={f.status === 'open' ? 'soc-risk-critical' : 'soc-risk-high'}>{f.status}</td
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
					onSelectDependency={(name) => (selectedDep = name)}
				/>
			</div>
			<div class="soc-section p-3 text-xs">
				<p class="soc-section-label mb-2">Dependency Findings</p>
				<div class="space-y-1">
					{#each selectedFindings as f}
						<div class="rounded border border-border px-2 py-1">
							<div class="flex items-center justify-between">
								<span>{f.id}</span><SeverityBadge value={f.sev} />
							</div>
							<p class="soc-subtle truncate">{f.dep} · {f.repo}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>
	{/if}
</div>
