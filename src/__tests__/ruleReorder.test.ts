import { reorderRules } from '../ruleReorder';

describe('reorderRules', () => {
  test('moves a rule forward without mutating the source list', () => {
    const source = ['a', 'b', 'c', 'd'];

    expect(reorderRules(source, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
    expect(source).toEqual(['a', 'b', 'c', 'd']);
  });

  test('moves a rule backward', () => {
    expect(reorderRules(['a', 'b', 'c', 'd'], 3, 1)).toEqual([
      'a',
      'd',
      'b',
      'c',
    ]);
  });

  test('keeps the list unchanged for invalid or identical positions', () => {
    expect(reorderRules(['a', 'b'], -1, 1)).toEqual(['a', 'b']);
    expect(reorderRules(['a', 'b'], 0, 2)).toEqual(['a', 'b']);
    expect(reorderRules(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});
