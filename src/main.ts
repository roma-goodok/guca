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
  Node, Link, edgeColorByStates, PALETTE16,
  getAllStateColorOverrides, setStateColorOverride,
  replaceStateColorOverrides, getStateColorOverride,
  computeGraphChangeMagnitude,
} from './utils';


import yaml from 'js-yaml';
import { buildMachineFromConfig } from './genomeLoader';
import { computeKToSatisfyMaxFill } from './viewport';
import { shouldUseMobileBasic } from './responsive';
import { createGraph3DController } from './graph3d';
import { encodeGenomeToUrlToken, parseGenomeFromUrlHash } from './shareGenome';
import { createRuleEditorController } from './ruleEditor';
import { formatNodeInspectorText } from './nodeInspector';




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
  reseed_isolated_A: true,
};

const config = { debug: false };              // simple UI verbosity flag
const FAST_MS_DEFAULT = 200;                  // default fast tick ms
const SLOW_MS = 500;                          // slow mode tick ms
const AUTO_MAX_FILL = 0.5;                    // auto camera max fill
const CAMERA_MA_WINDOW = 25;                  // smooth camera EMA window
const CAMERA_ALPHA = 2 / (CAMERA_MA_WINDOW + 1);

// Persist user-selected per-state colors between sessions
const COLOR_OVERRIDES_STORAGE_KEY = 'guca_state_color_overrides_v1';

function loadColorOverridesFromStorage() {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  try {
    const raw = window.localStorage.getItem(COLOR_OVERRIDES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { [state: number]: string };
    if (parsed && typeof parsed === 'object') {
      replaceStateColorOverrides(parsed);
    }
  } catch {
    // ignore malformed or unavailable storage
  }
}

function persistColorOverrides() {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  try {
    const map = getAllStateColorOverrides();
    window.localStorage.setItem(COLOR_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / access errors
  }
}

// Restore any saved colors as early as possible
loadColorOverridesFromStorage();

// Map each palette slot (0..15) to the NodeState values that use it.
// This lets one color tile control all states mapped to that slot.
const COLOR_SLOT_STATES: NodeState[][] = (() => {
  const size = PALETTE16.length || 16;
  const slots: NodeState[][] = Array.from({ length: size }, () => []);

  const candidates: NodeState[] = [
    NodeState.Ignored,
    NodeState.Unknown,
    NodeState.A, NodeState.B, NodeState.C, NodeState.D, NodeState.E,
    NodeState.F, NodeState.G, NodeState.H, NodeState.I, NodeState.J,
    NodeState.K, NodeState.L, NodeState.M, NodeState.N, NodeState.O,
    NodeState.P, NodeState.Q, NodeState.R, NodeState.S, NodeState.T,
    NodeState.U, NodeState.V, NodeState.W, NodeState.X, NodeState.Y,
    NodeState.Z,
  ];

  const len = slots.length;
  candidates.forEach(s => {
    const idx = ((Number(s) % len) + len) % len;
    slots[idx].push(s);
  });

  return slots;
})();

function getPaletteSlotColor(idx: number): string {
  const states = COLOR_SLOT_STATES[idx] || [];
  // If any state in this slot has an override, use it.
  for (const s of states) {
    const ov = getStateColorOverride(s);
    if (ov) return ov;
  }
  // Otherwise fall back to the base palette entry.
  return PALETTE16[idx] ?? '#cccccc';
}

function applyPaletteSlotColor(idx: number, cssColor: string) {
  const states = COLOR_SLOT_STATES[idx] || [];
  states.forEach(s => setStateColorOverride(s, cssColor));
  persistColorOverrides();
  renderPaletteGrid(); // refresh chips
  update();            // repaint graph with new colors
}



/* =========================================================================
   2) STATE (runtime, UI toggles, misc)
   ========================================================================= */

type Tool = 'move' | 'scissors';

type ViewMode = '2d' | '3d';
let viewMode: ViewMode = '2d';

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

const GENOME_SELECT_VALUES = {
  NEW: '__new__',
  CUSTOM: '__custom__',
} as const;

// NOTE: "url" is a legacy alias some branches used for the shared-via-URL flow.
// Keeping it here makes the code resilient to older call sites.
type GenomeSource = 'catalog' | 'upload' | 'shared' | 'url' | 'new' | 'custom';
let currentGenomeSource: GenomeSource = 'catalog';
let baseGenomeLabel = 'Genome';

let customGenomeCache: any | null = null;
let syncingGenomeSelect = false;


/* =========================================================================
   Sound: mechanical ticking tied to graph changes
   ========================================================================= */

type TickReason = 'auto' | 'manual';
type TickDirection = 'grow' | 'shrink' | 'mixed';

interface TickingSoundEngine {
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  tick(magnitude: number, direction: TickDirection, reason: TickReason): void;
}

function createTickingSoundEngine(): TickingSoundEngine {
  let AudioCtor: any = null;
  if (typeof window !== 'undefined') {
    AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
  }

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let enabled = false;

  function ensureContext() {
    if (!AudioCtor || ctx) return;
    ctx = new AudioCtor();
    if (!ctx) {   
      return;
    }
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }

  function setEnabled(on: boolean) {
    enabled = on;
    if (!on) return;
    ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* ignore */ });
    }
  }

  function isEnabled() {
    return enabled && !!ctx && !!masterGain;
  }

  function tick(magnitude: number, direction: TickDirection, _reason: TickReason) {
    if (!isEnabled() || !ctx || !masterGain) return;

    const now = ctx.currentTime;

    // Duration of the noise burst
    const duration = 0.08; // 80 ms
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);

    // Create a single-channel noise buffer
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    // White noise
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // High-pass filter to make it more "metal click" than "thump"
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    const baseFreq = direction === 'shrink' ? 4000 : 3000;
    filter.frequency.value = baseFreq; // try 3000–8000 to taste

    const gain = ctx.createGain();

    // Scale loudness a bit with intensity, but keep it subtle
    const clamped = Math.min(16, Math.max(1, 10*magnitude || 1));
    const peak = 0.12 + (clamped / 8) * 0.32;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  return { setEnabled, isEnabled, tick };
}

const tickingSound = createTickingSoundEngine();
let soundEnabled = true;

// Graph stats used to detect structural change for sound.
let lastNodesCountForSound = 0;
let lastEdgesCountForSound = 0;

// This will be called from resetGraph() once the seed node is in place.
function resetSoundGraphStats() {
  // gumGraph is defined later; this function is only called after it exists.
  lastNodesCountForSound = gumGraph.getNodes().length;
  lastEdgesCountForSound = gumGraph.getEdges().length;
}

function handleGraphCountsPotentiallyChanged(reason: TickReason) {
  const nodesNow = gumGraph.getNodes().length;
  const edgesNow = gumGraph.getEdges().length;

  const { changed, magnitude } = computeGraphChangeMagnitude(
    lastNodesCountForSound,
    lastEdgesCountForSound,
    nodesNow,
    edgesNow
  );

  if (soundEnabled && changed) {
    const deltaNodes = nodesNow - lastNodesCountForSound;
    const deltaEdges = edgesNow - lastEdgesCountForSound;
    const totalDelta = deltaNodes + deltaEdges;

    let dir: TickDirection = 'mixed';
    if (totalDelta > 0) dir = 'grow';
    else if (totalDelta < 0) dir = 'shrink';

    tickingSound.tick(magnitude, dir, reason);
  }

  lastNodesCountForSound = nodesNow;
  lastEdgesCountForSound = edgesNow;
}

/* =========================================================================
   3) DOM REFERENCES (queried once)
   ========================================================================= */

const pauseResumeButton = document.getElementById('pause-resume-button') as HTMLButtonElement;
const resetBtn          = document.getElementById('reset-button') as HTMLButtonElement | null;

resetBtn?.addEventListener('click', () => {
  clearInterval(simulationInterval);
  isSimulationRunning = false;
  pauseResumeButton.textContent = 'Start';
  pauseResumeButton.style.backgroundColor = 'lightgreen';
  setControlsEnabled(true);

  if (lastLoadedConfig) {
    // Rebuild machine + graph from the last loaded genome.
    // Note: we don’t pass a custom label so it won’t touch the dropdown options.
    void applyGenomConfig(lastLoadedConfig, null);
  } else {
    // Fallback: just reset view/iterations if no genome is loaded yet.
    gumMachine.resetIterations?.();
    resetGraph();
  }

  syncMobilePlayIcon();
});


const btnMove      = document.getElementById('tool-move-button') as HTMLButtonElement | null;
const btnScissors  = document.getElementById('tool-scissors-button') as HTMLButtonElement | null;
const slowBtn      = document.getElementById('slowdown-button') as HTMLButtonElement | null;

const view2dBtn = document.getElementById('view-2d-button') as HTMLButtonElement | null;
const view3dBtn = document.getElementById('view-3d-button') as HTMLButtonElement | null;

const soundToggleBtn = document.getElementById('sound-toggle-button') as HTMLButtonElement | null;

const mobileView2dBtn = document.getElementById('mobile-view-2d') as HTMLButtonElement | null;
const mobileView3dBtn = document.getElementById('mobile-view-3d') as HTMLButtonElement | null;

const mobileSoundBtn  = document.getElementById('mobile-sound') as HTMLButtonElement | null;

const threeContainer = document.getElementById('three-container') as HTMLDivElement | null;

const maintainChk       = document.getElementById('maintain-single-component') as HTMLInputElement | null;
const orphanCleanupChk  = document.getElementById('orphan-cleanup-checkbox') as HTMLInputElement | null;
const reseedIsolatedACheckbox = document.getElementById('reseed-isolated-a-checkbox') as HTMLInputElement | null;

const autoCenterChk = document.getElementById('auto-center-checkbox') as HTMLInputElement | null;
const autoScaleChk  = document.getElementById('auto-scale-checkbox')  as HTMLInputElement | null;

const downloadBtn  = document.getElementById('download-yaml-button') as HTMLButtonElement | null;
const maxStepsInput = document.getElementById('max-steps-input') as HTMLInputElement | null;

const uploadInput  = document.getElementById('gene-upload') as HTMLInputElement | null;
const simulationIntervalSlider = document.getElementById('simulation-interval') as HTMLInputElement | null;
const simulationIntervalLabel  = document.getElementById('simulation-interval-value');

let autoCenterEnabled = !!autoCenterChk?.checked;
let autoScaleEnabled  = !!autoScaleChk?.checked;

const shareGenomeBtn = document.getElementById('share-genome-button') as HTMLButtonElement | null;
const mobileShareBtn = document.getElementById('mobile-share') as HTMLButtonElement | null;
// Optional element: some layouts include a title area in the mobile toolbar.
// It's safe for this to be null when the element is not present.
const mobileToolbarTitle = document.getElementById('mobile-toolbar-title') as HTMLElement | null;

const toastEl = document.getElementById('toast') as HTMLDivElement | null;

const maxVerticesInput = document.getElementById('max-vertices-input') as HTMLInputElement | null;
const nearestMaxDepthInput = document.getElementById('nearest-max-depth-input') as HTMLInputElement | null;

function onMaxVerticesUiChanged() {
  syncMachineSettingsFromUi();
}
function onNearestDepthUiChanged() {
  syncMachineSettingsFromUi();
}

maxVerticesInput?.addEventListener('input', onMaxVerticesUiChanged);
maxVerticesInput?.addEventListener('change', onMaxVerticesUiChanged);

nearestMaxDepthInput?.addEventListener('input', onNearestDepthUiChanged);
nearestMaxDepthInput?.addEventListener('change', onNearestDepthUiChanged);




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

  mt?.toggleAttribute('hidden', !useMobile);
  ro?.toggleAttribute('hidden', !useMobile);
  
  if (viewMode === '3d' && threeContainer) {
    graph3D.resize();
  }
}

window.addEventListener('resize', () => {
  lastUserGestureAt = 0;         // nudge computation
  if (viewMode === '2d') {
    maybeAutoViewport();
  } else if (viewMode === '3d' && threeContainer) {
    graph3D.resize();
  }
});

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
    case OperationKindEnum.DisconnectFrom:         return '#fecaca';
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
    case OperationKindEnum.DisconnectFrom:         act = `disconnect from ${opS}`; break;
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
  const tiles = shown.map((it) => {
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

  const addTile = `<div class="gene-tile add-tile" data-add="1" title="Add a new rule">+</div>`;
  return tiles + addTile;
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

function syncSlowButtonsUI() {
  // Desktop turtle button
  if (slowBtn) {
    slowBtn.classList.toggle('active', slowMode);
    slowBtn.textContent = slowMode ? '🐢 Slow (ON)' : '🐢 Slow';
    slowBtn.setAttribute('aria-pressed', slowMode ? 'true' : 'false');
    slowBtn.title = slowMode ? 'Slow mode enabled' : 'Slow mode disabled';
  }

  // Mobile toolbar turtle button
  const mobileSlow = document.getElementById('mobile-slow') as HTMLButtonElement | null;
  if (mobileSlow) {
    mobileSlow.classList.toggle('toggle-active', slowMode);
    mobileSlow.setAttribute('aria-pressed', slowMode ? 'true' : 'false');
    mobileSlow.title = slowMode ? 'Slow mode enabled' : 'Slow mode disabled';
  }
}

function syncSoundButtonsUI() {
  if (soundToggleBtn) {
    soundToggleBtn.classList.toggle('active', soundEnabled);
    soundToggleBtn.textContent = soundEnabled ? '🔊 Sound' : '🔈 Sound';
    soundToggleBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    soundToggleBtn.title = soundEnabled
      ? 'Click to mute mechanical ticking'
      : 'Click to enable mechanical ticking';
  }

  if (mobileSoundBtn) {
    mobileSoundBtn.classList.toggle('toggle-active', soundEnabled);
    mobileSoundBtn.textContent = soundEnabled ? '🔊' : '🔈';
    mobileSoundBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    mobileSoundBtn.title = soundEnabled
      ? 'Mute mechanical ticking'
      : 'Enable mechanical ticking';
  }
}


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

let toastTimer: any = null;
function showToast(msg: string, ms = 2200) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl!.hidden = true; toastTimer = null; }, ms);
}

function syncGenomeSelects(value: string) {
  const desktop = document.getElementById('gene-select') as HTMLSelectElement | null;
  const mobile = document.getElementById('gene-select-mobile') as HTMLSelectElement | null;
  syncingGenomeSelect = true;
  if (desktop) desktop.value = value;
  if (mobile) mobile.value = value;
  syncingGenomeSelect = false;
}

function setShareHash(token: string | null) {
  const base = `${window.location.pathname}${window.location.search}`;
  const next = token ? `${base}#g=${encodeURIComponent(token)}` : base;
  window.history.replaceState(null, '', next);
}
function clearShareHashIfPresent() {
  if (window.location.hash && window.location.hash.includes('g=')) setShareHash(null);
}

function deepClone<T>(value: T): T {
  // Prefer structuredClone when available (handles nested objects, arrays, etc.).
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === 'function') {
    try {
      return sc(value);
    } catch {
      // Fall back to JSON cloning below.
    }
  }

  // JSON-based cloning is sufficient for our genome configs (plain data).
  return JSON.parse(JSON.stringify(value)) as T;
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

const graph3D = createGraph3DController(gumGraph);

function currentStartState(): NodeState {
  const s = lastLoadedConfig?.machine?.start_state;
  return (typeof s === 'number') ? (s as NodeState) : mapNodeState(String(s ?? 'A'));
}

/* =========================================================================
   Rule Editor
   ========================================================================= */

function pauseSimulationForRuleEditor() {
  if (!isSimulationRunning) return;
  clearInterval(simulationInterval);
  isSimulationRunning = false;
  pauseResumeButton.textContent = 'Resume';
  setControlsEnabled(true);
  syncMobilePlayIcon();
}

function stopSimulationLoop() {
  clearInterval(simulationInterval);
  isSimulationRunning = false;
}
const ruleEditor = createRuleEditorController({
  pauseForEditor: pauseSimulationForRuleEditor,
  stopSimulation: stopSimulationLoop,

  getRuleItems: () => gumMachine.getRuleItems(),
  exportRulesFromMachine,
  getStartStateToken: () => nodeStateLetter(currentStartState()),

  getLastLoadedConfig: () => lastLoadedConfig,
  buildMachineBlockFromRuntime,
  clearShareHashIfPresent,

  getCurrentGenomeSource: () => currentGenomeSource,
  getBaseGenomeLabel: () => baseGenomeLabel,

  setCustomGenomeCache: (cfg) => { customGenomeCache = cfg; },
  syncGenomeSelects,
  genomeSelectValues: GENOME_SELECT_VALUES,

  applyGenomeConfig: applyGenomConfig,
  showToast,
});

/* =========================================================================
   9) GENOME CATALOG / LOADING / EXPORT
   ========================================================================= */

const YAML_CATALOG = [
  
  { name: 'Dumbbell', path: 'data/genoms/dumbbell.yaml' },
  { name: 'Hairy Circle', path: 'data/genoms/hairy_circle_genom.yaml' },  
  { name: 'Dumbbell and Hairy Circle Hybrid', path: 'data/genoms/dumbbell_and_hairy_circle_hybrid.yaml' },    
  { name: 'Triangle Mesh', path: 'data/genoms/exp005_trimesh_genom.yaml' },
  { name: 'Quad Mesh', path: 'data/genoms/quadmesh.yaml' },
  { name: 'Hexagon replicator', path: 'data/genoms/hexagon_replicator.yaml' },  
  { name: 'Strange Figure #1', path: 'data/genoms/strange_figure1_genom.yaml' },
  { name: 'Strange Figure #2', path: 'data/genoms/strange_figure2_genom.yaml' },  
  { name: 'fractal-3', path: 'data/genoms/fractal3_genom.yaml' },
  { name: 'two_wheels', path: 'data/genoms/two_wheels.yaml' }, 
];

async function fetchYaml(path: string): Promise<any> {
  const txt = await (await fetch(path)).text();
  return yaml.load(txt);
}

async function loadGenesLibrary() {
  const geneSelect = document.getElementById('gene-select') as HTMLSelectElement | null;
  if (!geneSelect) return;

  const mobileSelect = document.getElementById('gene-select-mobile') as HTMLSelectElement | null;

  const fillCatalogOptions = (sel: HTMLSelectElement | null) => {
    if (!sel) return;
    sel.innerHTML = '';
    YAML_CATALOG.forEach(({ name, path }) => {
      const opt = document.createElement('option');
      opt.value = path;
      opt.text = name;
      sel.add(opt);
    });
  };

  fillCatalogOptions(geneSelect);
  fillCatalogOptions(mobileSelect);

  if (mobileSelect) mobileSelect.value = geneSelect.value;

  const handleGenomeSelection = async (value: string) => {
    // "Custom" option (added by upload/share/editor)
    if (value === GENOME_SELECT_VALUES.CUSTOM) {
      // If we have a cached custom genome, restore it instead of fetching a file.
      if (customGenomeCache) {
        clearShareHashIfPresent();
        currentGenomeSource = 'custom';
        await applyGenomConfig(deepClone(customGenomeCache), null);
      }
      return;
    }

    // Normal: YAML catalog path
    clearShareHashIfPresent();
    currentGenomeSource = 'catalog';
    baseGenomeLabel = YAML_CATALOG.find(x => x.path === value)?.name ?? 'Genome';
    await loadGenomFromYaml(value);
  };

  const wireSelect = (sel: HTMLSelectElement | null) => {
    if (!sel) return;
    sel.addEventListener('change', (ev) => {
      void (async () => {
        if (syncingGenomeSelect) return;
        const value = (ev.target as HTMLSelectElement).value;
        syncGenomeSelects(value);
        await handleGenomeSelection(value);
      })();
    });
  };

  wireSelect(geneSelect);
  wireSelect(mobileSelect);
  

  // Mobile toolbar buttons proxy desktop logic (no code duplication)
  document.getElementById('mobile-play')?.addEventListener('click', () => pauseResumeButton.click());
  document.getElementById('mobile-reset')?.addEventListener('click', () => resetBtn?.click());
  document.getElementById('mobile-slow')?.addEventListener('click', () => slowBtn?.click());

  // Load initial genome: shared link wins, otherwise first catalog genome.
  const shared = parseGenomeFromUrlHash(window.location.hash);
  if (shared) {
    currentGenomeSource = 'shared';
    baseGenomeLabel = 'Shared';
    await applyGenomConfig(shared, 'Shared');
    syncGenomeSelects(GENOME_SELECT_VALUES.CUSTOM);
    showToast('Loaded genome from shared link.');
  } else {
    await loadGenomFromYaml(geneSelect.value);
  }



  updateDebugInfo({ forceRulesRebuild: true });
}

async function loadGenomFromYaml(path: string) {
  const cfg = await fetchYaml(path);
  await applyGenomConfig(cfg, null);
  refreshMaxStepsInput();
}

async function applyGenomConfig(cfg: any, labelForSelect: string | null) {
  lastLoadedConfig = cfg ? deepClone(cfg) : {};

  (gumMachine as any) = buildMachineFromConfig(cfg, gumGraph, maintainChk?.checked ?? true);
  gumMachine.setMaxSteps(-1);

  const ocFromCfg = cfg?.machine?.orphan_cleanup;

  if (ocFromCfg) {
    // YAML explicitly provides orphan_cleanup → respect it (enabled can be true or false)
    lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
    lastLoadedConfig.machine.orphan_cleanup = deepClone(ocFromCfg);
    // No need to call setOrphanCleanup here: buildMachineFromConfig already wired it into the machine.
  } else {
    // No orphan_cleanup block in the genome → apply a default runtime config (enabled)
    const fallbackOc = {
      enabled: true,
      thresholds: { size1: 5, size2: 7, others: 10 },
      fadeStarts: { size1: 3, size2: 5, others: 8 },
    };
    (gumMachine as any).setOrphanCleanup?.(fallbackOc);

    lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
    lastLoadedConfig.machine.orphan_cleanup = { ...fallbackOc };
  }

  const ocActive = (gumMachine as any).getOrphanCleanup?.()?.enabled ?? false;
  if (orphanCleanupChk) orphanCleanupChk.checked = ocActive;

  const mscNow = (gumMachine as any).getMaintainSingleComponent?.();
  if (maintainChk && typeof mscNow === 'boolean') {
    maintainChk.checked = mscNow;
  }

  const reseedActive = (gumMachine as any).getReseedIsolatedA?.() ?? true;
  if (reseedIsolatedACheckbox) reseedIsolatedACheckbox.checked = reseedActive;
  lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
  lastLoadedConfig.machine.reseed_isolated_A = reseedActive;  

  gumMachine.resetIterations();
  pauseResumeButton.textContent = 'Start';
  pauseResumeButton.style.backgroundColor = 'lightgreen';
  resetGraph();                // handles zoom+fit
  refreshMaxStepsInput();
  refreshMachineSettingsInputs();
  updateDebugInfo({ forceRulesRebuild: true });

  const sel = document.getElementById('gene-select') as HTMLSelectElement;
  if (labelForSelect) {
    const upsert = (sel: HTMLSelectElement | null) => {
      if (!sel) return;
      let opt = sel.querySelector('option[data-custom="1"]') as HTMLOptionElement | null;
      if (!opt) {
        opt = document.createElement('option');
        opt.setAttribute('data-custom', '1');
        sel.insertBefore(opt, sel.firstChild);
      }
      opt.value = GENOME_SELECT_VALUES.CUSTOM;
      opt.text = `Custom: ${labelForSelect}`;
      sel.selectedIndex = 0;
    };

    upsert(document.getElementById('gene-select') as HTMLSelectElement | null);
    upsert(document.getElementById('gene-select-mobile') as HTMLSelectElement | null);

    customGenomeCache = deepClone(lastLoadedConfig);
    syncGenomeSelects(GENOME_SELECT_VALUES.CUSTOM);
  }


  // Keep in-memory config aligned with what the machine is actually running
  lastLoadedConfig.machine = buildMachineBlockFromRuntime();
  lastLoadedConfig.rules = exportRulesFromMachine();
  if (lastLoadedConfig?.meta && typeof lastLoadedConfig.meta === 'object') {
    delete (lastLoadedConfig.meta as any).activity_scheme;
  }
  delete (lastLoadedConfig as any).activity_scheme;

}

downloadBtn?.addEventListener('click', () => {
  const out = buildGenomeSnapshot();
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
    updateDebugInfo({ forceRulesRebuild: true });
  });
}

function ruleItemToConfigRule(it: RuleItem): any {
  const c = it.condition, o = it.operation;
  return {
    enabled: !!it.isEnabled,
    condition: {
      current: nodeStateLetter(c.currentState),
      prior: nodeStateLetter(c.priorState ?? NodeState.Ignored),
      conn_ge: c.allConnectionsCount_GE,
      conn_le: c.allConnectionsCount_LE,
      parents_ge: c.parentsCount_GE,
      parents_le: c.parentsCount_LE,
    },
    op: {
      kind: mapOperationKindToString(o.kind),
      operand: nodeStateLetter(o.operandNodeState ?? NodeState.Ignored),
    }
  };
}

function exportRulesFromMachine(): any[] {
  return gumMachine.getRuleItems().map(ruleItemToConfigRule);
}

function buildMachineBlockFromRuntime(): any {
  const base = deepClone(lastLoadedConfig?.machine ?? {});

  base.start_state = nodeStateLetter(currentStartState());
  base.max_steps = gumMachine.getMaxSteps();
  base.max_vertices = gumMachine.getMaxVertices();

  base.maintain_single_component = (gumMachine as any).getMaintainSingleComponent?.() ?? true;
  base.orphan_cleanup = (gumMachine as any).getOrphanCleanup?.() ?? base.orphan_cleanup ?? { enabled: false };
  base.reseed_isolated_A = (gumMachine as any).getReseedIsolatedA?.() ?? true;
  const ns = (gumMachine as any).getNearestSearchCfg?.();
  if (!base.nearest_search) {
    base.nearest_search = { max_depth: 2, tie_breaker: 'stable', connect_all: false };
  }
  if (ns) {
    base.nearest_search = { ...base.nearest_search, ...ns };
  }
  
}



function buildGenomeSnapshot(): any {
  syncMachineSettingsFromUi();
  const machine = buildMachineBlockFromRuntime();
  const init_graph = lastLoadedConfig?.init_graph ?? { nodes: [{ state: nodeStateLetter(currentStartState()) }] };
  const rules = exportRulesFromMachine();
  return { machine, init_graph, rules };
}

async function copyShareLinkToClipboard() {
  const snapshot = buildGenomeSnapshot();
  const token = encodeGenomeToUrlToken(snapshot);
  const url = `${window.location.origin}${window.location.pathname}#g=${encodeURIComponent(token)}`;

  try {
    await navigator.clipboard.writeText(url);
    showToast('Share link copied.');
  } catch {
    window.prompt('Copy this link:', url);
  }

  setShareHash(token); // keep URL consistent with what we copied
}

shareGenomeBtn?.addEventListener('click', () => { void copyShareLinkToClipboard(); });
mobileShareBtn?.addEventListener('click', () => { void copyShareLinkToClipboard(); });



/* =========================================================================
   10) SCISSORS TOOL (edge cutting) and view
   ========================================================================= */

function setTool(tool: Tool) {
  currentTool = tool;
  btnMove?.classList.toggle('active', tool === 'move');
  btnScissors?.classList.toggle('active', tool === 'scissors');
  svg.style('cursor', tool === 'scissors' ? 'crosshair' : 'default');
  graphGroup.selectAll<SVGGElement, Node>('.node')
    .style('pointer-events', tool === 'scissors' ? 'none' : 'auto');
    renderNodeInspector(undefined);

  }

btnMove?.addEventListener('click', () => setTool('move'));
btnScissors?.addEventListener('click', () => setTool('scissors'));
setTool('move');

function setViewMode(mode: ViewMode) {
  if (viewMode === mode) return;
  viewMode = mode;

  view2dBtn?.classList.toggle('active', mode === '2d');
  view3dBtn?.classList.toggle('active', mode === '3d');

  mobileView2dBtn?.classList.toggle('toggle-active', mode === '2d');
  mobileView3dBtn?.classList.toggle('toggle-active', mode === '3d');

  const svgEl = svg.node() as SVGSVGElement | null;
  if (!svgEl || !threeContainer) return;

  if (mode === '2d') {
    // Hide 3D, show 2D
    threeContainer.hidden = true;
    svgEl.removeAttribute('hidden');

    // Let D3 relax a bit after coming back from 3D
    for (let i = 0; i < 12; i++) {
      simulation.tick();
    }
    update();
    maybeAutoViewport();
    graph3D.pause();
  } else {
    // Hide 2D, show 3D
    svgEl.setAttribute('hidden', 'true');
    threeContainer.hidden = false;

    graph3D.ensure(threeContainer);
    graph3D.resize();
    graph3D.syncFromGum(true);  // includes cooldown + zoomToFit
    graph3D.resume();
  }
}

view2dBtn?.addEventListener('click', () => setViewMode('2d'));
view3dBtn?.addEventListener('click', () => setViewMode('3d'));

mobileView2dBtn?.addEventListener('click', () => setViewMode('2d'));
mobileView3dBtn?.addEventListener('click', () => setViewMode('3d'));


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

  handleGraphCountsPotentiallyChanged('manual');
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
  const el = document.getElementById('node-inspector-overlay') as HTMLDivElement | null;
  if (!el) return;

  if (!n) {
    el.textContent = '';
    el.hidden = true;
    return;
  }

  el.textContent = formatNodeInspectorText(n);
  el.hidden = false;
}


graph3D.onNodeHover((n?: GUMNode) => {
  renderNodeInspector(n);
});

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

  // NOTE: use a stable undirected key so edge identity doesn't flip
  const link = graphGroup.selectAll<SVGLineElement, Link>(".link")
    .data(links, d => {
      const s = (d.source as Node).id;
      const t = (d.target as Node).id;
      const a = Math.min(s, t);
      const b = Math.max(s, t);
      return `${a}-${b}`;
    });

  const linkEnter = link.enter().append("line")
    .attr("class", "link")
    .attr("vector-effect", "non-scaling-stroke");

  // IMPORTANT: merged selection = enter + update
  const mergedLinks = linkEnter.merge(link);

  const linkStroke = (d: Link) => {
    const s = gumGraph.getNodeById((d.source as Node).id);
    const t = gumGraph.getNodeById((d.target as Node).id);
    const base = edgeColorByStates((d.source as Node).state, (d.target as Node).state);
    const f = Math.max(s?.fade ?? 0, t?.fade ?? 0);
    return mixWithBlack(base, f);
  };

  // Set initial geometry/stroke immediately (so it looks right right away)
  mergedLinks
    .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
    .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
    .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
    .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
    .attr("stroke", linkStroke);

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

    // IMPORTANT: update merged links (enter+update), not only the update selection
    mergedLinks
      .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
      .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
      .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
      .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
      .attr("stroke", linkStroke);
  });

  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);
  simulation.alpha(0.5).restart();

  updateDebugInfo({ forceRulesRebuild: false });
  populateComboBoxes();
  simulation.tick();       // ensure positions flushed

  if (viewMode === '2d') {
    maybeAutoViewport();
  } else if (viewMode === '3d') {
    // keep 3D graph in sync with the same GUMGraph
    graph3D.syncFromGum(false);
  }
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
  grid.title = 'Click a swatch to change its color';

  const size = PALETTE16.length;

  for (let idx = 0; idx < size; idx++) {
    // Use a button so it’s fully clickable, but keep the original .palette-chip look.
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'palette-chip';
    cell.style.background = getPaletteSlotColor(idx);
    cell.style.cursor = 'pointer';
    cell.title = `#${idx} — click to change color`;

    // Hidden native color input; we just trigger it from the tile.
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.style.position = 'absolute';
    picker.style.opacity = '0';
    picker.style.pointerEvents = 'none';
    picker.style.width = '0';
    picker.style.height = '0';

    picker.addEventListener('input', () => {
      const hex = picker.value;
      if (!hex) return;
      applyPaletteSlotColor(idx, hex);
    });

    cell.addEventListener('click', () => {
      picker.click();
    });

    cell.appendChild(picker);
    grid.appendChild(cell);
  }
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

function updateDebugInfo(opts?: { forceRulesRebuild?: boolean }) {
  const forceRulesRebuild = !!opts?.forceRulesRebuild;

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
  const items = gumMachine.getRuleItems();
  const MAX = 60;

  if (board) {
    const geneInspectorBody = document.getElementById('gene-inspector-body') as HTMLDivElement | null;
    const defaultGI = 'Hover a rule tile to see its description. Click a tile to enable/disable that rule.';
    if (geneInspectorBody && !geneInspectorBody.textContent) {
      geneInspectorBody.textContent = defaultGI;
    }

    // Decide whether to fully rebuild tiles or just refresh their state
    const needFullRebuild = forceRulesRebuild || board.childElementCount === 0;

    if (needFullRebuild) {
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

      board.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
        // "+" tile: Add new rule
        if (el.dataset.add === '1') {
          el.addEventListener('click', () => ruleEditor.open('add'));
          return;
        }

        const idx = Number(el.dataset.idx ?? '-1');
        if (Number.isNaN(idx) || idx < 0) return;

        el.addEventListener('mouseenter', () => {
          const it = items[idx] ?? gumMachine.getRuleItems()[idx];
          if (!it || !geneInspectorBody) return;
          geneInspectorBody.textContent =
            `${describeRuleHuman(it)} — Click to ${it.isEnabled ? 'disable' : 'enable'}.`;
        });

        el.addEventListener('mouseleave', () => {
          if (geneInspectorBody) geneInspectorBody.textContent = defaultGI;
        });

        el.addEventListener('click', () => {
          ruleEditor.open('edit', idx);
        });


      });
    } else {
      // Lightweight update: keep existing elements & listeners, just update classes/tooltips
      board.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
        const idx = Number(el.dataset.idx ?? '-1');
        if (Number.isNaN(idx) || idx < 0) return;
        const it = items[idx];
        if (!it) return;

        el.classList.toggle('disabled', !it.isEnabled);
        el.classList.toggle('active', !!it.isActive);
        el.title = describeRuleHuman(it).replace(/"/g, '&quot;');
      });

      if (toggleBtn) {
        if (items.length > MAX) {
          toggleBtn.style.display = 'inline-block';
          toggleBtn.textContent = showAllRules ? 'Show less' : `Show more (${items.length - MAX})`;
        } else {
          toggleBtn.style.display = 'none';
        }
      }
    }
  } else {
    // Fallback: short-form text panel for rules
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
      if (toggleBtn) {
        toggleBtn.style.display = (lines.length > maxLines ? 'inline-block' : 'none');
      }
      
    }
  }

  // Keep overlay in sync, with same "full vs light" semantics
  renderRulesOverlay(forceRulesRebuild);
}


function renderRulesOverlay(forceRulesRebuild = true) {
  const container = document.getElementById('rules-overlay') as HTMLDivElement | null;
  if (!container || !document.body.classList.contains('mobile-basic')) return;

  const items = gumMachine.getRuleItems();

  const needFullRebuild = forceRulesRebuild || container.childElementCount === 0;

  if (!needFullRebuild) {
    // Lightweight: just refresh classes and tooltips
    container.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
      const idx = Number(el.dataset.idx ?? '-1');
      if (Number.isNaN(idx) || idx < 0) return;
      const it = items[idx];
      if (!it) return;

      el.classList.toggle('disabled', !it.isEnabled);
      el.classList.toggle('active', !!it.isActive);
      el.title = describeRuleHuman(it).replace(/"/g, '&quot;');
    });
    return;
  }

  // Full rebuild
  container.innerHTML = buildRuleTilesHTML(items, 48);

  container.querySelectorAll<HTMLDivElement>('.gene-tile').forEach(el => {
  if (el.dataset.add === '1') {      
      el.onclick = () => ruleEditor.open('add');
      return;
    }
    const idx = Number(el.dataset.idx ?? '-1');
    if (Number.isNaN(idx) || idx < 0) return;    
    el.onclick = () => ruleEditor.open('edit', idx);

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
    if (soundEnabled) {
      tickingSound.setEnabled(true);
    }
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
  if (isSimulationRunning) {
    clearInterval(simulationInterval);
    simulationInterval = setInterval(unfoldGraph, currentIntervalMs());
  }
  syncSlowButtonsUI();
});

syncSlowButtonsUI();


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

reseedIsolatedACheckbox?.addEventListener('change', () => {
  const on = !!reseedIsolatedACheckbox.checked;
  (gumMachine as any).setReseedIsolatedA?.(on);
  lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
  lastLoadedConfig.machine.reseed_isolated_A = on;
});

maxStepsInput?.addEventListener('change', () => {
  const v = parseInt(maxStepsInput.value, 10);
  gumMachine.setMaxSteps(Number.isNaN(v) ? gumMachine.getMaxSteps() : v);
});
function refreshMaxStepsInput() {
  if (maxStepsInput) maxStepsInput.value = String(gumMachine.getMaxSteps());
}

function syncMachineSettingsFromUi() {
  // Max vertices
  if (maxVerticesInput) {
    const v = parseInt(maxVerticesInput.value, 10);
    if (!Number.isNaN(v)) {
      const next = Math.max(0, Math.trunc(v));
      (gumMachine as any).setMaxVertices?.(next);
      lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
      lastLoadedConfig.machine.max_vertices = next;
    }
  }

  // Nearest search max depth
  if (nearestMaxDepthInput) {
    const v = parseInt(nearestMaxDepthInput.value, 10);
    if (!Number.isNaN(v)) {
      const next = Math.max(0, Math.trunc(v));
      (gumMachine as any).setNearestSearchMaxDepth?.(next);

      lastLoadedConfig.machine = lastLoadedConfig.machine ?? {};
      lastLoadedConfig.machine.nearest_search =
        lastLoadedConfig.machine.nearest_search ?? { tie_breaker: 'stable', connect_all: false };
      lastLoadedConfig.machine.nearest_search.max_depth = next;
    }
  }
}


function refreshMachineSettingsInputs() {
  if (maxVerticesInput) maxVerticesInput.value = String(gumMachine.getMaxVertices());
  if (nearestMaxDepthInput) {
    const ns = (gumMachine as any).getNearestSearchCfg?.();
    nearestMaxDepthInput.value = String(ns?.max_depth ?? 2);
  }
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
      handleGraphCountsPotentiallyChanged('manual');
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
  handleGraphCountsPotentiallyChanged('manual');
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
      handleGraphCountsPotentiallyChanged('manual');
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
      handleGraphCountsPotentiallyChanged('manual');
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
    handleGraphCountsPotentiallyChanged('manual');
    update();
  }
});

const toggleRulesBtn = document.getElementById('toggle-rules-btn') as HTMLButtonElement | null;
toggleRulesBtn?.addEventListener('click', () => {
  showAllRules = !showAllRules;
  toggleRulesBtn.textContent = showAllRules ? 'Show less' : 'Show more';  
  updateDebugInfo({ forceRulesRebuild: true });
});

soundToggleBtn?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  tickingSound.setEnabled(soundEnabled);
  syncSoundButtonsUI();
});

mobileSoundBtn?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  tickingSound.setEnabled(soundEnabled);
  syncSoundButtonsUI();
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

  handleGraphCountsPotentiallyChanged('auto');

  simulation.tick();
  update();
  simulation.tick();
  update();
}

function resetGraph() {
  // Use whatever graph is currently in gumGraph (built by buildMachineFromConfig).
  // Just reset camera/view + sound stats.

  resetZoom();
  resetSoundGraphStats();

  update();             // rebuilds nodes/links from gumGraph
  fitInitialOnReset();  // center & zoom to fit

  if (viewMode === '3d' && threeContainer) {
    graph3D.ensure(threeContainer);
    graph3D.syncFromGum(true);
  }
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

// Restore any saved per-state colors before we build the initial graph
loadColorOverridesFromStorage();

loadGenesLibrary().then(() => {

  setControlsEnabled(false);
  refreshMaxStepsInput();
  renderPaletteOpenCollapsed();
  initStateCombos();
  applyResponsiveMode();
  syncMobilePlayIcon();
  syncSlowButtonsUI();
  syncSoundButtonsUI();
});
