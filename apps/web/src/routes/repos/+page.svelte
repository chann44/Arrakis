<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

	$effect(() => {
		if (!browser) return;
		if (form && typeof form === 'object' && 'installRedirect' in form && form.installRedirect) {
			window.location.href = form.installRedirect;
		}
	});

	const prevHref = $derived(
		data.page > 1 ? `/repos?page=${data.page - 1}&page_size=${data.pageSize}` : ''
	);
	const nextHref = $derived(
		data.totalPages > 0 && data.page < data.totalPages
			? `/repos?page=${data.page + 1}&page_size=${data.pageSize}`
			: ''
	);

	const installGithubAppHref = $derived.by(() => {
		if (browser && window.location.hostname === 'localhost') {
			return 'http://localhost:8080/v1/auth/github/app/install';
		}
		return '/api/v1/auth/github/app/install';
	});
</script>

<div class="soc-page">
	{#if data.connected}
		<section class="soc-section mb-3 border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
			Repository connected successfully.
		</section>
	{/if}

	{#if form && typeof form === 'object' && 'message' in form && form.message}
		<section class="soc-section mb-3 border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
			{form.message}
		</section>
	{/if}

	{#if data.appSetup === 'repo_not_granted'}
		<section class="soc-section mb-3 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
			GitHub App is installed but the selected repository is not granted. In the GitHub installation page,
			select this repository, then click Connect again.
		</section>
	{:else if data.appSetup === 'state_expired'}
		<section class="soc-section mb-3 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
			Install session expired. Please click Connect again.
		</section>
	{:else if data.appSetup && data.appSetup !== 'installed'}
		<section class="soc-section mb-3 border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
			GitHub App setup status: {data.appSetup}. Please try Connect again.
		</section>
	{/if}

	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Repositories</h1>
		<div class="flex items-center gap-2">
			<span class="soc-subtle">
				Showing {data.repositories.length} of {data.total} (page {data.page}
				{#if data.totalPages > 0} / {data.totalPages}{/if})
			</span>
			<a class="soc-btn-primary" href={installGithubAppHref}>
				Install GitHub App
			</a>
		</div>
	</div>

	<section class="soc-section">
		<table class="soc-table">
			<thead>
				<tr>
					<th>Repository</th>
					<th>Full Name</th>
					<th>Visibility</th>
					<th>Branch</th>
					<th>Status</th>
					<th>Action</th>
				</tr>
			</thead>
			<tbody>
				{#if data.repositories.length === 0}
					<tr>
						<td colspan="6" class="soc-subtle">No repositories found. Connect GitHub and try again.</td>
					</tr>
				{:else}
					{#each data.repositories as repo}
					<tr class="soc-table-row-link">
						<td>
							<a class="font-medium hover:text-primary" href={`/repos/${repo.id}`}
								>{repo.name}</a
							>
						</td>
						<td class="soc-subtle">{repo.full_name}</td>
						<td class="soc-subtle">{repo.private ? 'Private' : 'Public'}</td>
						<td class="soc-subtle">{repo.default_branch}</td>
						<td>
							<span class={repo.connected ? 'text-emerald-600' : 'soc-subtle'}>
								{repo.connected ? 'Connected' : 'Not connected'}
							</span>
						</td>
						<td>
							<form method="POST" action="?/connect" class="inline-block">
								<input type="hidden" name="repoId" value={repo.id} />
								{#if repo.connected}
									<button class="soc-btn" type="submit">Configure</button>
								{:else}
									<button class="soc-btn-primary" type="submit">Connect</button>
								{/if}
							</form>
							<a class="soc-btn ml-2" href={repo.html_url} target="_blank" rel="noreferrer">GitHub</a>
						</td>
					</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</section>

	<div class="mt-3 flex items-center justify-end gap-2 text-xs">
		{#if prevHref}
			<a class="soc-btn" href={prevHref}>Previous</a>
		{:else}
			<button class="soc-btn" type="button" disabled>Previous</button>
		{/if}

		{#if nextHref}
			<a class="soc-btn" href={nextHref}>Next</a>
		{:else}
			<button class="soc-btn" type="button" disabled>Next</button>
		{/if}
	</div>
</div>
