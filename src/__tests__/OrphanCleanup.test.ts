import { GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState, MachineCfg } from '../gum';

function makeMachine(g: GUMGraph, ocEnabled = true): GraphUnfoldingMachine {
  const cfg: MachineCfg = {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: -1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
    maintain_single_component: false,
    orphan_cleanup: {
      enabled: ocEnabled,
      thresholds: { size1: 5, size2: 7, others: 10 },
      fadeStarts: { size1: 3, size2: 5, others: 8 },
    },
  };
  return new GraphUnfoldingMachine(g, cfg);
}

test('orphan subgraphs fade then delete at thresholds (size1=5, size2=7)', () => {
  const g = new GUMGraph();

  // Primary component (older)
  const p1 = new GUMNode(1, NodeState.A); p1.parentsCount = 0;
  const p2 = new GUMNode(2, NodeState.B); p2.parentsCount = 1;
  g.addNode(p1); g.addNode(p2); g.addEdge(p1, p2);

  // Orphan size-1
  const s1 = new GUMNode(3, NodeState.C); s1.parentsCount = 10;
  g.addNode(s1);

  // Orphan size-2
  const t1 = new GUMNode(4, NodeState.D); t1.parentsCount = 6;
  const t2 = new GUMNode(5, NodeState.E); t2.parentsCount = 7;
  g.addNode(t1); g.addNode(t2); g.addEdge(t1, t2);

  const m = makeMachine(g, true);

  // Step 1..2: no fade yet
  m.runOneStep(); m.runOneStep();
  expect(g.getNodeById(3)?.fade ?? 0).toBe(0);
  expect(g.getNodeById(4)?.fade ?? 0).toBe(0);

  // Step 3: size-1 starts fading
  m.runOneStep();
  expect((g.getNodeById(3)?.fade ?? 0)).toBeGreaterThan(0);

  // Step 5: size-1 deleted, size-2 starts fading (at 5)
  m.runOneStep(); m.runOneStep(); // steps 4,5
  expect(g.getNodeById(3)).toBeUndefined();
  expect((g.getNodeById(4)?.fade ?? 0)).toBeGreaterThan(0);
  expect(g.getNodeById(4)).toBeDefined();
  expect(g.getNodeById(5)).toBeDefined();

  // Step 7: size-2 deleted
  m.runOneStep(); m.runOneStep(); // steps 6,7
  expect(g.getNodeById(4)).toBeUndefined();
  expect(g.getNodeById(5)).toBeUndefined();

  // Primary component remains
  expect(g.getNodeById(1)).toBeDefined();
  expect(g.getNodeById(2)).toBeDefined();
});

test('re-attaching to primary resets orphanAge and fade', () => {
  const g = new GUMGraph();

  const p1 = new GUMNode(1, NodeState.A); p1.parentsCount = 0;
  const p2 = new GUMNode(2, NodeState.B); p2.parentsCount = 1;
  g.addNode(p1); g.addNode(p2); g.addEdge(p1, p2);

  const s1 = new GUMNode(3, NodeState.C); s1.parentsCount = 10;
  g.addNode(s1);

  const m = makeMachine(g, true);

  // Accumulate some orphan age & fade
  m.runOneStep(); m.runOneStep(); m.runOneStep();
  const beforeFade = g.getNodeById(3)?.fade ?? 0;
  expect(beforeFade).toBeGreaterThanOrEqual(0);

  // Re-attach to primary; next step should reset orphanAge/fade
  g.addEdge(s1, p1);
  m.runOneStep();

  expect(g.getNodeById(3)?.fade ?? 1).toBe(0);
  expect(g.getNodeById(3)).toBeDefined();
});
