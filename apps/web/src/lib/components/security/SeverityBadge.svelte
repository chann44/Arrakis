<script lang="ts">
	let { value }: { value: 'critical' | 'high' | 'medium' | 'low' } = $props();

	const tone = $derived(`soc-sev-${value}`);
</script>

<span class={`soc-badge ${tone}`}>{value}</span>
