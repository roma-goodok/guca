import { GraphUnfoldingMachine, GUMGraph, GUMNode, NodeState } from '../gum';

describe('GraphUnfoldingMachine', () => {
  let gumGraph: GUMGraph;
  let graphUnfoldingMachine: GraphUnfoldingMachine;

  beforeEach(() => {
    gumGraph = new GUMGraph();
    graphUnfoldingMachine = new GraphUnfoldingMachine(gumGraph);
  });

  it('should find the nearest node with state B that is not directly connected to A/1', () => {
    // Create nodes
    const nodeA = new GUMNode(1, NodeState["A"]);
    gumGraph.addNode(nodeA);

    const nodeB2 = new GUMNode(2, NodeState["B"]);
    gumGraph.addNode(nodeB2);

    const nodeB3 = new GUMNode(3, NodeState["B"]);
    gumGraph.addNode(nodeB3);

    const nodeB4 = new GUMNode(4, NodeState["B"]);
    gumGraph.addNode(nodeB4);

    // Create edges
    gumGraph.addEdge(nodeA, nodeB2);
    gumGraph.addEdge(nodeB2, nodeB4);
    gumGraph.addEdge(nodeB3, nodeB4);

    // Find nearest node with state B that is not directly connected to A/1
    const nearestNode = graphUnfoldingMachine['findNearest'](nodeA, NodeState["B"]);

    // Check result
    expect(nearestNode).toBe(nodeB4);
  });
});