import { AssertionError } from 'node:assert';
import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkAccessibility,
  failingViolations,
  formatA11yFailures,
  type A11yViolation,
} from '../src/node/a11y.js';

const axe = vi.hoisted(() => ({
  events: [] as string[],
  disabled: [] as string[][],
  scans: [] as { violations: unknown[] }[],
}));

vi.mock('@axe-core/playwright', () => ({
  default: class {
    disableRules(rules: string[]) {
      axe.disabled.push(rules);
      return this;
    }
    async analyze() {
      axe.events.push('scan');
      return axe.scans.shift() ?? { violations: [] };
    }
  },
}));

const violation = (
  id: string,
  impact: A11yViolation['impact'],
  target: A11yViolation['nodes'][number]['target'] = [`#${id}`],
): A11yViolation => ({
  id,
  impact,
  help: `${id} help`,
  helpUrl: `https://axe.example/${id}`,
  nodes: [{ target }],
});

const fakePage = () =>
  ({
    emulateMedia: async (media: { reducedMotion: string | null }) => {
      axe.events.push(`reducedMotion:${media.reducedMotion}`);
    },
  }) as unknown as Page;

const themes = {
  applyHighContrast: async () => {
    axe.events.push('high-contrast');
  },
  restoreDefaultTheme: async () => {
    axe.events.push('default-theme');
  },
};

beforeEach(() => {
  axe.events = [];
  axe.disabled = [];
  axe.scans = [];
});

describe('failingViolations', () => {
  const all = [
    violation('a', 'minor'),
    violation('b', 'moderate'),
    violation('c', 'serious'),
    violation('d', 'critical'),
    violation('e', null),
  ];

  it('fails only serious and critical violations by default', () => {
    expect(failingViolations(all).map((v) => v.id)).toEqual(['c', 'd']);
  });

  it('fails the impacts the caller names', () => {
    expect(failingViolations(all, ['moderate']).map((v) => v.id)).toEqual(['b']);
  });

  it('never fails a violation with no impact', () => {
    expect(failingViolations([violation('e', null)], ['minor', 'serious'])).toEqual([]);
  });
});

describe('formatA11yFailures', () => {
  it('lists each violation with its mode, rule id, impact, every target, and help URL', () => {
    const message = formatA11yFailures([
      { mode: 'default', violations: [] },
      {
        mode: 'high-contrast',
        violations: [
          {
            ...violation('color-contrast', 'serious'),
            nodes: [{ target: ['.badge'] }, { target: ['iframe#embed', ['x-card', 'button']] }],
          },
        ],
      },
      { mode: 'reduced-motion', violations: [violation('aria-roles', 'critical')] },
    ]);

    expect(message).toBe(
      [
        '2 accessibility violation(s):',
        '[high-contrast] color-contrast (serious): color-contrast help',
        '    target: .badge',
        '    target: iframe#embed -> x-card >>> button',
        '    help: https://axe.example/color-contrast',
        '[reduced-motion] aria-roles (critical): aria-roles help',
        '    target: #aria-roles',
        '    help: https://axe.example/aria-roles',
      ].join('\n'),
    );
  });
});

describe('checkAccessibility', () => {
  it('scans the default theme, then high contrast, then the default theme with reduced motion', async () => {
    await checkAccessibility(fakePage(), themes);

    expect(axe.events).toEqual([
      'scan',
      'high-contrast',
      'scan',
      'default-theme',
      'reducedMotion:reduce',
      'scan',
      'reducedMotion:null',
    ]);
  });

  it('passes when every violation is below the failing impacts', async () => {
    axe.scans = [
      { violations: [violation('region', 'moderate')] },
      { violations: [violation('list', 'minor')] },
      { violations: [] },
    ];
    await expect(checkAccessibility(fakePage(), themes)).resolves.toBeUndefined();
  });

  it('throws an assertion error naming the failing violation of every mode after all scans run', async () => {
    axe.scans = [
      { violations: [violation('button-name', 'critical'), violation('region', 'moderate')] },
      { violations: [] },
      { violations: [violation('color-contrast', 'serious')] },
    ];

    const error = await checkAccessibility(fakePage(), themes).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AssertionError);
    const { message } = error as AssertionError;
    expect(message).toContain('[default] button-name (critical)');
    expect(message).toContain('[reduced-motion] color-contrast (serious)');
    expect(message).not.toContain('region');
    expect(axe.events.filter((event) => event === 'scan')).toHaveLength(3);
  });

  it('fails on the caller-chosen impacts instead of the defaults', async () => {
    axe.scans = [{ violations: [violation('region', 'moderate')] }];
    await expect(
      checkAccessibility(fakePage(), { ...themes, failOn: ['moderate'] }),
    ).rejects.toThrow('[default] region (moderate)');
  });

  it('skips the disabled rules in every scan', async () => {
    await checkAccessibility(fakePage(), { ...themes, disableRules: ['color-contrast'] });
    expect(axe.disabled).toEqual([['color-contrast'], ['color-contrast'], ['color-contrast']]);
  });

  it('clears the reduced-motion emulation when the reduced-motion scan throws', async () => {
    axe.scans = [{ violations: [] }, { violations: [] }];
    const analyze = Promise.reject(new Error('axe crashed'));
    analyze.catch(() => {});
    axe.scans.push(analyze as never);

    await expect(checkAccessibility(fakePage(), themes)).rejects.toThrow('axe crashed');
    expect(axe.events.at(-1)).toBe('reducedMotion:null');
  });

  it('runs the reduced-motion scan in high contrast when the app gives no way back', async () => {
    await checkAccessibility(fakePage(), { applyHighContrast: themes.applyHighContrast });
    expect(axe.events).toEqual([
      'scan',
      'high-contrast',
      'scan',
      'reducedMotion:reduce',
      'scan',
      'reducedMotion:null',
    ]);
  });
});
