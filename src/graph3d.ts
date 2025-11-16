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

export function createGraph3DController(gumGraph: GUMGraph): Graph3DController {
  let fg: ForceGraph3DInstance | null = null;
  let containerEl: HTMLElement | null = null;
  let hoverHandler: ((node?: GUMNode) => void) | null = null;

  function ensure(container: HTMLElement) {
    containerEl = container;

    if (!fg) {
      // IMPORTANT: use `new` as recommended by the library README
      fg = new ForceGraph3D(containerEl)
        .backgroundColor('#000000')
        .showNavInfo(true)
        .linkOpacity(0.6)          // default is 0.2 → quite dark
        .linkWidth(1)            // > 0 switches to cylinders instead of 1px lines
        .linkResolution(8)         // smoother cylinders (default is 6)
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

      // Let the internal force layout relax a bit.
      fg.cooldownTicks(120);
    }

    resize();
  }

  function syncFromGum(triggerZoomFit: boolean) {
    if (!fg || !containerEl) return;

    const data = buildGraphDataFromGum(gumGraph);
    fg.graphData(data);

    if (triggerZoomFit) {
      // Run a few more layout ticks and smart-fit the camera
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
