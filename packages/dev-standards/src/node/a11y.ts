import { AssertionError } from 'node:assert';
import type { Page } from '@playwright/test';

export type A11yImpact = 'minor' | 'moderate' | 'serious' | 'critical';

export type A11yMode = 'default' | 'high-contrast' | 'reduced-motion';

export interface A11yViolation {
  id: string;
  impact?: A11yImpact | null;
  help: string;
  helpUrl: string;
  nodes: readonly { target: readonly (string | readonly string[])[] }[];
}

export interface A11yModeResult {
  mode: A11yMode;
  violations: readonly A11yViolation[];
}

export interface A11yCheckOptions {
  applyHighContrast: (page: Page) => Promise<void>;
  restoreDefaultTheme?: (page: Page) => Promise<void>;
  failOn?: readonly A11yImpact[];
  disableRules?: readonly string[];
}

const DEFAULT_FAIL_ON: readonly A11yImpact[] = ['serious', 'critical'];

export function failingViolations(
  violations: readonly A11yViolation[],
  failOn: readonly A11yImpact[] = DEFAULT_FAIL_ON,
): A11yViolation[] {
  return violations.filter((violation) => !!violation.impact && failOn.includes(violation.impact));
}

function formatTarget(target: A11yViolation['nodes'][number]['target']): string {
  return target
    .map((selector) => (typeof selector === 'string' ? selector : selector.join(' >>> ')))
    .join(' -> ');
}

export function formatA11yFailures(results: readonly A11yModeResult[]): string {
  const entries = results.flatMap(({ mode, violations }) =>
    violations.map((violation) =>
      [
        `[${mode}] ${violation.id} (${violation.impact ?? 'no impact'}): ${violation.help}`,
        ...violation.nodes.map((node) => `    target: ${formatTarget(node.target)}`),
        `    help: ${violation.helpUrl}`,
      ].join('\n'),
    ),
  );
  return `${entries.length} accessibility violation(s):\n${entries.join('\n')}`;
}

export async function checkAccessibility(page: Page, options: A11yCheckOptions): Promise<void> {
  // Imported here: @axe-core/playwright is an optional peer only an app's E2E suite installs.
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const failOn = options.failOn ?? DEFAULT_FAIL_ON;
  const scan = async (mode: A11yMode): Promise<A11yModeResult> => {
    const results = await new AxeBuilder({ page })
      .disableRules([...(options.disableRules ?? [])])
      .analyze();
    return { mode, violations: failingViolations(results.violations as A11yViolation[], failOn) };
  };

  const results = [await scan('default')];
  await options.applyHighContrast(page);
  results.push(await scan('high-contrast'));
  await options.restoreDefaultTheme?.(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    results.push(await scan('reduced-motion'));
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }

  if (results.some(({ violations }) => violations.length > 0)) {
    throw new AssertionError({ message: formatA11yFailures(results) });
  }
}
