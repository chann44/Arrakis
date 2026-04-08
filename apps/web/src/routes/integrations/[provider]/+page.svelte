<script lang="ts">
	let { data }: { data: any } = $props();

	const statusClass = (status: string) => {
		switch (status) {
			case 'connected':
				return 'soc-status-ok';
			case 'needs_attention':
				return 'soc-status-info';
			default:
				return 'soc-status-fail';
		}
	};

	const resultClass = (result: string) => {
		switch (result) {
			case 'success':
				return 'soc-status-ok';
			case 'retrying':
				return 'soc-status-info';
			default:
				return 'soc-status-fail';
		}
	};

	const integration = $derived(data.integration);
	const activities = $derived((data.activities ?? []) as any[]);
</script>

<div class="soc-page">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="soc-page-title">{integration.name} Integration</h1>
			<p class="soc-subtle">Detailed status, routing config, and recent activity.</p>
		</div>
		<a class="soc-btn" href="/integrations">Back to Integrations</a>
	</div>

	<section class="soc-section p-3 text-xs">
		<div class="mb-2 flex items-center justify-between">
			<p class="text-sm font-semibold">Connection Status</p>
			<span class={`soc-badge ${statusClass(integration.status)}`}>{integration.status}</span>
		</div>
		<div class="grid gap-2 md:grid-cols-2">
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Workspace / Project</p>
				<p>{integration.workspace}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Last Successful Sync</p>
				<p>{integration.lastSync}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Enabled</p>
				<p>{integration.enabled ? 'yes' : 'no'}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Notify on Critical</p>
				<p>{integration.notifyOnCritical ? 'yes' : 'no'}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Notify on Scan Complete</p>
				<p>{integration.notifyOnScanComplete ? 'yes' : 'no'}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Errors (7d)</p>
				<p>{integration.errors7d}</p>
			</div>
		</div>
	</section>

	<section class="soc-section p-3 text-xs">
		<p class="mb-2 text-sm font-semibold">Routing and Filters</p>
		<div class="grid gap-2 md:grid-cols-2">
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Target Mapping</p>
				<p>{integration.targetMapping}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Repository Filter</p>
				<p>{integration.repoFilter}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Severity Filter</p>
				<p>{integration.severityFilter}</p>
			</div>
			<div class="rounded border border-border bg-background px-2 py-1.5">
				<p class="soc-subtle">Event Filter</p>
				<p>{integration.eventFilter}</p>
			</div>
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			<button class="soc-btn-primary" type="button">Test Integration</button>
			<button class="soc-btn" type="button">Reconnect</button>
			<button class="soc-btn" type="button">Disconnect</button>
		</div>
	</section>

	<section class="soc-section">
		<div class="soc-section-head">
			<p class="soc-section-label">Activity</p>
		</div>
		<table class="soc-table">
			<thead>
				<tr>
					<th>Time</th>
					<th>Event</th>
					<th>Target</th>
					<th>Result</th>
					<th>Details</th>
				</tr>
			</thead>
			<tbody>
				{#if activities.length === 0}
					<tr><td colspan="5" class="soc-subtle">No activity captured yet.</td></tr>
				{:else}
					{#each activities as activity}
						<tr>
							<td class="soc-subtle">{new Date(activity.time).toLocaleString()}</td>
							<td>{activity.eventType}</td>
							<td class="text-primary">{activity.target}</td>
							<td><span class={`soc-badge ${resultClass(activity.result)}`}>{activity.result}</span></td>
							<td>{activity.details}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</section>
</div>
