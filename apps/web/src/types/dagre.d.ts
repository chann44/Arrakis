declare module 'dagre' {
	export interface GraphLabel {
		rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
		nodesep?: number;
		ranksep?: number;
	}

	export interface NodeLabel {
		width: number;
		height: number;
		x?: number;
		y?: number;
	}

	export class Graph {
		setGraph(label: GraphLabel): void;
		setDefaultEdgeLabel(callback: () => Record<string, never>): void;
		setNode(id: string, value: NodeLabel): void;
		setEdge(source: string, target: string): void;
		node(id: string): NodeLabel | undefined;
	}

	export const graphlib: {
		Graph: new () => Graph;
	};

	export function layout(graph: Graph): void;
}
