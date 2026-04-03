<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	const { data } = $props<{ data: { token: string } }>();

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('token', data.token);
		document.cookie = `session=${encodeURIComponent(data.token)}; Path=/; SameSite=Lax`;
		void goto('/');
	});
</script>

<p class="text-sm text-muted-foreground">Signing you in...</p>
