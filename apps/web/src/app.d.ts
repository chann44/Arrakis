// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				login: string;
				name?: string;
				email?: string;
				avatarUrl?: string;
			} | null;
		}
		interface PageData {
			user?: Locals['user'];
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
