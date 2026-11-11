import { describe, expect, it } from 'vitest';
import {
  partTokens,
  partVariantChoices,
  restylingConflicts,
  sheetClassProperties,
  themeValues,
  uiPartsIn,
  type UiPart,
} from '@ttt-productions/repo-guards';
import { packageSource } from './workspace';

// The utilities layer outranks theme-core's sheet, so a class on a ui-core part applies only where it
// sets nothing the part's built-in utilities set to another value.

/** Promised on every ui-core part: each composes with every part, in every variant, on every property. */
const COMPOSES_WITH_EVERY_PART = ['stack-1', 'stack-2', 'stack-3', 'stack-4', 'stack-6'];

/** For plain elements: not promised on a part, where the app guard judges each use. */
const PLAIN_ELEMENT_ONLY = [
  'center-row',
  'center-col',
  'two-line-clamp',
  'three-line-clamp',
  'single-line-truncate',
  'name-piece',
];

const sources = packageSource(['code', 'stylesheet']);
const sheet = sources.find((f) => f.path === 'packages/theme-core/src/styles/components.css');
const tokens = sources.find((f) => f.path === 'packages/theme-core/src/styles/tokens.css');
const parts = sources
  .filter(
    (f) => f.path.startsWith('packages/ui-core/src/react/components/') && f.path.endsWith('.tsx'),
  )
  .flatMap((f) => uiPartsIn(f.path, f.text));

const declared = sheetClassProperties(sheet?.code ?? '');
const theme = themeValues(tokens?.code ?? '');

function partsItLosesOn(className: string): string[] {
  const losing = new Set<string>();
  const declarations = declared.get(className) ?? [];
  for (const part of parts as UiPart[])
    for (const choice of partVariantChoices(part))
      for (const c of restylingConflicts(className, declarations, partTokens(part, choice), theme))
        losing.add(
          `<${part.name} ${JSON.stringify(choice)}> ${c.property}: ${c.classValue} vs ${c.utility}`,
        );
  return [...losing];
}

/** Whether the sheet declares the class in any rule, its own element's or its children's. */
const inSheet = (className: string) =>
  new RegExp(`\\.${className}(?![\\w-])`).test(sheet?.code ?? '');

describe("theme-core's layout classes on ui-core parts", () => {
  it('reads the sheet and every ui-core part', () => {
    expect(sheet).toBeDefined();
    expect(parts.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Button', 'Card', 'CardHeader', 'Label', 'SelectTrigger']),
    );
  });

  it.each(COMPOSES_WITH_EVERY_PART)(
    '.%s is declared, and sets nothing any part sets to another value',
    (className) => {
      expect(inSheet(className)).toBe(true);
      expect(partsItLosesOn(className)).toEqual([]);
    },
  );

  it.each(PLAIN_ELEMENT_ONLY)(
    '.%s is declared, and still loses on some part — once it loses on none it is promised on every part',
    (className) => {
      expect(inSheet(className)).toBe(true);
      expect(partsItLosesOn(className).length).toBeGreaterThan(0);
    },
  );
});
