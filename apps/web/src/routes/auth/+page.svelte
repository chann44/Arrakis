<script lang="ts">
	import { browser } from '$app/environment';

	const githubLoginHref = () => {
		if (browser && window.location.hostname === 'localhost') {
			return 'http://localhost:8080/v1/auth/github/login';
		}
		return '/api/v1/auth/github/login';
	};
</script>

<main class="mx-auto max-w-3xl px-6 py-20">
	<h1 class="text-4xl font-bold tracking-tight">Auth</h1>
	<p class="mt-4 text-lg text-muted-foreground">Auth page.</p>
	<button
		class="mt-5 rounded-md border border-primary bg-primary px-4 py-2 text-primary-foreground"
		onclick={() => {
			window.location.href = githubLoginHref();
		}}
	>
		Login with GitHub
	</button>
</main>
