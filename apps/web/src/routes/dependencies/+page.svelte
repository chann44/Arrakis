<script lang="ts">
	import { DependencyGraph, EcoBadge, RiskScore, SeverityBadge } from '$lib/components/security';
	import { dependencies, findings, repos } from '$lib/data/security-mock';

	let eco = $state<'all' | 'npm' | 'pip' | 'go'>('all');
	let mode = $state<'all' | 'direct' | 'transitive' | 'vuln' | 'flagged'>('all');
	let view = $state<'table' | 'graph'>('table');
	let selectedDep = $state<string | null>(null);

	const filtered = $derived(
		dependencies.filter(
			(d) =>
				(eco === 'all' || d.eco === eco) &&
				(mode === 'all' ||
					d.type === mode ||
					(mode === 'vuln' && d.vuln > 0) ||
					(mode === 'flagged' && d.flag))
		)
	);

	const selected = $derived(
		selectedDep ? dependencies.find((d) => d.name === selectedDep) : (filtered[0] ?? null)
	);
	const selectedFindings = $derived(
		selected ? findings.filter((f) => f.dep.startsWith(selected.name)) : []
	);
	const selectedRepos = $derived(
		selected ? Array.from(new Set(selectedFindings.map((f) => f.repo))) : []
	);
</script>

<div class="soc-page">
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="soc-page-title">Dependencies</h1>
		<div class="ml-auto flex flex-wrap gap-1">
			<button class="soc-btn" type="button" onclick={() => (view = 'table')}>table</button>
			<button class="soc-btn" type="button" onclick={() => (view = 'graph')}>graph</button>
			{#each ['all', 'npm', 'pip', 'go'] as e}
				<button class="soc-btn" type="button" onclick={() => (eco = e as typeof eco)}>{e}</button>
			{/each}
			{#each ['all', 'direct', 'transitive', 'vuln', 'flagged'] as t}
				<button class="soc-btn" type="button" onclick={() => (mode = t as typeof mode)}>{t}</button>
			{/each}
		</div>
	</div>

	{#if view === 'table'}
		<section class="soc-section">
			<table class="soc-table">
				<thead
					><tr
						><th>Package</th><th>Version</th><th>Latest</th><th>Ecosystem</th><th>Type</th><th
							>Risk</th
						><th>Vulns</th><th>Flags</th></tr
					></thead
				>
				<tbody>
					{#each filtered as d}
						<tr class="soc-table-row-link" onclick={() => (selectedDep = d.name)}>
							<td class="font-medium"
								><a class="hover:text-primary" href={`/dependencies/${d.name}`}>{d.name}</a></td
							>
							<td class="text-primary">{d.ver}</td>
							<td class={d.ver !== d.latest ? 'soc-risk-high' : 'soc-subtle'}>{d.latest}</td>
							<td><EcoBadge value={d.eco} /></td>
							<td class="soc-subtle">{d.type}</td>
							<td><RiskScore value={d.risk} /></td>
							<td>{d.vuln > 0 ? d.vuln : '-'}</td>
							<td class="text-[10px]">{d.flag ? 'postinstall' : '-'} {d.stale ? 'stale' : ''}</td>
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
				{#if selected}
					<div class="space-y-2">
						<p class="text-sm font-semibold text-primary">{selected.name}</p>
						<div class="flex items-center justify-between">
							<span class="soc-subtle">Version</span><span>{selected.ver}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="soc-subtle">Latest</span><span>{selected.latest}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="soc-subtle">Risk</span><span><RiskScore value={selected.risk} /></span>
						</div>
						<div class="flex items-center justify-between">
							<span class="soc-subtle">Used by repos</span><span>{selectedRepos.length}</span>
						</div>
						<div class="pt-1">
							<p class="soc-section-label mb-1">Linked Findings</p>
							<div class="space-y-1">
								{#each selectedFindings as f}
									<div class="rounded border border-border px-2 py-1">
										<div class="flex items-center justify-between gap-2">
											<span class="truncate">{f.id}</span><SeverityBadge value={f.sev} />
										</div>
										<p class="soc-subtle truncate">{f.repo} - {f.title}</p>
									</div>
								{/each}
								{#if selectedFindings.length === 0}<p class="soc-subtle">
										No linked findings.
									</p>{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>
