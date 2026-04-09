<script lang="ts">
	import { StatusBadge } from '$lib/components/security';
	import { onMount } from 'svelte';

	let { data }: { data: any } = $props();
	const scan = $derived(data.scan);
	const findings = $derived((data.findings ?? []) as any[]);
	let logs = $state<any[]>([]);
	let activeTab = $state<'findings' | 'logs' | 'ai'>('findings');
	let streamStatus = $state<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');

	$effect(() => {
		logs = [...((data.logs ?? []) as any[])];
	});

	const fmtTime = (value: string) => {
		if (!value) return '-';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '-';
		return parsed.toLocaleString();
	};

	const aiLogs = $derived(
		(logs ?? []).filter(
			(log) =>
				(log.directory_path ?? '').toLowerCase().startsWith('ai/') ||
				(log.message ?? '').toLowerCase().startsWith('ai:')
		)
	);

	const parseAIMessage = (raw: string) => {
		const value = (raw ?? '').trim();
		if (!value.startsWith('ai:')) {
			return { stage: 'ai', status: 'progress', detail: value };
		}
		const body = value.slice(3);
		const firstSep = body.indexOf(':');
		if (firstSep < 0) {
			return { stage: body || 'ai', status: 'progress', detail: '' };
		}
		const stage = body.slice(0, firstSep).trim() || 'ai';
		const tail = body.slice(firstSep + 1);
		const secondSep = tail.indexOf(' ');
		if (secondSep < 0) {
			return { stage, status: tail.trim() || 'progress', detail: '' };
		}
		return {
			stage,
			status: tail.slice(0, secondSep).trim() || 'progress',
			detail: tail.slice(secondSep + 1).trim()
		};
	};

	const aiStatusClass = (status: string) => {
		switch ((status ?? '').toLowerCase()) {
			case 'error':
				return 'soc-risk-critical';
			case 'success':
				return 'soc-risk-ok';
			case 'start':
				return 'soc-risk-high';
			default:
				return 'soc-subtle';
		}
	};

	onMount(() => {
		if (!scan?.id) {
			streamStatus = 'offline';
			return;
		}

		const highestID = (aiLogs ?? []).reduce((max: number, item: any) => {
			const current = Number(item?.id ?? 0);
			return Number.isFinite(current) && current > max ? current : max;
		}, 0);

		const params = new URLSearchParams();
		if (highestID > 0) {
			params.set('cursor', String(highestID));
		}
		const streamURL = `/scans/${scan.id}/ai-logs/stream?${params.toString()}`;
		const source = new EventSource(streamURL);
		streamStatus = 'connecting';

		source.addEventListener('log', (event) => {
			try {
				const payload = JSON.parse((event as MessageEvent).data);
				const id = Number(payload?.id ?? 0);
				if (!Number.isFinite(id) || id <= 0) {
					return;
				}
				if (logs.some((item: any) => Number(item?.id ?? 0) === id)) {
					streamStatus = 'live';
					return;
				}
				logs = [...logs, payload];
				streamStatus = 'live';
			} catch {
				streamStatus = 'reconnecting';
			}
		});

		source.onopen = () => {
			streamStatus = 'live';
		};

		source.onerror = () => {
			streamStatus = 'reconnecting';
		};

		return () => {
			source.close();
			streamStatus = 'offline';
		};
	});
</script>

<div class="soc-page">
	<h1 class="soc-page-title">Scan Details</h1>
	{#if scan}
		<section class="soc-section p-3 text-xs">
			<div class="flex justify-between">
				<span class="soc-subtle">Scan ID</span><span class="text-primary">{scan.id}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Repository</span><span>{scan.repository}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Policy</span><span>{scan.policy || 'Unassigned'}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Trigger</span><span>{scan.trigger}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Duration</span><span>{scan.duration || '-'}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Findings</span><span>{scan.findings_total}</span>
			</div>
			<div class="flex justify-between">
				<span class="soc-subtle">Status</span><span><StatusBadge value={scan.status} /></span>
			</div>
		</section>

		<section class="soc-section mt-3 p-3 text-xs">
			<div class="mb-3 flex gap-2 border-b border-border pb-2">
				<button class={activeTab === 'findings' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (activeTab = 'findings')}>Findings</button>
				<button class={activeTab === 'logs' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (activeTab = 'logs')}>Scan Logs</button>
				<button class={activeTab === 'ai' ? 'soc-btn-primary' : 'soc-btn'} type="button" onclick={() => (activeTab = 'ai')}>AI Analysis</button>
			</div>

			{#if activeTab === 'findings'}
				<p class="mb-2 text-sm font-semibold">Findings</p>
				{#if findings.length === 0}
					<p class="soc-subtle">No findings in this scan.</p>
				{:else}
					<table class="soc-table">
						<thead><tr><th>Severity</th><th>Package</th><th>Advisory</th><th>Sources</th><th>Links</th><th>Detail</th><th>Status</th></tr></thead>
						<tbody>
							{#each findings as finding}
								<tr>
									<td>{finding.severity}</td>
									<td>{finding.package_name}@{finding.resolved_version || finding.version_spec || '-'}</td>
									<td class="text-primary">{finding.advisory_id}</td>
									<td class="soc-subtle">{(finding.sources ?? []).join(', ') || '-'}</td>
									<td class="soc-subtle">
										{#if (finding.source_links ?? []).length > 0}
											<div class="flex flex-wrap gap-1">
												{#each finding.source_links as link}
													<a class="soc-btn" href={link.url} target="_blank" rel="noreferrer">{link.source}</a>
												{/each}
											</div>
										{:else}
											-
										{/if}
									</td>
									<td><a class="soc-btn" href={`/findings/${finding.id}`}>Open</a></td>
									<td>{finding.status}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:else if activeTab === 'logs'}
				<p class="mb-2 text-sm font-semibold">Scan Logs</p>
				{#if logs.length === 0}
					<p class="soc-subtle">No logs captured for this scan.</p>
				{:else}
					<table class="soc-table">
						<thead><tr><th>Time</th><th>Level</th><th>Directory</th><th>Message</th></tr></thead>
						<tbody>
							{#each logs as log}
								<tr>
									<td class="soc-subtle">{fmtTime(log.created_at)}</td>
									<td>{log.level}</td>
									<td class="text-primary">{log.directory_path || '-'}</td>
									<td>{log.message}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:else}
				<div class="mb-2 flex items-center justify-between">
					<p class="text-sm font-semibold">AI Analysis</p>
					<span class="soc-subtle text-[11px]">Live: {streamStatus}</span>
				</div>
				{#if aiLogs.length === 0}
					<p class="soc-subtle">No AI analysis logs captured for this scan.</p>
				{:else}
					<table class="soc-table">
						<thead><tr><th>Time</th><th>Stage</th><th>Status</th><th>Detail</th></tr></thead>
						<tbody>
							{#each aiLogs as log}
								{@const parsed = parseAIMessage(log.message ?? '')}
								<tr>
									<td class="soc-subtle whitespace-nowrap">{fmtTime(log.created_at)}</td>
									<td class="text-primary">{parsed.stage}</td>
									<td class={aiStatusClass(parsed.status)}>{parsed.status}</td>
									<td>{parsed.detail || log.message}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/if}
		</section>
	{:else}
		<section class="soc-section p-4 text-sm text-muted-foreground">Scan not found.</section>
	{/if}
</div>
