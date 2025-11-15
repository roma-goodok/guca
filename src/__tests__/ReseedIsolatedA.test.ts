// src/__tests__/ReseedIsolatedA.test.ts
import { GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState, MachineCfg } from '../gum';

function makeGraphWithIsolatedA() {
  const g = new GUMGraph();

  // Primary component (A-B)
  const n1 = new GUMNode(1, NodeState.A); n1.parentsCount = 0;
  const n2 = new GUMNode(2, NodeState.B); n2.parentsCount = 1;
  g.addNode(n1); g.addNode(n2); g.addEdge(n1, n2);

  // Isolated A node that should be “sprung off”
  const iso = new GUMNode(3, NodeState.A);
  iso.parentsCount = 5;
  iso.priorState = NodeState.F;
  g.addNode(iso);

  return { g, isolatedId: iso.id };
}

function makeCfg(overrides: Partial<MachineCfg>): MachineCfg {
  return {
    start_state: NodeState.A,
    transcription: 'resettable',
    count_compare: 'range',
    max_vertices: 0,
    max_steps: 5,
    rng_seed: 1,
    nearest_search: { max_depth: 2, tie_breaker: 'stable', connect_all: false },
    ...overrides,
  } as MachineCfg;
}

test('isolated A node is reseeded when feature is on and both other knobs are off', () => {
  const { g, isolatedId } = makeGraphWithIsolatedA();
  const cfg = makeCfg({
    maintain_single_component: false,
    orphan_cleanup: { enabled: false },
    reseed_isolated_A: true,
  });

  const m = new GraphUnfoldingMachine(g, cfg);
  m.runOneStep();

  const iso = g.getNodeById(isolatedId)!;
  expect(iso.parentsCount).toBe(0);
  expect(iso.priorState).toBe(NodeState.Unknown);
});

test('reseed_isolated_A is gated when maintain_single_component is true', () => {
  const { g, isolatedId } = makeGraphWithIsolatedA();
  const cfg = makeCfg({
    maintain_single_component: true,
    orphan_cleanup: { enabled: false },
    reseed_isolated_A: true,
  });

  const m = new GraphUnfoldingMachine(g, cfg);
  m.runOneStep();

  // Isolated component is pruned by enforceSingleComponentIfEnabled
  const iso = g.getNodeById(isolatedId);
  expect(iso).toBeUndefined();

  const ids = g.getNodes().map(n => n.id).sort((a,b)=>a-b);
  expect(ids).toEqual([1,2]); // primary component kept
});


test('reseed_isolated_A is gated when orphan_cleanup is enabled', () => {
  const { g, isolatedId } = makeGraphWithIsolatedA();
  const cfg = makeCfg({
    maintain_single_component: false,
    orphan_cleanup: { enabled: true },
    reseed_isolated_A: true,
  });

  const m = new GraphUnfoldingMachine(g, cfg);
  m.runOneStep();

  const iso = g.getNodeById(isolatedId)!;
  expect(iso.parentsCount).toBe(5);
  expect(iso.priorState).toBe(NodeState.A);
});

test('reseed_isolated_A = false leaves isolated A nodes unchanged', () => {
  const { g, isolatedId } = makeGraphWithIsolatedA();
  const cfg = makeCfg({
    maintain_single_component: false,
    orphan_cleanup: { enabled: false },
    reseed_isolated_A: false,
  });

  const m = new GraphUnfoldingMachine(g, cfg);
  m.runOneStep();

  const iso = g.getNodeById(isolatedId)!;
  expect(iso.parentsCount).toBe(5);
  expect(iso.priorState).toBe(NodeState.A);
});
