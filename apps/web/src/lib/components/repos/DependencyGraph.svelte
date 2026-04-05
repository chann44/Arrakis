<script lang="ts">
	import { onDestroy, onMount, createEventDispatcher } from 'svelte';
	import { quadtree, type Quadtree } from 'd3-quadtree';
	import * as PIXI from 'pixi.js';
	import dagre from 'dagre';

	type GraphNodeInput = {
		id: string;
		label: string;
		type?: string;
	};

	type GraphEdgeInput = {
		source: string;
		target: string;
		type?: string;
	};

	type PositionedNode = {
		id: string;
		label: string;
		type: string;
		x: number;
		y: number;
		sprite: PIXI.Sprite;
		text: PIXI.Text;
	};

	let {
		nodes = [],
		edges = [],
		rootId = '',
		height = '74vh'
	}: {
		nodes: GraphNodeInput[];
		edges: GraphEdgeInput[];
		rootId?: string;
		height?: string;
	} = $props();

	const dispatch = createEventDispatcher<{ nodeclick: { nodeId: string } }>();

	let containerEl: HTMLDivElement | null = null;
	let app: PIXI.Application | null = null;
	let edgeLayer: PIXI.Graphics | null = null;
	let nodeLayer: PIXI.Container | null = null;
	let labelLayer: PIXI.Container | null = null;
	let miniMapEl: HTMLCanvasElement | null = null;
	let disposed = false;
	let zoom = 1;
	let dragging = false;
	let movedWhileDrag = false;
	let lastPointer = { x: 0, y: 0 };
	let tree: Quadtree<PositionedNode> | null = null;
	let isLoading = $state(true);
	let errorText = $state('');
	let cleanupInteraction: (() => void) | null = null;
	let renderSeq = 0;

	type ThemePalette = {
		background: number;
		card: number;
		foreground: number;
		foregroundCss: string;
		primary: number;
		secondary: number;
		peer: number;
		optional: number;
		muted: number;
		destructiveCss: string;
	};

	let theme: ThemePalette = {
		background: 0x0f172a,
		card: 0x111827,
		foreground: 0xe5e7eb,
		foregroundCss: '#e5e7eb',
		primary: 0x3b82f6,
		secondary: 0x38bdf8,
		peer: 0xf59e0b,
		optional: 0x22c55e,
		muted: 0x64748b,
		destructiveCss: '#ef4444'
	};

	function clamp01(v: number): number {
		return Math.max(0, Math.min(1, v));
	}

	function srgbChannelToLinear(v: number): number {
		return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	}

	function linearToSrgbChannel(v: number): number {
		return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
	}

	function oklabToRgbNumber(L: number, a: number, b: number, fallback: number): number {
		const l = L + 0.3963377774 * a + 0.2158037573 * b;
		const m = L - 0.1055613458 * a - 0.0638541728 * b;
		const s = L - 0.0894841775 * a - 1.291485548 * b;

		const l3 = l * l * l;
		const m3 = m * m * m;
		const s3 = s * s * s;

		const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
		const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
		const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

		if (!Number.isFinite(rLin) || !Number.isFinite(gLin) || !Number.isFinite(bLin)) {
			return fallback;
		}

		const r = Math.round(clamp01(linearToSrgbChannel(clamp01(rLin))) * 255);
		const g = Math.round(clamp01(linearToSrgbChannel(clamp01(gLin))) * 255);
		const bb = Math.round(clamp01(linearToSrgbChannel(clamp01(bLin))) * 255);
		return (r << 16) | (g << 8) | bb;
	}

	function cssVarColor(varName: string, fallback: string): string {
		if (typeof window === 'undefined') return fallback;
		const probe = document.createElement('span');
		probe.style.color = `var(${varName})`;
		probe.style.position = 'absolute';
		probe.style.opacity = '0';
		document.body.appendChild(probe);
		const value = getComputedStyle(probe).color || fallback;
		probe.remove();
		return value;
	}

	function colorStringToNumber(value: string, fallback: number): number {
		const raw = value.trim().toLowerCase();

		if (raw.startsWith('#')) {
			const hex = raw.slice(1);
			if (hex.length === 3) {
				const r = parseInt(hex[0] + hex[0], 16);
				const g = parseInt(hex[1] + hex[1], 16);
				const b = parseInt(hex[2] + hex[2], 16);
				return (r << 16) | (g << 8) | b;
			}
			if (hex.length >= 6) {
				const n = parseInt(hex.slice(0, 6), 16);
				if (!Number.isNaN(n)) return n;
			}
			return fallback;
		}

		if (raw.startsWith('rgb(') || raw.startsWith('rgba(')) {
			const parts = raw.match(/[\d.]+/g);
			if (!parts || parts.length < 3) return fallback;
			const r = Math.max(0, Math.min(255, Math.round(Number(parts[0]))));
			const g = Math.max(0, Math.min(255, Math.round(Number(parts[1]))));
			const b = Math.max(0, Math.min(255, Math.round(Number(parts[2]))));
			return (r << 16) | (g << 8) | b;
		}

		if (raw.startsWith('oklch(')) {
			const inner = raw.slice(6, -1).replace('/', ' ');
			const parts = inner.trim().split(/\s+/);
			if (parts.length < 3) return fallback;
			let L = Number(parts[0].replace('%', ''));
			const C = Number(parts[1]);
			const H = Number(parts[2].replace('deg', ''));
			if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(H)) return fallback;
			if (parts[0].includes('%')) L /= 100;
			const hr = (H * Math.PI) / 180;
			const a = C * Math.cos(hr);
			const b = C * Math.sin(hr);
			return oklabToRgbNumber(L, a, b, fallback);
		}

		if (raw.startsWith('oklab(')) {
			const inner = raw.slice(6, -1).replace('/', ' ');
			const parts = inner.trim().split(/\s+/);
			if (parts.length < 3) return fallback;
			let L = Number(parts[0].replace('%', ''));
			const a = Number(parts[1]);
			const b = Number(parts[2]);
			if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return fallback;
			if (parts[0].includes('%')) L /= 100;
			return oklabToRgbNumber(L, a, b, fallback);
		}

		const parts = value.match(/[\d.]+/g);
		if (!parts || parts.length < 3) return fallback;
		const r = Math.max(0, Math.min(255, Math.round(Number(parts[0]))));
		const g = Math.max(0, Math.min(255, Math.round(Number(parts[1]))));
		const b = Math.max(0, Math.min(255, Math.round(Number(parts[2]))));
		return (r << 16) | (g << 8) | b;
	}

	function resolveTheme() {
		const backgroundCss = cssVarColor('--color-background', '#0f172a');
		const cardCss = cssVarColor('--color-card', '#111827');
		const foregroundCss = cssVarColor('--color-foreground', '#e5e7eb');
		const primaryCss = cssVarColor('--color-primary', '#3b82f6');
		const secondaryCss = cssVarColor('--color-secondary', '#38bdf8');
		const peerCss = cssVarColor('--color-accent', '#f59e0b');
		const optionalCss = cssVarColor('--color-muted', '#22c55e');
		const mutedCss = cssVarColor('--color-muted-foreground', '#64748b');

		theme = {
			background: colorStringToNumber(backgroundCss, 0x0f172a),
			card: colorStringToNumber(cardCss, 0x111827),
			foreground: colorStringToNumber(foregroundCss, 0xe5e7eb),
			foregroundCss,
			primary: colorStringToNumber(primaryCss, 0x3b82f6),
			secondary: colorStringToNumber(secondaryCss, 0x38bdf8),
			peer: colorStringToNumber(peerCss, 0xf59e0b),
			optional: colorStringToNumber(optionalCss, 0x22c55e),
			muted: colorStringToNumber(mutedCss, 0x64748b),
			destructiveCss: cssVarColor('--color-destructive', '#ef4444')
		};
	}

	function numberToRgbCss(value: number): string {
		return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255})`;
	}

	const nodeIndex = new Map<string, PositionedNode>();
	const textures = new Map<string, PIXI.Texture>();

	function colorForType(type: string): number {
		switch ((type || '').toLowerCase()) {
			case 'root':
				return theme.primary;
			case 'direct':
				return theme.primary;
			case 'peer':
				return theme.peer;
			case 'dev':
				return theme.secondary;
			case 'optional':
				return theme.optional;
			default:
				return theme.muted;
		}
	}

	function nodeTexture(type: string): PIXI.Texture {
		const key = (type || 'default').toLowerCase();
		const cached = textures.get(key);
		if (cached) return cached;
		if (!app) throw new Error('PIXI app not initialized');

		const color = colorForType(type);
		const g = new PIXI.Graphics();
		g.roundRect(0, 0, 132, 38, 8);
		g.fill({ color, alpha: 0.16 });
		g.stroke({ width: 1.6, color, alpha: 0.95 });
		const tex = app.renderer.generateTexture(g);
		textures.set(key, tex);
		g.destroy();
		return tex;
	}

	function clearScene() {
		nodeIndex.clear();
		tree = null;
		edgeLayer?.clear();
		nodeLayer?.removeChildren().forEach((c) => c.destroy());
		labelLayer?.removeChildren().forEach((c) => c.destroy());
	}

	function drawMiniMap() {
		if (!miniMapEl || !app || nodeIndex.size === 0) return;
		const ctx = miniMapEl.getContext('2d');
		if (!ctx) return;

		const w = miniMapEl.width;
		const h = miniMapEl.height;
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = `rgba(${(theme.card >> 16) & 255}, ${(theme.card >> 8) & 255}, ${theme.card & 255}, 0.92)`;
		ctx.fillRect(0, 0, w, h);

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const node of nodeIndex.values()) {
			if (node.x < minX) minX = node.x;
			if (node.y < minY) minY = node.y;
			if (node.x > maxX) maxX = node.x;
			if (node.y > maxY) maxY = node.y;
		}

		const graphW = Math.max(1, maxX - minX);
		const graphH = Math.max(1, maxY - minY);
		const mapPad = 8;
		const mapScale = Math.min((w - mapPad * 2) / graphW, (h - mapPad * 2) / graphH);

		for (const node of nodeIndex.values()) {
			const nx = mapPad + (node.x - minX) * mapScale;
			const ny = mapPad + (node.y - minY) * mapScale;
			ctx.fillStyle = node.type === 'root'
				? `rgb(${(theme.primary >> 16) & 255} ${(theme.primary >> 8) & 255} ${theme.primary & 255})`
				: `rgb(${(theme.secondary >> 16) & 255} ${(theme.secondary >> 8) & 255} ${theme.secondary & 255})`;
			ctx.fillRect(nx - 1, ny - 1, 3, 3);
		}

		const vx = (-app.stage.x / zoom - minX) * mapScale + mapPad;
		const vy = (-app.stage.y / zoom - minY) * mapScale + mapPad;
		const vw = (app.screen.width / zoom) * mapScale;
		const vh = (app.screen.height / zoom) * mapScale;

		ctx.strokeStyle = numberToRgbCss(theme.foreground);
		ctx.lineWidth = 1;
		ctx.strokeRect(vx, vy, vw, vh);
	}

	function drawEdges(positions: Record<string, { x: number; y: number }>) {
		if (!edgeLayer) return;
		edgeLayer.clear();

		for (const edge of edges) {
			const s = positions[edge.source];
			const t = positions[edge.target];
			if (!s || !t) continue;

			const color = theme.muted;
			const mx = (s.x + t.x) / 2;
			edgeLayer.moveTo(s.x, s.y + 18);
			edgeLayer.bezierCurveTo(mx, s.y + 32, mx, t.y - 32, t.x, t.y - 18);
			edgeLayer.stroke({ width: 1.25, color, alpha: 0.38 });
		}
	}

	function drawNodes(positions: Record<string, { x: number; y: number }>) {
		if (!nodeLayer || !labelLayer) return;

		const positioned: PositionedNode[] = [];
		for (const node of nodes) {
			const pos = positions[node.id];
			if (!pos) continue;

			const tex = nodeTexture(node.type || 'default');
			const sprite = new PIXI.Sprite(tex);
			sprite.x = pos.x - 66;
			sprite.y = pos.y - 19;
			nodeLayer.addChild(sprite);

			const maxTextWidth = 112;
			let labelText = node.label.replace(/\s+/g, ' ').trim();
			if (labelText.length > 36) {
				labelText = `${labelText.slice(0, 35)}…`;
			}

			const text = new PIXI.Text({
				text: labelText,
				style: {
					fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
					fontSize: 11,
					fill: theme.foreground,
					align: 'center'
				}
			});

			let fontSize = 11;
			while (text.width > maxTextWidth && fontSize > 8) {
				fontSize -= 1;
				text.style.fontSize = fontSize;
			}

			while (text.width > maxTextWidth && labelText.length > 5) {
				labelText = `${labelText.slice(0, -2)}…`;
				text.text = labelText;
			}

			text.x = pos.x - text.width / 2;
			text.y = pos.y - text.height / 2;
			labelLayer.addChild(text);

			const meta: PositionedNode = {
				id: node.id,
				label: node.label,
				type: node.type || 'default',
				x: pos.x,
				y: pos.y,
				sprite,
				text
			};
			nodeIndex.set(node.id, meta);
			positioned.push(meta);
		}

		tree = quadtree<PositionedNode>()
			.x((n: PositionedNode) => n.x)
			.y((n: PositionedNode) => n.y)
			.addAll(positioned);
	}

	function updateLabelVisibility() {
		if (!app || !labelLayer) return;
		const show = zoom >= 0.75;
		labelLayer.visible = show;
		if (!show) return;

		const ox = -app.stage.x / zoom;
		const oy = -app.stage.y / zoom;
		const w = app.screen.width / zoom;
		const h = app.screen.height / zoom;
		const pad = 110;

		for (const node of nodeIndex.values()) {
			node.text.visible =
				node.x > ox - pad &&
				node.x < ox + w + pad &&
				node.y > oy - pad &&
				node.y < oy + h + pad;
		}
		drawMiniMap();
	}

	function centerOnRoot(initialZoom = 0.9) {
		if (!app) return;
		const root = nodeIndex.get(rootId) || nodeIndex.values().next().value;
		if (!root) return;

		const children = edges.filter((e) => e.source === root.id).map((e) => nodeIndex.get(e.target)).filter(Boolean) as PositionedNode[];
		const maxChildDepth = children.length > 0 ? Math.max(...children.map((c) => c.y)) : root.y + 140;
		const focusHeight = Math.max(200, maxChildDepth - root.y + 200);
		const fitZoom = Math.min(1.15, Math.max(0.58, (app.screen.height * 0.74) / focusHeight));

		zoom = Math.min(initialZoom, fitZoom);
		app.stage.scale.set(zoom);
		app.stage.x = app.screen.width / 2 - root.x * zoom;
		app.stage.y = app.screen.height / 2 - root.y * zoom;
		updateLabelVisibility();
	}

	function fitToGraph(maxZoom = 1) {
		if (!app || nodeIndex.size === 0) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const node of nodeIndex.values()) {
			if (node.x < minX) minX = node.x;
			if (node.y < minY) minY = node.y;
			if (node.x > maxX) maxX = node.x;
			if (node.y > maxY) maxY = node.y;
		}
		const gw = Math.max(1, maxX - minX + 240);
		const gh = Math.max(1, maxY - minY + 180);
		zoom = Math.min(maxZoom, app.screen.width / gw, app.screen.height / gh);
		app.stage.scale.set(zoom);
		app.stage.x = app.screen.width / 2 - (minX + (maxX - minX) / 2) * zoom;
		app.stage.y = app.screen.height / 2 - (minY + (maxY - minY) / 2) * zoom;
		updateLabelVisibility();
	}

	function zoomBy(factor: number) {
		if (!app) return;
		const next = Math.max(0.12, Math.min(2.5, zoom * factor));
		const cx = app.screen.width / 2;
		const cy = app.screen.height / 2;
		app.stage.x = cx - (cx - app.stage.x) * (next / zoom);
		app.stage.y = cy - (cy - app.stage.y) * (next / zoom);
		zoom = next;
		app.stage.scale.set(zoom);
		updateLabelVisibility();
	}

	function setupPointerInteraction() {
		if (!app || !containerEl) return;
		const canvas = app.canvas as HTMLCanvasElement;

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			if (!app) return;

			const rect = canvas.getBoundingClientRect();
			const mx = event.clientX - rect.left;
			const my = event.clientY - rect.top;
			const factor = event.deltaY > 0 ? 0.9 : 1.1;
			const next = Math.max(0.12, Math.min(2.5, zoom * factor));

			app.stage.x = mx - (mx - app.stage.x) * (next / zoom);
			app.stage.y = my - (my - app.stage.y) * (next / zoom);
			zoom = next;
			app.stage.scale.set(zoom);
			updateLabelVisibility();
		};

		const onPointerDown = (event: PointerEvent) => {
			dragging = true;
			movedWhileDrag = false;
			lastPointer = { x: event.clientX, y: event.clientY };
			canvas.style.cursor = 'grabbing';
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!dragging || !app) return;
			const dx = event.clientX - lastPointer.x;
			const dy = event.clientY - lastPointer.y;
			if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedWhileDrag = true;
			app.stage.x += dx;
			app.stage.y += dy;
			lastPointer = { x: event.clientX, y: event.clientY };
			updateLabelVisibility();
		};

		const onPointerUp = (event: PointerEvent) => {
			if (!app) return;
			canvas.style.cursor = 'grab';
			const wasDrag = dragging;
			dragging = false;

			if (!wasDrag || movedWhileDrag || !tree) return;
			const rect = canvas.getBoundingClientRect();
			const sx = event.clientX - rect.left;
			const sy = event.clientY - rect.top;
			const gx = (sx - app.stage.x) / zoom;
			const gy = (sy - app.stage.y) / zoom;
			const hit = tree.find(gx, gy, 42 / zoom);
			if (hit) {
				dispatch('nodeclick', { nodeId: hit.id });
			}
		};

		canvas.addEventListener('wheel', onWheel, { passive: false });
		canvas.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);

		cleanupInteraction = () => {
			canvas.removeEventListener('wheel', onWheel);
			canvas.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};
	}

	async function renderGraph() {
		if (!app || !edgeLayer || !nodeLayer || !labelLayer || disposed) return;
		if (!nodes || nodes.length === 0) {
			clearScene();
			isLoading = false;
			errorText = '';
			return;
		}

		const seq = ++renderSeq;
		isLoading = true;
		errorText = '';
		clearScene();

		let worker: Worker;
		try {
			worker = new Worker(new URL('./dependency-layout.worker.ts', import.meta.url), {
				type: 'module'
			});
		} catch {
			errorText = 'Graph worker failed to start';
			isLoading = false;
			return;
		}

		const timeout = window.setTimeout(() => {
			if (seq !== renderSeq || disposed) return;
			errorText = 'Graph layout timed out';
			isLoading = false;
			worker.terminate();
		}, 12000);

		worker.postMessage({
			nodes: nodes.map((n) => ({ id: n.id })),
			edges
		});

		worker.onmessage = ({ data }) => {
			window.clearTimeout(timeout);
			if (seq !== renderSeq) {
				worker.terminate();
				return;
			}
			if (disposed) {
				worker.terminate();
				return;
			}
			try {
				const positions = data?.positions || {};
				drawEdges(positions);
				drawNodes(positions);
				centerOnRoot(0.92);
				drawMiniMap();
				errorText = '';
				isLoading = false;
			} catch {
				errorText = 'Failed to render graph';
				isLoading = false;
			}
			worker.terminate();
		};

		worker.onerror = () => {
			window.clearTimeout(timeout);
			if (seq !== renderSeq) {
				worker.terminate();
				return;
			}
			try {
				const g = new dagre.graphlib.Graph();
				g.setGraph({ rankdir: 'TB', nodesep: 42, ranksep: 84 });
				g.setDefaultEdgeLabel(() => ({}));
				for (const node of nodes) g.setNode(node.id, { width: 132, height: 38 });
				for (const edge of edges) g.setEdge(edge.source, edge.target);
				dagre.layout(g);
				const positions: Record<string, { x: number; y: number }> = {};
				for (const node of nodes) {
					const pos = g.node(node.id) as { x: number; y: number } | undefined;
					if (pos) positions[node.id] = { x: pos.x, y: pos.y };
				}
				drawEdges(positions);
				drawNodes(positions);
				centerOnRoot(0.92);
				drawMiniMap();
				errorText = '';
				isLoading = false;
			} catch {
				errorText = 'Failed to layout graph';
				isLoading = false;
			}
			isLoading = false;
			worker.terminate();
		};
	}

	onMount(async () => {
		if (!containerEl) return;
		resolveTheme();
		app = new PIXI.Application();
		await app.init({
			resizeTo: containerEl,
			background: theme.background,
			antialias: true,
			autoDensity: true,
			resolution: window.devicePixelRatio || 1
		});

		containerEl.appendChild(app.canvas as HTMLCanvasElement);
		edgeLayer = new PIXI.Graphics();
		nodeLayer = new PIXI.Container();
		labelLayer = new PIXI.Container();
		app.stage.addChild(edgeLayer, nodeLayer, labelLayer);

		setupPointerInteraction();
		void renderGraph();
	});

	$effect(() => {
		if (app && nodes.length > 0) {
			void renderGraph();
		}
	});

		onDestroy(() => {
		disposed = true;
		cleanupInteraction?.();
		for (const tex of textures.values()) {
			tex.destroy(true);
		}
		textures.clear();
		app?.destroy(true);
		app = null;
	});
</script>

<div bind:this={containerEl} class="dep-graph" style={`height:${height};`}>
	<canvas bind:this={miniMapEl} class="dep-minimap" width="172" height="112"></canvas>
	<div class="dep-controls">
		<button type="button" class="soc-btn" onclick={() => zoomBy(1.14)}>+</button>
		<button type="button" class="soc-btn" onclick={() => zoomBy(0.88)}>-</button>
		<button type="button" class="soc-btn" onclick={() => centerOnRoot(0.92)}>Center</button>
		<button type="button" class="soc-btn" onclick={() => fitToGraph(1)}>Fit</button>
	</div>
	{#if isLoading}
		<div class="dep-overlay">Loading dependency graph...</div>
	{:else if errorText}
		<div class="dep-overlay dep-error">{errorText}</div>
	{:else if nodes.length === 0}
		<div class="dep-overlay">No graph data available</div>
	{/if}
</div>

<style>
	.dep-graph {
		position: relative;
		width: 100%;
		cursor: grab;
		border-radius: 12px;
		overflow: hidden;
		background: color-mix(in oklab, var(--color-card) 92%, transparent);
		border: 1px solid var(--color-border);
	}

	.dep-controls {
		position: absolute;
		left: 10px;
		top: 10px;
		display: flex;
		gap: 6px;
		z-index: 3;
	}

	.dep-minimap {
		position: absolute;
		right: 10px;
		bottom: 10px;
		width: 172px;
		height: 112px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: color-mix(in oklab, var(--color-card) 88%, transparent);
		z-index: 3;
	}

	.dep-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in oklab, var(--color-background) 72%, transparent);
		color: var(--color-foreground);
		font-size: 12px;
		z-index: 4;
	}

	.dep-error {
		color: var(--color-destructive);
	}
</style>
