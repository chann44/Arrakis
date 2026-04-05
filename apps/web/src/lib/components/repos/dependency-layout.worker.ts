import dagre from 'dagre';

type LayoutNode = { id: string };
type LayoutEdge = { source: string; target: string };

self.onmessage = ({ data }: MessageEvent<{ nodes: LayoutNode[]; edges: LayoutEdge[] }>) => {
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];

	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'TB',
		nodesep: 42,
		ranksep: 84
	});
	g.setDefaultEdgeLabel(() => ({}));

	for (const node of nodes) {
		g.setNode(node.id, { width: 132, height: 38 });
	}

	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	dagre.layout(g);

	const positions: Record<string, { x: number; y: number }> = {};
	for (const node of nodes) {
		const pos = g.node(node.id) as { x: number; y: number } | undefined;
		if (pos) {
			positions[node.id] = { x: pos.x, y: pos.y };
		}
	}

	self.postMessage({ positions });
};

export {};
