<script lang="ts">
	import { EcoBadge, RiskScore, StatCard, StatusBadge } from '$lib/components/security';
	import { findings, repos, scans } from '$lib/data/security-mock';

	const critical = findings.filter((f) => f.sev === 'critical').length;
	const highRiskDeps = 4;
	const severity = [
		{ label: 'critical', count: findings.filter((f) => f.sev === 'critical').length },
		{ label: 'high', count: findings.filter((f) => f.sev === 'high').length },
		{ label: 'medium', count: findings.filter((f) => f.sev === 'medium').length },
		{ label: 'low', count: findings.filter((f) => f.sev === 'low').length }
	];
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Dashboard</h1>

	<section class="soc-grid-4">
		<StatCard label="Repositories" value={repos.length} sub="connected" />
		<StatCard
			label="Critical Findings"
			value={critical}
			sub="across all repos"
			tone="soc-risk-critical"
		/>
		<StatCard
			label="High Risk Deps"
			value={highRiskDeps}
			sub="need attention"
			tone="soc-risk-high"
		/>
		<StatCard label="Scans Today" value={12} sub="last: 2m ago" />
	</section>

	<section class="soc-grid-2">
		<div class="soc-section">
			<div class="soc-section-head"><p class="soc-section-label">Findings by Severity</p></div>
			<div class="space-y-2 p-3">
				{#each severity as row}
					<div class="flex items-center gap-2">
						<p class="w-16 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
							{row.label}
						</p>
						<div class="h-1.5 flex-1 overflow-hidden rounded bg-muted/40">
							<div
								class={`h-full rounded ${
									row.label === 'critical'
										? 'bg-red-400'
										: row.label === 'high'
											? 'bg-orange-400'
											: row.label === 'medium'
												? 'bg-amber-400'
												: 'bg-emerald-400'
								}`}
								style={`width: ${(row.count / findings.length) * 100}%`}
							></div>
						</div>
						<p class="w-5 text-right text-xs">{row.count}</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="soc-section">
			<div class="soc-section-head"><p class="soc-section-label">Policy Status</p></div>
			<div class="space-y-2 p-3">
				{#each repos as repo}
					<div class="flex items-center gap-2 text-xs">
						<p class="flex-1">{repo.name}</p>
						<RiskScore value={repo.risk} />
						<StatusBadge value={repo.policy} />
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="soc-section">
		<div class="soc-section-head">
			<p class="soc-section-label">Recent Scans</p>
			<a class="text-[10px] text-primary" href="/scans">view all -></a>
		</div>
		<table class="soc-table">
			<thead>
				<tr>
					<th>Scan ID</th>
					<th>Repository</th>
					<th>Trigger</th>
					<th>Duration</th>
					<th>Findings</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each scans.slice(0, 5) as scan}
					<tr>
						<td class="text-[10px] text-primary">{scan.id}</td>
						<td>{scan.repo}</td>
						<td><EcoBadge value={scan.trigger} /></td>
						<td class="soc-subtle">{scan.dur}</td>
						<td>
							<span
								class={scan.findings > 5
									? 'soc-risk-critical'
									: scan.findings > 0
										? 'soc-risk-high'
										: 'soc-subtle'}
							>
								{scan.findings}
							</span>
						</td>
						<td><StatusBadge value={scan.status} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
