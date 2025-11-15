// src/genomeLoader.ts
import {
    GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState,
    MachineCfg, TranscriptionWay, CountCompare,
    OperationCondition, Operation
  } from './gum';
  import { mapNodeState, mapOperationKind } from './utils';
  
  function toNodeStateFlex(v: any): NodeState {
    return typeof v === 'number' ? (v as NodeState) : mapNodeState(String(v ?? 'Unknown'));
  }
  
  function parseActivityScheme(s: string): Set<number> {
    // Format: number => count of inactive rules; 'x' => one active rule.
    // Example "4x9x18xx" => skip 4 inactive, add 1 active, skip 9 inactive, add 1 active, skip 18 inactive, add 1 active, add 1 active.
    // Returns zero-based indices of active rules.
    const active = new Set<number>();
    if (!s || typeof s !== 'string') return active;
  
    // Normalize: remove spaces
    const tokens = s.replace(/\s+/g, '').match(/(\d+|x)/g) || [];
    let idx = 0;
    for (const t of tokens) {
      if (t === 'x') { active.add(idx); idx += 1; continue; }
      const n = parseInt(t, 10);
      if (!Number.isNaN(n) && n >= 0) idx += n;   // skip n introns
    }
    return active;
  }
  

  export function buildMachineFromConfig(
    cfg: any,
    gumGraph: GUMGraph,
    maintainSingleComponent: boolean = true
  ): GraphUnfoldingMachine {
    // 1) wipe graph clean
    gumGraph.getNodes().forEach(n => (n.markedAsDeleted = true));
    gumGraph.removeMarkedNodes();
  
    // 2) seed nodes from init_graph (BEFORE constructing the machine)
    const machineBlock = cfg?.machine ?? {};
    const startState = toNodeStateFlex(machineBlock?.start_state ?? 'A');
  
    if (Array.isArray(cfg?.init_graph?.nodes) && cfg.init_graph.nodes.length > 0) {
      cfg.init_graph.nodes.forEach((n: any, idx: number) => {
        const st = toNodeStateFlex(n?.state ?? startState);
        gumGraph.addNode(new GUMNode(idx + 1, st));
      });
    } else {
      gumGraph.addNode(new GUMNode(1, startState));
    }

    const mscFromCfg = machineBlock?.maintain_single_component;
    const maintainSingle = (typeof mscFromCfg === 'boolean') ? mscFromCfg : Boolean(maintainSingleComponent);

  
    // 3) build MachineCfg
    const mc: MachineCfg = {
      start_state: startState,
      transcription: (machineBlock?.transcription ?? 'resettable') as TranscriptionWay,
      count_compare: (machineBlock?.count_compare ?? 'range') as CountCompare,
      max_vertices: Number(machineBlock?.max_vertices ?? 2000),
      max_steps: Number(machineBlock?.max_steps ?? 120),
      rng_seed: machineBlock?.rng_seed,
      nearest_search: {
        max_depth: Number(machineBlock?.nearest_search?.max_depth ?? 2),
        tie_breaker: (machineBlock?.nearest_search?.tie_breaker ?? 'stable'),
        connect_all: Boolean(machineBlock?.nearest_search?.connect_all ?? false),
      },
      maintain_single_component: maintainSingle,
      orphan_cleanup: machineBlock?.orphan_cleanup ?? { enabled: false },
      reseed_isolated_A: machineBlock?.reseed_isolated_A ?? true,
    };
  
    // 4) construct machine
    const machine = new GraphUnfoldingMachine(gumGraph, mc);
  
    // 5) add rules (optionally pruned by meta.activity_scheme)
    const rawRules: any[] = Array.isArray(cfg?.rules) ? cfg.rules.slice() : [];
    let rulesForBuild = rawRules;

    const scheme = cfg?.meta?.activity_scheme ?? cfg?.activity_scheme;
    if (scheme) {
        const activeIdx = parseActivityScheme(String(scheme));
        const kept: any[] = [];
        for (let i = 0; i < rawRules.length; i++) if (activeIdx.has(i)) kept.push(rawRules[i]);
        if (kept.length > 0) {
        rulesForBuild = kept;
        console.info(`[genomeLoader] Pruned introns via activity_scheme (${rawRules.length} → ${kept.length} rules)`);
        }
    }

    machine.clearRuleTable();
    for (const r of rulesForBuild) {
        const c = r?.condition ?? {};
        const o = r?.op ?? r?.operation ?? {};
        const cond = new OperationCondition(
        toNodeStateFlex(c.current),
        mapNodeState(String(c.prior ?? 'any')),
        Number(c.conn_ge ?? c.allConnectionsCount_GE ?? -1),
        Number(c.conn_le ?? c.allConnectionsCount_LE ?? -1),
        Number(c.parents_ge ?? c.parentsCount_GE ?? -1),
        Number(c.parents_le ?? c.parentsCount_LE ?? -1),
        );
        const op = new Operation(mapOperationKind(String(o.kind)), toNodeStateFlex(o.operand));
        machine.addRuleItem({ condition: cond, operation: op, isActive: false, isEnabled: true, lastActivationInterationIndex: -1, isActiveInNodes: [] });
    }

  
    // 6) sync maintain-single-component
    (machine as any).setMaintainSingleComponent?.(mc.maintain_single_component ?? true);
    return machine;
  }
