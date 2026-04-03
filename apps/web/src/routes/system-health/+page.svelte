<script lang="ts">
	import { StatCard } from '$lib/components/security';

	const services = [
		{ name: 'API Server', status: 'ok', latency: '4ms', uptime: '99.9%' },
		{ name: 'Worker', status: 'ok', latency: '-', uptime: '99.7%' },
		{ name: 'PostgreSQL', status: 'ok', latency: '1ms', uptime: '100%' },
		{ name: 'Redis', status: 'ok', latency: '<1ms', uptime: '100%' },
		{ name: 'GitHub Webhook', status: 'ok', latency: '-', uptime: '99.8%' },
		{ name: 'OSV Scanner', status: 'ok', latency: '180ms', uptime: '98.2%' }
	];

	const queue = [
		{ type: 'scan_repo', pending: 0, running: 1, failed: 0 },
		{ type: 'parse_manifest', pending: 2, running: 0, failed: 0 },
		{ type: 'run_scanners', pending: 0, running: 1, failed: 0 },
		{ type: 'generate_report', pending: 1, running: 0, failed: 0 }
	];
</script>

<div class="soc-page">
	<h1 class="soc-page-title">System Health</h1>
	<section class="soc-grid-4">
		<StatCard label="Services" value="6/6 up" tone="soc-risk-ok" />
		<StatCard label="Queue Backlog" value={3} />
		<StatCard label="Scan Throughput" value="4/hr" />
		<StatCard label="Version" value="v0.1.0" />
	</section>

	<section class="soc-grid-2">
		<div class="soc-section">
			<div class="soc-section-head"><p class="soc-section-label">Services</p></div>
			<table class="soc-table">
				<thead><tr><th>Service</th><th>Status</th><th>Latency</th><th>Uptime</th></tr></thead>
				<tbody>
					{#each services as service}
						<tr>
							<td>{service.name}</td>
							<td class="soc-risk-ok">{service.status}</td>
							<td class="soc-subtle">{service.latency}</td>
							<td class="soc-subtle">{service.uptime}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="soc-section">
			<div class="soc-section-head"><p class="soc-section-label">Job Queue</p></div>
			<table class="soc-table">
				<thead><tr><th>Job Type</th><th>Pending</th><th>Running</th><th>Failed</th></tr></thead>
				<tbody>
					{#each queue as q}
						<tr>
							<td class="text-primary">{q.type}</td>
							<td class={q.pending > 0 ? 'soc-risk-high' : 'soc-subtle'}>{q.pending}</td>
							<td class={q.running > 0 ? 'soc-risk-ok' : 'soc-subtle'}>{q.running}</td>
							<td class={q.failed > 0 ? 'soc-risk-critical' : 'soc-subtle'}>{q.failed}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
