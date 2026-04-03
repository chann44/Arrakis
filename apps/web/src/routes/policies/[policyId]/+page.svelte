<script lang="ts">
	import { page } from '$app/state';
	import { SeverityBadge } from '$lib/components/security';
	import { policies } from '$lib/data/security-mock';

	const policy = $derived(policies.find((p) => p.id === page.params.policyId));
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Policy Details</h1>
	{#if policy}
		<section class="soc-section p-3 text-xs">
			<div class="flex justify-between">
				<span class="soc-subtle">ID</span><span>{policy.id}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Rule</span><span>{policy.name}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Condition</span><span class="text-primary">{policy.condition}</span
				>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Severity</span><span><SeverityBadge value={policy.sev} /></span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Action</span><span>{policy.action}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Enabled</span><span>{policy.enabled ? 'yes' : 'no'}</span>
			</div>
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Policy not found.</section>
	{/if}
</div>
