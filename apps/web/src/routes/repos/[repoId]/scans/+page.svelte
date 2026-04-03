<script lang="ts">
	import { page } from '$app/state';
	import { EcoBadge, StatusBadge } from '$lib/components/security';
	import { scans } from '$lib/data/security-mock';

	const rows = $derived(scans.filter((s) => s.repo === page.params.repoId));
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Repository Scans</h1>
	<p class="soc-subtle">Scans for repo: {page.params.repoId}</p>
	<section class="soc-section">
		<table class="soc-table">
			<thead
				><tr
					><th>Scan ID</th><th>Branch</th><th>Trigger</th><th>Duration</th><th>Findings</th><th
						>Status</th
					></tr
				></thead
			>
			<tbody>
				{#each rows as s}
					<tr>
						<td class="text-primary">{s.id}</td>
						<td class="soc-subtle">{s.branch}</td>
						<td><EcoBadge value={s.trigger} /></td>
						<td class="soc-subtle">{s.dur}</td>
						<td>{s.findings}</td>
						<td><StatusBadge value={s.status} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
