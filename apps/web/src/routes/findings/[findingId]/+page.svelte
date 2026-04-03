<script lang="ts">
	import { page } from '$app/state';
	import { SeverityBadge } from '$lib/components/security';
	import { evidenceMap, findings } from '$lib/data/security-mock';

	const finding = $derived(findings.find((f) => f.id === page.params.findingId));
	const evidence = $derived(finding ? (evidenceMap[finding.rule] ?? []) : []);
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Finding Details</h1>
	{#if finding}
		<section class="soc-section p-4">
			<div class="mb-3 flex items-start gap-2">
				<SeverityBadge value={finding.sev} />
				<p class="text-sm font-semibold">{finding.title}</p>
			</div>
			<div class="grid gap-2 text-xs md:grid-cols-3">
				<div>
					<p class="soc-subtle">Repository</p>
					<p>{finding.repo}</p>
				</div>
				<div>
					<p class="soc-subtle">Package</p>
					<p class="text-primary">{finding.dep}</p>
				</div>
				<div>
					<p class="soc-subtle">Rule</p>
					<p>{finding.rule}</p>
				</div>
				<div>
					<p class="soc-subtle">Detected</p>
					<p>{finding.detected}</p>
				</div>
				<div>
					<p class="soc-subtle">Status</p>
					<p>{finding.status}</p>
				</div>
			</div>
		</section>

		<section class="soc-grid-2">
			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Evidence</p></div>
				<div class="space-y-2 p-3 text-xs">
					{#each evidence as item}
						<p><span class="text-primary">·</span> {item}</p>
					{/each}
				</div>
			</div>
			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Remediation</p></div>
				<div class="space-y-2 p-3 text-xs text-muted-foreground">
					<p>Patch to a non-affected version and regenerate lock files.</p>
					<p>Re-run scans and verify no transitive vulnerable path remains.</p>
				</div>
			</div>
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Finding not found.</section>
	{/if}
</div>
