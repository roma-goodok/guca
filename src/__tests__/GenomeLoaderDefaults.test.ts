import { GUMGraph } from '../gum';
import { buildMachineFromConfig } from '../genomeLoader';

test('buildMachineFromConfig defaults max_vertices=200 and nearest_search.max_depth=2 when absent', () => {
  const g = new GUMGraph();
  const cfg = { rules: [] };
  const m = buildMachineFromConfig(cfg, g, true);

  expect(m.getMaxVertices()).toBe(2000);

  const ns = (m as any).getNearestSearchCfg?.();
  expect(ns?.max_depth).toBe(2);
});

test('buildMachineFromConfig respects YAML machine.max_vertices and nearest_search.max_depth', () => {
  const g = new GUMGraph();
  const cfg = {
    machine: { max_vertices: 321, nearest_search: { max_depth: 5, tie_breaker: 'stable', connect_all: false } },
    rules: []
  };
  const m = buildMachineFromConfig(cfg, g, true);

  expect(m.getMaxVertices()).toBe(321);

  const ns = (m as any).getNearestSearchCfg?.();
  expect(ns?.max_depth).toBe(5);
});
