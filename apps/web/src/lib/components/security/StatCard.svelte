<script lang="ts">
	let {
		label,
		value,
		sub = '',
		tone = ''
	}: { label: string; value: string | number; sub?: string; tone?: string } = $props();
</script>

<article class="soc-stat">
	<p class="soc-stat-label">{label}</p>
	<p class={`soc-stat-value ${tone}`}>{value}</p>
	{#if sub}
		<p class="soc-stat-sub">{sub}</p>
	{/if}
</article>
