<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let { data, form } = $props();
	const pageData = $derived(data as any);
	const formData = $derived(form as any);
	let createPolicyDialogOpen = $state(false);

	$effect(() => {
		if (formData?.action === 'createPolicy' && formData?.success === false) {
			createPolicyDialogOpen = true;
		}
	});
</script>

<div class="soc-page">
	<div class="flex items-center justify-between">
		<h1 class="soc-page-title">Policies</h1>
		<Dialog.Root bind:open={createPolicyDialogOpen}>
			<Dialog.Trigger class="soc-btn-primary" type="button">+ New Policy</Dialog.Trigger>
			<Dialog.Content class="max-h-[90vh] max-w-4xl overflow-y-auto">
				<Dialog.Header>
					<Dialog.Title>Create Policy</Dialog.Title>
					<Dialog.Description>
						Configure trigger, sources, SAST, and registry options in one step.
					</Dialog.Description>
				</Dialog.Header>

				<form method="POST" action="?/createPolicy" class="space-y-4 text-xs">
					<section class="rounded border border-border bg-muted/20 p-3">
						<p class="text-sm font-semibold">Basic</p>
						<p class="soc-subtle mb-2 text-[11px]">Set a policy name and enabled state.</p>
						<div class="grid grid-cols-2 gap-2">
							<label class="col-span-2"
								>Policy Name
								<input
									class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
									type="text"
									name="name"
									required
								/>
							</label>
							<label><input type="checkbox" name="enabled" checked /> enabled</label>
						</div>
					</section>

					<section class="rounded border border-border bg-muted/20 p-3">
						<p class="text-sm font-semibold">Trigger</p>
						<p class="soc-subtle mb-2 text-[11px]">Define when scans run for repositories using this policy.</p>
						<div class="grid grid-cols-2 gap-2">
						<label
							>Trigger
							<select name="trigger_type" class="mt-1 w-full rounded border border-border bg-background px-2 py-1">
								<option value="manual">manual</option>
								<option value="push">push</option>
								<option value="pull_request">pull_request</option>
								<option value="schedule">schedule</option>
							</select>
						</label>
						<label
							>Timezone
							<input
								name="trigger_timezone"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								value="UTC"
							/>
						</label>
						<label class="col-span-2"
							>Cron (for schedule)
							<input
								name="trigger_cron"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="0 2 * * 1"
							/>
						</label>
						<label class="col-span-2"
							>Branches (comma separated)
							<input
								name="trigger_branches"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="main,release/*"
							/>
						</label>
						</div>
					</section>

					<section class="rounded border border-border bg-muted/20 p-3">
						<p class="text-sm font-semibold">Sources</p>
						<p class="soc-subtle mb-2 text-[11px]">Select vulnerability data sources and cache behavior.</p>
						<div class="grid grid-cols-2 gap-2">
						<label><input type="checkbox" name="registry_first" checked /> registry first</label>
						<label><input type="checkbox" name="registry_only" /> registry only</label>
						<label><input type="checkbox" name="osv_enabled" checked /> osv enabled</label>
						<label><input type="checkbox" name="ghsa_enabled" checked /> ghsa enabled</label>
						<label><input type="checkbox" name="nvd_enabled" /> nvd enabled</label>
						<label><input type="checkbox" name="govulncheck_enabled" checked /> govulncheck enabled</label>
						<label
							>Registry max age days
							<input
								name="registry_max_age_days"
								type="number"
								min="1"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								value="7"
							/>
						</label>
						<label
							>GHSA token ref
							<input
								name="ghsa_token_ref"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="env://GHSA_TOKEN"
							/>
						</label>
						<label class="col-span-2"
							>NVD api key ref
							<input
								name="nvd_api_key_ref"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="env://NVD_API_KEY"
							/>
						</label>
						</div>
					</section>

					<details class="rounded border border-border bg-muted/20 p-3" open>
						<summary class="cursor-pointer text-sm font-semibold">SAST + AI</summary>
						<p class="soc-subtle my-2 text-[11px]">Pattern checks and optional AI enrichment settings.</p>
						<div class="grid grid-cols-2 gap-2">
						<label><input type="checkbox" name="sast_enabled" checked /> sast enabled</label>
						<label><input type="checkbox" name="patterns_enabled" checked /> patterns enabled</label>
						<label
							>Rulesets
							<input
								name="rulesets"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								value="default"
							/>
						</label>
						<label
							>Min severity
							<select name="min_severity" class="mt-1 w-full rounded border border-border bg-background px-2 py-1">
								<option value="low">low</option>
								<option value="medium" selected>medium</option>
								<option value="high">high</option>
								<option value="critical">critical</option>
							</select>
						</label>
						<label class="col-span-2"
							>Exclude paths
							<input
								name="exclude_paths"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="vendor/**,node_modules/**"
							/>
						</label>
						<label><input type="checkbox" name="ai_enabled" /> ai enabled</label>
						<label><input type="checkbox" name="ai_reachability" checked /> ai reachability</label>
						<label><input type="checkbox" name="ai_suggest_fix" checked /> ai suggest fix</label>
						<label
							>AI max files per scan
							<input
								name="ai_max_files_per_scan"
								type="number"
								min="1"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								value="50"
							/>
						</label>
						</div>
					</details>

					<details class="rounded border border-border bg-muted/20 p-3">
						<summary class="cursor-pointer text-sm font-semibold">Registry Push/Pull</summary>
						<p class="soc-subtle my-2 text-[11px]">Configure report publish/pull behavior from registries.</p>
						<div class="grid grid-cols-2 gap-2">
						<label><input type="checkbox" name="push_enabled" /> push enabled</label>
						<label><input type="checkbox" name="pull_enabled" /> pull enabled</label>
						<label
							>Push URL
							<input name="push_url" type="text" class="mt-1 w-full rounded border border-border bg-background px-2 py-1" />
						</label>
						<label
							>Push signing key ref
							<input
								name="push_signing_key_ref"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="env://SIGNING_KEY"
							/>
						</label>
						<label
							>Pull URL
							<input name="pull_url" type="text" class="mt-1 w-full rounded border border-border bg-background px-2 py-1" />
						</label>
						<label
							>Pull trusted keys
							<input
								name="pull_trusted_keys"
								type="text"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								placeholder="keyA,keyB"
							/>
						</label>
						<label
							>Pull max age days
							<input
								name="pull_max_age_days"
								type="number"
								min="1"
								class="mt-1 w-full rounded border border-border bg-background px-2 py-1"
								value="7"
							/>
						</label>
						</div>
					</details>

					<div class="flex items-center justify-end gap-2 pt-2">
						<Dialog.Close class="soc-btn" type="button">Cancel</Dialog.Close>
						<button class="soc-btn-primary" type="submit">Create Policy</button>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	{#if formData?.message}
		<section
			class={`soc-section p-3 text-xs ${
				formData?.success === false
					? 'border border-rose-300 bg-rose-50 text-rose-800'
					: 'border border-emerald-300 bg-emerald-50 text-emerald-800'
			}`}
		>
			{formData.message}
		</section>
	{/if}

	<section class="soc-section p-3">
		<p class="mb-2 text-xs font-semibold">Assign Policy to Repository</p>
		<form method="POST" action="?/assignPolicy" class="flex flex-wrap items-center gap-2 text-xs">
			<select class="rounded border border-border bg-background px-2 py-1" name="repo_id" required>
				<option value="">Select repo</option>
				{#each pageData.repositories as repo}
					<option value={repo.id}>{repo.full_name}</option>
				{/each}
			</select>
			<select class="rounded border border-border bg-background px-2 py-1" name="policy_id" required>
				<option value="">Select policy</option>
				{#each pageData.policies as policy}
					<option value={policy.id}>{policy.name}</option>
				{/each}
			</select>
			<button class="soc-btn" type="submit">Assign</button>
		</form>
	</section>

	<section class="soc-section">
		<table class="soc-table">
			<thead
				><tr><th>Policy</th><th>Applied Repos</th><th>Enabled</th><th>Updated</th><th>Action</th></tr
				></thead
			>
			<tbody>
				{#if pageData.policies.length === 0}
					<tr><td colspan="5" class="soc-subtle">No policies yet.</td></tr>
				{/if}
				{#each pageData.policies as p}
					<tr class="soc-table-row-link">
						<td class="font-medium"
							><a class="hover:text-primary" href={`/policies/${p.id}`}>{p.name}</a></td
						>
						<td>{p.repository_count}</td>
						<td>{p.enabled ? 'yes' : 'no'}</td>
						<td class="soc-subtle">{p.updated_at ? new Date(p.updated_at).toLocaleString() : '-'}</td>
						<td>
							<form method="POST" action="?/deletePolicy">
								<input type="hidden" name="policy_id" value={p.id} />
								<button class="soc-btn" type="submit">Delete</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
