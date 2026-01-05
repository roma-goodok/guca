// src/__tests__/AdvancedOneStep.test.ts
import yaml from 'js-yaml';
import {
  GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState,
  MachineCfg, OperationCondition, Operation
} from '../gum';
import { mapNodeState, mapOperationKind } from '../utils';

function buildGraphFromSpec(
  nodes_list: Record<number, { state: string; rule_index: number; parents_count: number; prior_state?: string }>,
  edge_list: number[][]
): GUMGraph {
  const g = new GUMGraph();

  // Create nodes with exact ids and attributes
  const ids = Object.keys(nodes_list).map(n => parseInt(n, 10)).sort((a, b) => a - b);
  for (const id of ids) {
    const spec = nodes_list[id];
    const n = new GUMNode(id, mapNodeState(spec.state));
    n.parentsCount = spec.parents_count ?? 0;
    n.ruleIndex = spec.rule_index ?? 0;
    n.priorState = mapNodeState(spec.prior_state ?? spec.state); // default prior = current if not given
    n.markedNew = false;
    g.addNode(n);
  }

  // Add edges
  for (const [u, v] of edge_list) {
    const nu = g.getNodeById(u);
    const nv = g.getNodeById(v);
    if (!nu || !nv) throw new Error(`Bad edge (${u}, ${v})`);
    g.addEdge(nu, nv);
  }
  return g;
}

function installRules(m: GraphUnfoldingMachine, rules: Array<any>) {
  m.clearRuleTable();
  for (const r of rules) {
    const c = r.condition, o = r.op;
    const cond = new OperationCondition(
      mapNodeState(c.current),
      mapNodeState(c.prior ?? 'any'),
      Number(c.conn_ge ?? -1),
      Number(c.conn_le ?? -1),
      Number(c.parents_ge ?? -1),
      Number(c.parents_le ?? -1),
    );
    const op = new Operation(mapOperationKind(String(o.kind)), mapNodeState(o.operand));
    m.addRuleItem({ condition: cond, operation: op, isActive: false, isEnabled: true, lastActivationInterationIndex: -1, isActiveInNodes: [] });
  }
}

function summarize(g: GUMGraph) {
  const nodes = g.getNodes();
  const edges = g.getEdges()
    .map(e => [Math.min(e.source.id, e.target.id), Math.max(e.source.id, e.target.id)])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

  const states_count: Record<string, number> = {};
  for (const n of nodes) {
    const key = String(NodeState[n.state]);
    states_count[key] = (states_count[key] ?? 0) + 1;
  }

  const nodes_list: Record<number, { state: string; rule_index: number; parents_count: number }> = {};
  for (const n of nodes.sort((a, b) => a.id - b.id)) {
    nodes_list[n.id] = {
      state: String(NodeState[n.state]),
      rule_index: n.ruleIndex,
      parents_count: n.parentsCount,
    };
  }

  return {
    graph_summary: {
      nodes: nodes.length,
      edges: edges.length,
      states_count,
      edge_list: edges,
      nodes_list,
    }
  };
}

test('advanced one-step (continuable + connect_all nearest + pre-seeded graph)', () => {
  // --- Rules from the prompt ---
  const rules = [
    { condition: { current: 'A', prior: 'A', conn_ge: 0, conn_le: 2, parents_ge: 0, parents_le: 0 }, op: { kind: 'GiveBirthConnected', operand: 'A' } },
    { condition: { current: 'A', prior: 'A', conn_ge: 0, conn_le: 5, parents_ge: 0, parents_le: 5 }, op: { kind: 'TurnToState', operand: 'F' } },
    { condition: { current: 'F', prior: 'F', conn_ge: 0, conn_le: 6, parents_ge: 0, parents_le: 1 }, op: { kind: 'TurnToState', operand: 'A' } },
    { condition: { current: 'A', prior: 'A', conn_ge: 3, conn_le: 3, parents_ge: 1, parents_le: 7 }, op: { kind: 'TurnToState', operand: 'G' } },
    { condition: { current: 'F', prior: 'A', conn_ge: 2, conn_le: 8, parents_ge: 0, parents_le: 11 }, op: { kind: 'TryToConnectWithNearest', operand: 'A' } },
    { condition: { current: 'A', prior: 'F', conn_ge: 0, conn_le: 1, parents_ge: 0, parents_le: 10 }, op: { kind: 'GiveBirthConnected', operand: 'A' } },
    { condition: { current: 'G', prior: 'G', conn_ge: 1, conn_le: 5, parents_ge: 0, parents_le: 11 }, op: { kind: 'TurnToState', operand: 'A' } },
    { condition: { current: 'G', prior: 'A', conn_ge: 0, conn_le: 3, parents_ge: 1, parents_le: 8 }, op: { kind: 'GiveBirthConnected', operand: 'A' } },
    { condition: { current: 'A', prior: 'F', conn_ge: 5, conn_le: 13, parents_ge: 0, parents_le: 7 }, op: { kind: 'DisconnectFrom', operand: 'A' } },
  ];

  // --- Initial edges from the prompt ---
  const edge_list = [
    [0,3],[0,4],[0,5],[0,6],
    [1,3],[1,4],[1,6],[1,7],
    [2,3],[2,5],[2,6],[2,8],
    [3,6],[3,7],[3,8],
  ];

  // --- Initial nodes from the prompt (+ prior_state choices as in the Python example) ---
  const nodes_list = {
    0: { state: 'A', rule_index: 3, parents_count: 0, prior_state: 'A' },
    1: { state: 'A', rule_index: 7, parents_count: 1, prior_state: 'A' },
    2: { state: 'A', rule_index: 7, parents_count: 1, prior_state: 'A' },
    3: { state: 'A', rule_index: 3, parents_count: 1, prior_state: 'F' }, // so it triggers DisconnectFrom A (rule #9)
    4: { state: 'F', rule_index: 5, parents_count: 2, prior_state: 'A' },
    5: { state: 'F', rule_index: 5, parents_count: 2, prior_state: 'A' },
    6: { state: 'F', rule_index: 5, parents_count: 2, prior_state: 'A' },
    7: { state: 'F', rule_index: 2, parents_count: 2, prior_state: 'F' },
    8: { state: 'F', rule_index: 2, parents_count: 2, prior_state: 'A' },
  };

  const g = buildGraphFromSpec(nodes_list, edge_list);

  // Machine config (continuable + connect_all + no single-component + orphan cleanup enabled)
  const mc: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'continuable',
    count_compare: 'range',
    max_vertices: 300,
    max_steps: -1,
    rng_seed: 42,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: true },
    maintain_single_component: false,
    topology_semantics: 'live',
    orphan_cleanup: {
      enabled: true,
      thresholds: { size1: 10, size2: 14, others: 20 },
      fadeStarts: { size1: 3, size2: 5, others: 8 },
    },

  } as any;

  const m = new GraphUnfoldingMachine(g, mc);
  installRules(m, rules);

  // Exactly one step
  m.runOneStep();

  // Summary + YAML output (visible in Jest logs)
  const result = summarize(g);
  // eslint-disable-next-line no-console
  console.log(yaml.dump(result, { lineWidth: 130 }));

  const edgesAfter: Array<[number, number]> = result.graph_summary.edge_list as any;

  // Core assertions from the expected outcome
  expect(result.graph_summary.nodes).toBe(9);
  expect(result.graph_summary.edges).toBe(12);
  expect(result.graph_summary.states_count.F).toBe(8);
  expect(result.graph_summary.states_count.A).toBe(1);

  // The three A-A edges from node 3 must be gone
  expect(edgesAfter).not.toContainEqual([0, 3]);
  expect(edgesAfter).not.toContainEqual([1, 3]);
  expect(edgesAfter).not.toContainEqual([2, 3]);

  // Exact edge set match
const expectedEdges: Array<[number, number]> = ([
  [0,4],[0,5],[0,6],
  [1,4],[1,6],[1,7],
  [2,5],[2,6],[2,8],
  [3,6],[3,7],[3,8],
] as [number, number][])
  .sort((a,b)=>(a[0]-b[0])||(a[1]-b[1]));
  expect(edgesAfter).toEqual(expectedEdges);

  const nodesAfter = result.graph_summary.nodes_list as Record<string, { state: string; rule_index: number; parents_count: number }>;
  // Node 3 wrapped rule_index to 0
  expect(nodesAfter['3'].rule_index).toBe(0);
  // Nodes 0,1,2 turned F and advanced to rule_index 2
  [0,1,2].forEach(i => {
    expect(nodesAfter[String(i)].state).toBe('F');
    expect(nodesAfter[String(i)].rule_index).toBe(2);
  });
});
