<script lang="ts">
	const sections = [
		{
			title: 'Organization',
			fields: [
				['Org Name', 'levitate-labs'],
				['Default Branch', 'main'],
				['Scan Schedule', 'every 6h'],
				['Retention', '90 days']
			]
		},
		{
			title: 'Severity Thresholds',
			fields: [
				['Block on', 'critical'],
				['Warn on', 'high, medium'],
				['Ignore below', 'low'],
				['CVE Score Cutoff', '7.0']
			]
		},
		{
			title: 'Registries',
			fields: [
				['npm', 'registry.npmjs.org'],
				['pip', 'pypi.org'],
				['go', 'proxy.golang.org'],
				['Private Registry', '-']
			]
		},
		{
			title: 'API and Tokens',
			fields: [
				['API Endpoint', 'http://localhost:8080'],
				['Webhook Secret', '********'],
				['CI Token', '********'],
				['GitHub App ID', '888234']
			]
		}
	] as const;
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Settings</h1>
	<div class="soc-grid-2">
		{#each sections as section}
			<section class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">{section.title}</p></div>
				<div class="space-y-2 p-3">
					{#each section.fields as [key, value]}
						<label class="flex items-center gap-2 text-xs">
							<span class="soc-subtle w-36 shrink-0">{key}</span>
							<input class="soc-input" readonly {value} />
						</label>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
