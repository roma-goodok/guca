/**
 * main.ts — GUCA interactive demo
 * Purpose: wire up DOM/controls, D3 force graph, camera/viewport helpers,
 * genome loading/export, scissors tool, and the Graph Unfolding Machine (GUM).
 *
 * This file intentionally performs a light, non-functional refactor:
 *  - clear sectioning and order of declarations
 *  - minimal, onboarding-oriented comments
 *  - no behavior changes
 */

import * as d3 from 'd3';
import {
  GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState,
  RuleItem, OperationCondition, Operation, OperationKindEnum,
  MachineCfg, TranscriptionWay, CountCompare
} from './gum';
import {
  mapOperationKind, mapOperationKindToString, getVertexRenderColor, getVertexRenderTextColor,
  mapNodeState, getNodeDisplayText, mapGUMNodeToNode, convertToShortForm,
  Node, Link, edgeColorByStates, PALETTE16
} from './utils';

import yaml from 'js-yaml';
import { buildMachineFromConfig } from './genomeLoader';
import { computeKToSatisfyMaxFill } from './viewport';
import { shouldUseMobileBasic } from './responsive';


/* =========================================================================
   1) CONSTANTS / GLOBAL CONFIG
   ========================================================================= */

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
  maintain_single_component: true,
};

const config = { debug: false };              // simple UI verbosity flag
const FAST_MS_DEFAULT = 100;                  // default fast tick ms
const SLOW_MS = 700;                          // slow mode tick ms
const AUTO_MAX_FILL = 0.5;                    // auto camera max fill
const CAMERA_MA_WINDOW = 25;                  // smooth camera EMA window
const CAMERA_ALPHA = 2 / (CAMERA_MA_WINDOW + 1);

/* =========================================================================
   2) STATE (runtime, UI toggles, misc)
   ========================================================================= */

type Tool = 'move' | 'scissors';

let showAllRules = false;
let lastLoadedConfig: any = null;

let isSimulationRunning = false;
let simulationInterval: any;

let slowMode = false;
let fastMs = FAST_MS_DEFAULT;

let currentTool: Tool = 'move';
let isCutting = false;
let lastCutPt: { x: number; y: number } | null = null;

type CameraState = { k: number; x: number; y: number };
let camCurrent: CameraState = { k: 1, x: 0, y: 0 };
let camTarget:  CameraState = { k: 1, x: 0, y: 0 };
let lastUserGestureAt = 0;

// Initial-fit tuning
const FIT_PARAMS = {
  minNodesToFitOnReset: 1,   // for 1–2 nodes, stick to identity zoom
  minContentPx: 240,         // treat content as at least this big when fitting
  maxInitialK: 1.4,          // cap “instant fit” zoom-in
  defaultK: 1,
};


/* =========================================================================
   3) DOM REFERENCES (queried once)
   ========================================================================= */

const pauseResumeButton = document.getElementById('pause-resume-button') as HTMLButtonElement;
const resetBtn          = document.getElementById('reset-button') as HTMLButtonElement | null;
// Reset: stop timers, reseed graph, reset camera & UI state
resetBtn?.addEventListener('click', () => {
  clearInterval(simulationInterval);
  isSimulationRunning = false;
  pauseResumeButton.textContent = 'Start';
  pauseResumeButton.style.backgroundColor = 'lightgreen';
  setControlsEnabled(true);
  resetGraph();                 // now self-centers
  gumMachine.resetIterations?.();
  syncMobilePlayIcon?.();       // keep ▶︎/⏸ in sync (if you added this earlier)
});


const btnMove      = document.getElementById('tool-move-button') as HTMLButtonElement | null;
const btnScissors  = document.getElementById('tool-scissors-button') as HTMLButtonElement | null;
const slowBtn      = document.getElementById('slowdown-button') as HTMLButtonElement | null;

const maintainChk       = document.getElementById('maintain-single-component') as HTMLInputElement | null;
const orphanCleanupChk  = document.getElementById('orphan-cleanup-checkbox') as HTMLInputElement | null;

const autoCenterChk = document.getElementById('auto-center-checkbox') as HTMLInputElement | null;
const autoScaleChk  = document.getElementById('auto-scale-checkbox')  as HTMLInputElement | null;

const downloadBtn  = document.getElementById('download-yaml-button') as HTMLButtonElement | null;
const maxStepsInput = document.getElementById('max-steps-input') as HTMLInputElement | null;

const uploadInput  = document.getElementById('gene-upload') as HTMLInputElement | null;
const simulationIntervalSlider = document.getElementById('simulation-interval') as HTMLInputElement | null;
const simulationIntervalLabel  = document.getElementById('simulation-interval-value');

let autoCenterEnabled = !!autoCenterChk?.checked;
let autoScaleEnabled  = !!autoScaleChk?.checked;

/* =========================================================================
   4) SVG / D3 SETUP
   ========================================================================= */

const width = 960;
const height = 800;

const svg = d3.select("#canvas-container svg")
  .attr("width", "100%")
  .attr("height", height);

// Overlay MUST be under the graph layer; otherwise it steals drag events.
const zoomOverlay = svg.append("rect")
  .attr("width", "100%")
  .attr("height", height)
  .attr("fill", "transparent")
  .attr("pointer-events", "all");

// Graph layer drawn above the overlay so nodes are draggable.
const graphGroup = svg.append("g");

const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.01, 10])
  .filter((event: any) => {
    if (event.type === 'wheel') return true;
    if (currentTool === 'move') {
      return (!event.ctrlKey || event.type === 'wheel') && !event.button;
    }
    return false;
  })
  .on("zoom", (event) => {
    graphGroup.attr("transform", event.transform);
    camCurrent = { k: event.transform.k, x: event.transform.x, y: event.transform.y };
    if (event.sourceEvent) lastUserGestureAt = Date.now();
  });

(svg as any).call(zoomBehavior as any);

/* =========================================================================
   5) CAMERA & VIEWPORT HELPERS
   ========================================================================= */

autoCenterChk?.addEventListener('change', () => { autoCenterEnabled = !!autoCenterChk.checked; });
autoScaleChk?.addEventListener('change',  () => { autoScaleEnabled  = !!autoScaleChk.checked; });

function primaryComponentNodeIds(): Set<number> {
  const comps = gumGraph.getConnectedComponents();
  if (comps.length === 0) return new Set<number>();
  const score = (comp: GUMNode[]) => ({
    minParents: Math.min(...comp.map(n => n.parentsCount)),
    minId:      Math.min(...comp.map(n => n.id)),
  });
  let keep = 0, best = score(comps[0]);
  for (let i = 1; i < comps.length; i++) {
    const s = score(comps[i]);
    if (s.minParents < best.minParents || (s.minParents === best.minParents && s.minId < best.minId)) {
      best = s; keep = i;
    }
  }
  return new Set(comps[keep].map(n => n.id));
}

function computeBBoxForNodes(filter?: Set<number>) {
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity, cnt=0;
  for (const n of nodes) {
    if (filter && !filter.has(n.id)) continue;
    if (n.x == null || n.y == null) continue;
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
    cnt++;
  }
  if (!cnt || !isFinite(minX)) return null;
  const pad = 25; // ≈ 2*node radius
  const w = (maxX - minX) + 2*pad, h = (maxY - minY) + 2*pad;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return { w, h, cx, cy };
}

function resetZoom() {
  svg.call((zoomBehavior as any).transform, d3.zoomIdentity as any);
}

function maybeAutoViewport() {
  if (Date.now() - lastUserGestureAt < 800) return;

  const ids = primaryComponentNodeIds();
  const bb = computeBBoxForNodes(ids.size ? ids : undefined);
  if (!bb) return;

  const rect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  const vw = rect.width, vh = rect.height;

  let targetK = camCurrent.k;
  if (autoScaleEnabled) {
    const kFit = computeKToSatisfyMaxFill(bb.w, bb.h, vw, vh, AUTO_MAX_FILL);
    targetK = Math.min(camCurrent.k, kFit); // only zoom out automatically
  }

  let targetX = camCurrent.x, targetY = camCurrent.y;
  if (autoCenterEnabled) {
    const cxScreen = vw / 2, cyScreen = vh / 2;
    targetX = cxScreen - targetK * bb.cx;
    targetY = cyScreen - targetK * bb.cy;
  }

  camTarget = { k: targetK, x: targetX, y: targetY };

  const next: CameraState = {
    k: camCurrent.k + (camTarget.k - camCurrent.k) * CAMERA_ALPHA,
    x: camCurrent.x + (camTarget.x - camCurrent.x) * CAMERA_ALPHA,
    y: camCurrent.y + (camTarget.y - camCurrent.y) * CAMERA_ALPHA,
  };

  if (Math.abs(next.k - camCurrent.k) > 1e-4 ||
      Math.abs(next.x - camCurrent.x) > 0.3 ||
      Math.abs(next.y - camCurrent.y) > 0.3) {
    const t = (d3 as any).zoomIdentity.translate(next.x, next.y).scale(next.k);
    (svg as any).call((zoomBehavior as any).transform, t);
  }
}

window.addEventListener('resize', () => {
  lastUserGestureAt = 0;         // nudge computation
  maybeAutoViewport();
});


function applyResponsiveMode() {
  const rect = (svg.node() as SVGSVGElement).getBoundingClientRect?.() || { width: 0, height: 0 };
  const vw = window.innerWidth  || rect.width;
  const vh = window.innerHeight || rect.height;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

  const useMobile = shouldUseMobileBasic(vw, vh, coarse);
  document.body.classList.toggle('mobile-basic', useMobile);

  const mt = document.getElementById('mobile-toolbar') as HTMLElement | null;
  const ro = document.getElementById('rules-overlay')  as HTMLElement | null;

  // Hidden attribute is the hard gate; CSS only opens them in mobile mode.
  mt?.toggleAttribute('hidden', !useMobile);
  ro?.toggleAttribute('hidden', !useMobile);
}
window.addEventListener('resize', applyResponsiveMode);
window.addEventListener('orientationchange', applyResponsiveMode);
// also run once after layout settles
requestAnimationFrame(applyResponsiveMode);




/* =========================================================================
   6) SMALL PURE HELPERS (colors, labels)
   ========================================================================= */

function opKindColor(kind: OperationKindEnum): string {
  switch (kind) {
    case OperationKindEnum.TurnToState:            return '#fde68a';
    case OperationKindEnum.GiveBirthConnected:     return '#bbf7d0';
    case OperationKindEnum.GiveBirth:              return '#dcfce7';
    case OperationKindEnum.TryToConnectWithNearest:return '#bfdbfe';
    case OperationKindEnum.TryToConnectWith:       return '#dbeafe';
    case OperationKindEnum.DisconectFrom:          return '#fecaca';
    case OperationKindEnum.Die:                    return '#e5e7eb';
    default:                                       return '#e5e7eb';
  }
}

function nodeStateLetter(s: NodeState): string {
  if (s === NodeState.Unknown) return "Unknown";
  if (s === NodeState.Ignored) return "any";
  if (s >= NodeState.A && s <= NodeState.Z) return String.fromCharCode(64 + s);
  return String(s);
}

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

function mixWithBlack(cssColor: string, t: number): string {
  const c = d3.color(cssColor);
  if (!c) return cssColor;
  // @ts-ignore d3.color returns RGB-like object
  const r = Math.round((c.r ?? 0) * (1 - t));
  // @ts-ignore
  const g = Math.round((c.g ?? 0) * (1 - t));
  // @ts-ignore
  const b = Math.round((c.b ?? 0) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

function buildRuleTilesHTML(items: RuleItem[], cap: number): string {
  const shown = items.slice(0, cap);
  return shown.map((it) => {
    const c = it.condition, o = it.operation;
    const curColor = getVertexRenderColor(c.currentState);
    const priorColor = getVertexRenderColor(c.priorState);
    const opColor = opKindColor(o.kind);
    const argColor = getVertexRenderColor(o.operandNodeState);
    const title = describeRuleHuman(it).replace(/"/g, '&quot;');
    const absIdx = gumMachine.getRuleItems().indexOf(it);
    const classes = `gene-tile ${it.isActive ? 'active' : ''} ${it.isEnabled ? '' : 'disabled'}`;
    return `
      <div class="${classes}" data-idx="${absIdx}" title="${title}">
        <span style="background:${curColor}"></span>
        <span style="background:${priorColor}"></span>
        <span style="background:${opColor}"></span>
        <span style="background:${argColor}"></span>
      </div>`;
  }).join('');
}

function syncMobilePlayIcon() {
  const mp = document.getElementById('mobile-play') as HTMLButtonElement | null;
  if (!mp) return;
  if (isSimulationRunning) {
    mp.textContent = '⏸';
    mp.style.color = '';
    mp.setAttribute('aria-label', 'Pause');
    mp.title = 'Pause';
  } else {
    mp.textContent = '▶︎';
    mp.style.color = '#16a34a';
    mp.setAttribute('aria-label', 'Start');
    mp.title = 'Start';
  }
}

// REPLACE the previous fitGraphInstant with this version
function fitGraphInstant(maxFill = AUTO_MAX_FILL) {
  const ids = primaryComponentNodeIds();
  const bb = computeBBoxForNodes(ids.size ? ids : undefined);
  const rect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  if (!bb || !rect.width || !rect.height) { resetZoom(); return; }

  // Inflate tiny content so k doesn’t explode
  const effW = Math.max(bb.w, FIT_PARAMS.minContentPx);
  const effH = Math.max(bb.h, FIT_PARAMS.minContentPx);

  let kFit = computeKToSatisfyMaxFill(effW, effH, rect.width, rect.height, maxFill);
  kFit = Math.min(kFit, FIT_PARAMS.maxInitialK); // cap zoom-in

  const cxScreen = rect.width / 2, cyScreen = rect.height / 2;
  const x = cxScreen - kFit * bb.cx;
  const y = cyScreen - kFit * bb.cy;

  const t = (d3 as any).zoomIdentity.translate(x, y).scale(kFit);
  (svg as any).call((zoomBehavior as any).transform, t);
  camCurrent = { k: kFit, x, y };
  camTarget  = { k: kFit, x, y };
  lastUserGestureAt = 0;
}

function fitInitialOnReset() {
  const nodeCount = gumGraph.getNodes().length;
  if (nodeCount < FIT_PARAMS.minNodesToFitOnReset) {
    // identity (default zoom), already centered because we seed at SVG center
    const t = (d3 as any).zoomIdentity;
    (svg as any).call((zoomBehavior as any).transform, t);
    camCurrent = { k: FIT_PARAMS.defaultK, x: 0, y: 0 };
    camTarget  = { ...camCurrent };
    lastUserGestureAt = 0;
    return;
  }
  fitGraphInstant(0.5);
}



/* =========================================================================
   7) D3 SIMULATION (force layout) + MIRRORED ARRAYS
   ========================================================================= */

const simulation = d3.forceSimulation<Node, Link>()
  .force("link", d3.forceLink<Node, Link>()
    .id((d: Node) => d.id.toString())
    .distance(50))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .velocityDecay(0.2);

let nodes: Node[] = [{ id: 1, x: width / 2, y: height / 2, state: NodeState.A }];
let links: Link[] = [];

/* =========================================================================
   8) GUM GRAPH + MACHINE (core engine)
   ========================================================================= */

const gumGraph = new GUMGraph();
let gumMachine = new GraphUnfoldingMachine(gumGraph, DEFAULT_MACHINE_CFG);

function currentStartState(): NodeState {
  const s = lastLoadedConfig?.machine?.start_state;
  return (typeof s === 'number') ? (s as NodeState) : mapNodeState(String(s ?? 'A'));
}

/* =========================================================================
   9) GENOME CATALOG / LOADING / EXPORT
   ========================================================================= */

const YAML_CATALOG = [
  { name: 'Dumbbell', path: 'data/genoms/dumbbell.yaml' },
  { name: 'Hairy Circle', path: 'data/genoms/hairy_circle_genom.yaml' },  
  { name: 'Dumbbell and Hairy Circle Hybrid', path: 'data/genoms/dumbbell_and_hairy_circle_hybrid.yaml' },
  { name: 'fractal-3', path: 'data/genoms/fractal3_genom.yaml' },
  { name: 'Triangle Mesh', path: 'data/genoms/exp005_trimesh_genom.yaml' },
  { name: 'Quad Mesh', path: 'data/genoms/quadmesh.yaml' },
  { name: 'Strange Figure #1', path: 'data/genoms/strange_figure1_genom.yaml' },
  { name: 'Strange Figure #2', path: 'data/genoms/strange_figure2_genom.yaml' },
  { name: 'Gun (replicator)', path: 'data/genoms/gun.yaml' },  
  { name: 'Primitive Fractal', path: 'data/genoms/primitive_fractal_genom.yaml' },
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

  await loadGenomFromYaml(geneSelect.value);

  geneSelect.addEventListener('change', async (ev) => {
    const path = (ev.target as HTMLSelectElement).value;
    await loadGenomFromYaml(path);
  });

  const mobileSelect = document.getElementById('gene-select-mobile') as HTMLSelectElement | null;
  if (mobileSelect) {
    mobileSelect.innerHTML = '';
    YAML_CATALOG.forEach(({ name, path }) => {
      const opt = document.createElement('option');
      opt.value = path; opt.text = name; mobileSelect.add(opt);
    });
    mobileSelect.value = (document.getElementById('gene-select') as HTMLSelectElement)?.value ?? YAML_CATALOG[0].path;
    mobileSelect.onchange = async (ev) => {
      await loadGenomFromYaml((ev.target as HTMLSelectElement).value);
    };
  }

  // Mobile toolbar buttons proxy desktop logic (no code duplication)
  document.getElementById('mobile-play')?.addEventListener('click', () => pauseResumeButton.click());
  document.getElementById('mobile-reset')?.addEventListener('click', () => resetBtn?.click());
  document.getElementById('mobile-slow')?.addEventListener('click', () => slowBtn?.click());


  updateDebugInfo();
}

async function loadGenomFromYaml(path: string) {
  const cfg = await fetchYaml(path);
  await applyGenomConfig(cfg, null);
  refreshMaxStepsInput();
}

async function applyGenomConfig(cfg: any, labelForSelect: string | null) {
  lastLoadedConfig = cfg ? JSON.parse(JSON.stringify(cfg)) : {};

  (gumMachine as any) = buildMachineFromConfig(cfg, gumGraph, maintainChk?.checked ?? true);
  gumMachine.setMaxSteps(-1);

  const ocFromCfg = cfg?.machine?.orphan_cleanup;
  if (!(ocFromCfg && ocFromCfg.enabled)) {
    (gumMachine as any).setOrphanCleanup?.({
      enabled: true,
      thresholds: { size1: 5, size2: 7, others: 10 },
      fadeStarts: { size1: 3, size2: 5, others: 8 },
    });
    // reflect into lastLoadedConfig so export matches runtime
    lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
    lastLoadedConfig.machine.orphan_cleanup = {
      enabled: true,
      thresholds: { size1: 10, size2: 14, others: 20 },
      fadeStarts: { size1: 3, size2: 5, others: 8 },
    };
  }

  const ocActive = (gumMachine as any).getOrphanCleanup?.()?.enabled ?? false;
  if (orphanCleanupChk) orphanCleanupChk.checked = ocActive;

  const mscNow = (gumMachine as any).getMaintainSingleComponent?.();
  if (maintainChk && typeof mscNow === 'boolean') {
    maintainChk.checked = mscNow;
  }

  gumMachine.resetIterations();
  pauseResumeButton.textContent = 'Start';
  pauseResumeButton.style.backgroundColor = 'lightgreen';
  resetGraph();                // handles zoom+fit
  refreshMaxStepsInput();

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

downloadBtn?.addEventListener('click', () => {
  const items = gumMachine.getRuleItems();
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

  const machineBlock: any = {
    ...(lastLoadedConfig?.machine ?? {}),
    max_steps: gumMachine.getMaxSteps(),
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

if (uploadInput) {
  uploadInput.addEventListener('change', async () => {
    const f = uploadInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    let cfg: any = null;
    try {
      cfg = yaml.load(text);
      if (!cfg || typeof cfg !== 'object') throw new Error('Empty YAML');
    } catch {
      try { cfg = JSON.parse(text); }
      catch { alert('Unable to parse file. Please upload a valid YAML or JSON genome.'); return; }
    }
    await applyGenomConfig(cfg, f.name);
    refreshMaxStepsInput();
    updateDebugInfo();
  });
}

/* =========================================================================
   10) SCISSORS TOOL (edge cutting)
   ========================================================================= */

function setTool(tool: Tool) {
  currentTool = tool;
  btnMove?.classList.toggle('active', tool === 'move');
  btnScissors?.classList.toggle('active', tool === 'scissors');
  svg.style('cursor', tool === 'scissors' ? 'crosshair' : 'default');
  graphGroup.selectAll<SVGGElement, Node>('.node')
    .style('pointer-events', tool === 'scissors' ? 'none' : 'auto');
}
btnMove?.addEventListener('click', () => setTool('move'));
btnScissors?.addEventListener('click', () => setTool('scissors'));
setTool('move');

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
  if (o1 !== o2 && o3 !== o4) return true;
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

  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (typeof enforce === 'function') enforce.call(gumMachine);

  update();
}

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

/* =========================================================================
   11) RENDERING & UPDATE LOOP
   ========================================================================= */

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

function renderNodeInspector(n?: GUMNode) {
  const body = document.getElementById('node-inspector-body') as HTMLDivElement | null;
  if (!body) return;
  if (!n) {
    body.textContent = 'Select the 🖐️ Move tool, then hover a node to see details.';
    return;
  }
  const liveState = nodeStateName(n.state);
  const prior     = nodeStateName(n.priorState);
  const saved     = nodeStateName(n.getSavedCurrentState?.() ?? n.state);
  const liveDeg   = n.connectionsCount;
  const savedDeg  = (n as any).savedDegree ?? liveDeg;
  const livePar   = n.parentsCount;
  const savedPar  = (n as any).savedParents ?? livePar;

  body.innerHTML = `
    <div><b>ID:</b> ${n.id}</div>
    <div><b>State:</b> ${liveState}</div>
    <div><b>Prior:</b> ${prior}</div>
    <div><b>Saved (for matching):</b> ${saved}</div>
    <div><b>Degree (live/saved):</b> ${liveDeg} / ${savedDeg}</div>
    <div><b>Parents (live/saved):</b> ${livePar} / ${savedPar}</div>
  `;
}
function nodeStateName(n: number): string {
  // @ts-ignore enum reverse mapping present
  return (NodeState as any)[n] ?? String(n);
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

  const link = graphGroup.selectAll<SVGLineElement, Link>(".link")
    .data(links, d => `${(d.source as Node).id}-${(d.target as Node).id}`);

  const linkEnter = link.enter().append("line")
    .attr("class", "link")
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke", d => {
      const s = gumGraph.getNodeById((d.source as Node).id);
      const t = gumGraph.getNodeById((d.target as Node).id);
      const base = edgeColorByStates((d.source as Node).state, (d.target as Node).state);
      const f = Math.max(s?.fade ?? 0, t?.fade ?? 0);
      return mixWithBlack(base, f);
    });

  linkEnter.merge(link)
    .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
    .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
    .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
    .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
    .attr("stroke", d => {
      const s = gumGraph.getNodeById((d.source as Node).id);
      const t = gumGraph.getNodeById((d.target as Node).id);
      const base = edgeColorByStates((d.source as Node).state, (d.target as Node).state);
      const f = Math.max(s?.fade ?? 0, t?.fade ?? 0);
      return mixWithBlack(base, f);
    });

  link.exit().remove();

  const nodeSel = graphGroup.selectAll<SVGGElement, Node>(".node")
    .data(nodes, d => d.id.toString());

  const nodeEnter = nodeSel.enter().append("g")
    .attr("class", "node")
    .call(d3.drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (currentTool === 'scissors') return;
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
    .attr("fill", d => {
      const gn = gumGraph.getNodeById(d.id);
      const base = getVertexRenderColor(d.state);
      const f = gn?.fade ?? 0;
      return mixWithBlack(base, f);
    });

  nodeEnter.append("text")
    .attr("dy", 3)
    .attr("dx", config.debug ? -10 : -6)
    .attr("fill", d => getVertexRenderTextColor(d.state))
    .text(d => getNodeDisplayText(d.state, d.id, config.debug));

  const mergedNodes = nodeEnter.merge(nodeSel);
  nodeSel.exit().remove();

  mergedNodes.style('pointer-events', currentTool === 'scissors' ? 'none' : 'auto');

  mergedNodes
    .on('mouseover.inspect', (_event, d) => {
      if (currentTool !== 'move') return;
      const gn = gumGraph.getNodeById(d.id);
      if (gn) renderNodeInspector(gn);
    })
    .on('mouseout.inspect', () => {
      if (currentTool !== 'move') return;
      renderNodeInspector(undefined);
    });

  simulation.nodes(nodes).on("tick", () => {
    mergedNodes.select("circle")
      .attr("r", d => config.debug ? 20 : 12.5)
      .attr("cx", d => d.x!)
      .attr("cy", d => d.y!)
      .attr("fill", d => {
        const gn = gumGraph.getNodeById(d.id);
        const base = getVertexRenderColor(d.state);
        const f = gn?.fade ?? 0;
        return mixWithBlack(base, f);
      });
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
        const s = gumGraph.getNodeById((d.source as Node).id);
        const t = gumGraph.getNodeById((d.target as Node).id);
        const base = edgeColorByStates((d.source as Node).state, (d.target as Node).state);
        const f = Math.max(s?.fade ?? 0, t?.fade ?? 0);
        return mixWithBlack(base, f);
      });
  });

  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);
  simulation.alpha(0.5).restart();

  updateDebugInfo();
  populateComboBoxes();
  simulation.tick();       // ensure positions flushed
  maybeAutoViewport();     // auto camera
}

/* =========================================================================
   12) STATUS / DEBUG / SIDE PANELS
   ========================================================================= */

function updateDisplay(option: string) {
  const displayEdges = option === 'edges' || option === 'both';
  const displayNodes = option === 'nodes' || option === 'both';
  d3.selectAll('.link').style('display', displayEdges ? 'block' : 'none');
  d3.selectAll('.node').style('display', displayNodes ? 'block' : 'none');
}

function renderPaletteGrid() {
  const grid = document.getElementById('palette-grid');
  if (!grid) return;
  grid.innerHTML = '';
  PALETTE16.forEach((name, idx) => {
    const cell = document.createElement('div');
    cell.className = 'palette-chip';
    cell.style.background = name;
    cell.title = `#${idx} — ${name}`;
    grid.appendChild(cell);
  });
}

function wireDetailsToggle(detailsId: string) {
  const det = document.getElementById(detailsId) as HTMLDetailsElement | null;
  if (!det) return;
  const summary = det.querySelector('summary');
  if (!summary) return;

  summary.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,select,textarea,label')) return;
    e.preventDefault();
    det.open = !det.open;
  });

  summary.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      det.open = !det.open;
    }
  });
}

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

  const board = document.getElementById('rule-board');
  const toggleBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;

  if (board) {
    const items = gumMachine.getRuleItems();
    const MAX = 60;
    const html = buildRuleTilesHTML(items, showAllRules ? items.length : MAX);
    board.innerHTML = html;

    if (toggleBtn) {
      if (items.length > MAX) {
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = showAllRules ? 'Show less' : `Show more (${items.length - MAX})`;
      } else {
        toggleBtn.style.display = 'none';
      }
    }

    const geneInspectorBody = document.getElementById('gene-inspector-body') as HTMLDivElement | null;
    const defaultGI = 'Hover a rule tile to see its description. Click a tile to enable/disable that rule.';
    if (geneInspectorBody && !geneInspectorBody.textContent) geneInspectorBody.textContent = defaultGI;

    board.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
      const idx = Number(el.dataset.idx ?? '-1');
      if (Number.isNaN(idx) || idx < 0) return;

      el.addEventListener('mouseenter', () => {
        const it = items.find(i => gumMachine.getRuleItems().indexOf(i) === idx) ?? gumMachine.getRuleItems()[idx];
        if (!it || !geneInspectorBody) return;
        geneInspectorBody.textContent = `${describeRuleHuman(it)} — Click to ${it.isEnabled ? 'disable' : 'enable'}.`;
      });
      el.addEventListener('mouseleave', () => {
        if (geneInspectorBody) geneInspectorBody.textContent = defaultGI;
      });
      el.addEventListener('click', () => {
        const all = gumMachine.getRuleItems();
        if (!all[idx]) return;
        all[idx].isEnabled = !all[idx].isEnabled;
        updateDebugInfo();
      });
    });
  } else {
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
      const toggleBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;
      if (toggleBtn) toggleBtn.style.display = (lines.length > maxLines ? 'inline-block' : 'none');
    }
  }

  renderRulesOverlay();
}

function renderRulesOverlay() {
  const container = document.getElementById('rules-overlay') as HTMLDivElement | null;
  if (!container || !document.body.classList.contains('mobile-basic')) return;

  const items = gumMachine.getRuleItems();
  container.innerHTML = buildRuleTilesHTML(items, 48); // cap tiles for tiny screens

  // Click handlers (enable/disable rule)
  container.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
    const idx = Number(el.dataset.idx ?? '-1');
    if (Number.isNaN(idx) || idx < 0) return;
    el.onclick = () => {
      const all = gumMachine.getRuleItems();
      if (!all[idx]) return;
      all[idx].isEnabled = !all[idx].isEnabled;
      updateDebugInfo();        // keep both places in sync
      renderRulesOverlay();
    };
  });
}


/* =========================================================================
   13) CONTROL WIRING (buttons, sliders, toggles)
   ========================================================================= */

function setControlsEnabled(enabled: boolean) {
  const controls = document.querySelectorAll('#display-options, #simulation-interval');
  controls.forEach(control => {
    (control as HTMLInputElement).disabled = !enabled;
  });
}

document.getElementById('display-options')?.addEventListener('change', function () {
  const displayOption = (this as HTMLSelectElement).value;
  updateDisplay(displayOption);
});
updateDisplay('edges');

if (simulationIntervalSlider) {
  simulationIntervalSlider.value = String(FAST_MS_DEFAULT);
  if (simulationIntervalLabel) simulationIntervalLabel.textContent = String(FAST_MS_DEFAULT);
  simulationIntervalSlider.addEventListener('input', function () {
    fastMs = parseInt((this as HTMLInputElement).value, 10) || FAST_MS_DEFAULT;
    if (simulationIntervalLabel) simulationIntervalLabel.textContent = String(fastMs);
    if (isSimulationRunning && !slowMode) {
      clearInterval(simulationInterval);
      simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
    }
  });
}

function currentIntervalMs() {
  return slowMode ? SLOW_MS : (fastMs || FAST_MS_DEFAULT);
}

pauseResumeButton.textContent = 'Start';
pauseResumeButton.style.backgroundColor = 'lightgreen';

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
  syncMobilePlayIcon();
});

document.getElementById('next-step-button')!.addEventListener('click', () => {
  if (!isSimulationRunning) {
    isSimulationRunning = true;
    unfoldGraph();
    isSimulationRunning = false;
  }
});

slowBtn?.addEventListener('click', () => {
  slowMode = !slowMode;
  slowBtn.classList.toggle('active', slowMode);
  slowBtn.textContent = slowMode ? '🐢 Slow down (ON)' : '🐢 Slow down';
  if (isSimulationRunning) {
    clearInterval(simulationInterval);
    simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
  }
});

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

orphanCleanupChk?.addEventListener('change', () => {
  const current = (gumMachine as any).getOrphanCleanup?.() ?? {};
  const next = {
    enabled: !!orphanCleanupChk.checked,
    thresholds: current.thresholds ?? { size1: 5, size2: 7, others: 10 },
    fadeStarts: current.fadeStarts ?? { size1: 3, size2: 5, others: 8 },
  };
  (gumMachine as any).setOrphanCleanup?.(next);

  lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
  lastLoadedConfig.machine.orphan_cleanup = next;
});

maxStepsInput?.addEventListener('change', () => {
  const v = parseInt(maxStepsInput.value, 10);
  gumMachine.setMaxSteps(Number.isNaN(v) ? gumMachine.getMaxSteps() : v);
});
function refreshMaxStepsInput() {
  if (maxStepsInput) maxStepsInput.value = String(gumMachine.getMaxSteps());
}

/* Advanced manual operations */
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

const toggleRulesBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;
toggleRulesBtn?.addEventListener('click', () => {
  showAllRules = !showAllRules;
  toggleRulesBtn.textContent = showAllRules ? 'Show less' : 'Show more';
  updateDebugInfo();
});

/* =========================================================================
   14) UNFOLD LOOP & GRAPH RESET
   ========================================================================= */

function unfoldGraph() {
  if (!isSimulationRunning) return;

  if (gumMachine.reachedMaxSteps()) {
    clearInterval(simulationInterval);
    isSimulationRunning = false;
    pauseResumeButton.textContent = 'Start';
    pauseResumeButton.style.backgroundColor = 'lightgreen';
    setControlsEnabled(true);
    updateDebugInfo();
    syncMobilePlayIcon();
    return;
  }

  simulation.tick();
  gumMachine.runOneStep();
  const enforce = (gumMachine as any)?.enforceSingleComponentIfEnabled;
  if (typeof enforce === 'function') enforce.call(gumMachine);

  simulation.tick();
  update();
  simulation.tick();
  update();
}

// Replace the whole resetGraph() body with:
function resetGraph() {
  const st = currentStartState();

  // 1) reset zoom first (avoid drawing off-screen with previous transform)
  resetZoom();

  // 2) wipe graph model
  gumGraph.getNodes().forEach(n => n.markedAsDeleted = true);
  gumGraph.removeMarkedNodes();

  // 3) seed D3 layer at real SVG center
  const rect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  const cx = rect.width  / 2;
  const cy = rect.height / 2;
  nodes = [{ id: 1, x: cx, y: cy, state: st }];
  links = [];

  // 4) seed GUM
  const newId = gumGraph.allocateNodeId();
  gumGraph.addNode(new GUMNode(newId, st));

  // 5) paint once, then snap-fit (no smoothing, instant)
  update();  
  fitInitialOnReset();
}


/* =========================================================================
   15) PALETTE / DETAILS INIT + BOOT
   ========================================================================= */

function renderPaletteOpenCollapsed() {
  renderPaletteGrid();
  wireDetailsToggle('palette-block');
  const det = document.getElementById('palette-block') as HTMLDetailsElement | null;
  if (det) det.open = true; // keep existing behavior
}

function initStateCombos() {
  populateStateComboBox('node-state');
  populateStateComboBox('change-node-state');
  populateStateComboBox('connect-nearest-state');
}

loadGenesLibrary().then(() => {
  setControlsEnabled(false);
  refreshMaxStepsInput();
  renderPaletteOpenCollapsed();
  initStateCombos();
  applyResponsiveMode();  
  syncMobilePlayIcon();

});
