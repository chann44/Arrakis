<script lang="ts">
	import { page } from '$app/state';
	import { StatusBadge } from '$lib/components/security';
	import { scans } from '$lib/data/security-mock';

	const scan = $derived(scans.find((s) => s.id === page.params.scanId));
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Scan Details</h1>
	{#if scan}
		<section class="soc-section p-3 text-xs">
			<div class="flex justify-between">
				<span class="soc-subtle">Scan ID</span><span class="text-primary">{scan.id}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Repository</span><span>{scan.repo}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Branch</span><span>{scan.branch}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Trigger</span><span>{scan.trigger}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Duration</span><span>{scan.dur}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Findings</span><span>{scan.findings}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Status</span><span><StatusBadge value={scan.status} /></span>
			</div>
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Scan not found.</section>
	{/if}
</div>
