import * as d3 from 'd3';
import {
  GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState,
  RuleItem, OperationCondition, Operation, OperationKindEnum,
  MachineCfg, TranscriptionWay, CountCompare
} from './gum';
import {
  mapOperationKind, mapOperationKindToString, getVertexRenderColor, getVertexRenderTextColor,
  mapNodeState, getNodeDisplayText, mapGUMNodeToNode, convertToShortForm,
  Node, Link
} from './utils';
import yaml from 'js-yaml';
import { buildMachineFromConfig } from './genomeLoader';

// ---------------------- Machine defaults ----------------------
const DEFAULT_MACHINE_CFG: MachineCfg = {
  start_state: NodeState.A,
  transcription: 'resettable' as TranscriptionWay,
  count_compare: 'range' as CountCompare,
  max_vertices: 0,    // 0 = unlimited
  max_steps: 120,
  rng_seed: 123,
  nearest_search: {
    max_depth: 2,
    tie_breaker: 'stable',
    connect_all: false,
  },
  maintain_single_component: true, // NEW default
};

// Global configuration (debug UI verbosity)
const config = { debug: false };
let showAllRules = false;
let lastLoadedConfig: any = null;

// ---------------------- Small helpers (local, no logic changes) ----------------------

// Color chip for operation kind (distinct from state colors)
function opKindColor(kind: OperationKindEnum): string {
  switch (kind) {
    case OperationKindEnum.TurnToState:            return '#fde68a'; // amber-200
    case OperationKindEnum.GiveBirthConnected:     return '#bbf7d0'; // green-200
    case OperationKindEnum.GiveBirth:              return '#dcfce7'; // green-100
    case OperationKindEnum.TryToConnectWithNearest:return '#bfdbfe'; // blue-200
    case OperationKindEnum.TryToConnectWith:       return '#dbeafe'; // blue-100
    case OperationKindEnum.DisconectFrom:          return '#fecaca'; // red-200
    case OperationKindEnum.Die:                    return '#e5e7eb'; // gray-200
    default:                                       return '#e5e7eb';
  }
}
function nodeStateLetter(s: NodeState): string {
  if (s === NodeState.Unknown) return "Unknown";
  if (s === NodeState.Ignored) return "any";
  if (s >= NodeState.A && s <= NodeState.Z) return String.fromCharCode(64 + s);
  return String(s);
}
// Human-readable tooltip for a rule tile (self-contained to avoid extra deps)
function describeRuleHuman(item: RuleItem): string {
  const c = item.condition, o = item.operation;
  const cur = nodeStateLetter(c.currentState);
  const prior = nodeStateLetter(c.priorState);
  const bits: string[] = [];
  if (c.allConnectionsCount_GE >= 0) bits.push(`c≥${c.allConnectionsCount_GE}`);
  if (c.allConnectionsCount_LE >= 0) bits.push(`c≤${c.allConnectionsCount_LE}`);
  if (c.parentsCount_GE >= 0)        bits.push(`p≥${c.parentsCount_GE}`);
  if (c.parentsCount_LE >= 0)        bits.push(`p≤${c.parentsCount_LE}`);
  const cond = `if current=${cur}${c.priorState!==NodeState.Ignored?` & prior=${prior}`:''}${bits.length?` & ${bits.join(' & ')}`:''}`;
  const opS = nodeStateLetter(o.operandNodeState);
  let act = '';
  switch (o.kind) {
    case OperationKindEnum.TurnToState:            act = `turn to ${opS}`; break;
    case OperationKindEnum.GiveBirthConnected:     act = `give birth to ${opS} (connected)`; break;
    case OperationKindEnum.GiveBirth:              act = `give birth to ${opS}`; break;
    case OperationKindEnum.TryToConnectWithNearest:act = `connect to nearest ${opS}`; break;
    case OperationKindEnum.TryToConnectWith:       act = `connect to all ${opS}`; break;
    case OperationKindEnum.DisconectFrom:          act = `disconnect from ${opS}`; break;
    case OperationKindEnum.Die:                    act = `die`; break;
    default:                                       act = `do operation`;
  }
  return `${act} ${cond}`;
}

// ---------------------- SVG / D3 setup ----------------------
const width = 960;
const height = 800;

// Create the SVG container inside #canvas-container
const svg = d3.select("#canvas-container svg")
  .attr("width", "100%")
  .attr("height", height);

// Full-canvas overlay to capture interactions (zoom/cut)
const zoomOverlay = svg.append("rect")
  .attr("width", "100%")
  .attr("height", height)
  .attr("fill", "transparent")
  .attr("pointer-events", "all");

// Group that holds the graph elements
const graphGroup = svg.append("g");

type Tool = 'move' | 'scissors';
let currentTool: Tool = 'scissors';   // default ✂️

// NOTE: we no longer scale line widths in JS; we rely on vector-effect or constant width.
const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.01, 10])
  .filter((event: any) => {
    // Always allow wheel zoom (both tools)
    if (event.type === 'wheel') return true;

    // In Move (hand) mode: allow default drag/pan (no right-click; ignore ctrl+wheel)
    if (currentTool === 'move') {
      return (!event.ctrlKey || event.type === 'wheel') && !event.button;
    }

    // In Scissors mode: disallow non-wheel (so scissors drag works unimpeded)
    return false;
  })
  .on("zoom", (event) => {
    graphGroup.attr("transform", event.transform);
  });

// Start with zoom enabled; toggle behavior via tool switcher.
(svg as any).call(zoomBehavior as any);

// ---------------------- Simulation ----------------------
const simulation = d3.forceSimulation<Node, Link>()
  .force("link", d3.forceLink<Node, Link>()
    .id((d: Node) => d.id.toString())
    .distance(50))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .velocityDecay(0.2);

// Graph state mirrored for D3
let nodes: Node[] = [{ id: 1, x: width / 2, y: height / 2, state: NodeState.A }];
let links: Link[] = [];

// ---------------------- GUM init ----------------------
const gumGraph = new GUMGraph();
let gumMachine = new GraphUnfoldingMachine(gumGraph, DEFAULT_MACHINE_CFG);

// Simulation control
let isSimulationRunning = false;
let simulationInterval: any;

// Simple speed model: fast (slider) vs slow mode (toggle)
let slowMode = false;
let fastMs = 100;
const FAST_MS_DEFAULT = 100;
const SLOW_MS = 700;
const currentIntervalMs = () => (slowMode ? SLOW_MS : fastMs || FAST_MS_DEFAULT);

// UI controls we already have
const pauseResumeButton = document.getElementById('pause-resume-button') as HTMLButtonElement;
pauseResumeButton.textContent = 'Start';
pauseResumeButton.style.backgroundColor = 'lightgreen';

// ---------------------- New UI: tools & single-component ----------------------
let isCutting = false;
let lastCutPt: { x: number; y: number } | null = null;

const btnMove = document.getElementById('tool-move-button') as HTMLButtonElement | null;
const btnScissors = document.getElementById('tool-scissors-button') as HTMLButtonElement | null;
const maintainChk = document.getElementById('maintain-single-component') as HTMLInputElement | null;
const slowBtn = document.getElementById('slowdown-button') as HTMLButtonElement | null;

function setTool(tool: Tool) {
  currentTool = tool;
  btnMove?.classList.toggle('active', tool === 'move');
  btnScissors?.classList.toggle('active', tool === 'scissors');

  // Cursor hint
  svg.style('cursor', tool === 'scissors' ? 'crosshair' : 'default');

  // Make nodes non-interactive in Scissors mode so drags don't steal events
  graphGroup.selectAll<SVGGElement, Node>('.node')
    .style('pointer-events', tool === 'scissors' ? 'none' : 'auto');
}

btnMove?.addEventListener('click', () => setTool('move'));
btnScissors?.addEventListener('click', () => setTool('scissors'));
setTool('scissors'); // default

// Maintain single component toggle
maintainChk?.addEventListener('change', () => {
  const on = !!maintainChk.checked;
  const fn = (gumMachine as any)?.setMaintainSingleComponent;
  if (typeof fn === 'function') fn.call(gumMachine, on);
  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (on && typeof enforce === 'function') {
    enforce.call(gumMachine);
    update();
  }
});

// Slow mode toggle (optional button)
slowBtn?.addEventListener('click', () => {
  slowMode = !slowMode;
  slowBtn.classList.toggle('active', slowMode);
  slowBtn.textContent = slowMode ? '🐢 Slow down (ON)' : '🐢 Slow down';
  if (isSimulationRunning) {
    clearInterval(simulationInterval);
    simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
  }
});

// ---------------------- Genome catalog ----------------------

// Hardcode a small catalog or generate it server-side
const YAML_CATALOG = [
  { name: 'Dumbbell', path: 'data/genoms/dumbbell.yaml' },
  { name: 'Hairy Circle', path: 'data/genoms/hairy_circle_genom.yaml' },  
  { name: 'Dumbbell and Hairy Circle Hybrid', path: 'data/genoms/dumbbell_and_hairy_circle_hybrid.yaml' },
  { name: 'fractal-3', path: 'data/genoms/fractal3_genom.yaml' },
  { name: 'Triangle Mesh', path: 'data/genoms/exp005_trimesh_genom.yaml' },
  { name: 'Quad Mesh', path: 'data/genoms/quadmesh.yaml' },
  { name: 'Strange Figure #1', path: 'data/genoms/strange_figure1_genom.yaml' },
  { name: 'Strange Figure #2', path: 'data/genoms/strange_figure2_genom.yaml' },
//  { name: 'Gun (replicator)', path: 'gun.yaml' },  
  { name: 'Primitive Fractal', path: ' data/genoms/primitive_fractal_genom.yaml' },
  // { name: 'Hex Mesh (legacy debug, continuable)', path: 'data/genoms/HexMesh_64.13_short_continuable.yaml' },
  // { name: 'Hex Mesh (legacy debug, resettable)', path: 'data/genoms/HexMesh_64.13_short_resettable.yaml' },
];

async function fetchYaml(path: string): Promise<any> {
  const txt = await (await fetch(path)).text();
  return yaml.load(txt);
}

async function loadGenesLibrary() {
  const geneSelect = document.getElementById('gene-select') as HTMLSelectElement;
  if (!geneSelect) return;

  geneSelect.innerHTML = '';
  YAML_CATALOG.forEach(({ name, path }) => {
    const opt = document.createElement('option');
    opt.value = path; opt.text = name; geneSelect.add(opt);
  });

  // load initial
  await loadGenomFromYaml(geneSelect.value);

  geneSelect.addEventListener('change', async (ev) => {
    const path = (ev.target as HTMLSelectElement).value;
    await loadGenomFromYaml(path);
  });

  updateDebugInfo();
}

const uploadInput = document.getElementById('gene-upload') as HTMLInputElement | null;
if (uploadInput) {
  uploadInput.addEventListener('change', async () => {
    const f = uploadInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    let cfg: any = null;
    try {
      // try YAML first; if it fails, try JSON
      cfg = yaml.load(text);
      if (!cfg || typeof cfg !== 'object') throw new Error('Empty YAML');
    } catch {
      try {
        cfg = JSON.parse(text);
      } catch (e) {
        alert('Unable to parse file. Please upload a valid YAML or JSON genome.');
        return;
      }
    }
    await applyGenomConfig(cfg, f.name);
    refreshMaxStepsInput();
    updateDebugInfo();
  });
}

function toNodeState(s: any): NodeState {
  // supports numbers or strings
  if (typeof s === 'number') return s as NodeState;
  return mapNodeState(String(s));
}

async function loadGenomFromYaml(path: string) {
  const cfg = await fetchYaml(path);
  await applyGenomConfig(cfg, /*labelForSelect*/ null);
  refreshMaxStepsInput();
}

async function applyGenomConfig(cfg: any, labelForSelect: string | null) {
  lastLoadedConfig = cfg ? JSON.parse(JSON.stringify(cfg)) : {}; // keep a clone for export base  
  // Build machine + graph from config
  (gumMachine as any) = buildMachineFromConfig(cfg, gumGraph, maintainChk?.checked ?? true);

  // Reset UI run state, zoom & redraw
  resetGraph();                      // keep your visual state reset flow
  gumMachine.resetIterations();
  pauseResumeButton.textContent = 'Start';
  pauseResumeButton.style.backgroundColor = 'lightgreen';
  resetZoom();

  // (optional) Replace the select’s current option label to reflect a custom upload
  const sel = document.getElementById('gene-select') as HTMLSelectElement;
  if (labelForSelect && sel) {
    let opt = sel.querySelector('option[data-custom="1"]') as HTMLOptionElement | null;
    if (!opt) {
      opt = document.createElement('option');
      opt.setAttribute('data-custom', '1');
      sel.insertBefore(opt, sel.firstChild);
    }
    opt.value = '__custom__';
    opt.text = `Custom: ${labelForSelect}`;
    sel.selectedIndex = 0;
  }
}

// Reset zoom transform to identity
function resetZoom() {
  svg.call((zoomBehavior as any).transform, d3.zoomIdentity as any);
}

// ------------- Geometry helpers for scissors -------------
function toGraphCoords(evt: any) {
  const [mx, my] = d3.pointer(evt, svg.node() as any);
  const t = d3.zoomTransform(svg.node() as any);
  return { x: (mx - t.x) / t.k, y: (my - t.y) / t.k };
}

function orientation(ax:number, ay:number, bx:number, by:number, cx:number, cy:number) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : -1;
}

function onSegment(ax:number, ay:number, bx:number, by:number, px:number, py:number) {
  return Math.min(ax, bx) - 1e-9 <= px && px <= Math.max(ax, bx) + 1e-9 &&
         Math.min(ay, by) - 1e-9 <= py && py <= Math.max(ay, by) + 1e-9;
}

function segmentsIntersect(a1:{x:number;y:number}, a2:{x:number;y:number}, b1:{x:number;y:number}, b2:{x:number;y:number}) {
  const o1 = orientation(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
  const o2 = orientation(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);
  const o3 = orientation(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
  const o4 = orientation(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
  if (o1 !== o2 && o3 !== o4) return true; // general case
  // Colinear special cases
  if (o1 === 0 && onSegment(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y)) return true;
  if (o2 === 0 && onSegment(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y)) return true;
  if (o3 === 0 && onSegment(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y)) return true;
  if (o4 === 0 && onSegment(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y)) return true;
  return false;
}

function distPointToSegment(px:number, py:number, x1:number, y1:number, x2:number, y2:number) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const len2 = C*C + D*D;
  let t = len2 ? (A*C + B*D) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const xx = x1 + t*C, yy = y1 + t*D;
  const dx = px - xx, dy = py - yy;
  return Math.sqrt(dx*dx + dy*dy);
}

function cutEdgesBetween(p0:{x:number;y:number}, p1:{x:number;y:number}) {
  const t = d3.zoomTransform(svg.node() as any);
  const tol = 6 / Math.max(1e-6, t.k); // ~6px screen tolerance in graph coords

  const toRemove: Array<{ s: number; t: number }> = [];
  for (const l of links) {
    const s = (l.source as Node), tt = (l.target as Node);
    if (!s || !tt || s.x == null || s.y == null || tt.x == null || tt.y == null) continue;

    // If cursor path segment intersects the edge segment OR gets within tol
    const segIntersects = segmentsIntersect(p0, p1, { x: s.x!, y: s.y! }, { x: tt.x!, y: tt.y! });
    const near =
      Math.min(
        distPointToSegment(p0.x, p0.y, s.x!, s.y!, tt.x!, tt.y!),
        distPointToSegment(p1.x, p1.y, s.x!, s.y!, tt.x!, tt.y!)
      ) <= tol;

    if (segIntersects || near) {
      toRemove.push({ s: s.id, t: tt.id });
    }
  }

  if (toRemove.length === 0) return;

  for (const e of toRemove) {
    const g1 = gumGraph.getNodes().find(n => n.id === e.s);
    const g2 = gumGraph.getNodes().find(n => n.id === e.t);
    if (g1 && g2) gumGraph.removeEdge(g1, g2);
  }

  // Enforce single component if enabled (guarded)
  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (typeof enforce === 'function') enforce.call(gumMachine);

  update();
}

// Attach scissors handlers to the SVG surface
svg.on('mousedown.cut', (event: any) => {
  if (currentTool !== 'scissors') return;
  isCutting = true;
  lastCutPt = toGraphCoords(event);
});

svg.on('mousemove.cut', (event: any) => {
  if (!isCutting || currentTool !== 'scissors' || !lastCutPt) return;
  const p = toGraphCoords(event);
  cutEdgesBetween(lastCutPt, p);
  lastCutPt = p;
});

svg.on('mouseup.cut mouseleave.cut', () => {
  isCutting = false;
  lastCutPt = null;
});

// ---------------------- Graph rendering ----------------------
function adjustForRadius(source: Node, target: Node) {
  const radius = 12.5;
  const dx = target.x! - source.x!;
  const dy = target.y! - source.y!;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const padding = radius;

  return {
    x1: source.x! + dx * (padding / distance),
    y1: source.y! + dy * (padding / distance),
    x2: target.x! - dx * (padding / distance),
    y2: target.y! - dy * (padding / distance),
  };
}

function populateComboBoxes() {
  const nodeIds = gumGraph.getNodes().map(node => node.id);
  populateComboBox('source-node', nodeIds);
  populateComboBox('target-node', nodeIds);
  populateComboBox('remove-node-id', nodeIds);
  populateComboBox('change-node-id', nodeIds);
  populateComboBox('disconnect-source-node', nodeIds);
  populateComboBox('disconnect-target-node', nodeIds);
  populateComboBox('connect-nearest-node', nodeIds);
}

function update() {
  const gumNodes = gumGraph.getNodes();
  const gumEdges = gumGraph.getEdges();

  nodes = gumNodes.map(gumNode => {
    let existingNode = nodes.find(node => node.id === gumNode.id);
    if (!existingNode) {
      const centerNode = nodes[0];
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 200;
      existingNode = mapGUMNodeToNode(gumNode);
      existingNode.x = centerNode.x! + distance * Math.cos(angle);
      existingNode.y = centerNode.y! + distance * Math.sin(angle);
    } else {
      existingNode.state = gumNode.state;
    }
    return existingNode;
  });

  links = gumEdges.map(gumEdge => {
    const sourceNode = nodes.find(node => node.id === gumEdge.source.id) as Node;
    const targetNode = nodes.find(node => node.id === gumEdge.target.id) as Node;
    return { source: sourceNode, target: targetNode };
  });

  // LINKS (constant on-screen width via vector-effect)
  const link = graphGroup.selectAll<SVGLineElement, Link>(".link")
    .data(links, d => `${(d.source as Node).id}-${(d.target as Node).id}`);

  const linkEnter = link.enter().append("line")
    .attr("class", "link")
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke", 'white');

  linkEnter.merge(link)
    .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
    .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
    .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
    .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2);

  link.exit().remove();

  // NODES
  const nodeSel = graphGroup.selectAll<SVGGElement, Node>(".node")
    .data(nodes, d => d.id.toString());

  const nodeEnter = nodeSel.enter().append("g")
    .attr("class", "node")
    .call(d3.drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (currentTool === 'scissors') return; // disable dragging in scissors mode
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        if (currentTool === 'scissors') return;
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (currentTool === 'scissors') return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );

  nodeEnter.append("circle")
    .attr("r", d => config.debug ? 20 : 12.5)
    .attr("fill", d => getVertexRenderColor(d.state));

  nodeEnter.append("text")
    .attr("dy", 3)
    .attr("dx", config.debug ? -10 : -6)
    .attr("fill", d => getVertexRenderTextColor(d.state))
    .text(d => getNodeDisplayText(d.state, d.id, config.debug));

  const mergedNodes = nodeEnter.merge(nodeSel);
  nodeSel.exit().remove();

  // Respect current tool's pointer interactivity for nodes
  mergedNodes.style('pointer-events', currentTool === 'scissors' ? 'none' : 'auto');

  simulation.nodes(nodes).on("tick", () => {
    mergedNodes.select("circle")
      .attr("r", d => config.debug ? 20 : 12.5)
      .attr("cx", d => d.x!)
      .attr("cy", d => d.y!)
      .attr("fill", d => getVertexRenderColor(d.state));
    mergedNodes.select("text")
      .attr("x", d => d.x!)
      .attr("y", d => d.y!)
      .attr("fill", d => getVertexRenderTextColor(d.state))
      .text(d => getNodeDisplayText(d.state, d.id, config.debug));
    link
      .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
      .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
      .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
      .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
      .attr("stroke", d => {
        const maxState = Math.max((d.source as Node).state, (d.target as Node).state);
        return getVertexRenderColor(maxState);
      });
  });

  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);
  simulation.alpha(0.5).restart();
  updateDebugInfo();

  // Refresh combo boxes
  populateComboBoxes();

  // Ensure positions are flushed
  simulation.tick();
}

// ---------------------- Debug / status UI ----------------------
function updateDebugInfo() {
  const statusInfoElement = document.getElementById('status-info');

  if (!config.debug) {
    const nodeCountElement = document.getElementById('node-count');
    const nodeDetailsElement = document.getElementById('node-details');
    const edgeDetailsElement = document.getElementById('edge-details');
    if (nodeCountElement) nodeCountElement.textContent = '';
    if (nodeDetailsElement) nodeDetailsElement.innerHTML = '';
    if (edgeDetailsElement) edgeDetailsElement.innerHTML = '';
  }

  if (statusInfoElement) {
    statusInfoElement.textContent =
      `Nodes: ${nodes.length} | Edges: ${links.length} | Iterations: ${gumMachine.getIterations()}`;
  }

  // Prefer tile board if present; otherwise keep legacy short-form in #rule-table
  const board = document.getElementById('rule-board');
  const toggleBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;

  if (board) {
    const items = gumMachine.getRuleItems();
    const MAX = 60;
    const shown = showAllRules ? items : items.slice(0, MAX);
    const html = shown.map((it) => {
      const c = it.condition, o = it.operation;
      const curColor = getVertexRenderColor(c.currentState);
      const priorColor = getVertexRenderColor(c.priorState);
      const opColor = opKindColor(o.kind);
      const argColor = getVertexRenderColor(o.operandNodeState);
      const title = describeRuleHuman(it).replace(/"/g, '&quot;');
      return `
        <div class="gene-tile ${it.isActive ? 'active' : ''}" title="${title}">
          <span title="${title}" style="background:${curColor}"></span>
          <span title="${title}" style="background:${priorColor}"></span>
          <span title="${title}" style="background:${opColor}"></span>
          <span title="${title}" style="background:${argColor}"></span>
        </div>`;
    }).join('');
    board.innerHTML = html;

    if (toggleBtn) {
      if (items.length > MAX) {
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = showAllRules ? 'Show less' : `Show more (${items.length - MAX})`;
      } else {
        toggleBtn.style.display = 'none';
      }
    }
  } else {
    // Legacy short-form text fallback
    const ruleTableElement = document.getElementById('rule-table');
    if (ruleTableElement) {
      const changeRuleItems = gumMachine.getRuleItems();
      const shortForm = convertToShortForm(changeRuleItems);
    
      const lines = shortForm.split('\n');
      const maxLines = 10;
      const body = (!showAllRules && lines.length > maxLines)
        ? lines.slice(0, maxLines).join('\n') + `\n… (${lines.length - maxLines} more hidden)`
        : shortForm;
    
      ruleTableElement.innerHTML = `<h4>Rule Table (Short Form)</h4><pre>${body}</pre>`;
      if (toggleBtn) toggleBtn.style.display = (lines.length > maxLines ? 'inline-block' : 'none');
    }
  }

  if (config.debug) {
    const nodeCountElement = document.getElementById('node-count');
    const nodeDetailsElement = document.getElementById('node-details');
    const edgeDetailsElement = document.getElementById('edge-details');

    if (nodeCountElement) nodeCountElement.textContent = `Nodes: ${nodes.length}`;

    if (nodeDetailsElement) {
      const nodeDetails = gumGraph.getNodes().map(node =>
        `ID: ${node.id} | State: ${NodeState[node.state]} | Prior: ${NodeState[node.priorState]} | p: ${node.parentsCount} | c: ${node.connectionsCount}`
      ).join('\n');
      nodeDetailsElement.innerHTML = `<pre>${nodeDetails}</pre>`;
    }

    if (edgeDetailsElement) {
      const edgeDetails = gumGraph.getEdges().map(edge =>
        `Edge (${NodeState[edge.source.state]}/${edge.source.id}, ${NodeState[edge.target.state]}/${edge.target.id})`
      ).join('\n');
      edgeDetailsElement.innerHTML = `<pre>${edgeDetails}</pre>`;
    }
  }
}

const toggleRulesBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;
toggleRulesBtn?.addEventListener('click', () => {
  showAllRules = !showAllRules;
  toggleRulesBtn.textContent = showAllRules ? 'Show less' : 'Show more';
  updateDebugInfo();
});

// ---------------------- Unfolding / control wiring ----------------------
function unfoldGraph() {
  if (!isSimulationRunning) return;

  // Stop when max_steps reached
  if (gumMachine.reachedMaxSteps()) {
    clearInterval(simulationInterval);
    isSimulationRunning = false;
    pauseResumeButton.textContent = 'Start';
    pauseResumeButton.style.backgroundColor = 'lightgreen';
    setControlsEnabled(true);
    updateDebugInfo();
    return;
  }

  simulation.tick();
  gumMachine.runOneStep();
  // Optional extra guard (no-op if method doesn't exist).
  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (typeof enforce === 'function') enforce.call(gumMachine);

  simulation.tick();
  update();
  simulation.tick();
  update();
}

function resetGraph() {
  nodes = [{ id: 1, x: width / 2, y: height / 2, state: NodeState.A }];
  links = [];
  gumGraph.getNodes().forEach(node => node.markedAsDeleted = true);
  gumGraph.removeMarkedNodes();
  const newId = gumGraph.allocateNodeId();
  gumGraph.addNode(new GUMNode(newId, NodeState.A));
  update();
}

// Display options
document.getElementById('display-options')?.addEventListener('change', function () {
  const displayOption = (this as HTMLSelectElement).value;
  updateDisplay(displayOption);
});

// Simulation interval slider (Advanced): adjusts fast mode only
const simulationIntervalSlider = document.getElementById('simulation-interval') as HTMLInputElement | null;
if (simulationIntervalSlider) {
  simulationIntervalSlider.value = String(FAST_MS_DEFAULT);
  const label = document.getElementById('simulation-interval-value');
  if (label) label.textContent = String(FAST_MS_DEFAULT);
  simulationIntervalSlider.addEventListener('input', function () {
    fastMs = parseInt((this as HTMLInputElement).value, 10) || FAST_MS_DEFAULT;
    if (label) label.textContent = String(fastMs);
    if (isSimulationRunning && !slowMode) {
      clearInterval(simulationInterval);
      simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
    }
  });
}

function updateDisplay(option: string) {
  const displayEdges = option === 'edges' || option === 'both';
  const displayNodes = option === 'nodes' || option === 'both';
  d3.selectAll('.link').style('display', displayEdges ? 'block' : 'none');
  d3.selectAll('.node').style('display', displayNodes ? 'block' : 'none');
}
updateDisplay('edges');

pauseResumeButton.addEventListener('click', () => {
  isSimulationRunning = !isSimulationRunning;
  if (isSimulationRunning) {
    simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
    pauseResumeButton.textContent = 'Pause';
    setControlsEnabled(false);
  } else {
    clearInterval(simulationInterval);
    pauseResumeButton.textContent = 'Resume';
    setControlsEnabled(true);
  }
});

document.getElementById('next-step-button')!.addEventListener('click', () => {
  if (!isSimulationRunning) {
    isSimulationRunning = true;
    unfoldGraph();
    isSimulationRunning = false;
  }
});

// Manual connect / add / remove / change / disconnect / connect-nearest (Advanced)
document.getElementById('connect-button')?.addEventListener('click', () => {
  const sourceId = (document.getElementById('source-node') as HTMLSelectElement)?.value;
  const targetId = (document.getElementById('target-node') as HTMLSelectElement)?.value;
  if (sourceId && targetId) {
    const sourceNode = gumGraph.getNodes().find(node => node.id === parseInt(sourceId, 10));
    const targetNode = gumGraph.getNodes().find(node => node.id === parseInt(targetId, 10));
    if (sourceNode && targetNode) {
      gumGraph.addEdge(sourceNode, targetNode);
      const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
      if (typeof enforce === 'function') enforce.call(gumMachine);
      update();
    }
  }
});

document.getElementById('add-node-button')?.addEventListener('click', () => {
  const stateSel = document.getElementById('node-state') as HTMLSelectElement | null;
  if (!stateSel) return;
  const state = stateSel.value as keyof typeof NodeState;
  const newId = gumGraph.allocateNodeId();
  const newNode = new GUMNode(newId, NodeState[state]);
  gumGraph.addNode(newNode);
  nodes.push({ id: newNode.id, state: newNode.state });
  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (typeof enforce === 'function') enforce.call(gumMachine);
  update();
});

document.getElementById('remove-node-button')?.addEventListener('click', () => {
  const nodeId = (document.getElementById('remove-node-id') as HTMLSelectElement)?.value;
  if (nodeId) {
    const nodeToRemove = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
    if (nodeToRemove) {
      nodeToRemove.markedAsDeleted = true;
      gumGraph.removeMarkedNodes();
      nodes = nodes.filter(node => node.id !== nodeToRemove.id);
      const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
      if (typeof enforce === 'function') enforce.call(gumMachine);
      update();
    }
  }
});

document.getElementById('change-node-state-button')?.addEventListener('click', () => {
  const nodeId = (document.getElementById('change-node-id') as HTMLSelectElement)?.value;
  const stateSel = document.getElementById('change-node-state') as HTMLSelectElement | null;
  if (!nodeId || !stateSel) return;
  const state = stateSel.value as keyof typeof NodeState;
  const node = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
  if (node) {
    node.priorState = node.state;
    node.state = NodeState[state];
    const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
    if (typeof enforce === 'function') enforce.call(gumMachine);
    update();
  }
});

document.getElementById('disconnect-button')?.addEventListener('click', () => {
  const sourceId = (document.getElementById('disconnect-source-node') as HTMLSelectElement)?.value;
  const targetId = (document.getElementById('disconnect-target-node') as HTMLSelectElement)?.value;
  if (sourceId && targetId) {
    const sourceNode = gumGraph.getNodes().find(node => node.id === parseInt(sourceId, 10));
    const targetNode = gumGraph.getNodes().find(node => node.id === parseInt(targetId, 10));
    if (sourceNode && targetNode) {
      gumGraph.removeEdge(sourceNode, targetNode);
      const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
      if (typeof enforce === 'function') enforce.call(gumMachine);
      update();
    }
  }
});

document.getElementById('connect-nearest-button')?.addEventListener('click', () => {
  const nodeId = (document.getElementById('connect-nearest-node') as HTMLSelectElement)?.value;
  const stateSel = document.getElementById('connect-nearest-state') as HTMLSelectElement | null;
  if (!nodeId || !stateSel) return;
  const state = stateSel.value as keyof typeof NodeState;
  const node = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
  if (node) {
    gumMachine.tryToConnectWithNearest(node, NodeState[state]);
    const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
    if (typeof enforce === 'function') enforce.call(gumMachine);
    update();
  }
});

// Populate state lists A..Z
function populateStateComboBox(comboBoxId: string) {
  const comboBox = document.getElementById(comboBoxId) as HTMLSelectElement | null;
  if (!comboBox) return;
  comboBox.innerHTML = '';
  for (let i = NodeState.A; i <= NodeState.Z; i++) {
    const option = document.createElement('option');
    // @ts-ignore - enum reverse mapping
    option.value = NodeState[i];
    option.text = String.fromCharCode(64 + i);
    comboBox.add(option);
  }
}

function populateComboBox(comboBoxId: string, items: number[]) {
  const comboBox = document.getElementById(comboBoxId) as HTMLSelectElement | null;
  if (!comboBox) return;
  comboBox.innerHTML = '';
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.toString();
    option.text = item.toString();
    comboBox.add(option);
  });
}

function setControlsEnabled(enabled: boolean) {
  const controls = document.querySelectorAll('#display-options, #simulation-interval');
  controls.forEach(control => {
    (control as HTMLInputElement).disabled = !enabled;
  });
}

const downloadBtn = document.getElementById('download-yaml-button') as HTMLButtonElement | null;
downloadBtn?.addEventListener('click', () => {
  const items = gumMachine.getRuleItems();
  // Rebuild a clean JSON structure
  const toName = (s:number)=> (typeof s==='number' ? (NodeState as any)[s] ?? s : s);
  const toRule = (it:any)=>({
    condition: {
      current: toName(it.condition.currentState),
      prior:   toName(it.condition.priorState === undefined ? 'any' : it.condition.priorState),
      conn_ge: it.condition.allConnectionsCount_GE,
      conn_le: it.condition.allConnectionsCount_LE,
      parents_ge: it.condition.parentsCount_GE,
      parents_le: it.condition.parentsCount_LE,
    },
    op: {
      kind: (it.operation.kind !== undefined) ? mapOperationKindToString(it.operation.kind) : String(it.operation.kind),
      operand: toName(it.operation.operandNodeState),
    }
  });

  // Compose machine block (keep current max_steps)
  const machineBlock: any = {
    ...(lastLoadedConfig?.machine ?? {}),
    max_steps: gumMachine.getMaxSteps(), // ensure current GUI-ed value
  };

  const out = {
    machine: machineBlock,
    init_graph: lastLoadedConfig?.init_graph ?? { nodes: [{ state: toName((machineBlock.start_state ?? NodeState.A)) }] },
    rules: items.map(toRule),
  };

  const text = yaml.dump(out, { lineWidth: 120 });
  const blob = new Blob([text], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'genome_export.yaml';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
});

const maxStepsInput = document.getElementById('max-steps-input') as HTMLInputElement | null;
function refreshMaxStepsInput() {
  if (maxStepsInput) maxStepsInput.value = String(gumMachine.getMaxSteps());
}
maxStepsInput?.addEventListener('change', () => {
  const v = parseInt(maxStepsInput.value, 10);
  gumMachine.setMaxSteps(Number.isNaN(v) ? gumMachine.getMaxSteps() : v);
  // No need to restart; the stop condition will use the new value
});

// ---------------------- Boot ----------------------
loadGenesLibrary().then(() => {
  // Initially disabled until user starts
  setControlsEnabled(false);
  refreshMaxStepsInput();
});

// Populate state combos
populateStateComboBox('node-state');
populateStateComboBox('change-node-state');
populateStateComboBox('connect-nearest-state');
