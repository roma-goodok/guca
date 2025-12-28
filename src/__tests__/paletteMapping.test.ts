import { NodeState } from '../gum';
import {
  DEFAULT_PALETTE16,
  getVertexRenderColor,
  getVertexRenderTextColor,
  replaceStateColorOverrides,
  setStateColorOverride,
  stateToPaletteIndex,
} from '../utils';

describe('palette mapping', () => {
  beforeEach(() => {
    replaceStateColorOverrides({});
  });

  test('stateToPaletteIndex: Unknown and any -> 0; letters use 15-cycle (A,P)', () => {
    expect(stateToPaletteIndex(NodeState.Unknown)).toBe(0);
    expect(stateToPaletteIndex(NodeState.Ignored)).toBe(0);

    expect(stateToPaletteIndex(NodeState.A)).toBe(1);
    expect(stateToPaletteIndex(NodeState.O)).toBe(15);

    expect(stateToPaletteIndex(NodeState.P)).toBe(1); // A,P share
    expect(stateToPaletteIndex(NodeState.Q)).toBe(2);
    expect(stateToPaletteIndex(NodeState.Z)).toBe(11);
  });

  test('getVertexRenderColor uses default palette + A/P grouping', () => {
    expect(getVertexRenderColor(NodeState.Unknown)).toBe(DEFAULT_PALETTE16[0]);
    expect(getVertexRenderColor(NodeState.A)).toBe(DEFAULT_PALETTE16[1]);
    expect(getVertexRenderColor(NodeState.P)).toBe(DEFAULT_PALETTE16[1]);
    expect(getVertexRenderColor(NodeState.B)).toBe(DEFAULT_PALETTE16[2]);
    expect(getVertexRenderColor(NodeState.Q)).toBe(DEFAULT_PALETTE16[2]);
  });

  test('overrides win and can be cleared', () => {
    setStateColorOverride(NodeState.A, '#123456');
    expect(getVertexRenderColor(NodeState.A)).toBe('#123456');

    replaceStateColorOverrides({});
    expect(getVertexRenderColor(NodeState.A)).toBe(DEFAULT_PALETTE16[1]);
  });

  test('getVertexRenderTextColor picks contrast (light -> black, dark -> white)', () => {
    expect(getVertexRenderTextColor(NodeState.Unknown)).toBe('black'); // #d3d3d3

    // O maps to slot 15 => #202122 (dark)
    expect(getVertexRenderTextColor(NodeState.O)).toBe('white');
  });
});
