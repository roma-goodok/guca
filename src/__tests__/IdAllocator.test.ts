import { GUMGraph, GUMNode, NodeState } from '../gum';

test('allocateNodeId() is monotonic and never reuses existing ids', () => {
  const g = new GUMGraph();
  g.addNode(new GUMNode(1, NodeState.A));
  g.addNode(new GUMNode(3, NodeState.B)); // hole at id=2 on purpose
  g.addNode(new GUMNode(10, NodeState.C));

  const id1 = g.allocateNodeId();
  const id2 = g.allocateNodeId();

  expect(id1).toBe(11); // next after the max existing id
  expect(id2).toBe(12);
});
