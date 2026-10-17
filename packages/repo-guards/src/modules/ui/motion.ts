// The motion guard: transitions ride the motion tokens and name the property they animate, and
// motion a script asks for by name reads the one effective reduced-motion preference.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard } from '../../guard.js';
import { matchPattern, ownerOnly, reviewedAllowlist, type Hit, type Matcher } from '../../shapes/shapes.js';
import { cssBlocks } from './css.js';
import { requireObject, requirePath, requirePathOrNull } from './facts.js';
import { APP_CODE, APP_STYLES } from './styling.js';

export interface MotionFacts {
  /** The entry stylesheet whose `@theme` binds Tailwind's default transition timing. */
  entryStylesheet: string;
  /** The one module that turns the effective reduced-motion preference into a scroll behavior. */
  motionHelper: string;
  /**
   * The one module that calls the mobile package's `useKeepFocusedInputVisible` with the effective
   * motion, or null when the app never calls it.
   */
  focusedInputKeeperAdapter: string | null;
}

const tsx = (text: string) => ({ path: 'sample.tsx', text });
const css = (text: string) => ({ path: 'sample.css', text });

export const motionUtilities = matchPattern(/\btransition-all\b|\bduration-\d+\b/);
export const smoothScrollRequests = matchPattern(/['"]smooth['"]/);
export const focusedInputKeeperCalls = matchPattern(/\buseKeepFocusedInputVisible\b/);

/** A transition value judged outside every var(): `all` or a raw duration. */
export const untokenedTransition = (value: string): boolean => {
  const outsideVars = value.replace(/var\((?:[^()]|\([^()]*\))*\)/g, 'TOKEN');
  return /\ball\b/.test(outsideVars) || /\d(?:\.\d+)?m?s\b/.test(outsideVars);
};

export const untokenedTransitions: Matcher = (file) => {
  if (file.kind !== 'stylesheet') return [];
  const hits: Hit[] = [];
  for (const block of cssBlocks(file.code)) {
    for (const d of block.declarations) {
      if ((d.property === 'transition' || d.property === 'transition-property') && untokenedTransition(d.value)) {
        hits.push({ index: d.index, detail: `${d.property}: ${d.value}` });
      }
    }
  }
  return hits;
};

export const motionGuard: GenericGuardDefinition<MotionFacts> = {
  id: 'motionTokens',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!requireObject(facts, problems)) return problems;
    requirePath(facts.entryStylesheet, 'entryStylesheet', problems);
    requirePath(facts.motionHelper, 'motionHelper', problems);
    requirePathOrNull(facts.focusedInputKeeperAdapter, 'focusedInputKeeperAdapter', problems);
    return problems;
  },
  build(facts): Guard[] {
    const keeper = {
      title: "the mobile package's focused-input keeper is called only through the app's motion adapter",
      description:
        "useKeepFocusedInputVisible scrolls smoothly unless it is handed the effective motion, so it is called once, from " +
        'the adapter that hands it the effective reduced-motion preference; everything else calls the adapter. An app ' +
        'with no adapter calls it nowhere.',
      scope: APP_CODE,
      match: focusedInputKeeperCalls,
      samples: { flags: [tsx('useKeepFocusedInputVisible(ref);')], passes: [tsx('useKeepFocusedInputVisibleWithMotion(ref);')] },
    };
    return [
      reviewedAllowlist({
        title: 'app code uses no transition-all and no Tailwind duration-* utility',
        description:
          'A transition rides the motion tokens and names the one property it animates: transition-all animates whatever ' +
          'changes next, and a duration-N utility is a raw duration outside the tokens. Give the animated element a ' +
          'semantic class that transitions its one property on the motion tokens.',
        scope: APP_CODE,
        match: motionUtilities,
        allowlist: [],
        samples: { flags: [tsx('<div className="transition-all" />'), tsx('<div className="duration-300" />')], passes: [tsx('<div className="transition-colors" />')] },
      }),
      ownerOnly({
        title: 'a smooth scroll is requested only by the effective-motion helper',
        description:
          "A script's explicit smooth scroll is motion the stylesheet's reduced-motion switch cannot reach, so its " +
          "behavior comes from the one effective-motion helper, never a literal 'smooth'. Ask the helper for the scroll behavior.",
        scope: APP_CODE,
        match: smoothScrollRequests,
        owners: [facts.motionHelper],
        samples: { flags: [tsx("el.scrollIntoView({ behavior: 'smooth' });")], passes: [tsx('el.scrollIntoView({ behavior: preferredScrollBehavior() });')] },
      }),
      facts.focusedInputKeeperAdapter
        ? ownerOnly({ ...keeper, owners: [facts.focusedInputKeeperAdapter] })
        : reviewedAllowlist({ ...keeper, allowlist: [] }),
      reviewedAllowlist({
        title: 'every app stylesheet transition names its property and rides the motion tokens',
        description:
          'A transition or transition-property in an app stylesheet never names `all` and never carries a raw duration ' +
          'outside a var(): it names the property it animates and takes its timing from the motion tokens.',
        scope: APP_STYLES,
        match: untokenedTransitions,
        allowlist: [],
        samples: {
          flags: [css('.a { transition: all var(--motion-base) var(--motion-ease); }'), css('.a { transition: background-color 0.15s ease; }'), css('.a { transition: transform 700ms ease; }')],
          passes: [css('.a { transition: opacity var(--motion-base) var(--motion-ease); }'), css('.a { transition: transform var(--walk-ms, 750ms) var(--motion-ease); }')],
        },
      }),
      {
        title: "Tailwind's default transition timing is bound to the motion tokens",
        description:
          "The entry stylesheet's @theme binds --default-transition-duration to var(--motion-fast|base|slow) and " +
          '--default-transition-timing-function to var(--motion-ease), so every transition utility that names no timing ' +
          'follows the tokens.',
        run(context) {
          if (!context.reader.exists(facts.entryStylesheet)) return [{ file: facts.entryStylesheet, detail: 'the entry stylesheet does not exist' }];
          const entry = context.file(facts.entryStylesheet);
          const declared = new Map<string, string>();
          for (const block of cssBlocks(entry.code)) {
            if (block.prelude.startsWith('@theme')) for (const d of block.declarations) declared.set(d.property, d.value);
          }
          const findings: Finding[] = [];
          const duration = declared.get('--default-transition-duration');
          if (!duration || !/^var\(--motion-(?:fast|base|slow)\)$/.test(duration)) {
            findings.push({ file: entry.path, detail: `--default-transition-duration is ${duration ?? 'not declared'}; bind it to var(--motion-fast), var(--motion-base), or var(--motion-slow)` });
          }
          const timing = declared.get('--default-transition-timing-function');
          if (timing !== 'var(--motion-ease)') {
            findings.push({ file: entry.path, detail: `--default-transition-timing-function is ${timing ?? 'not declared'}; bind it to var(--motion-ease)` });
          }
          return findings;
        },
      },
    ];
  },
};
