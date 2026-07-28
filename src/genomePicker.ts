export const CUSTOM_GENOME_CATEGORY = 'Custom' as const;

export function getGenomePickerCategories<T extends string>(
  catalogCategories: readonly T[],
  hasCustomGenomes: boolean
): Array<T | typeof CUSTOM_GENOME_CATEGORY> {
  return hasCustomGenomes
    ? [CUSTOM_GENOME_CATEGORY, ...catalogCategories]
    : [...catalogCategories];
}

export function getEditedGenomeLabel(source: string, baseLabel: string): string {
  return `${baseLabel} (edited)`;
}
