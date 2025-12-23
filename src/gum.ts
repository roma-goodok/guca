// gum.ts
// Graph Unfolding Machine (TypeScript version, aligned with Python M2 implementation)

import { Graph } from 'graphlib';

// ----------------- Machine Config Types -----------------

export type CountCompare = 'range' | 'exact';
export type TranscriptionWay = 'resettable' | 'continuable';

export interface NearestSearchCfg {
  max_depth: number;
  tie_breaker: 'stable' | 'random' | 'by_id' | 'by_creation';
  connect_all: boolean;
}

// NEW near other types:
export interface OrphanCleanupCfg {
  enabled: boolean;
  thresholds?: { size1?: number; size2?: number; others?: number };
  fadeStarts?: { size1?: number; size2?: number; others?: number };
}

export interface MachineCfg {
  start_state: NodeState;
  transcription: TranscriptionWay;
  count_compare: CountCompare;
  max_vertices: number;
  max_steps: number;
  rng_seed?: number;
  nearest_search: NearestSearchCfg;
  maintain_single_component?: boolean;
  orphan_cleanup?: OrphanCleanupCfg;
  reseed_isolated_A?: boolean;
}

// ----------------- RNG -----------------

class RNG {
  private s: number;
  constructor(seed: number | undefined) {
    this.s = (seed ?? 1234567) >>> 0;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }
  choice<T>(arr: T[]): T {
    return arr[this.next() % arr.length];
  }
}

// ----------------- Enums -----------------

export enum NodeState {
  Max = 255,
  Min = 0,
  Ignored = 0,
  Unknown = 254,
  A = 1, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z
}

export enum OperationKindEnum {
  TurnToState = 0x0,
  TryToConnectWithNearest = 0x1,
  GiveBirthConnected = 0x2,
  DisconnectFrom = 0x3,
  Die = 0x4,
  TryToConnectWith = 0x5,
  GiveBirth = 0x6,
}

// ----------------- Rule / Condition / Operation -----------------

export class Operation {
  constructor(
    public kind: OperationKindEnum,
    public operandNodeState: NodeState = NodeState.Ignored
  ) {}
}

export class OperationCondition {
  constructor(
    public currentState: NodeState,
    public priorState: NodeState = NodeState.Ignored,
    public allConnectionsCount_GE: number = -1,
    public allConnectionsCount_LE: number = -1,    
    public parentsCount_GE: number = -1,
    public parentsCount_LE: number = -1,
    // NodeState.Ignored means "any" (count all connections).
    public allConnectionsWithState: NodeState = NodeState.Ignored
  ) {}
}

export class RuleItem {
  constructor(
    public condition: OperationCondition,
    public operation: Operation,
    public isActive: boolean = false,
    public isEnabled: boolean = true,
    public lastActivationInterationIndex: number = -1,
    public isActiveInNodes: number[] = []
  ) {}
}

export class RuleTable {
  public items: RuleItem[] = [];

  add(item: RuleItem) {
    this.items.push(item);
  }

  clear() {
    this.items = [];
  }
}

// ----------------- Graph / Node -----------------

export class GUMNode {
  public connectionsCount = 0;
  public parentsCount = 0;
  public markedAsDeleted = false;
  public markedNew = true;
  public priorState = NodeState.Unknown;
  public orphanAge = 0;
  public fade = 0;

  // step snapshots
  public savedDegree = 0;
  public savedParents = 0;
  protected savedCurrentState = NodeState.Unknown;
  public savedConnByState: Record<number, number> = {};

  public ruleIndex = 0; // for continuable transcription

  public position: { x: number; y: number } | null = null;
  public velocity: { vx: number; vy: number } | null = null;
  public force: { fx: number | null; fy: number | null } | null = null;
  public bornFromId: number | null = null;

  constructor(public id: number, public state: NodeState = NodeState.Unknown) {}

  updatePriorState() {
    this.priorState = this.savedCurrentState;
  }

  saveCurrentState() {
    this.savedCurrentState = this.state;
  }

  public getSavedCurrentState(): NodeState {
    return this.savedCurrentState;
  }
  
}

export class GUMGraph {
  private graph: Graph;
  private nextId = 1;

  constructor() {
    this.graph = new Graph({ directed: false });
  }

  allocateNodeId(): number {
    // Skip any ids that might exist (e.g., after loading a YAML with explicit ids)
    while (this.graph.hasNode(this.nextId.toString())) this.nextId++;
    return this.nextId++;
  }

  addNode(node: GUMNode) {
    this.graph.setNode(node.id.toString(), node);
    if (node.id >= this.nextId) this.nextId = node.id + 1;  // NEW
  }

  addEdge(source: GUMNode, target: GUMNode) {
    if (this.graph.hasEdge(source.id.toString(), target.id.toString())) return;
    this.graph.setEdge(source.id.toString(), target.id.toString());
    source.connectionsCount++;
    target.connectionsCount++;
  }

  removeEdge(source: GUMNode, target: GUMNode) {
    if (this.graph.hasEdge(source.id.toString(), target.id.toString())) {
      this.graph.removeEdge(source.id.toString(), target.id.toString());
      source.connectionsCount--;
      target.connectionsCount--;
    }
  }

  getNodes(): GUMNode[] {
    return this.graph.nodes().map(nodeId => this.graph.node(nodeId) as GUMNode);
  }

  getEdges(): { source: GUMNode; target: GUMNode }[] {
    return this.graph.edges().map(edge => ({
      source: this.graph.node(edge.v) as GUMNode,
      target: this.graph.node(edge.w) as GUMNode,
    }));
  }

  removeMarkedNodes() {
    this.getNodes().forEach(node => {
      if (node.markedAsDeleted) {
        this.graph.removeNode(node.id.toString());
      }
    });
  }

  areNodesConnected(node1: GUMNode, node2: GUMNode): boolean {
    return this.graph.hasEdge(node1.id.toString(), node2.id.toString());
  }

  getNodeById(id: number): GUMNode | undefined {
    return this.graph.node(id.toString()) as GUMNode | undefined;
  }

  getNeighbors(node: GUMNode): GUMNode[] {
    const ids = this.graph.neighbors(node.id.toString()) || [];
    return ids
      .map(id => this.graph.node(id) as GUMNode)
      .filter(n => n && !n.markedAsDeleted);
  }

  getConnectedComponents(): GUMNode[][] {
    const comps: GUMNode[][] = [];
    const seen = new Set<number>();
    for (const n of this.getNodes().filter(n => !n.markedAsDeleted)) {
      if (seen.has(n.id)) continue;
      const q = [n]; seen.add(n.id); const comp = [n];
      while (q.length) {
        const u = q.shift()!;
        for (const v of this.getNeighbors(u)) {
          if (!seen.has(v.id)) { seen.add(v.id); q.push(v); comp.push(v); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

}

// ----------------- Graph Unfolding Machine -----------------

export class GraphUnfoldingMachine {
  public ruleTable: RuleTable;
  public getStepCount(): number { return this.iterations; }
  public getMaxSteps(): number { return this.cfg.max_steps; }
  public getMaxVertices(): number { return this.cfg.max_vertices; }

  private iterations = 0;
  private rng: RNG;

  constructor(private graph: GUMGraph, private cfg: MachineCfg) {
    this.ruleTable = new RuleTable();
    this.rng = new RNG(cfg?.rng_seed);

    if (this.graph.getNodes().length === 0) {
      const seed = new GUMNode(this.graph.allocateNodeId(), cfg.start_state ?? NodeState.A);
      this.graph.addNode(seed);
    }


    if (this.cfg.maintain_single_component === undefined) {
      (this.cfg as any).maintain_single_component = true;
    }

    if ((this.cfg as any).reseed_isolated_A === undefined) {
      (this.cfg as any).reseed_isolated_A = true;
    }
  }

  public setMaxSteps(n: number) {
    (this as any).cfg.max_steps = Number.isFinite(n) ? Math.trunc(n) : this.getMaxSteps();
  }  

  public enforceSingleComponentIfEnabled(): void {
    if (!this.cfg.maintain_single_component) return;
    const comps = this.graph.getConnectedComponents();
    if (comps.length <= 1) return;

    const score = (comp: GUMNode[]) => {
      return {
        minParents: Math.min(...comp.map(n => n.parentsCount)),
        minId: Math.min(...comp.map(n => n.id)),
      };
    };

    let keep = 0, best = score(comps[0]);
    for (let i = 1; i < comps.length; i++) {
      const s = score(comps[i]);
      if (s.minParents < best.minParents || (s.minParents === best.minParents && s.minId < best.minId)) {
        best = s; keep = i;
      }
    }

    comps.forEach((comp, i) => {
      if (i === keep) return;
      comp.forEach(n => n.markedAsDeleted = true);
    });
    this.graph.removeMarkedNodes();
  }


  public reachedMaxSteps(): boolean {
    return this.cfg.max_steps >= 0 && this.iterations >= this.cfg.max_steps;
  }

  public atVertexLimit(): boolean {
    return this.cfg.max_vertices > 0 && this.graph.getNodes().length >= this.cfg.max_vertices;
  }

  public getOrphanCleanup(): OrphanCleanupCfg | undefined {
    return (this as any).cfg?.orphan_cleanup;
  }
  
  public setOrphanCleanup(cfg: OrphanCleanupCfg) {
    (this.cfg as any).orphan_cleanup = cfg;
  }

  public getMaintainSingleComponent(): boolean {
    return !!this.cfg.maintain_single_component;
  }

  public setMaintainSingleComponent(on: boolean) {
    (this.cfg as any).maintain_single_component = on;
  }

  public getReseedIsolatedA(): boolean {
    return (this.cfg as any).reseed_isolated_A ?? true;
  }

  public setReseedIsolatedA(on: boolean) {
    (this.cfg as any).reseed_isolated_A = !!on;
  }


  clearRuleTable() {
    this.ruleTable.clear();
  }

  addRuleItem(item: RuleItem) {
    this.ruleTable.add(item);
  }

  getRuleItems() {
    return this.ruleTable.items;
  }

  getIterations() {
    return this.iterations;
  }

  resetIterations() {
    this.iterations = 0;
  }

  public setMaxVertices(n: number) {
    const v = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : this.cfg.max_vertices;
    (this.cfg as any).max_vertices = v;
  }

  public getNearestSearchCfg(): NearestSearchCfg {
    return { ...this.cfg.nearest_search };
  }

  public setNearestSearchMaxDepth(n: number) {
    const v = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : this.cfg.nearest_search.max_depth;
    (this.cfg.nearest_search as any).max_depth = v;
  }


 private snapshotAllNodes() {
    const nodes = this.graph.getNodes();

    // Pass 1: freeze state/parents and capture snapshot neighbor ids
    const neighborIdsByNode = new Map<number, number[]>();
    for (const n of nodes) {
      n.markedNew = false;
      n.saveCurrentState();
      n.savedParents = n.parentsCount;

      const nbs = this.graph.getNeighbors(n);
      neighborIdsByNode.set(n.id, nbs.map(nb => nb.id));
    }

    // Pass 2: compute degree + per-state neighbor counts from the snapshot
    for (const n of nodes) {
      const nbIds = neighborIdsByNode.get(n.id) ?? [];
      n.savedDegree = nbIds.length;

      const counts: Record<number, number> = {};
      for (const nbId of nbIds) {
        const nb = this.graph.getNodeById(nbId);
        if (!nb) continue;
        const st = (nb.getSavedCurrentState?.() ?? nb.state);
        const k = Number(st);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      n.savedConnByState = counts;
    }
  }

  private getSavedConnectionsCount(node: GUMNode, withState: NodeState): number {
    if (withState === NodeState.Ignored) return node.savedDegree; // "any"
    const key = Number(withState);
    return node.savedConnByState?.[key] ?? 0;
  }

  private matchInts(val: number, ge: number, le: number): boolean {
    if (this.cfg.count_compare === 'exact' && ge >= 0) {
      if (val !== ge) return false;
      if (le >= 0 && val > le) return false;
      return true;
    }
    if (ge >= 0 && val < ge) return false;
    if (le >= 0 && val > le) return false;
    return true;
  }

  private findMatchingRule(node: GUMNode): RuleItem | null {
    const items = this.ruleTable.items;
    if (items.length === 0) return null;

    const start = (this.cfg.transcription === 'continuable') ? node.ruleIndex : 0;

    const scan = (lo: number, hi: number) => {
      for (let i = lo; i < hi; i++) {
        const it = items[i];
        if (!it.isEnabled) continue;
        const c = it.condition;        
        const currentOk = c.currentState === node.getSavedCurrentState() || c.currentState === NodeState.Ignored;
        const priorOk = c.priorState === NodeState.Ignored || c.priorState === node.priorState;
        const connCount = this.getSavedConnectionsCount(node, c.allConnectionsWithState ?? NodeState.Ignored);
        const connOk = this.matchInts(connCount, c.allConnectionsCount_GE, c.allConnectionsCount_LE);
        const parOk = this.matchInts(node.savedParents, c.parentsCount_GE, c.parentsCount_LE);
        
        if (currentOk && priorOk && connOk && parOk) return it;
      }
      return null;
    };

    return scan(start, items.length) ?? scan(0, start);
  }

  private eligibleForNearest(u: GUMNode, v: GUMNode, required: NodeState): boolean {
    if (u === v) return false;
    if (this.graph.areNodesConnected(u, v)) return false;
    if (v.markedNew) return false;

    // Python parity: operand "any" (Ignored) or "Unknown" => no state filter
    const isWildcard = required === undefined
                    || required === null as any
                    || required === NodeState.Ignored
                    || required === NodeState.Unknown;

    if (isWildcard) return true;

    const saved = (v.getSavedCurrentState?.() ?? v.state);
    return saved === required;
  }

  public tryToConnectWithNearest(node: GUMNode, state: NodeState) {
    const maxD = this.cfg.nearest_search.max_depth;
    if (!Number.isFinite(maxD) || maxD <= 0) return; // nothing to search

    const q: Array<{ n: GUMNode; d: number }> = [{ n: node, d: 0 }];
    const visited = new Set<GUMNode>([node]);
    let foundDepth: number | null = null;
    const found: GUMNode[] = [];

    while (q.length) {
      const { n, d } = q.shift()!;
      if (foundDepth !== null && d > foundDepth) break;

      if (d > 0 && d <= maxD && this.eligibleForNearest(node, n, state)) {
        foundDepth = d; found.push(n); continue;
      }

      if (d < maxD) {
        const nbs = this.graph.getEdges()
          .filter(e => e.source === n || e.target === n)
          .map(e => e.source === n ? e.target : e.source)
          .filter(x => !visited.has(x))
          .sort((a, b) => a.id - b.id);
        nbs.forEach(nb => { visited.add(nb); q.push({ n: nb, d: d + 1 }); });
      }
    }

    if (found.length === 0) return;

    if (this.cfg.nearest_search.connect_all) {
      found.forEach(v => this.graph.addEdge(node, v));
      return;
    }

    let pick: GUMNode;
    switch (this.cfg.nearest_search.tie_breaker) {
      case 'random': pick = this.rng.choice(found); break;
      default:       pick = found.slice().sort((a, b) => a.id - b.id)[0];
    }
    this.graph.addEdge(node, pick);
  }


  private performOperation(node: GUMNode, operation: Operation) {
    switch (operation.kind) {
      case OperationKindEnum.TurnToState:
        node.state = operation.operandNodeState;
        break;
      case OperationKindEnum.GiveBirthConnected:
        this.giveBirthConnected(node, operation.operandNodeState);
        break;      
      case OperationKindEnum.DisconnectFrom:
        this.disconnectFrom(node, operation.operandNodeState);
        break;
      case OperationKindEnum.TryToConnectWithNearest:
        this.tryToConnectWithNearest(node, operation.operandNodeState);
        break;
      case OperationKindEnum.Die:
        node.markedAsDeleted = true;
        break;
      case OperationKindEnum.TryToConnectWith:
        this.tryToConnectWith(node, operation.operandNodeState);
        break;
      case OperationKindEnum.GiveBirth:
        this.giveBirth(node, operation.operandNodeState);
        break;
    }
  }

  private giveBirthConnected(node: GUMNode, state: NodeState) {
    if (this.cfg.max_vertices > 0 && this.graph.getNodes().length >= this.cfg.max_vertices) return;

    const newId = this.graph.allocateNodeId();
    const newNode = new GUMNode(newId, state);
    newNode.parentsCount = node.parentsCount + 1;
    newNode.markedNew = true;
    newNode.bornFromId = node.id;
    this.graph.addNode(newNode);
    this.graph.addEdge(node, newNode);
  }

  private giveBirth(node: GUMNode, state: NodeState) {
    if (this.cfg.max_vertices > 0 && this.graph.getNodes().length >= this.cfg.max_vertices) return;

    const newId = this.graph.allocateNodeId();
    const newNode = new GUMNode(newId, state);
    newNode.parentsCount = node.parentsCount + 1;
    newNode.markedNew = true;
    newNode.bornFromId = node.id;
    this.graph.addNode(newNode);
  }

  private disconnectFrom(node: GUMNode, state: NodeState) {
    // Remove edges from `node` to any neighbor whose *saved* state equals `state`.
    const edgesToRemove = this.graph.getEdges().filter(edge => {
      const other =
        edge.source === node ? edge.target :
        edge.target === node ? edge.source : null;
      if (!other) return false;
      if (other.markedNew) return false; // ignore newborns this step

      const saved = (other.getSavedCurrentState?.() ?? other.state);
      return saved === state;
    });

    edgesToRemove.forEach(edge => {
      this.graph.removeEdge(edge.source, edge.target);
    });
  }


  private tryToConnectWith(node: GUMNode, state: NodeState) {
    const isWildcard =
      state === NodeState.Ignored || state === NodeState.Unknown;

    for (const other of this.graph.getNodes()) {
      if (other.id === node.id) continue;
      if (this.graph.areNodesConnected(node, other)) continue;
      if (other.markedNew) continue;

      const saved = (other.getSavedCurrentState?.() ?? other.state);
      if (isWildcard || saved === state) {
        this.graph.addEdge(node, other);
      }
    }
  }



  // Inside cleanupOrphansIfEnabled(), replace the fade block:

 
  private cleanupOrphansIfEnabled(): void {
    const oc = this.cfg.orphan_cleanup;
    if (!oc?.enabled) return;
    if (this.cfg.maintain_single_component) return;

    const comps = this.graph.getConnectedComponents();
    if (comps.length <= 1) {
      // back to single component; reset all
      for (const n of this.graph.getNodes()) { n.orphanAge = 0; n.fade = 0; }
      return;
    }

    // pick primary the same way as enforceSingleComponentIfEnabled()
    const score = (comp: GUMNode[]) => ({
      minParents: Math.min(...comp.map(n => n.parentsCount)),
      minId: Math.min(...comp.map(n => n.id)),
    });
    let keep = 0, best = score(comps[0]);
    for (let i = 1; i < comps.length; i++) {
      const s = score(comps[i]);
      if (s.minParents < best.minParents || (s.minParents === best.minParents && s.minId < best.minId)) {
        best = s; keep = i;
      }
    }

    const T = {
      size1: oc.thresholds?.size1 ?? 5,
      size2: oc.thresholds?.size2 ?? 7,
      others: oc.thresholds?.others ?? 10,
    };
    const F = {
      size1: oc.fadeStarts?.size1 ?? (T.size1 - 2),   // 3
      size2: oc.fadeStarts?.size2 ?? (T.size2 - 2),   // 5
      others: oc.fadeStarts?.others ?? (T.others - 2) // 8
    };

    comps.forEach((comp, idx) => {
      const isPrimary = idx === keep;
      const size = comp.length;
      const th = size === 1 ? T.size1 : size === 2 ? T.size2 : T.others;
      const fs = size === 1 ? F.size1 : size === 2 ? F.size2 : F.others;

      for (const n of comp) {
        if (isPrimary) { n.orphanAge = 0; n.fade = 0; continue; }

        n.orphanAge = (n.orphanAge ?? 0) + 1;

        if (n.orphanAge >= th) {
          n.markedAsDeleted = true;
          continue;
        }
        if (n.orphanAge >= fs) {
          const denom = Math.max(1, th - fs);
          const k = (n.orphanAge - fs + 1);
          n.fade = Math.min(1, k / denom);
        } else {
          n.fade = 0;
        }        
      }
    });
  }

  private reseedIsolatedANodesIfEnabled(): void {
    const cfgAny = this.cfg as any;
    const featureOn: boolean = cfgAny.reseed_isolated_A ?? true;
    if (!featureOn) return;

    const maintain = !!this.cfg.maintain_single_component;
    if (maintain) return;

    const oc = this.cfg.orphan_cleanup;
    if (oc?.enabled) return;  // only active when Auto-dissolve is OFF

    const comps = this.graph.getConnectedComponents();
    if (!comps.length) return;

    for (const comp of comps) {
      // "disconnected node" = component of size 1
      if (comp.length !== 1) continue;
      const n = comp[0];
      if (n.state !== NodeState.A) continue;

      // NEW: reseed *once* — only if it previously had parents
      if (n.parentsCount <= 0) continue;

      n.parentsCount = 0;
      n.priorState   = NodeState.Unknown;
      n.orphanAge    = 0;
      n.fade         = 0;
    }
  }



  runOneStep(): boolean {
    this.snapshotAllNodes();
    this.ruleTable.items.forEach(it => { it.isActive = false; it.isActiveInNodes = []; });

    let didAnything = false;
    const nodesNow = this.graph.getNodes().slice().sort((a, b) => a.id - b.id);


    for (const node of nodesNow) {
      if (node.markedAsDeleted) continue;
      const item = this.findMatchingRule(node);
      if (item && item.isEnabled) {
        this.performOperation(node, item.operation);
        item.isActive = true;
        item.lastActivationInterationIndex++;
        item.isActiveInNodes.push(node.id);
        didAnything = true;
        if (this.cfg.transcription === 'continuable') {
          node.ruleIndex = (this.ruleTable.items.indexOf(item) + 1) % Math.max(1, this.ruleTable.items.length);
        }
      }
      node.updatePriorState();
    }

    this.iterations++;
    this.cleanupOrphansIfEnabled();
    this.graph.removeMarkedNodes();
    this.reseedIsolatedANodesIfEnabled(); 
    this.enforceSingleComponentIfEnabled();
    return didAnything;
  }

  runUntilStop() {
    let empty = 0;
    for (let i = 0; this.cfg.max_steps < 0 || i < this.cfg.max_steps; i++) {
      const changed = this.runOneStep();
      empty = changed ? 0 : empty + 1;
      if (empty >= 2) break;
      if (this.cfg.max_vertices > 0 && this.graph.getNodes().length > this.cfg.max_vertices) break;
    }
  }
}
