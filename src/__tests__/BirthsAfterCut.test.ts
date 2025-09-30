import yaml from 'js-yaml';
import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState, MachineCfg, OperationCondition, Operation } from '../gum';
import { mapNodeState, mapOperationKind } from '../utils';

test('GiveBirthConnected-only genome: after a cut, next step only adds one edge per new node', () => {
  const cfg: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: 999,
    rng_seed: 1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
    maintain_single_component: true,
  };

  // two-rule genome (from the report)
  const rules = [
    { condition: { current: 'A', prior: 'Unknown', conn_ge: -1, conn_le: -1, parents_ge: -1, parents_le: 5 }, op: { kind: 'GiveBirthConnected', operand: 'A' } },
    { condition: { current: 'A', prior: 'A',       conn_ge: -1, conn_le:  2, parents_ge: -1, parents_le: 4 }, op: { kind: 'GiveBirthConnected', operand: 'A' } },
  ];

  const g = new GUMGraph();
  const m = new GraphUnfoldingMachine(g, cfg);
  g.addNode(new GUMNode(g.allocateNodeId(), NodeState.A));

  for (const r of rules) {
    const c = r.condition, o = r.op;
    m.addRuleItem({
      condition: new OperationCondition(
        mapNodeState(c.current), mapNodeState(c.prior),
        c.conn_ge, c.conn_le, c.parents_ge, c.parents_le
      ),
      operation: new Operation(mapOperationKind(o.kind), mapNodeState(o.operand)),
      isActive: false, isEnabled: true, lastActivationInterationIndex: -1, isActiveInNodes: []
    });
  }

  // Build a small structure
  m.runOneStep(); // step 1
  m.runOneStep(); // step 2
  m.runOneStep(); // step 3

  const beforeCutNodes = g.getNodes().length;
  const beforeCutEdges = g.getEdges().length;

  // Cut: remove one leaf edge (if any); then enforce single component to mimic the UI behavior
  const anyEdge = g.getEdges()[g.getEdges().length - 1];
  if (anyEdge) {
    g.removeEdge(anyEdge.source, anyEdge.target);
  }
  (m as any).enforceSingleComponentIfEnabled?.();

  const preStepNodes = g.getNodes().length;
  const preStepEdges = g.getEdges().length;

  // Next step: with GiveBirthConnected only, edges added == nodes added
  m.runOneStep();

  const postNodes = g.getNodes().length;
  const postEdges = g.getEdges().length;

  const deltaNodes = postNodes - preStepNodes;
  const deltaEdges = postEdges - preStepEdges;

  expect(deltaEdges).toBe(deltaNodes);
  // Also sanity: nothing exploded into star-like connections
  expect(deltaEdges).toBeGreaterThanOrEqual(0);
});
