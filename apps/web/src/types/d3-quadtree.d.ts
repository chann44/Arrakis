declare module 'd3-quadtree' {
	export type Accessor<T> = (d: T) => number;

	export interface Quadtree<T> {
		x(accessor: Accessor<T>): Quadtree<T>;
		y(accessor: Accessor<T>): Quadtree<T>;
		addAll(data: T[]): Quadtree<T>;
		find(x: number, y: number, radius?: number): T | undefined;
	}

	export function quadtree<T>(): Quadtree<T>;
}
