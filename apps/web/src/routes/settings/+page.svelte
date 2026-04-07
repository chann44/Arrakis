<script lang="ts">
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

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
				['API Endpoint', '/api'],
				['Webhook Secret', '********'],
				['CI Token', '********'],
				['GitHub App ID', '888234']
			]
		}
	] as const;

	const statusClass = (status: string) => {
		switch (status) {
			case 'active':
				return 'text-emerald-700';
			case 'error':
				return 'text-rose-700';
			default:
				return 'text-amber-700';
		}
	};
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Settings</h1>

	<section class="soc-section mb-3 p-3">
		<div class="mb-3 flex items-center justify-between">
			<p class="soc-section-label">Custom Domains</p>
			<span class="soc-subtle text-[11px]">Serve UI + API on one domain</span>
		</div>

		<form method="POST" action="?/addDomain" class="mb-3 flex items-center gap-2">
			<input
				name="hostname"
				class="soc-input"
				placeholder="app.example.com"
				autocomplete="off"
				required
			/>
			<button class="soc-btn-primary" type="submit">Add Domain</button>
		</form>

		{#if form?.message}
			<p class="mb-3 text-xs text-rose-700">{form.message}</p>
		{/if}

		{#if data.domains.length === 0}
			<p class="soc-subtle text-xs">No domains configured yet.</p>
		{:else}
			<div class="space-y-3">
				{#each data.domains as domain}
					<div class="rounded-md border border-border p-3">
						<div class="mb-2 flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">{domain.hostname}</p>
								<p class={`text-xs ${statusClass(domain.status)}`}>status: {domain.status}</p>
							</div>
							<div class="flex gap-2">
								<form method="POST" action="?/verifyDomain">
									<input type="hidden" name="domainID" value={domain.id} />
									<button class="soc-btn" type="submit">Verify</button>
								</form>
								<form method="POST" action="?/deleteDomain">
									<input type="hidden" name="domainID" value={domain.id} />
									<button class="soc-btn" type="submit">Remove</button>
								</form>
							</div>
						</div>

						{#if domain.error}
							<p class="mb-2 text-xs text-rose-700">{domain.error}</p>
						{/if}

						<table class="soc-table text-xs">
							<thead>
								<tr>
									<th>Type</th>
									<th>Name</th>
									<th>Value</th>
									<th>TTL</th>
								</tr>
							</thead>
							<tbody>
								{#each domain.records as record}
									<tr>
										<td>{record.type}</td>
										<td>{record.name}</td>
										<td>{record.value}</td>
										<td>{record.ttl}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		{/if}
	</section>

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
