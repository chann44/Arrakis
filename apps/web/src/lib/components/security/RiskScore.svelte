<script lang="ts">
	let { value }: { value: number } = $props();

	const tone = $derived(
		value >= 70 ? 'soc-risk-critical' : value >= 40 ? 'soc-risk-high' : 'soc-risk-ok'
	);
</script>

<span class={tone}>{value}</span>
