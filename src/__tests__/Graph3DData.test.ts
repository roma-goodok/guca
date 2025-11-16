// src/__tests__/Graph3DData.test.ts
import { GUMGraph, GUMNode, NodeState } from '../gum';
import { buildGraphDataFromGum } from '../graphData';

test('buildGraphDataFromGum maps nodes and edges correctly', () => {
  const g = new GUMGraph();

  const a = new GUMNode(1, NodeState.A);
  const b = new GUMNode(2, NodeState.B);
  g.addNode(a);
  g.addNode(b);
  g.addEdge(a, b);

  const data = buildGraphDataFromGum(g);

  // nodes preserved with correct ids and states
  expect(data.nodes).toEqual(
    expect.arrayContaining([
      { id: 1, state: NodeState.A },
      { id: 2, state: NodeState.B },
    ])
  );

  // edges preserved up to undirected symmetry
  const undirected = data.links.map(l =>
    [Math.min(l.source, l.target), Math.max(l.source, l.target)]
  );
  expect(undirected).toContainEqual([1, 2]);
});
