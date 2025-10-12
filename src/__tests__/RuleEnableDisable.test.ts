import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState, MachineCfg, OperationCondition, Operation, OperationKindEnum } from '../gum';

function makeMachine(): GraphUnfoldingMachine {
  const cfg: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: 1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
    maintain_single_component: true,
  };
  const g = new GUMGraph();
  g.addNode(new GUMNode(g.allocateNodeId(), NodeState.A));
  return new GraphUnfoldingMachine(g, cfg);
}

test('disabled rule is skipped; next matching rule runs', () => {
  // Two rules that both match A:
  // r1: TurnToState C
  // r2: GiveBirthConnected B
  const m1 = makeMachine();
  m1.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Ignored, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.TurnToState, NodeState.C),
    isActive:false, isEnabled:true, lastActivationInterationIndex:-1, isActiveInNodes:[]
  });
  m1.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Ignored, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.GiveBirthConnected, NodeState.B),
    isActive:false, isEnabled:true, lastActivationInterationIndex:-1, isActiveInNodes:[]
  });

  // Case 1: both enabled → first wins, node turns to C, no new nodes.
  m1.runOneStep();
  expect(m1['graph'].getNodes().length).toBe(1);

  // Case 2: disable first, rebuild fresh.
  const m2 = makeMachine();
  m2.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Ignored, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.TurnToState, NodeState.C),
    isActive:false, isEnabled:false, lastActivationInterationIndex:-1, isActiveInNodes:[]
  });
  m2.addRuleItem({
    condition: new OperationCondition(NodeState.A, NodeState.Ignored, -1, -1, -1, -1),
    operation: new Operation(OperationKindEnum.GiveBirthConnected, NodeState.B),
    isActive:false, isEnabled:true, lastActivationInterationIndex:-1, isActiveInNodes:[]
  });
  m2.runOneStep();
  expect(m2['graph'].getNodes().length).toBe(2);  // second rule executed
});
