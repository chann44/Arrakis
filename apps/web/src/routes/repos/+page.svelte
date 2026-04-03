<script lang="ts">
	import { EcoBadge, RiskScore, StatusBadge } from '$lib/components/security';
	import { repos } from '$lib/data/security-mock';
</script>

<div class="soc-page">
	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Repositories</h1>
		<button class="soc-btn-primary" type="button">+ Connect Repo</button>
	</div>

	<section class="soc-section">
		<table class="soc-table">
			<thead>
				<tr>
					<th>Repository</th>
					<th>Branch</th>
					<th>Ecosystems</th>
					<th>Last Scan</th>
					<th>Risk</th>
					<th>Critical</th>
					<th>Policy</th>
					<th>Sync</th>
				</tr>
			</thead>
			<tbody>
				{#each repos as repo}
					<tr class="soc-table-row-link">
						<td>
							<a class="font-medium hover:text-primary" href={`/repos/${repo.name}`}>{repo.name}</a>
						</td>
						<td class="soc-subtle">{repo.branch}</td>
						<td class="space-x-1">
							{#each repo.eco as eco}<EcoBadge value={eco} />{/each}
						</td>
						<td class="soc-subtle">{repo.scan}</td>
						<td><RiskScore value={repo.risk} /></td>
						<td>
							<span class={repo.crit > 0 ? 'soc-risk-critical' : 'soc-subtle'}
								>{repo.crit > 0 ? `${repo.crit} crit` : '-'}</span
							>
						</td>
						<td><StatusBadge value={repo.policy} /></td>
						<td><StatusBadge value={repo.sync} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
