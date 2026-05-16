import { GUMGraph, NodeState, OperationKindEnum } from '../gum';
import { buildMachineFromConfig } from '../genomeLoader';

test('buildMachineFromConfig defaults max_vertices=200 and nearest_search.max_depth=2 when absent', () => {
  const g = new GUMGraph();
  const cfg = { rules: [] };
  const m = buildMachineFromConfig(cfg, g, true);

  expect(m.getMaxVertices()).toBe(2000);

  const ns = (m as any).getNearestSearchCfg?.();
  expect(ns?.max_depth).toBe(2);
});

test('buildMachineFromConfig respects YAML machine.max_vertices and nearest_search.max_depth', () => {
  const g = new GUMGraph();
  const cfg = {
    machine: { max_vertices: 321, nearest_search: { max_depth: 5, tie_breaker: 'stable', connect_all: false } },
    rules: []
  };
  const m = buildMachineFromConfig(cfg, g, true);

  expect(m.getMaxVertices()).toBe(321);

  const ns = (m as any).getNearestSearchCfg?.();
  expect(ns?.max_depth).toBe(5);
});

test('buildMachineFromConfig rejects invalid node state tokens with a clear error', () => {
  const g = new GUMGraph();
  const cfg = {
    init_graph: { nodes: [{ state: 'NotAState' }] },
    rules: []
  };

  expect(() => buildMachineFromConfig(cfg, g, true)).toThrow(/Unknown node state: NotAState/);
});

test('buildMachineFromConfig accepts valid numeric enum states', () => {
  const g = new GUMGraph();
  const cfg = {
    init_graph: {
      nodes: [
        { id: 1, state: NodeState.A, prior_state: NodeState.Unknown },
        { id: 2, state: NodeState.B }
      ],
      edges: [[1, 2]]
    },
    rules: [
      {
        condition: { current: NodeState.A, prior: NodeState.Unknown, conn_with_state: NodeState.B, conn_ge: 1 },
        op: { kind: 'TurnToState', operand: NodeState.C }
      }
    ]
  };

  const m = buildMachineFromConfig(cfg, g, true);

  expect(g.getNodeById(1)?.state).toBe(NodeState.A);
  expect(g.getNodeById(2)?.state).toBe(NodeState.B);
  expect(g.getEdges()).toHaveLength(1);
  expect(m.getRuleItems()[0].condition.allConnectionsWithState).toBe(NodeState.B);
  expect(m.getRuleItems()[0].operation.operandNodeState).toBe(NodeState.C);
});

test('buildMachineFromConfig supports legacy DisconectFrom, conn_with_state, and init_graph.edges', () => {
  const g = new GUMGraph();
  const cfg = {
    machine: { maintain_single_component: false },
    init_graph: {
      nodes: [
        { id: 1, state: 'A' },
        { id: 2, state: 'B' }
      ],
      edges: [{ source: 1, target: 2 }]
    },
    rules: [
      {
        condition: { current: 'A', prior: 'Unknown', conn_with_state: 'B', conn_ge: 1 },
        op: { kind: 'DisconectFrom', operand: 'B' }
      }
    ]
  };

  const m = buildMachineFromConfig(cfg, g, false);

  expect(g.getEdges()).toHaveLength(1);
  expect(m.getRuleItems()[0].condition.allConnectionsWithState).toBe(NodeState.B);
  expect(m.getRuleItems()[0].operation.kind).toBe(OperationKindEnum.DisconnectFrom);

  m.runOneStep();
  expect(g.getEdges()).toHaveLength(0);
});
