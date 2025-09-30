import fs from 'fs';
import yaml from 'js-yaml';
import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState, MachineCfg } from '../gum';
import { mapOperationKind, mapNodeState } from '../utils';

function loadYaml(p: string) { return yaml.load(fs.readFileSync(p, 'utf8')) as any; }

test('dumbbell.yaml reproduces expected nodes/edges/states after 120 steps', () => {
  const cfg = loadYaml('data/genoms/dumbbell.yaml');

  const mc: MachineCfg = {
    start_state: NodeState.A,
    transcription: (cfg.machine.transcription ?? 'resettable'),
    count_compare: (cfg.machine.count_compare ?? 'range'),
    max_vertices: cfg.machine.max_vertices ?? 2000,
    max_steps: cfg.machine.max_steps ?? 120,
    rng_seed: cfg.machine.rng_seed,
    nearest_search: {
      max_depth: cfg.machine.nearest_search?.max_depth ?? 2,
      tie_breaker: cfg.machine.nearest_search?.tie_breaker ?? 'stable',
      connect_all: cfg.machine.nearest_search?.connect_all ?? false
    }
  } as any;

  const g = new GUMGraph();
  const m = new GraphUnfoldingMachine(g, mc);

  // init_graph
  g.addNode(new GUMNode(1, NodeState.A));

  // rules
  for (const r of cfg.rules) {
    const c = r.condition, o = r.op;
    m.addRuleItem({
      condition: new (require('../gum').OperationCondition)(
        mapNodeState(c.current), mapNodeState(c.prior ?? 'any'),
        c.conn_ge ?? c.allConnectionsCount_GE ?? -1, c.conn_le ?? c.allConnectionsCount_LE ?? -1,
        c.parents_ge ?? c.parentsCount_GE ?? -1, c.parents_le ?? c.parentsCount_LE ?? -1),
      operation: new (require('../gum').Operation)(mapOperationKind(o.kind), mapNodeState(o.operand)),
      isActive:false, isEnabled:true, lastActivationInterationIndex:-1, isActiveInNodes:[]
    });
  }

  // run
  m.runUntilStop();

  const nodes = g.getNodes();
  const edges = g.getEdges();
  const states = nodes.reduce((acc:any,n)=>{const k=NodeState[n.state]; acc[k]=(acc[k]??0)+1; return acc;},{});

  expect(nodes.length).toBe(cfg.expected.nodes);
  expect(edges.length).toBe(cfg.expected.edges);
  for (const [k,v] of Object.entries(cfg.expected.states_count)) {
    expect(states[k]).toBe(v);
  }
});
