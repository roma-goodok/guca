import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState, MachineCfg } from '../gum';

test('enforceSingleComponent keeps component with oldest node (min parentsCount)', () => {
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
  // Component 1 (older)
  const n1 = new GUMNode(1, NodeState.A); n1.parentsCount = 0;
  const n2 = new GUMNode(2, NodeState.B); n2.parentsCount = 1;
  g.addNode(n1); g.addNode(n2); g.addEdge(n1, n2);

  // Component 2 (newer)
  const n3 = new GUMNode(3, NodeState.C); n3.parentsCount = 5;
  const n4 = new GUMNode(4, NodeState.D); n4.parentsCount = 6;
  g.addNode(n3); g.addNode(n4); g.addEdge(n3, n4);

  const m = new GraphUnfoldingMachine(g, cfg);
  m.enforceSingleComponentIfEnabled();

  const ids = g.getNodes().map(n => n.id).sort((a,b)=>a-b);
  expect(ids).toEqual([1,2]); // newer component removed
});
