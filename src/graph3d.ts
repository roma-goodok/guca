// src/graph3d.ts
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import { GUMGraph, GUMNode, NodeState } from './gum';
import { edgeColorByStates, getVertexRenderColor } from './utils';
import { buildGraphDataFromGum } from './graphData';

export interface Graph3DController {
  ensure(container: HTMLElement): void;
  syncFromGum(triggerZoomFit: boolean): void;
  resize(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  onNodeHover(handler: (node?: GUMNode) => void): void;
}

type InternalLink = { source: number; target: number };

type InternalNode = {
  id: number;
  state: number;
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
};


export function createGraph3DController(gumGraph: GUMGraph): Graph3DController {
  let fg: ForceGraph3DInstance | null = null;
  let containerEl: HTMLElement | null = null;
  let hoverHandler: ((node?: GUMNode) => void) | null = null;

  // Persistent data object (same reference for incremental updates)
  const data: { nodes: InternalNode[]; links: InternalLink[] } = {
    nodes: [],
    links: [],
  };
  const nodeById = new Map<number, InternalNode>();

  function ensure(container: HTMLElement) {
    containerEl = container;

    if (!fg) {
      fg = new ForceGraph3D(containerEl)
        .backgroundColor('#000000')
        .showNavInfo(true)
        .linkOpacity(1)
        .linkWidth(2)
        .linkResolution(8)
        .nodeId('id')
        .nodeRelSize(6)
        .nodeLabel((n: any) => {
          const stName = (NodeState as any)[n.state] ?? n.state;
          return `ID: ${n.id} | ${stName}`;
        })
        .nodeColor((n: any) =>
          getVertexRenderColor(n.state as NodeState)
        )
        .linkColor((link: any) => {
          const srcId =
            typeof link.source === 'object'
              ? link.source.id
              : link.source;
          const tgtId =
            typeof link.target === 'object'
              ? link.target.id
              : link.target;
          const s = gumGraph.getNodeById(Number(srcId));
          const t = gumGraph.getNodeById(Number(tgtId));
          if (!s || !t) return '#888';
          return edgeColorByStates(s.state, t.state);
        })
        .onNodeHover((n: any | null) => {
          if (!hoverHandler) return;
          if (!n) {
            hoverHandler(undefined);
            return;
          }
          const gNode = gumGraph.getNodeById(Number(n.id));
          hoverHandler(gNode ?? undefined);
        });

      // Initial empty data; positions will be filled once we sync
      fg.graphData(data);
      fg.cooldownTicks(120);
    }

    resize();
  }

  const BIRTH3D_SPAWN_BASE_R = 45;
  const BIRTH3D_SPAWN_JITTER_R = 18;

  function pickBirthAnchorId3D(child: GUMNode): number | null {
    const hinted = child.bornFromId;
    if (typeof hinted === 'number' && Number.isFinite(hinted)) return hinted;

    const nbs = gumGraph.getNeighbors(child);
    if (!nbs.length) return null;
    return nbs.reduce((m, nb) => Math.min(m, nb.id), nbs[0].id);
  }

  function seedNewNodePosition3D(newNode: InternalNode, parent: any) {
    const px = (typeof parent.x === 'number') ? parent.x : 0;
    const py = (typeof parent.y === 'number') ? parent.y : 0;
    const pz = (typeof parent.z === 'number') ? parent.z : 0;

    const r = Math.max(
      6,
      BIRTH3D_SPAWN_BASE_R + (Math.random() - 0.5) * 2 * BIRTH3D_SPAWN_JITTER_R
    );

    // Random direction on a sphere
    const theta = Math.random() * 2 * Math.PI;
    const u = (Math.random() * 2) - 1; // cos(phi) in [-1,1]
    const phi = Math.acos(u);

    const sx = r * Math.sin(phi) * Math.cos(theta);
    const sy = r * Math.sin(phi) * Math.sin(theta);
    const sz = r * Math.cos(phi);

    newNode.x = px + sx;
    newNode.y = py + sy;
    newNode.z = pz + sz;

    if (typeof parent.vx === 'number') newNode.vx = parent.vx;
    if (typeof parent.vy === 'number') newNode.vy = parent.vy;
    if (typeof parent.vz === 'number') newNode.vz = parent.vz;
  }


  function syncFromGum(triggerZoomFit: boolean) {
    if (!fg || !containerEl) return;

    // --- Incremental node sync ---

    const gumNodes = gumGraph.getNodes();
    const currentIds = new Set<number>();

    for (const gn of gumNodes) {
      currentIds.add(gn.id);
      let node = nodeById.get(gn.id);
      if (!node) {
          node = { id: gn.id, state: gn.state };

          const parentId = pickBirthAnchorId3D(gn);
          const parent = (parentId != null) ? nodeById.get(parentId) : null;
          if (parent && (typeof (parent as any).x === 'number' || typeof (parent as any).y === 'number' || typeof (parent as any).z === 'number')) {
            seedNewNodePosition3D(node, parent as any);
          }

          nodeById.set(gn.id, node);
          data.nodes.push(node);
        } else {
          node.state = gn.state;
        }

    }

    // Remove deleted nodes
    if (nodeById.size !== currentIds.size) {
      data.nodes = data.nodes.filter(n => {
        if (!currentIds.has(n.id)) {
          nodeById.delete(n.id);
          return false;
        }
        return true;
      });
    }

    // --- Links: rebuild list but re-use the same data object ---

    const gumEdges = gumGraph.getEdges();
    data.links.length = 0;
    for (const e of gumEdges) {
      data.links.push({ source: e.source.id, target: e.target.id });
    }

    // Apply incremental update
    fg.graphData(data);

    if (triggerZoomFit) {
      fg.cooldownTicks(120);
      fg.zoomToFit(600, 24);
    }
  }

  function resize() {
    if (!fg || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    fg.width(rect.width || 0);
    fg.height(rect.height || 0);
  }

  function pause() {
    if (fg) fg.pauseAnimation();
  }

  function resume() {
    if (fg) fg.resumeAnimation();
  }

  function destroy() {
    if (fg && typeof (fg as any)._destructor === 'function') {
      (fg as any)._destructor();
    }
    fg = null;
  }

  function onNodeHover(handler: (node?: GUMNode) => void) {
    hoverHandler = handler;
  }

  return {
    ensure,
    syncFromGum,
    resize,
    pause,
    resume,
    destroy,
    onNodeHover,
  };
}
