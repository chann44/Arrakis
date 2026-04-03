<script lang="ts">
	import { page } from '$app/state';
	import { SeverityBadge } from '$lib/components/security';
	import { findings } from '$lib/data/security-mock';

	const rows = $derived(findings.filter((f) => f.repo === page.params.repoId));
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Repository Findings</h1>
	<p class="soc-subtle">Findings for repo: {page.params.repoId}</p>
	<section class="soc-section">
		<table class="soc-table">
			<thead
				><tr
					><th>Severity</th><th>Finding</th><th>Package</th><th>Rule</th><th>Detected</th><th
						>Status</th
					></tr
				></thead
			>
			<tbody>
				{#each rows as f}
					<tr>
						<td><SeverityBadge value={f.sev} /></td>
						<td>{f.title}</td>
						<td class="text-primary">{f.dep}</td>
						<td class="soc-subtle">{f.rule}</td>
						<td class="soc-subtle">{f.detected}</td>
						<td class={f.status === 'open' ? 'soc-risk-critical' : 'soc-risk-high'}>{f.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
