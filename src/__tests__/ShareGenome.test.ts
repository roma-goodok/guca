// src/__tests__/ShareGenome.test.ts
import { encodeGenomeToUrlToken, parseGenomeFromUrlHash } from '../shareGenome';

test('shared genome roundtrip works with URI-encoded #g= token', () => {
  const cfg = {
  machine: {
    start_state: 'A',
    max_steps: 120,
    nearest_search: { max_depth: 4, tie_breaker: 'stable', connect_all: false },
    max_vertices: 200,
  },
  init_graph: { nodes: [{ state: 'A' }] },
  rules: [    
    { enabled: true, condition: { current: 'A', prior: 'any', conn_with_state: 'B', conn_ge: 1 }, op: { kind: 'Die' } },
  ],
};


  const token = encodeGenomeToUrlToken(cfg);
  const hash = `#g=${encodeURIComponent(token)}`;

  const parsed = parseGenomeFromUrlHash(hash);
  expect(parsed).toEqual(cfg);
});



test('shared genome parser also accepts non-encoded #g= token', () => {
  const cfg = { hello: 'world', nums: [1, 2, 3], nested: { ok: true } };

  const token = encodeGenomeToUrlToken(cfg);
  const hash = `#g=${token}`;

  const parsed = parseGenomeFromUrlHash(hash);
  expect(parsed).toEqual(cfg);
});
