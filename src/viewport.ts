// src/viewport.ts
export function computeKToSatisfyMaxFill(
  bboxW: number, bboxH: number,
  viewW: number, viewH: number,
  maxFill: number
): number {
  const vw = Math.max(1, viewW);
  const vh = Math.max(1, viewH);
  const need = Math.max(bboxW / vw, bboxH / vh); // fraction of view occupied at k=1
  if (!isFinite(need) || need <= 0) return 1;     // nothing to scale
  return maxFill / need;                          // k that caps fill at maxFill
}
