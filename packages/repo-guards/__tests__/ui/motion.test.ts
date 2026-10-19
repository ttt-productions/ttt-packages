// The motion guard: token transitions that name their property, and script motion that reads the
// one effective reduced-motion preference.

import { describe, expect, it } from 'vitest';
import { motionGuard, type MotionFacts } from '../../src/modules/ui/motion.js';
import { allFindings } from './helpers.js';

const ENTRY = 'src/app/styles/globals.css';
const HELPER = 'src/motion/reduced-motion.ts';
const facts: MotionFacts = {
  entryStylesheet: ENTRY,
  motionHelper: HELPER,
  focusedInputKeeperAdapter: null,
};
const clean = {
  [ENTRY]:
    '@theme {\n  --default-transition-duration: var(--motion-fast);\n  --default-transition-timing-function: var(--motion-ease);\n}',
  [HELPER]: "export const scrollBehavior = (reduced: boolean) => (reduced ? 'auto' : 'smooth');",
  'src/app/styles/components.css':
    '.a { transition: opacity var(--motion-base) var(--motion-ease); }\n.b { transition: transform var(--walk-ms, 750ms) var(--motion-ease); }',
  'src/ui/card.tsx':
    'export const c = <div className="transition-colors" onClick={() => el.scrollIntoView({ behavior: scrollBehavior(r) })} />;',
};

describe('motion rides the tokens and the effective reduced-motion preference', () => {
  it('passes token transitions, the helper asking for a smooth scroll, and the bound default timing', async () => {
    expect(await allFindings(motionGuard, facts, clean)).toEqual([]);
  });

  it('flags transition-all and a duration utility in app code', async () => {
    expect(
      await allFindings(motionGuard, facts, {
        ...clean,
        'src/ui/bad.tsx':
          'export const a = <div className="transition-all" />;\nexport const b = <div className="duration-300" />;',
      }),
    ).toEqual([
      'src/ui/bad.tsx:1 not on the reviewed list: transition-all',
      'src/ui/bad.tsx:2 not on the reviewed list: duration-300',
    ]);
  });

  it('flags a smooth scroll outside the helper, and a helper that no longer asks for one', async () => {
    expect(
      await allFindings(motionGuard, facts, {
        ...clean,
        'src/ui/jump.ts': "el.scrollIntoView({ behavior: 'smooth' });",
      }),
    ).toEqual(["src/ui/jump.ts:1 outside its owner: 'smooth'"]);
    expect(
      await allFindings(motionGuard, facts, {
        ...clean,
        [HELPER]: 'export const scrollBehavior = () => preferred;',
      }),
    ).toEqual([
      'src/motion/reduced-motion.ts stale owner: the pattern no longer appears in it (or it is outside the scope)',
    ]);
  });

  it('flags the focused-input keeper anywhere when the app has no adapter, and outside the adapter when it has one', async () => {
    const files = {
      ...clean,
      'src/ui/form.tsx':
        'useKeepFocusedInputVisible(ref);\nuseKeepFocusedInputVisibleWithMotion(ref);',
      'src/lib/mobile.ts': 'export const k = () => useKeepFocusedInputVisible(ref, behavior);',
    };
    expect(await allFindings(motionGuard, facts, files)).toEqual([
      'src/lib/mobile.ts:1 not on the reviewed list: useKeepFocusedInputVisible',
      'src/ui/form.tsx:1 not on the reviewed list: useKeepFocusedInputVisible',
    ]);
    expect(
      await allFindings(
        motionGuard,
        { ...facts, focusedInputKeeperAdapter: 'src/lib/mobile.ts' },
        files,
      ),
    ).toEqual(['src/ui/form.tsx:1 outside its owner: useKeepFocusedInputVisible']);
  });

  it('flags a stylesheet transition of `all` or with a raw duration', async () => {
    const findings = await allFindings(motionGuard, facts, {
      ...clean,
      'src/app/styles/bad.css':
        '.a { transition: all var(--motion-base) var(--motion-ease); }\n.b {\n  transition-property: all;\n}\n.c { transition: background-color 0.15s ease; }\n.d { transition: transform 700ms ease; }',
    });
    expect(findings).toEqual([
      'src/app/styles/bad.css:1 not on the reviewed list: transition: all var(--motion-base) var(--motion-ease)',
      'src/app/styles/bad.css:3 not on the reviewed list: transition-property: all',
      'src/app/styles/bad.css:5 not on the reviewed list: transition: background-color 0.15s ease',
      'src/app/styles/bad.css:6 not on the reviewed list: transition: transform 700ms ease',
    ]);
  });

  it("flags Tailwind's default timing left unbound or bound to a raw value", async () => {
    expect(
      await allFindings(motionGuard, facts, {
        ...clean,
        [ENTRY]: '@theme {\n  --default-transition-duration: 150ms;\n}',
      }),
    ).toEqual([
      'src/app/styles/globals.css --default-transition-duration is 150ms; bind it to var(--motion-fast), var(--motion-base), or var(--motion-slow)',
      'src/app/styles/globals.css --default-transition-timing-function is not declared; bind it to var(--motion-ease)',
    ]);
  });

  it('refuses facts that leave the keeper adapter undeclared', () => {
    expect(
      motionGuard.factProblems({ entryStylesheet: ENTRY, motionHelper: HELPER } as never),
    ).toEqual(['focusedInputKeeperAdapter is missing (declare null when the app has none)']);
  });
});
