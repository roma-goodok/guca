import {
  DEFAULT_DISPLAY_OPTION,
  DEFAULT_MAINTAIN_SINGLE_COMPONENT,
  DEFAULT_ORPHAN_CLEANUP_ENABLED,
  nextPlaybackSpeed,
  playbackIntervalMs,
  toolAfterClick,
  toolForView,
  viewAfterClick,
} from '../p0UiBehavior';

describe('P0 UI behavior', () => {
  test('speed cycles 1x -> 0.5x -> 2x -> 1x', () => {
    expect(nextPlaybackSpeed(1)).toBe(0.5);
    expect(nextPlaybackSpeed(0.5)).toBe(2);
    expect(nextPlaybackSpeed(2)).toBe(1);
  });

  test('playback speed scales the configured base interval', () => {
    expect(playbackIntervalMs(200, 0.5)).toBe(400);
    expect(playbackIntervalMs(200, 1)).toBe(200);
    expect(playbackIntervalMs(200, 2)).toBe(100);
  });

  test('clicking either active tool returns to the other tool', () => {
    expect(toolAfterClick('move', 'move', '2d')).toBe('scissors');
    expect(toolAfterClick('scissors', 'scissors', '2d')).toBe('move');
    expect(toolAfterClick('move', 'scissors', '2d')).toBe('scissors');
    expect(toolAfterClick('scissors', 'move', '2d')).toBe('move');
  });

  test('3D always resolves Cut to Move', () => {
    expect(toolAfterClick('move', 'scissors', '3d')).toBe('move');
    expect(toolForView('scissors', '3d')).toBe('move');
  });

  test('clicking the active view returns to the other view', () => {
    expect(viewAfterClick('2d', '2d')).toBe('3d');
    expect(viewAfterClick('3d', '3d')).toBe('2d');
    expect(viewAfterClick('3d', '2d')).toBe('2d');
    expect(viewAfterClick('2d', '3d')).toBe('3d');
  });

  test('P0 graph defaults keep detached components visible', () => {
    expect(DEFAULT_DISPLAY_OPTION).toBe('both');
    expect(DEFAULT_MAINTAIN_SINGLE_COMPONENT).toBe(false);
    expect(DEFAULT_ORPHAN_CLEANUP_ENABLED).toBe(false);
  });
});
