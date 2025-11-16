// src/graphData.ts
import { GUMGraph } from './gum';

export interface GraphDataNode {
  id: number;
  state: number; // NodeState numeric enum value
}

export interface GraphDataLink {
  source: number;
  target: number;
}

/**
 * Extracts a simple nodes/links representation from the internal GUMGraph.
 * This is used by the 3D renderer and can also be unit-tested independently.
 */
export function buildGraphDataFromGum(
  g: GUMGraph
): { nodes: GraphDataNode[]; links: GraphDataLink[] } {
  const nodes = g.getNodes().map(n => ({
    id: n.id,
    state: n.state,
  }));

  const links = g.getEdges().map(e => ({
    source: e.source.id,
    target: e.target.id,
  }));

  return { nodes, links };
}
