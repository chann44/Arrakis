<script lang="ts">
	import { page } from '$app/state';
	import { RiskScore, StatCard, StatusBadge } from '$lib/components/security';
	import { findings, repos, scans } from '$lib/data/security-mock';

	const repo = $derived(repos.find((r) => r.name === page.params.repoId));
	const repoFindings = $derived(findings.filter((f) => f.repo === page.params.repoId));
	const repoScans = $derived(scans.filter((s) => s.repo === page.params.repoId));
</script>

<div class="soc-page">
	<div class="flex items-center gap-2 text-xs">
		<a class="text-primary" href="/repos">&larr; repos</a>
		<span class="text-muted-foreground">/</span>
		<h1 class="soc-page-title text-base">{page.params.repoId}</h1>
		{#if repo}<span class="ml-auto"><StatusBadge value={repo.policy} /></span>{/if}
	</div>

	{#if repo}
		<section class="soc-grid-4">
			<StatCard
				label="Risk Score"
				value={repo.risk}
				tone={repo.risk >= 70
					? 'soc-risk-critical'
					: repo.risk >= 40
						? 'soc-risk-high'
						: 'soc-risk-ok'}
			/>
			<StatCard
				label="Critical"
				value={repo.crit}
				tone={repo.crit > 0 ? 'soc-risk-critical' : ''}
			/>
			<StatCard label="High" value={repo.high} tone={repo.high > 0 ? 'soc-risk-high' : ''} />
			<StatCard label="Last Scan" value={repo.scan} />
		</section>

		<section class="soc-section">
			<div class="soc-section-head"><p class="soc-section-label">Drilldown</p></div>
			<div class="flex flex-wrap gap-2 p-3 text-xs">
				<a class="soc-btn" href={`/repos/${repo.name}/findings`}>Findings ({repoFindings.length})</a
				>
				<a class="soc-btn" href={`/repos/${repo.name}/dependencies`}>Dependencies</a>
				<a class="soc-btn" href={`/repos/${repo.name}/scans`}>Scans ({repoScans.length})</a>
			</div>
		</section>

		<section class="soc-grid-2">
			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Repo Info</p></div>
				<div class="space-y-2 p-3 text-xs">
					<div class="flex justify-between">
						<span class="soc-subtle">Name</span><span>{repo.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="soc-subtle">Branch</span><span>{repo.branch}</span>
					</div>
					<div class="flex justify-between">
						<span class="soc-subtle">Ecosystems</span><span>{repo.eco.join(', ')}</span>
					</div>
					<div class="flex justify-between">
						<span class="soc-subtle">Sync</span><span><StatusBadge value={repo.sync} /></span>
					</div>
				</div>
			</div>

			<div class="soc-section">
				<div class="soc-section-head"><p class="soc-section-label">Risk Breakdown</p></div>
				<div class="space-y-2 p-3 text-xs">
					<div class="flex items-center justify-between">
						<span class="soc-subtle">Critical</span><RiskScore value={repo.crit * 25} />
					</div>
					<div class="flex items-center justify-between">
						<span class="soc-subtle">High</span><RiskScore value={repo.high * 10} />
					</div>
					<div class="flex items-center justify-between">
						<span class="soc-subtle">Overall</span><RiskScore value={repo.risk} />
					</div>
				</div>
			</div>
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Repository not found.</section>
	{/if}
</div>
