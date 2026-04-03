<script lang="ts">
	import { EcoBadge, StatCard, StatusBadge } from '$lib/components/security';
	import { scans } from '$lib/data/security-mock';
</script>

<div class="soc-page">
	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Scan History</h1>
		<button class="soc-btn-primary" type="button">Trigger Scan</button>
	</div>

	<section class="soc-grid-4">
		<StatCard label="Total Scans" value={41} />
		<StatCard label="Avg Duration" value="23s" />
		<StatCard label="Failed" value={1} tone="soc-risk-high" />
		<StatCard label="PR Scans" value={18} />
	</section>

	<section class="soc-section">
		<table class="soc-table">
			<thead
				><tr
					><th>Scan ID</th><th>Repository</th><th>Branch</th><th>Trigger</th><th>Duration</th><th
						>Findings</th
					><th>Delta</th><th>Status</th></tr
				></thead
			>
			<tbody>
				{#each scans as s}
					<tr class="soc-table-row-link">
						<td class="text-primary"><a href={`/scans/${s.id}`}>{s.id}</a></td>
						<td>{s.repo}</td>
						<td class="soc-subtle">{s.branch}</td>
						<td><EcoBadge value={s.trigger} /></td>
						<td class="soc-subtle">{s.dur}</td>
						<td>{s.findings}</td>
						<td
							class={s.diff.startsWith('+')
								? 'soc-risk-critical'
								: s.diff.startsWith('-')
									? 'soc-risk-ok'
									: 'soc-subtle'}>{s.diff}</td
						>
						<td><StatusBadge value={s.status} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
