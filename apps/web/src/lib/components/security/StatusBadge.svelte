<script lang="ts">
	let { value }: { value: string } = $props();

	const tone = $derived(
		value === 'pass' || value === 'ok' || value === 'done'
			? 'soc-status-ok'
			: value === 'fail' || value === 'failed'
				? 'soc-status-fail'
				: 'soc-status-info'
	);
</script>

<span class={`soc-badge ${tone}`}>{value}</span>
