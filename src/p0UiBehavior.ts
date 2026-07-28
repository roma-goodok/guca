export type PlaybackSpeed = 0.5 | 1 | 2;
export type GraphTool = 'move' | 'scissors';
export type GraphViewMode = '2d' | '3d';

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1;
export const DEFAULT_DISPLAY_OPTION = 'both';
export const DEFAULT_MAINTAIN_SINGLE_COMPONENT = false;
export const DEFAULT_ORPHAN_CLEANUP_ENABLED = false;

const PLAYBACK_SPEED_ORDER: readonly PlaybackSpeed[] = [1, 0.5, 2];

export function nextPlaybackSpeed(current: PlaybackSpeed): PlaybackSpeed {
  const index = PLAYBACK_SPEED_ORDER.indexOf(current);
  return PLAYBACK_SPEED_ORDER[(index + 1) % PLAYBACK_SPEED_ORDER.length];
}

export function playbackIntervalMs(baseIntervalMs: number, speed: PlaybackSpeed): number {
  const safeBase = Number.isFinite(baseIntervalMs) && baseIntervalMs > 0
    ? baseIntervalMs
    : 1;
  return Math.max(1, Math.round(safeBase / speed));
}

export function toolAfterClick(
  current: GraphTool,
  requested: GraphTool,
  viewMode: GraphViewMode
): GraphTool {
  if (viewMode === '3d') return 'move';
  if (current !== requested) return requested;
  return current === 'move' ? 'scissors' : 'move';
}

export function toolForView(current: GraphTool, viewMode: GraphViewMode): GraphTool {
  return viewMode === '3d' && current === 'scissors' ? 'move' : current;
}

export function viewAfterClick(
  current: GraphViewMode,
  requested: GraphViewMode
): GraphViewMode {
  if (current !== requested) return requested;
  return current === '2d' ? '3d' : '2d';
}
