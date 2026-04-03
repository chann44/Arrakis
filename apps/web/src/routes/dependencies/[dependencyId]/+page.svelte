<script lang="ts">
	import { page } from '$app/state';
	import { RiskScore, StatusBadge } from '$lib/components/security';
	import { dependencies } from '$lib/data/security-mock';

	const dep = $derived(dependencies.find((d) => d.name === page.params.dependencyId));
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Dependency Details</h1>
	{#if dep}
		<section class="soc-grid-4">
			<div class="soc-stat">
				<p class="soc-stat-label">Package</p>
				<p class="soc-stat-value text-base">{dep.name}</p>
			</div>
			<div class="soc-stat">
				<p class="soc-stat-label">Version</p>
				<p class="soc-stat-value text-base text-primary">{dep.ver}</p>
			</div>
			<div class="soc-stat">
				<p class="soc-stat-label">Latest</p>
				<p class="soc-stat-value text-base">{dep.latest}</p>
			</div>
			<div class="soc-stat">
				<p class="soc-stat-label">Risk</p>
				<p class="soc-stat-value text-base"><RiskScore value={dep.risk} /></p>
			</div>
		</section>
		<section class="soc-section p-3 text-xs">
			<div class="flex justify-between">
				<span class="soc-subtle">Ecosystem</span><span>{dep.eco}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Type</span><span>{dep.type}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Vulnerabilities</span><span>{dep.vuln}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Flags</span><span
					><StatusBadge value={dep.flag ? 'reviewing' : 'ok'} /></span
				>
			</div>
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Dependency not found.</section>
	{/if}
</div>
