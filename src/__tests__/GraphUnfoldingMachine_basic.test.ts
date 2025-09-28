import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState, MachineCfg } from '../gum';

describe('GraphUnfoldingMachine', () => {
  let gumGraph: GUMGraph;
  let graphUnfoldingMachine: GraphUnfoldingMachine;

  beforeEach(() => {
    gumGraph = new GUMGraph();

    const cfg: MachineCfg = {
      start_state: NodeState.A,
      transcription: 'resettable',
      count_compare: 'range',
      max_vertices: 0,          // 0 = unlimited
      max_steps: 1,             // small; just need a snapshot step
      rng_seed: 123,
      nearest_search: {
        max_depth: 3,
        tie_breaker: 'stable',  // pick min-id among candidates at first depth
        connect_all: false,
      },
    };

    graphUnfoldingMachine = new GraphUnfoldingMachine(gumGraph, cfg);
  });

  it('should connect to the nearest node with state B that is not directly connected to A/1', () => {
    // Create nodes
    const nodeA  = new GUMNode(1, NodeState.A);
    const nodeB2 = new GUMNode(2, NodeState.B);
    const nodeB3 = new GUMNode(3, NodeState.B);
    const nodeB4 = new GUMNode(4, NodeState.B);

    gumGraph.addNode(nodeA);
    gumGraph.addNode(nodeB2);
    gumGraph.addNode(nodeB3);
    gumGraph.addNode(nodeB4);

    // Create edges: A—B2, B2—B4, B3—B4
    gumGraph.addEdge(nodeA,  nodeB2);
    gumGraph.addEdge(nodeB2, nodeB4);
    gumGraph.addEdge(nodeB3, nodeB4);

    // Produce snapshots (saved_state/degree/parents) like a real step
    graphUnfoldingMachine.runOneStep();

    // Invoke nearest connection (public API). Eligibility excludes directly-adjacent nodes,
    // so A should connect to B4 (depth 2), not B2 (depth 1 but adjacent).
    graphUnfoldingMachine.tryToConnectWithNearest(nodeA, NodeState.B);

    // Assert the expected new connection exists
    expect(gumGraph.areNodesConnected(nodeA, nodeB4)).toBe(true);
  });
});
