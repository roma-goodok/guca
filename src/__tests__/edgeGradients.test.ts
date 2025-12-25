// src/__tests__/edgeGradients.test.ts
import { edgeGradientId, shouldUseGradientEdge, undirectedEdgeKey } from '../edgeGradients';

describe('edgeGradients', () => {
  test('undirectedEdgeKey is stable regardless of order', () => {
    expect(undirectedEdgeKey(2, 10)).toBe('2-10');
    expect(undirectedEdgeKey(10, 2)).toBe('2-10');
  });

  test('edgeGradientId is stable regardless of order', () => {
    expect(edgeGradientId(10, 2)).toBe('edge-grad-2-10');
  });

  test('shouldUseGradientEdge', () => {
    expect(shouldUseGradientEdge(false, 1, 2)).toBe(false);
    expect(shouldUseGradientEdge(true, 1, 1)).toBe(false);
    expect(shouldUseGradientEdge(true, 1, 2)).toBe(true);
  });
});
