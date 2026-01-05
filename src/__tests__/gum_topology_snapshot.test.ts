import {
  GUMGraph, GUMNode, GraphUnfoldingMachine,
  NodeState, MachineCfg,
  RuleItem, OperationCondition, Operation, OperationKindEnum
} from '../gum';

function makeCfg(partial?: Partial<MachineCfg>): MachineCfg {
  return {
    start_state: NodeState.A,
    transcription: 'continuable',
    count_compare: 'range',
    max_vertices: 200,
    max_steps: -1,
    rng_seed: 123,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: true },
    maintain_single_component: false,
    orphan_cleanup: { enabled: false },
    reseed_isolated_A: true,
    ...(partial ?? {}),
  };
}

test('TryToConnectWithNearest uses step-start topology (no intra-step shortcut eligibility)', () => {
  const g = new GUMGraph();
  const m = new GraphUnfoldingMachine(g, makeCfg());

  // Rule 1: A(prior Unknown, parents<=2) => birth connected A
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.A, NodeState.Unknown, -1, -1, -1, 2),
    new Operation(OperationKindEnum.GiveBirthConnected, NodeState.A),
  ));

  // Rule 2: A(prior A, parents in [1..2]) => turn to B
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.A, NodeState.A, -1, -1, 1, 2),
    new Operation(OperationKindEnum.TurnToState, NodeState.B),
  ));

  // Rule 3: B(prior A) => connect nearest A (depth=2, connect_all=true)
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.B, NodeState.A),
    new Operation(OperationKindEnum.TryToConnectWithNearest, NodeState.A),
  ));

  // Rule 4: A(prior Unknown, parents==3) => connect nearest A (should NOT fire within depth 2)
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.A, NodeState.Unknown, -1, -1, 3, 3),
    new Operation(OperationKindEnum.TryToConnectWithNearest, NodeState.A),
  ));

  // Steps 1..4
  m.runOneStep();
  m.runOneStep();
  m.runOneStep();
  m.runOneStep();

  const n1 = g.getNodeById(1)!;
  const n4 = g.getNodeById(4)!;

  // Node 4 must NOT connect to node 1 within the same step due to shortcut edges created earlier that step.
  expect(g.areNodesConnected(n1, n4)).toBe(false);

  // Sanity: node 2 should have connected to node 4 at step 4.
  const n2 = g.getNodeById(2)!;
  expect(g.areNodesConnected(n2, n4)).toBe(true);
});

test('DisconnectFrom only considers step-start neighbors (does not remove same-step newly created edges)', () => {
  const g = new GUMGraph();
  const n1 = new GUMNode(1, NodeState.B);
  const n2 = new GUMNode(2, NodeState.A);
  const n3 = new GUMNode(3, NodeState.C);

  g.addNode(n1); g.addNode(n2); g.addNode(n3);
  g.addEdge(n1, n3);
  g.addEdge(n3, n2);

  const m = new GraphUnfoldingMachine(g, makeCfg({
    transcription: 'resettable',
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
  }));

  // Node1: connect nearest A (should create edge 1-2 through 3)
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.B, NodeState.Unknown),
    new Operation(OperationKindEnum.TryToConnectWithNearest, NodeState.A),
  ));

  // Node2: disconnect from B (should NOT remove edge 1-2 created earlier this same step)
  m.addRuleItem(new RuleItem(
    new OperationCondition(NodeState.A, NodeState.Ignored),
    new Operation(OperationKindEnum.DisconnectFrom, NodeState.B),
  ));

  m.runOneStep();

  expect(g.areNodesConnected(n1, n2)).toBe(true);
});
