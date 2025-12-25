// src/edgeGradients.ts

export function undirectedEdgeKey(aId: number, bId: number): string {
  const a = Number(aId);
  const b = Number(bId);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}-${hi}`;
}

export function edgeGradientId(aId: number, bId: number): string {
  return `edge-grad-${undirectedEdgeKey(aId, bId)}`;
}

export function shouldUseGradientEdge(enabled: boolean, aState: number, bState: number): boolean {
  return !!enabled && aState !== bState;
}
