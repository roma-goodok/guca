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

type InternalNode = { id: number; state: number };
type InternalLink = { source: number; target: number };

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
        nodeById.set(gn.id, node);
        data.nodes.push(node);
      } else {
        // Update state in place (position x,y,z is kept by 3d-force-graph)
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
