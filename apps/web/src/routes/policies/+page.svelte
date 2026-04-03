<script lang="ts">
	import { SeverityBadge } from '$lib/components/security';
	import { policies } from '$lib/data/security-mock';

	let rules = $state(policies.map((p) => ({ ...p })));
	const toggle = (id: string) => {
		rules = rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
	};
</script>

<div class="soc-page">
	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Policies</h1>
		<button class="soc-btn-primary" type="button">+ New Rule</button>
	</div>
	<section class="soc-section">
		<table class="soc-table">
			<thead
				><tr><th>Rule</th><th>Condition</th><th>Severity</th><th>Action</th><th>Enabled</th></tr
				></thead
			>
			<tbody>
				{#each rules as p}
					<tr class="soc-table-row-link">
						<td class="font-medium"
							><a class="hover:text-primary" href={`/policies/${p.id}`}>{p.name}</a></td
						>
						<td class="text-primary">{p.condition}</td>
						<td><SeverityBadge value={p.sev} /></td>
						<td class="text-xs">{p.action}</td>
						<td>
							<button class="soc-btn" type="button" onclick={() => toggle(p.id)}
								>{p.enabled ? 'on' : 'off'}</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
