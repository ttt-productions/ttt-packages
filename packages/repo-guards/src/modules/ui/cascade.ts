// The UI guards over the stylesheet cascade: one entry stylesheet in a pinned order, every
// class-rendering package scanned by Tailwind, a semantic text class that survives the
// same-named Tailwind utility, and the theme token blocks.

import { dirnameOf, normalizePath } from '../../support/paths.js';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import {
  cssBlocks,
  HSL_TRIPLE,
  layerOrder,
  normalizeStatement,
  resolveToken,
  selectorsOf,
  subjectCompound,
  topLevelStatements,
} from './css.js';
import { isText, namesProblem, objectProblem, pathProblem } from '../../support/facts.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';
import { APP_CODE, type EntryStylesheetFacts } from './styling.js';
import { installedManifest, loadedStylesheets, type LoadedSheet } from './stylesheets.js';


function entryProblems(facts: unknown): string[] {
  const problems: string[] = [];
  if (objectProblem(facts, 'facts', problems)) pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
  return problems;
}

// ---- one stylesheet entry, pinned order -------------------------------------------------------

/** The entry's top-level statements as the pin compares them; a run of `@source` lines is one entry. */
export function pinnedStatements(code: string): string[] {
  const out: string[] = [];
  for (const statement of topLevelStatements(code)) {
    const text = statement.bodyIndex === undefined ? normalizeStatement(statement.text) : `${normalizeStatement(statement.text)} { … }`;
    if (text.startsWith('@source ')) {
      if (out[out.length - 1] !== '@source …') out.push('@source …');
    } else out.push(text);
  }
  return out;
}

/** Whether a module specifier names a stylesheet: a `.css` file or a scoped package's style subpath. */
export const namesStylesheet = (spec: string): boolean => /\.css$/.test(spec) || /^@[\w-]+\/[\w.-]+\/styles$/.test(spec);

export interface StylesheetEntryFacts {
  /** The one module that imports the entry stylesheet (the root layout). */
  layoutModule: string;
  /** The entry stylesheet. */
  entryStylesheet: string;
  /** The entry's top-level statements, in order, as `pinnedStatements` reads them. */
  pinnedOrder: readonly string[];
}

export const stylesheetEntryGuard: GenericGuardDefinition<StylesheetEntryFacts> = {
  id: 'stylesheetEntry',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.layoutModule, 'layoutModule', problems);
    pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
    if (!Array.isArray(facts.pinnedOrder) || !facts.pinnedOrder.length) problems.push('pinnedOrder is missing or empty');
    else if (!facts.pinnedOrder.every(isText)) problems.push('pinnedOrder holds an empty or non-text statement');
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'only the root layout imports a stylesheet, and it imports exactly the entry stylesheet',
        description:
          'The entry stylesheet is the one stylesheet the app imports from code; every other sheet joins it at a fixed ' +
          'position in its pinned order. A sheet imported anywhere else lands unlayered and beats every layered rule. ' +
          'Move the import into the entry stylesheet, and put component styles in a semantic class in an app sheet.',
        run(context) {
          const findings: Finding[] = [];
          let canonical = 0;
          for (const file of context.files(APP_CODE)) {
            for (const { spec, specifier } of moduleImports(file.sourceFile, MODULE_LOADS)) {
              const index = specifier.getStart(file.sourceFile);
              if (!namesStylesheet(spec)) continue;
              const resolved = spec.startsWith('.') ? normalizePath(`${dirnameOf(file.path)}/${spec}`).path : spec;
              if (file.path === facts.layoutModule && resolved === facts.entryStylesheet) canonical += 1;
              else findings.push({ file: file.path, line: file.lineOf(index), detail: `imports the stylesheet ${spec}` });
            }
          }
          if (canonical !== 1) findings.push({ file: facts.layoutModule, detail: `imports the entry stylesheet ${facts.entryStylesheet} ${canonical} times; it must import it exactly once` });
          return findings;
        },
      },
      {
        title: 'the entry stylesheet keeps its pinned statements in their pinned order',
        description:
          'The declared cascade layer order plus the order of the entry stylesheet’s imports IS the cascade: reordering ' +
          'it, dropping a sheet out of its layer, or adding a sheet without a fixed position changes which rule wins ' +
          'app-wide. The entry holds exactly the pinned statements, in order (one run of @source lines counts once); a ' +
          'deliberate change updates the pinned order in the app’s guard config.',
        run(context) {
          if (!context.reader.exists(facts.entryStylesheet)) return [{ file: facts.entryStylesheet, detail: 'the entry stylesheet does not exist' }];
          const actual = pinnedStatements(context.file(facts.entryStylesheet).code);
          const expected = facts.pinnedOrder;
          const findings: Finding[] = [];
          const length = Math.max(actual.length, expected.length);
          for (let i = 0; i < length; i += 1) {
            if (actual[i] !== expected[i]) {
              findings.push({ file: facts.entryStylesheet, detail: `statement ${i + 1} is ${actual[i] ?? '(nothing)'}; pinned: ${expected[i] ?? '(nothing)'}` });
              break;
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---- Tailwind @source covers every class-rendering package ------------------------------------

export interface TailwindSourceFacts {
  /** The entry stylesheet that carries the `@source` lines. */
  entryStylesheet: string;
  /** The app's package manifest, whose dependencies start the installed-package walk. */
  manifest: string;
  /** Package-name prefixes whose installed builds Tailwind must scan (`@scope/`). */
  packageScopes: readonly string[];
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

/** Every installed package in the scopes the manifest reaches, directly or through another one. */
function installedScopedPackages(context: GuardContext, manifest: Record<string, unknown>, scopes: readonly string[]) {
  const installed: string[] = [];
  const missing: string[] = [];
  const queue: Array<{ name: string; required: boolean }> = [];
  const seen = new Set<string>();
  const enqueue = (m: Record<string, unknown>, direct: boolean) => {
    for (const field of DEPENDENCY_FIELDS) {
      const deps = m[field];
      if (!deps || typeof deps !== 'object') continue;
      for (const name of Object.keys(deps)) {
        if (!scopes.some((s) => name.startsWith(s)) || seen.has(name)) continue;
        seen.add(name);
        queue.push({ name, required: direct && field !== 'peerDependencies' && field !== 'optionalDependencies' });
      }
    }
  };
  enqueue(manifest, true);
  while (queue.length) {
    const { name, required } = queue.shift()!;
    const m = installedManifest(context, name);
    if (!m) {
      if (required) missing.push(name);
      continue;
    }
    installed.push(name);
    enqueue(m, false);
  }
  return { installed: installed.sort(), missing };
}

/** The build files of an installed package that render a class (`className:` in compiled JSX). */
function classRenderingFiles(context: GuardContext, name: string): { files: string[]; readable: boolean } {
  const code = context.reader.installedFiles(name, { kinds: ['code'] });
  const files = code.filter((f) => /\bclassName\s*:/.test(f.code)).map((f) => f.path);
  return { files, readable: code.length > 0 };
}

/** The repo-relative folder each `@source` glob scans, from the folder of the sheet that names it. */
export function sourceRoots(sheet: FileView): string[] {
  const out: string[] = [];
  for (const statement of topLevelStatements(sheet.code)) {
    const m = /^@source\s+["']([^"']+)["']$/.exec(statement.text);
    if (!m) continue;
    const literal = m[1].split(/[*{[?!]/)[0];
    out.push(normalizePath(`${dirnameOf(sheet.path)}/${literal}`).path);
  }
  return out;
}

export const tailwindSourcesGuard: GenericGuardDefinition<TailwindSourceFacts> = {
  id: 'tailwindSources',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
    pathProblem(facts.manifest, 'manifest', problems);
    namesProblem(facts.packageScopes, 'packageScopes', problems);
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'Tailwind scans every installed package whose build renders classes',
        description:
          'Tailwind never scans node_modules, so a package whose build renders utility classes needs an @source line in ' +
          'the entry stylesheet that covers its build folder, or the classes it renders never generate. The packages are ' +
          'found from the app manifest and what each installed package depends on, never listed. Add ' +
          "`@source '<path to node_modules>/<package>/dist/**/*.{js,ts,jsx,tsx}';` to the entry stylesheet's run of @source lines.",
        timeoutMs: 60_000,
        run(context) {
          const findings: Finding[] = [];
          if (!context.reader.exists(facts.manifest)) return [{ file: facts.manifest, detail: 'the app manifest does not exist' }];
          if (!context.reader.exists(facts.entryStylesheet)) return [{ file: facts.entryStylesheet, detail: 'the entry stylesheet does not exist' }];
          const manifest = JSON.parse(context.file(facts.manifest).text) as Record<string, unknown>;
          const { installed, missing } = installedScopedPackages(context, manifest, facts.packageScopes);
          for (const name of missing) findings.push({ file: facts.manifest, detail: `${name} is a dependency but is not installed, so its build cannot be read` });
          if (!installed.length) findings.push({ file: facts.manifest, detail: 'no installed package in the declared scopes was found, so nothing could be checked' });
          const roots = sourceRoots(context.file(facts.entryStylesheet));
          for (const name of installed) {
            const { files, readable } = classRenderingFiles(context, name);
            if (!readable) {
              findings.push({ file: `node_modules/${name}`, detail: 'ships no type declarations, so its build files cannot be read' });
              continue;
            }
            const uncovered = files.filter((f) => !roots.some((root) => f === root || f.startsWith(`${root}/`)));
            if (uncovered.length) findings.push({ file: facts.entryStylesheet, detail: `no @source line covers ${name}, which renders classes in ${uncovered[0]}` });
          }
          return findings;
        },
      },
    ];
  },
};

// ---- a semantic text class survives the same-named Tailwind utility --------------------------

/** The Tailwind text-color utilities the loaded `@theme` blocks mint, with the color each paints. */
function textColorUtilities(sheets: readonly LoadedSheet[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const { file } of sheets) {
    for (const block of cssBlocks(file.code)) {
      if (!block.prelude.startsWith('@theme')) continue;
      for (const d of block.declarations) {
        const m = /^--color-([\w-]+)$/.exec(d.property);
        if (m && d.value !== 'initial') out.set(`text-${m[1]}`, d.value);
      }
    }
  }
  return out;
}

const sameColor = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/** The class a selector's subject compound names from the utility set, if any. */
function utilityClassIn(selector: string, utilities: ReadonlyMap<string, string>): string | null {
  for (const m of subjectCompound(selector).matchAll(/\.([\w-]+)(?![\w-])/g)) if (utilities.has(m[1])) return m[1];
  return null;
}

export function semanticTextFindings(context: GuardContext, entryStylesheet: string): Finding[] {
  const { sheets, findings } = loadedStylesheets(context, entryStylesheet);
  const entry = sheets.find((s) => s.file.path === entryStylesheet);
  const order = entry ? topLevelStatements(entry.file.code).map((s) => layerOrder(s.text)).find((o) => o !== null) : null;
  const utilitiesAt = order ? order.indexOf('utilities') : -1;
  if (!order || utilitiesAt === -1) {
    findings.push({ file: entryStylesheet, detail: 'declares no cascade layer order naming the utilities layer, so no rule can be placed against it' });
    return findings;
  }
  const utilities = textColorUtilities(sheets);
  const outranks = (sheet: LoadedSheet) => sheet.layer === null || order.indexOf(sheet.layer) > utilitiesAt;
  const pins = new Map<string, string>();
  for (const sheet of sheets.filter((s) => !s.fromPackage && outranks(s))) {
    for (const block of cssBlocks(sheet.file.code)) {
      const color = block.declarations.find((d) => d.property === 'color')?.value;
      if (!color) continue;
      for (const selector of selectorsOf(block)) if (utilities.has(selector.slice(1)) && /^\.[\w-]+$/.test(selector)) pins.set(selector.slice(1), color);
    }
  }
  for (const sheet of sheets.filter((s) => !outranks(s))) {
    for (const block of cssBlocks(sheet.file.code)) {
      const color = block.declarations.find((d) => d.property === 'color');
      if (!color) continue;
      for (const selector of selectorsOf(block)) {
        const name = utilityClassIn(selector, utilities);
        if (!name || sameColor(color.value, utilities.get(name)!)) continue;
        if (!sheet.fromPackage) {
          findings.push({
            file: sheet.file.path,
            line: sheet.file.lineOf(color.index),
            detail: `${selector} sets color: ${color.value}, but Tailwind's ${name} utility (${utilities.get(name)}) sits in a later layer and wins`,
          });
        } else if (selector === `.${name}`) {
          const pin = pins.get(name);
          if (!pin || !sameColor(pin, color.value)) {
            findings.push({
              file: sheet.file.path,
              line: sheet.file.lineOf(color.index),
              detail: `.${name} paints ${color.value}, but Tailwind's same-named utility paints ${utilities.get(name)} and wins; pin \`.${name} { color: ${color.value}; }\` in a sheet above the utilities layer`,
            });
          }
        }
      }
    }
  }
  return findings;
}

export const utilityCollisionGuard: GenericGuardDefinition<EntryStylesheetFacts> = {
  id: 'semanticTextCollision',
  absentWhen: false,
  factProblems: entryProblems,
  build(facts): Guard[] {
    return [
      {
        title: 'a semantic text class keeps its color against the same-named Tailwind utility',
        description:
          'Tailwind mints a text-X utility from every --color-X theme color, and the utilities layer outranks every sheet ' +
          'in an earlier layer. A semantic .text-X class (from the theme package or the app) that paints a different ' +
          'color than the utility loses to it, so its text takes the utility color. Pin the semantic color in a sheet ' +
          'imported into a layer above utilities; an app rule below that layer that re-colors .text-X never applies — ' +
          'move it above utilities too.',
        timeoutMs: 60_000,
        run: (context) => semanticTextFindings(context, facts.entryStylesheet),
      },
    ];
  },
};

// ---- theme tokens declared in every theme block ---------------------------------------------

export interface ThemeTokenFacts {
  /** The entry stylesheet: the token cascade is read in the order it loads its sheets. */
  entryStylesheet: string;
  /** The app's token sheet that declares the `:root`, `.dark` and `.high-contrast` blocks. */
  tokenSheet: string;
}

const LITERAL_COLOUR = /\b(?:oklch|oklab|lab|lch|rgba?|hsla?)\(\s*[\d.]|#[0-9a-fA-F]{3,8}\b/;
const COMPLETE_COLOUR = /\b(hsla?|rgba?|oklch|color-mix)\(|#[0-9a-fA-F]{3,8}\b/;
const THEME_BLOCKS = [':root', '.dark', '.high-contrast'] as const;

/** The declarations of the first top-level rule whose selector is exactly `selector`. */
function exactBlock(file: FileView, selector: string): { index: number; tokens: Map<string, string> } | null {
  const block = cssBlocks(file.code).find((b) => !b.atRule && b.within.length === 0 && b.prelude === selector);
  if (!block) return null;
  return { index: block.index, tokens: new Map(block.declarations.filter((d) => d.property.startsWith('--')).map((d) => [d.property, d.value])) };
}

/** The effective token map of one theme: every rule whose selector list names `:root` or the theme's class, in cascade order. */
function themeCascade(sheets: readonly LoadedSheet[], themeSelector: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const { file } of sheets) {
    for (const block of cssBlocks(file.code)) {
      const selectors = selectorsOf(block);
      if (!selectors.includes(':root') && !(themeSelector && selectors.includes(themeSelector))) continue;
      for (const d of block.declarations) if (d.property.startsWith('--')) out.set(d.property, d.value);
    }
  }
  return out;
}

export function themeTokenFindings(context: GuardContext, facts: ThemeTokenFacts): Finding[] {
  const findings: Finding[] = [];
  if (!context.reader.exists(facts.tokenSheet)) return [{ file: facts.tokenSheet, detail: 'the token sheet does not exist' }];
  const sheet = context.file(facts.tokenSheet);
  const blocks = THEME_BLOCKS.map((selector) => ({ selector, block: exactBlock(sheet, selector) }));
  for (const { selector, block } of blocks) if (!block) findings.push({ file: sheet.path, detail: `declares no top-level ${selector} block` });
  if (findings.length) return findings;
  const [root, dark, hc] = blocks.map((b) => b.block!);
  if (!(root.index < dark.index && dark.index < hc.index)) {
    findings.push({ file: sheet.path, detail: 'the theme blocks must come in the order :root, .dark, .high-contrast — they tie on specificity, so the later block wins' });
  }
  const varying = new Set([...dark.tokens.keys(), ...hc.tokens.keys()]);
  for (const [token, value] of root.tokens) if (HSL_TRIPLE.test(value)) varying.add(token);
  for (const token of varying) {
    for (const [i, selector] of THEME_BLOCKS.entries()) {
      if (![root, dark, hc][i].tokens.has(token)) findings.push({ file: sheet.path, detail: `${token} is a theme color but is missing from ${selector}, so that theme takes another block's value` });
    }
  }
  for (const [token, value] of root.tokens) {
    if (dark.tokens.has(token) || hc.tokens.has(token)) continue;
    if (COMPLETE_COLOUR.test(value) && !/var\(--/.test(value)) {
      findings.push({ file: sheet.path, line: sheet.lineOf(root.index), detail: `${token} is a literal color declared only in :root, so every theme paints it the same` });
    }
  }
  const { sheets, findings: unresolved } = loadedStylesheets(context, facts.entryStylesheet);
  findings.push(...unresolved);
  const tokenSheetAt = sheets.findIndex((s) => s.file.path === facts.tokenSheet);
  if (tokenSheetAt === -1) {
    findings.push({ file: facts.entryStylesheet, detail: `does not load the token sheet ${facts.tokenSheet}` });
    return findings;
  }
  const packageDefaults = new Map<string, string>();
  for (const { file } of sheets.slice(0, tokenSheetAt).filter((s) => s.fromPackage)) {
    for (const block of cssBlocks(file.code)) {
      if (block.atRule || block.prelude !== ':root') continue;
      for (const d of block.declarations) if (d.property.startsWith('--')) packageDefaults.set(d.property, d.value);
    }
  }
  const setAtRoot = new Set<string>();
  for (const block of cssBlocks(sheet.code)) {
    if (selectorsOf(block).includes(':root')) for (const d of block.declarations) setAtRoot.add(d.property);
  }
  for (const [token, value] of packageDefaults) {
    if (LITERAL_COLOUR.test(value) && !setAtRoot.has(token)) {
      findings.push({ file: sheet.path, detail: `${token} keeps the theme package's literal default (${value}); set it in :root from the app's tokens` });
    }
  }
  const highContrast = themeCascade(sheets, '.high-contrast');
  for (const token of highContrast.keys()) {
    const value = resolveToken(highContrast, token);
    const m = value === undefined ? null : HSL_TRIPLE.exec(value.trim());
    if (m && Number(m[2]) !== 0) findings.push({ file: sheet.path, detail: `${token} resolves to ${value} in high contrast; high contrast is monochrome (saturation 0)` });
  }
  for (const [token, expected] of [['--background', '0 0% 0%'], ['--foreground', '0 0% 100%']] as const) {
    const value = resolveToken(highContrast, token);
    if (value !== expected) findings.push({ file: sheet.path, detail: `${token} resolves to ${value ?? '(nothing)'} in high contrast; it must be ${expected}` });
  }
  return findings;
}

export const themeTokensGuard: GenericGuardDefinition<ThemeTokenFacts> = {
  id: 'themeTokens',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
    pathProblem(facts.tokenSheet, 'tokenSheet', problems);
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'every theme token is declared in :root, .dark, and .high-contrast, and high contrast is monochrome',
        description:
          'The token sheet declares :root, then .dark, then .high-contrast (they tie on specificity, so order decides). A ' +
          'token that varies by theme — declared in .dark or .high-contrast, or a raw triplet in :root — is declared in ' +
          'all three, or another theme’s value leaks in. A literal color only in :root never changes with the theme. Every ' +
          'literal color the theme package defaults in :root is set from the app’s tokens. In the effective high-contrast ' +
          'cascade every triplet has saturation 0, with --background pure black and --foreground pure white.',
        timeoutMs: 60_000,
        run: (context) => themeTokenFindings(context, facts),
      },
    ];
  },
};
