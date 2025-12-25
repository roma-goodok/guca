// src/graph3d.ts
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import { GUMGraph, GUMNode, NodeState } from './gum';
import { edgeColorByStates, getVertexRenderColor } from './utils';
import { buildGraphDataFromGum } from './graphData';
import * as THREE from 'three';


export interface Graph3DController {
  ensure(container: HTMLElement): void;
  syncFromGum(triggerZoomFit: boolean): void;
  resize(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  onNodeHover(handler: (node?: GUMNode) => void): void;
  setGradientEdges(on: boolean): void;
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

      apply3DLinkRendering(false);
      // Initial empty data; positions will be filled once we sync
      fg.graphData(data);
      fg.cooldownTicks(120);      

    }

    resize();
  }

  function setGradientEdges(on: boolean) {
    gradientEdgesEnabled = !!on;
    apply3DLinkRendering(true);
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
      const a = e.source.id;
      const b = e.target.id;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      data.links.push({ source: lo, target: hi });
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

  let gradientEdgesEnabled = true;

  function apply3DLinkRendering(refresh: boolean) {
    if (!fg) return;

    if (gradientEdgesEnabled) {
      // Make default links be lines (not cylinders) so same-state edges stay lightweight.
      fg.linkWidth(0);

      (fg as any).linkThreeObject((link: any) => {
        const srcId = typeof link.source === 'object' ? Number(link.source.id) : Number(link.source);
        const tgtId = typeof link.target === 'object' ? Number(link.target.id) : Number(link.target);

        const srcState =
          typeof link.source === 'object' ? Number(link.source.state) : Number(nodeById.get(srcId)?.state);
        const tgtState =
          typeof link.target === 'object' ? Number(link.target.state) : Number(nodeById.get(tgtId)?.state);

        // Optimization: same state => use default solid link
        if (!Number.isFinite(srcState) || !Number.isFinite(tgtState) || srcState === tgtState) return false;

        const c0 = new THREE.Color(getVertexRenderColor(srcState as NodeState));
        const c1 = new THREE.Color(getVertexRenderColor(tgtState as NodeState));
        const colors = new Float32Array([...c0.toArray(), ...c1.toArray()]);

        const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return new THREE.Line(geometry, material);
      });

      (fg as any).linkPositionUpdate((line: any, { start, end }: any, link: any) => {
        const geom = line?.geometry;
        const posAttr = geom?.getAttribute?.('position');
        if (!posAttr || posAttr.count !== 2) return false;

        const dx = (end.x || 0) - (start.x || 0);
        const dy = (end.y || 0) - (start.y || 0);
        const dz = (end.z || 0) - (start.z || 0);
        const lineLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (!(lineLen > 0)) return false;

        // Trim so the line touches node surfaces (same trick as the official example).
        const r = (fg as any).nodeRelSize?.() ?? 0;
        const t0 = Math.min(0.49, r / lineLen);
        const t1 = Math.max(0.51, 1 - r / lineLen);

        const coords = [t0, t1]
          .map(t => [start.x + dx * t, start.y + dy * t, start.z + dz * t])
          .flat();

        (posAttr.array as Float32Array).set(coords);
        posAttr.needsUpdate = true;

        // Keep gradient colors up-to-date if palette overrides change
        const colorAttr = geom.getAttribute?.('color');
        if (colorAttr && colorAttr.count === 2) {
          const sState =
            typeof link.source === 'object' ? Number(link.source.state) : Number(nodeById.get(Number(link.source))?.state);
          const tState =
            typeof link.target === 'object' ? Number(link.target.state) : Number(nodeById.get(Number(link.target))?.state);

          if (Number.isFinite(sState) && Number.isFinite(tState)) {
            const c0 = new THREE.Color(getVertexRenderColor(sState as NodeState));
            const c1 = new THREE.Color(getVertexRenderColor(tState as NodeState));
            (colorAttr.array as Float32Array).set([...c0.toArray(), ...c1.toArray()]);
            colorAttr.needsUpdate = true;
          }
        }

        return true;
      });
    } else {
      // Restore your original look
      fg.linkWidth(2);

      // Disable custom link objects/updates
      (fg as any).linkThreeObject(undefined);
      (fg as any).linkPositionUpdate(undefined);
    }

    if (refresh) fg.graphData(data);
  }


  return {
    ensure,
    syncFromGum,
    resize,
    pause,
    resume,
    destroy,
    onNodeHover,
    setGradientEdges
  };
}
