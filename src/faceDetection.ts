import { NodeState } from './gum';
import { getVertexRenderColor } from './utils';

export interface FaceDetectionNode {
  id: number;
  state: NodeState | number;
}

export type FaceEndpoint = number | { id: number };

export interface FaceDetectionLink {
  source: FaceEndpoint;
  target: FaceEndpoint;
}

export interface DetectedFace {
  id: string;
  nodeIds: number[];
  state: NodeState | number;
  color: string;
}

export interface FaceDetectionOptions {
  minCycleLength?: number;
  maxCycleLength?: number;
  maxFaces?: number;
}

const DEFAULT_MIN_CYCLE_LENGTH = 3;
const DEFAULT_MAX_CYCLE_LENGTH = 6;
const DEFAULT_MAX_FACES = 2000;

function endpointId(endpoint: FaceEndpoint): number {
  return typeof endpoint === 'number' ? endpoint : endpoint.id;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function lexicographicLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

function rotateToSmallest(ids: number[]): number[] {
  let bestIndex = 0;
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] < ids[bestIndex]) bestIndex = i;
  }
  return ids.slice(bestIndex).concat(ids.slice(0, bestIndex));
}

export function canonicalCycle(cycle: number[]): number[] {
  const forward = rotateToSmallest(cycle);
  const backward = rotateToSmallest(cycle.slice().reverse());
  return lexicographicLess(backward, forward) ? backward : forward;
}

function hasChord(cycle: number[], edgeSet: Set<string>): boolean {
  const n = cycle.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const consecutive = j === i + 1 || (i === 0 && j === n - 1);
      if (consecutive) continue;
      if (edgeSet.has(edgeKey(cycle[i], cycle[j]))) return true;
    }
  }
  return false;
}

export function majorityNodeStateForFace(
  nodeIds: number[],
  nodesById: Map<number, FaceDetectionNode>
): NodeState | number {
  const counts = new Map<number, number>();

  for (const id of nodeIds) {
    const node = nodesById.get(id);
    if (!node) continue;
    const state = Number(node.state);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }

  let bestState = Number(NodeState.Unknown);
  let bestCount = -1;
  for (const [state, count] of counts) {
    if (count > bestCount || (count === bestCount && state < bestState)) {
      bestState = state;
      bestCount = count;
    }
  }

  return bestState as NodeState;
}

export function detectFaces(
  nodes: FaceDetectionNode[],
  links: FaceDetectionLink[],
  options: FaceDetectionOptions = {}
): DetectedFace[] {
  const minCycleLength = Math.max(
    3,
    Math.trunc(options.minCycleLength ?? DEFAULT_MIN_CYCLE_LENGTH)
  );
  const maxCycleLength = Math.max(
    minCycleLength,
    Math.trunc(options.maxCycleLength ?? DEFAULT_MAX_CYCLE_LENGTH)
  );
  const maxFaces = Math.max(0, Math.trunc(options.maxFaces ?? DEFAULT_MAX_FACES));

  if (!nodes.length || !links.length || maxFaces === 0) return [];

  const nodesById = new Map<number, FaceDetectionNode>();
  for (const node of nodes) nodesById.set(node.id, node);

  const adjacency = new Map<number, Set<number>>();
  const edgeSet = new Set<string>();

  for (const node of nodes) adjacency.set(node.id, new Set<number>());

  for (const link of links) {
    const a = endpointId(link.source);
    const b = endpointId(link.target);
    if (a === b || !nodesById.has(a) || !nodesById.has(b)) continue;

    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
    edgeSet.add(edgeKey(a, b));
  }

  const sortedIds = Array.from(nodesById.keys()).sort((a, b) => a - b);
  const sortedAdjacency = new Map<number, number[]>();
  for (const id of sortedIds) {
    sortedAdjacency.set(id, Array.from(adjacency.get(id) ?? []).sort((a, b) => a - b));
  }

  const facesByKey = new Map<string, DetectedFace>();

  function maybeAddCycle(path: number[]) {
    if (path.length < minCycleLength || path.length > maxCycleLength) return;

    const canonical = canonicalCycle(path);
    if (hasChord(canonical, edgeSet)) return;

    const key = canonical.join(':');
    if (facesByKey.has(key)) return;

    const state = majorityNodeStateForFace(canonical, nodesById);
    facesByKey.set(key, {
      id: key,
      nodeIds: canonical,
      state,
      color: getVertexRenderColor(state as NodeState),
    });
  }

  function dfs(start: number, current: number, path: number[], visited: Set<number>) {
    if (facesByKey.size >= maxFaces) return;

    const nextIds = sortedAdjacency.get(current) ?? [];
    for (const next of nextIds) {
      if (facesByKey.size >= maxFaces) return;

      if (next === start) {
        maybeAddCycle(path);
        continue;
      }

      if (next < start || visited.has(next) || path.length >= maxCycleLength) continue;

      visited.add(next);
      path.push(next);
      dfs(start, next, path, visited);
      path.pop();
      visited.delete(next);
    }
  }

  for (const start of sortedIds) {
    if (facesByKey.size >= maxFaces) break;
    const visited = new Set<number>([start]);
    dfs(start, start, [start], visited);
  }

  return Array.from(facesByKey.values()).sort((a, b) => {
    if (a.nodeIds.length !== b.nodeIds.length) return a.nodeIds.length - b.nodeIds.length;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
