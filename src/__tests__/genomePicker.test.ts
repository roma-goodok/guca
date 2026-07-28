import {
  CUSTOM_GENOME_CATEGORY,
  getEditedGenomeLabel,
  getGenomePickerCategories,
} from '../genomePicker';

describe('genome picker custom entries', () => {
  test('adds Custom before catalog categories only when a custom genome exists', () => {
    const catalog = ['Manual', 'Evolution'] as const;

    expect(getGenomePickerCategories(catalog, false)).toEqual(catalog);
    expect(getGenomePickerCategories(catalog, true)).toEqual([
      CUSTOM_GENOME_CATEGORY,
      ...catalog,
    ]);
  });

  test('appends the edited suffix to every genome name', () => {
    expect(getEditedGenomeLabel('catalog', 'Dumbbell')).toBe(
      'Dumbbell (edited)'
    );
    expect(getEditedGenomeLabel('upload', 'example.yaml')).toBe(
      'example.yaml (edited)'
    );
    expect(getEditedGenomeLabel('shared', 'Shared')).toBe('Shared (edited)');
    expect(getEditedGenomeLabel('url', 'Shared')).toBe('Shared (edited)');
    expect(getEditedGenomeLabel('new', 'New')).toBe('New (edited)');
  });
});
