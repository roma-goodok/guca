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

test('GiveBirthConnected sets bornFromId on the newborn', () => {
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
  g.addNode(new GUMNode(1, NodeState.A));

  const m = new GraphUnfoldingMachine(g, cfg);
  m.clearRuleTable();

  // A(Unknown) -> GiveBirthConnected A
  m.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Unknown, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.GiveBirthConnected, NodeState.A),
    isActive: false,
    isEnabled: true,
    lastActivationInterationIndex: -1,
    isActiveInNodes: [],
  } as any);

  m.runOneStep();

  const nodes = g.getNodes().sort((a, b) => a.id - b.id);
  expect(nodes.length).toBe(2);

  const parent = nodes[0];
  const child = nodes[1];

  expect(child.bornFromId).toBe(parent.id);
  expect(g.areNodesConnected(parent, child)).toBe(true);
});

test('GiveBirth sets bornFromId on the newborn (even without an edge)', () => {
  const cfg: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: 1,
    rng_seed: 1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
    maintain_single_component: false,
    orphan_cleanup: { enabled: false },
  };

  const g = new GUMGraph();
  g.addNode(new GUMNode(1, NodeState.A));

  const m = new GraphUnfoldingMachine(g, cfg);
  m.clearRuleTable();

  // A(Unknown) -> GiveBirth A
  m.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Unknown, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.GiveBirth, NodeState.A),
    isActive: false,
    isEnabled: true,
    lastActivationInterationIndex: -1,
    isActiveInNodes: [],
  } as any);

  m.runOneStep();

  const nodes = g.getNodes().sort((a, b) => a.id - b.id);
  expect(nodes.length).toBe(2);

  const parent = nodes[0];
  const child = nodes[1];

  expect(child.bornFromId).toBe(parent.id);
  expect(g.getEdges().length).toBe(0);
});
