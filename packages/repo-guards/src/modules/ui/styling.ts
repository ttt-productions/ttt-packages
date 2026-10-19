// The UI guards over how app code and app stylesheets paint: colors through theme tokens, scale
// classes that exist, status foregrounds on their solid fill, shadows owned by classes, vertical
// stacks never on rows, and no clickable affordance on an unavailable control.

import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Finding, Guard } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit, type Matcher } from '../../shapes/shapes.js';
import { cssBlocks, selectorsOf, subjectCompound } from './css.js';
import { allowlistProblems, objectProblem, pathProblem } from '../../support/facts.js';
import { bareToken, codeStrings, tokensOf } from './source.js';
import { loadedStylesheets } from './stylesheets.js';

export const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };
export const APP_STYLES: Scope = { roots: ['app'], kinds: ['stylesheet'], tests: false };
const APP_CODE_AND_STYLES: Scope = { roots: ['app'], kinds: ['code', 'stylesheet'], tests: false };

const css = (text: string) => ({ path: 'sample.css', text });
const tsx = (text: string) => ({ path: 'sample.tsx', text });

/** Every match of each pattern in a file's comment-free code. */
function patternHits(file: FileView, patterns: readonly RegExp[]): Hit[] {
  const hits: Hit[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (let m = re.exec(file.code); m; m = re.exec(file.code)) hits.push({ index: m.index, detail: m[0] });
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Hits for every token of every string the code writes that `test` picks out. */
function tokenHits(file: FileView, test: (token: string, tokens: readonly string[]) => boolean): Hit[] {
  if (file.kind !== 'code') return [];
  const hits: Hit[] = [];
  for (const { text, index } of codeStrings(file)) {
    const tokens = tokensOf(text);
    for (const token of tokens) if (test(token, tokens)) hits.push({ index, detail: token });
  }
  return hits;
}

// ---- color literals -----------------------------------------------------------------------------

const PALETTE_PREFIX = 'text|bg|border|ring|from|via|to|fill|stroke|decoration|outline|divide|placeholder|caret|accent|shadow';
const PALETTE_HUE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone';
const COLOR_LITERALS = [
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/,
  /\b(?:hsla?|rgba?)\(\s*\d[^)]*\)?/,
  new RegExp(`\\b(?:${PALETTE_PREFIX})-(?:(?:${PALETTE_HUE})-\\d{2,3}|white|black)\\b`),
];
export const colorLiteralMatcher: Matcher = (file) => patternHits(file, COLOR_LITERALS);

export interface ColorLiteralFacts {
  /** Files that must hold a color literal (an SVG whose paint cannot be a token), each with its why and count. */
  exceptions: readonly AllowlistEntry[];
}

export const colorLiteralsGuard: GenericGuardDefinition<ColorLiteralFacts> = {
  id: 'colorLiterals',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems)) allowlistProblems(facts.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'every color in app code and stylesheets resolves through a theme token',
        description:
          'A color renders as hsl(var(--token)) from the theme system. App code and app stylesheets never hold a hex, ' +
          'a numeric hsl()/rgb() literal, or a stock Tailwind palette class (bg-amber-500, text-gray-500, bg-white, ' +
          'text-black): those never reach the theme tokens, so they keep their value in every theme and in high contrast. ' +
          'Use an existing token, or declare a new one in the app token sheet as a raw triplet.',
        scope: APP_CODE_AND_STYLES,
        match: colorLiteralMatcher,
        allowlist: facts.exceptions,
        samples: {
          flags: [
            tsx('<div style={{ color: "#fff" }} />'),
            tsx('const shade = "rgba(0,0,0,.5)";'),
            tsx('<p className="text-gray-500" />'),
            tsx('<div className="dark:bg-amber-500/10" />'),
            tsx('<span className="bg-white text-black" />'),
            css('.a { color: hsl(258 50% 40%); }'),
          ],
          passes: [
            tsx('<p className="text-muted-foreground bg-card border-border" />'),
            css('.a { color: hsl(var(--primary)); --gold: 45 65% 62%; }'),
            tsx('// a #fff comment and bg-white in prose'),
          ],
        },
      }),
    ];
  },
};

// ---- theme scale classes ------------------------------------------------------------------------

const SCALE_CLASS = /^(?:stack|icon|spinner)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DECLARED_SCALE_CLASS = /\.((?:stack|icon|spinner)-[a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g;

/** Every scale class a stylesheet's selectors declare. */
export function declaredScaleClasses(sheet: FileView): string[] {
  return [...sheet.code.matchAll(DECLARED_SCALE_CLASS)].map((m) => m[1]);
}

/** Every scale class token a string in the code names. */
export const usedScaleClasses: Matcher = (file) => tokenHits(file, (token) => SCALE_CLASS.test(bareToken(token)));

export interface EntryStylesheetFacts {
  /** The one stylesheet the app loads, repo-relative. */
  entryStylesheet: string;
}

export const scaleClassesGuard: GenericGuardDefinition<EntryStylesheetFacts> = {
  id: 'themeScaleClasses',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems)) pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'every stack-*, icon-*, and spinner-* class app code uses is declared by a loaded stylesheet',
        description:
          'The stack-*, icon-* and spinner-* scales are semantic classes, not Tailwind utilities, so nothing flags a step ' +
          'nobody declares: an undeclared one renders as nothing and reads as a working class. Use a step a stylesheet ' +
          'the entry stylesheet loads declares (the theme package or the app), or declare the step there.',
        run(context) {
          const { sheets, findings } = loadedStylesheets(context, facts.entryStylesheet);
          const defined = new Set(sheets.flatMap(({ file }) => declaredScaleClasses(file)));
          if (!defined.size) findings.push({ file: facts.entryStylesheet, detail: 'no loaded stylesheet declares a scale class, so nothing could be checked' });
          for (const file of context.files(APP_CODE)) {
            for (const hit of usedScaleClasses(file)) {
              const name = bareToken(hit.detail ?? '');
              if (!defined.has(name)) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: `${name} is declared by no loaded stylesheet` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---- status foreground on its solid fill ---------------------------------------------------------

const STATUS_FOREGROUND = /^((?:[\w-]+:)*)text-(success|warning|destructive|info)-foreground$/;
export const tintedStatusForegrounds: Matcher = (file) =>
  tokenHits(file, (token, tokens) => {
    const m = STATUS_FOREGROUND.exec(token);
    return !!m && !tokens.includes(`${m[1]}bg-${m[2]}`);
  });

export const statusForegroundGuard: GenericGuardDefinition<Record<string, never>> = {
  id: 'statusForegroundOnFill',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts, 'facts', problems);
    return problems;
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'a status foreground is painted only on its own solid status fill',
        description:
          'A status foreground (text-success-foreground, text-warning-foreground, text-destructive-foreground, ' +
          'text-info-foreground) is measured for contrast on its SOLID fill only; on a tint or another seat it is ' +
          'unreadable. A class list that paints text-X-foreground also paints bg-X under the same variant prefix. On a ' +
          'tint (bg-X/10) the text is ordinary body text: text-foreground.',
        scope: APP_CODE,
        match: tintedStatusForegrounds,
        allowlist: [],
        samples: {
          flags: [tsx('<p className="center-row text-warning-foreground bg-warning/10" />'), tsx("cn('hover:text-destructive-foreground bg-destructive')")],
          passes: [tsx('<p className="bg-success text-success-foreground" />'), tsx("cn('hover:bg-destructive hover:text-destructive-foreground')")],
        },
      }),
    ];
  },
};

// ---- shadow ownership --------------------------------------------------------------------------

const normalizeShadow = (value: string) => value.replace(/\s+/g, ' ').trim();
const pairedTwShadow = (value: string) => (normalizeShadow(value) === 'none' ? '0 0 transparent' : normalizeShadow(value));

/** Every box-shadow declaration whose block does not set the identical --tw-shadow. */
export const unpairedShadows: Matcher = (file) => {
  if (file.kind !== 'stylesheet') return [];
  const hits: Hit[] = [];
  for (const block of cssBlocks(file.code)) {
    const tw = block.declarations.find((d) => d.property === '--tw-shadow')?.value;
    for (const d of block.declarations) {
      if (d.property !== 'box-shadow') continue;
      if (tw === undefined || normalizeShadow(tw) !== pairedTwShadow(d.value)) {
        hits.push({ index: d.index, detail: `box-shadow: ${d.value} — --tw-shadow: ${tw ?? '(missing)'}` });
      }
    }
  }
  return hits;
};

const SHADOW_UTILITY = (() => {
  const variants = String.raw`(?:[\w-]+:|\[[^\]]+\]:)`;
  const shadow = String.raw`!?(?:inset-|drop-)?shadow`;
  const sized = String.raw`-(?:2xs|xs|sm|md|lg|xl|2xl|inner|\[[^\]]+\]|\([^)]+\))`;
  return new RegExp(`^(?:${variants}*${shadow}${sized}|${variants}+${shadow})$`);
})();
export const shadowUtilities: Matcher = (file) => tokenHits(file, (token) => SHADOW_UTILITY.test(token));

export const shadowOwnershipGuard: GenericGuardDefinition<Record<string, never>> = {
  id: 'shadowOwnership',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts, 'facts', problems);
    return problems;
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'every app box-shadow pairs with an identical --tw-shadow',
        description:
          'A Tailwind ring utility (a focus ring) writes the whole box-shadow as a composite ending in var(--tw-shadow), ' +
          'so a rule that sets box-shadow without the same --tw-shadow loses its shadow under a keyboard focus ring. Set ' +
          '--tw-shadow to the same value in the same rule; a `none` pairs with `0 0 transparent`.',
        scope: APP_STYLES,
        match: unpairedShadows,
        allowlist: [],
        samples: {
          flags: [css('.a {\n  box-shadow: 0 0 1rem hsl(var(--ring) / 0.24);\n}'), css('.a { --tw-shadow: 0 0 1rem red; box-shadow: 0 0 2rem red; }'), css('.a { --tw-shadow: none; box-shadow: none; }')],
          passes: [css('.a { --tw-shadow: 0 0 1rem hsl(var(--ring)); box-shadow: 0 0 1rem hsl(var(--ring)); }'), css('.a { --tw-shadow: 0 0 transparent; box-shadow: none; }'), css('.a { transition: box-shadow var(--motion-fast) var(--motion-ease); }')],
        },
      }),
      reviewedAllowlist({
        title: 'app code adds no shadow through a Tailwind shadow utility',
        description:
          'A shadow utility sits in a later cascade layer than every app rule, so it silently beats the card and hover ' +
          'shadows the app classes own. Wear the app card class or the theme package elevation hook instead; ' +
          'shadow-none removes a shadow and is allowed.',
        scope: APP_CODE,
        match: shadowUtilities,
        allowlist: [],
        samples: {
          flags: [tsx('<Card className="w-full shadow-md rounded-xl" />'), tsx("cn('hover:shadow', 'md:shadow-[0_0_4px_red]', 'drop-shadow-sm')")],
          passes: [tsx('<Card className="border-none shadow-none" />'), tsx("const label = 'a little shadow hatching';")],
        },
      }),
    ];
  },
};

// ---- vertical stacks never on horizontal rows --------------------------------------------------

export const horizontalStacks: Matcher = (file) =>
  tokenHits(file, (token, tokens) => {
    if (!/^stack-\d+$/.test(bareToken(token))) return false;
    const row = (tokens.includes('flex') || tokens.includes('inline-flex')) && !tokens.includes('flex-col') && !tokens.includes('flex-col-reverse');
    return row;
  });

export const stackRowsGuard: GenericGuardDefinition<Record<string, never>> = {
  id: 'stackOnRows',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts, 'facts', problems);
    return problems;
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'a stack-N class is never on a horizontal flex row',
        description:
          'The stack-N classes are vertical stacks (they space each child from the one above it). On a horizontal flex ' +
          'row they add no horizontal gap and push the second child down. A horizontal row spaces its children with gap-*.',
        scope: { roots: ['app'], kinds: ['code'], tests: true },
        match: horizontalStacks,
        allowlist: [],
        samples: {
          flags: [tsx('<div className="flex items-center stack-2" />'), tsx('<label className="inline-flex md:stack-3" />')],
          passes: [tsx('<div className="flex flex-col stack-2" />'), tsx('<div className="stack-4" />'), tsx('<div className="flex gap-2" />')],
        },
      }),
    ];
  },
};

// ---- an unavailable control never wears the clickable affordance -------------------------------

const EXCLUDES_DISABLED = /:not\([^)]*:disabled/;
const EXCLUDES_ARIA_DISABLED = /:not\([^)]*\[aria-disabled\s*=\s*['"]?true['"]?\s*\]/;
const ROLE_BUTTON = /\[role\s*=\s*['"]?button['"]?\s*\]/;
const TYPE_BUTTON = /(?<![\w.#-])button(?![\w-])/;

/** Selectors that give a button the pointer cursor or a press transform without excluding an unavailable one. */
export const affordanceOnUnavailable: Matcher = (file) => {
  if (file.kind !== 'stylesheet') return [];
  const hits: Hit[] = [];
  for (const block of cssBlocks(file.code)) {
    if (block.atRule) continue;
    const pointer = block.declarations.some((d) => d.property === 'cursor' && /^pointer\b/.test(d.value));
    const transform = block.declarations.some((d) => d.property === 'transform' || d.property === 'scale' || d.property === 'translate');
    for (const selector of selectorsOf(block)) {
      const press = transform && selector.includes(':active');
      if (!pointer && !press) continue;
      const subject = subjectCompound(selector);
      const withoutAttributes = subject.replace(/\[[^\]]*\]/g, '');
      const typeButton = TYPE_BUTTON.test(withoutAttributes);
      const roleButton = ROLE_BUTTON.test(subject);
      if (!typeButton && !roleButton) continue;
      const missing: string[] = [];
      if (typeButton && !EXCLUDES_DISABLED.test(subject)) missing.push(':not(:disabled)');
      if (!EXCLUDES_ARIA_DISABLED.test(subject)) missing.push(":not([aria-disabled='true'])");
      if (missing.length) hits.push({ index: block.index, detail: `${selector} gives the ${press ? 'press effect' : 'pointer cursor'} without ${missing.join(' and ')}` });
    }
  }
  return hits;
};

export const unavailableAffordanceGuard: GenericGuardDefinition<Record<string, never>> = {
  id: 'unavailableControlAffordance',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts, 'facts', problems);
    return problems;
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'an unavailable control never wears the clickable affordance',
        description:
          "A pending control is aria-disabled and never natively disabled (it keeps focus), so an app rule that gives a " +
          "button the pointer cursor or a press effect excludes :disabled AND [aria-disabled='true'] (a [role=button] " +
          'element excludes the second); otherwise a control that ignores activation still looks pressable.',
        scope: APP_STYLES,
        match: affordanceOnUnavailable,
        allowlist: [],
        samples: {
          flags: [css('button:not(:disabled) { cursor: pointer; }'), css(':is(button, a).btn:active:not(:disabled) { transform: scale(0.97); }'), css("[role='button'] { cursor: pointer; }")],
          passes: [
            css("button:not(:disabled):not([aria-disabled='true']), [role='button']:not([aria-disabled='true']), summary { cursor: pointer; }"),
            css(":is(button, a).btn:active:not(:disabled):not([aria-disabled='true']) { transform: scale(0.97); }"),
            css('.coin { cursor: pointer; }'),
          ],
        },
      }),
    ];
  },
};

/** Findings for a file-level matcher run over a scope, for guards that run one directly. */
export function scopeFindings(files: readonly FileView[], match: Matcher, prefix = ''): Finding[] {
  return files.flatMap((file) => match(file).map((hit) => ({ file: file.path, line: file.lineOf(hit.index), detail: `${prefix}${hit.detail ?? ''}` })));
}
