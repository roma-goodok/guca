// src/__tests__/ConnWithStateCondition.test.ts
import {
  GraphUnfoldingMachine,
  GUMGraph,
  GUMNode,
  NodeState,
  MachineCfg,
  OperationCondition,
  Operation,
  OperationKindEnum,
} from '../gum';

test('conn_with_state counts neighbors by saved state (snapshot semantics)', () => {
  const cfg: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: 1,
    rng_seed: 1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
  };

  const g = new GUMGraph();
  const n1 = new GUMNode(1, NodeState.A);
  const n2 = new GUMNode(2, NodeState.B);
  g.addNode(n1);
  g.addNode(n2);
  g.addEdge(n1, n2);

  const m = new GraphUnfoldingMachine(g, cfg);
  m.clearRuleTable();

  // Node 1: A with (B)>=1 -> D
  m.addRuleItem({
    condition: new OperationCondition(
      NodeState.A, NodeState.Ignored,
      1, -1, -1, -1,
      NodeState.B
    ),
    operation: new Operation(OperationKindEnum.TurnToState, NodeState.D),
    isActive: false, isEnabled: true, lastActivationInterationIndex: -1, isActiveInNodes: [],
  } as any);

  // Node 2: B with (A)>=1 -> E
  // Must still match even though node 1 changed to D earlier in the step.
  m.addRuleItem({
    condition: new OperationCondition(
      NodeState.B, NodeState.Ignored,
      1, -1, -1, -1,
      NodeState.A
    ),
    operation: new Operation(OperationKindEnum.TurnToState, NodeState.E),
    isActive: false, isEnabled: true, lastActivationInterationIndex: -1, isActiveInNodes: [],
  } as any);

  m.runOneStep();

  expect(g.getNodeById(1)?.state).toBe(NodeState.D);
  expect(g.getNodeById(2)?.state).toBe(NodeState.E);
});
