// src/responsive.ts
export const RESPONSIVE = {
  MOBILE_MAX_W: 900,            // ≤640px switches to mobile in portrait
  MOBILE_LANDSCAPE_MAX_H: 640,  // ≤420px height switches to mobile in landscape
  USE_POINTER_HINT: false,      // ← size-only by default; set true to require coarse pointer for portrait rule
};

export type Orientation = 'portrait' | 'landscape';

export function computeOrientation(width: number, height: number): Orientation {
  return height >= width ? 'portrait' : 'landscape';
}

/** Primary gate for the simplified UI. */
export function shouldUseMobileBasic(
  width: number,
  height: number,
  hasCoarsePointer: boolean
): boolean {
  const orient = computeOrientation(width, height);
  const smallPortrait  = width <= RESPONSIVE.MOBILE_MAX_W;
  const tightLandscape = orient === 'landscape' && height <= RESPONSIVE.MOBILE_LANDSCAPE_MAX_H;

  if (RESPONSIVE.USE_POINTER_HINT) {
    return hasCoarsePointer ? (smallPortrait || tightLandscape) : tightLandscape;
  }
  return smallPortrait || tightLandscape; // size-only
}
