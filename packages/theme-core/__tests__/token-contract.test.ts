import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// theme-core's token layer is the contract every shared recipe and ui-core
// component reads. These guards pin the PROPERTIES, not today's token list:
//  - every variable read without a fallback, in any package, resolves in every theme;
//  - an HSL-triplet token is only ever read inside hsl(), never as a complete colour;
//  - every semantic Tailwind colour utility ui-core renders maps to a token, and
//    ui-core renders no raw colour (palette utility or literal);
//  - shadows are token- and class-owned: no Tailwind shadow utility in ui-core, no
//    literal shadow in a theme-core recipe;
//  - no package stylesheet carries a raw colour literal (values live in theme-core's
//    token declarations), and every package stylesheet reads only resolvable tokens;
//  - every black-drop-shadow token is redeclared for the dark canvases.

const packagesDir = path.resolve(__dirname, '../..');
const THEME_CORE_SRC = path.join(packagesDir, 'theme-core', 'src');
const DARK_CANVAS_BLOCKS = ['.dark', '.high-contrast'] as const;

// Variables set at runtime on individual elements by a library. theme-core cannot
// (and must not) declare them. Each entry states who sets it.
const RUNTIME_VARIABLES: ReadonlyArray<{ pattern: RegExp; setBy: string }> = [
  { pattern: /^--radix-/, setBy: 'Radix primitives, on their own elements (trigger size, swipe offset)' },
];

// --- source + CSS reading ----------------------------------------------------------

function sourceFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

function read(file: string): string {
  const src = readFileSync(file, 'utf8');
  return file.endsWith('.css') ? src.replace(/\/\*[\s\S]*?\*\//g, '') : src;
}

function where(file: string): string {
  return path.relative(packagesDir, file);
}

interface CssRule {
  file: string;
  selector: string;
  declarations: Array<[property: string, value: string]>;
}

/** Innermost rule blocks (a rule nested in @media is returned with its own selector). */
function cssRules(file: string): CssRule[] {
  return [...read(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    file: path.basename(file),
    selector: selector.trim(),
    declarations: body
      .split(';')
      .map((decl) => decl.trim())
      .filter((decl) => decl.includes(':'))
      .map((decl) => {
        const idx = decl.indexOf(':');
        return [decl.slice(0, idx).trim(), decl.slice(idx + 1).trim()] as [string, string];
      }),
  }));
}

const themeStylesheets = sourceFiles(path.join(THEME_CORE_SRC, 'styles'), ['.css']);
const themeRules = themeStylesheets.flatMap(cssRules);

// Every OTHER package's shipped stylesheet (report-core, media-viewer, chat-react, …): they
// read theme-core tokens too, never an app-defined variable or a raw colour.
const packageStylesheets = readdirSync(packagesDir)
  .filter((pkg) => pkg !== 'theme-core')
  .flatMap((pkg) => {
    const src = path.join(packagesDir, pkg, 'src');
    try {
      return sourceFiles(src, ['.css']);
    } catch {
      return [];
    }
  });
const packageStyleRules = packageStylesheets.flatMap(cssRules);

function blockDeclarations(selector: string): Map<string, string> {
  return new Map(themeRules.filter((r) => r.selector === selector).flatMap((r) => r.declarations));
}

// A token declared in :root resolves in every theme: .dark / .high-contrast match
// the same root element and either redeclare it or leave the :root value in force.
const rootTokens = new Set([...blockDeclarations(':root').keys()].filter((p) => p.startsWith('--')));

// Class names theme-core defines. ui-core also renders these, and some share a
// Tailwind prefix (`text-caption`), so they are recipes, not colour utilities.
const themeClasses = new Set(
  themeRules.flatMap((r) => [...r.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1])),
);

// --- package Tailwind utilities ---------------------------------------------------

const COLOUR_UTILITY =
  /(?<=^|[\s"'`:!])((?:bg|text|border|ring-offset|ring|outline|divide|fill|stroke|placeholder|caret|decoration)-[a-z0-9][a-z0-9-]*)(?:\/\d+)?(?=$|[\s"'`])/g;
const COLOUR_PREFIX =
  /^(?:ring-offset|border-[xytblrse]|border|divide-[xy]|divide|bg|text|ring|outline|fill|stroke|placeholder|caret|decoration)-(.+)$/;
// Tailwind's raw palette. None of it may appear in any package: colours come from tokens.
const PALETTE =
  /^((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|black|white)$/;
// Not raw colours: CSS colour keywords, and non-colour utilities that share a colour
// prefix (sizes, sides, alignment, styles).
const NOT_A_RAW_COLOUR =
  /^(transparent|current|inherit|\d+(\.\d+)?|px|xs|sm|base|md|lg|\d?xl|[xytblrse]|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|solid|dashed|dotted|double|wavy|hidden|none|collapse|separate|inset|auto|offset-\d+|from-font|fixed|local|scroll|cover|contain|repeat|no-repeat|repeat-[xy]|clip-\w+|origin-\w+|gradient-[\w-]+)$/;
// A literal colour in source: hex in a class/style/string position, or a colour
// function whose first argument is a number rather than var(...).
const SOURCE_COLOUR_LITERAL =
  /(?<=[\s"'`(:[,])#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[-\d.]/g;
// A raw colour in a stylesheet value: hex, a colour function with a numeric argument, or
// a black/white keyword.
const STYLESHEET_COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[-\d.]|\b(white|black)\b/i;
// A bare HSL triplet ("0 84% 60%"): only a colour inside hsl(), so it hides in a fallback.
const HSL_TRIPLET = /^-?\d*\.?\d+(?:deg|turn|rad|grad)?[\s,]+\d*\.?\d+%[\s,]+\d*\.?\d+%/;

/** The fallback text of every var() in `value`, nested var() fallbacks included. */
function varFallbacks(value: string): string[] {
  return [...value.matchAll(/var\(\s*--[\w-]+\s*,/g)].map((m) => {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < value.length && depth > 0; i++) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
    }
    return value.slice(start, i - 1).trim();
  });
}
const isRawColour = (fallback: string) => HSL_TRIPLET.test(fallback) || STYLESHEET_COLOUR_LITERAL.test(fallback);

const SHADOW_UTILITY =/(?<=^|[\s"'`:!])((?:inset-|drop-)?shadow(?:-[^\s"'`]*)?)(?=$|[\s"'`])/g;
const ELEVATION_HOOK = /(?<=^|[\s"'`])(elevation-[a-z-]+|card-border|tabs-trigger)(?=$|[\s"'`])/g;

// Every package's component source: raw colours and shadow utilities are banned in all of
// them, not just ui-core (file-input, chat-react, media-viewer, … render with the same tokens).
const packageSources = readdirSync(packagesDir).flatMap((pkg) => {
  try {
    return sourceFiles(path.join(packagesDir, pkg, 'src'), ['.ts', '.tsx']);
  } catch {
    return [];
  }
});

/** Every package's TS/TSX source plus every stylesheet (theme-core's and the other packages'). */
const allPackageFiles = [...packageSources, ...themeStylesheets, ...packageStylesheets];

const CLASS_HELPERS = new Set(['cn', 'cva', 'clsx', 'cx', 'twMerge']);
const CLASS_NAME = /(?:^|[a-z])(?:Class|ClassName|Classes)$|^[A-Z_]*CLASS(?:ES)?$|^className$/;

function parseSource(file: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

/** Every string literal and template chunk under `node`, appended to `out`. */
function collectStrings(node: ts.Node, out: string[]): void {
  if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    out.push(node.text);
  }
  ts.forEachChild(node, (child) => collectStrings(child, out));
}

/**
 * The strings a file uses as CLASS LISTS: a `className` / `*ClassName` JSX attribute, an
 * argument of cn / cva / clsx / cx / twMerge, or a variable or property named as a class
 * string (`triggerClass`, `SIZE_CLASS`). Parsed with the TypeScript compiler, so prose
 * in comments and CSS text in style strings (`"stroke-dashoffset 0.1s"`) never count.
 */
function classStrings(file: string): string[] {
  const sf = parseSource(file);
  const out: string[] = [];
  const collect = (node: ts.Node) => collectStrings(node, out);
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.initializer && CLASS_NAME.test(node.name.getText(sf))) return collect(node.initializer);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CLASS_HELPERS.has(node.expression.text)) {
      return node.arguments.forEach(collect);
    }
    if ((ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) && node.initializer && CLASS_NAME.test(node.name.getText(sf))) {
      return collect(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * Every string in a source file — class lists, style strings, template chunks — parsed with
 * the TypeScript compiler, so prose in comments never counts.
 */
function sourceStrings(file: string): string[] {
  const out: string[] = [];
  collectStrings(parseSource(file), out);
  return out;
}

/**
 * The raw colours hidden in var() fallbacks inside source strings. A Tailwind arbitrary value
 * spells its spaces as `_` (`bg-[hsl(var(--x,_0_84%_60%))]`), so each fallback is decoded
 * before it is judged.
 */
function sourceFallbackColours(text: string): string[] {
  return varFallbacks(text)
    .map((fallback) => fallback.replace(/_/g, ' ').trim())
    .filter(isRawColour);
}

/** Colour-prefixed utilities in the class lists of `files`, minus the theme-core recipe classes. */
function classListColourUtilities(files: readonly string[]): Array<{ where: string; utility: string; name: string }> {
  return files.flatMap((file) =>
    classStrings(file)
      .flatMap((list) => [...list.matchAll(COLOUR_UTILITY)].map(([, utility]) => utility))
      .filter((utility) => !themeClasses.has(utility))
      .map((utility) => ({ where: where(file), utility, name: COLOUR_PREFIX.exec(utility)?.[1] ?? '' }))
      .filter(({ name }) => name !== ''),
  );
}

/** Colour-prefixed utilities in `files`, minus the theme-core recipe classes. */
function colourUtilities(files: readonly string[]): Array<{ where: string; utility: string; name: string }> {
  return files.flatMap((file) =>
    [...read(file).matchAll(COLOUR_UTILITY)]
      .map(([, utility]) => utility)
      .filter((utility) => !themeClasses.has(utility))
      .map((utility) => ({ where: where(file), utility, name: COLOUR_PREFIX.exec(utility)?.[1] ?? '' }))
      .filter(({ name }) => name !== ''),
  );
}

// --- status fill / foreground pairing -------------------------------------------------

// A token's status family comes from its name: `destructive` / `status-error` /
// `toast-destructive` are the destructive family, `success` / `button-success` /
// `toast-success-foreground` the success family, and so on.
const STATUS_WORD = /(?:^|-)(destructive|error|success|warning|info)(?:-|$)/;
function statusFamily(token: string): string | undefined {
  const word = STATUS_WORD.exec(token)?.[1];
  return word === 'error' ? 'destructive' : word;
}
/** A token that paints a status family's fill (not its text, edge, or deep shade). */
const isStatusFill = (token: string) => statusFamily(token) !== undefined && !/-(foreground|border)$/.test(token);
const isForegroundOf = (token: string, family: string) => token.endsWith('-foreground') && statusFamily(token) === family;

/** The first variable a colour value reads, or the named token of a semantic utility. */
const firstVar = (value: string) => /var\(\s*--([\w-]+)/.exec(value)?.[1];

/**
 * The status-fill pairing violations in one class list: a SOLID status fill at rest (no
 * modifier prefix, no alpha — a faint tint carries ordinary body text instead) must carry
 * a text colour, and every resting text colour must be that family's own foreground.
 */
function classListPairingViolations(list: string): string[] {
  const tokens = list.split(/\s+/).filter(Boolean);
  const fills = tokens
    // `bg-x/10`, `bg-[…]/90`, `bg-[hsl(var(--x)_/_0.1)]` are alpha tints, not solid fills
    .filter((t) => t.startsWith('bg-') && !/\/[_\s]*\.?\d/.test(t))
    .map((t) => (t.startsWith('bg-[') ? firstVar(t) : t.slice(3)))
    .filter((token): token is string => token !== undefined && isStatusFill(token));
  if (fills.length === 0) return [];
  const texts = tokens
    .filter((t) => t.startsWith('text-'))
    .map((t) => (t.startsWith('text-[') ? firstVar(t) : t.slice(5).replace(/\/\d+$/, '')))
    .filter((token): token is string => token !== undefined && rootTokens.has(`--${token}`));
  return fills.flatMap((fill) => {
    const family = statusFamily(fill)!;
    if (texts.length === 0) return [`--${fill} fill sets no text colour (needs a ${family} foreground)`];
    return texts
      .filter((text) => !isForegroundOf(text, family))
      .map((text) => `--${fill} fill carries --${text} text (needs a ${family} foreground)`);
  });
}

/** The same pairing, for one stylesheet rule's background + color declarations. */
function cssRulePairingViolations(rule: CssRule): string[] {
  const decls = new Map(rule.declarations);
  const background = decls.get('background-color') ?? decls.get('background');
  const solid = background && /^(?:hsl\(\s*var\(\s*--([\w-]+)\s*\)\s*\)|var\(\s*--([\w-]+)\s*\))$/.exec(background);
  const fill = solid ? (solid[1] ?? solid[2]) : undefined;
  if (!fill || !isStatusFill(fill)) return [];
  const family = statusFamily(fill)!;
  const color = decls.get('color');
  const text = color ? firstVar(color) : undefined;
  if (!text) return [`--${fill} fill sets no text colour (needs a ${family} foreground)`];
  return isForegroundOf(text, family) ? [] : [`--${fill} fill carries --${text} text (needs a ${family} foreground)`];
}

// Solid status fills that render NO text, so they pair with no foreground. Each entry
// states what the element is.
const TEXTLESS_STATUS_FILLS: ReadonlyArray<{ file: string; selector: string; why: string }> = [
  { file: 'hooks.css', selector: '.notify-dot', why: 'the 8px unread dot — a shape, no text' },
];

// --- guards --------------------------------------------------------------------------

describe('theme-core token contract', () => {
  it('every variable read without a fallback, in any package source or stylesheet, resolves in every theme', () => {
    const files = allPackageFiles;
    const unresolved = files.flatMap((file) =>
      [...read(file).matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)]
        .filter(([, , next]) => next === ')')
        .map(([, name]) => name)
        .filter((name) => !rootTokens.has(name) && !RUNTIME_VARIABLES.some((v) => v.pattern.test(name)))
        .map((name) => `${where(file)}: ${name}`),
    );
    expect(unresolved).toEqual([]);
  });

  // Semantic colour tokens are HSL TRIPLETS ("240 5% 88%"): only hsl(var(--x)) makes a
  // colour of one. Read bare — color: var(--foreground) — the value is invalid and the
  // property silently falls back (inherited colour, transparent background).
  it('an HSL-triplet token is only ever read inside hsl(), never as a complete colour', () => {
    const TRIPLET = /^-?\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;
    const root = blockDeclarations(':root');
    const isTriplet = (name: string, seen: ReadonlySet<string> = new Set()): boolean => {
      const value = root.get(name);
      if (value === undefined || seen.has(name)) return false;
      if (TRIPLET.test(value)) return true;
      const derived = /^var\((--[\w-]+)\)$/.exec(value);
      return derived ? isTriplet(derived[1], new Set([...seen, name])) : false;
    };
    const triplets = new Set([...rootTokens].filter((name) => isTriplet(name)));
    expect(triplets.has('--foreground') && triplets.has('--input')).toBe(true);

    /** The function whose argument list encloses `index` (skipping var() fallbacks), or undefined. */
    const enclosingColourFunction = (text: string, index: number): string | undefined => {
      let depth = 0;
      for (let i = index - 1; i >= 0; i--) {
        const c = text[i];
        if (c === ')') depth++;
        else if (c === '(') {
          if (depth > 0) {
            depth--;
            continue;
          }
          const name = /([\w-]+)\s*$/.exec(text.slice(Math.max(0, i - 40), i))?.[1];
          return name === 'var' ? enclosingColourFunction(text, i - 3) : name;
        } else if (depth === 0 && ';{}\n"\'`'.includes(c)) return undefined;
      }
      return undefined;
    };
    /** `--x: var(--triplet)` — one token derived from another, not a colour read. */
    const isTokenDerivation = (text: string, index: number): boolean => {
      const lineStart = Math.max(text.lastIndexOf(';', index), text.lastIndexOf('{', index), text.lastIndexOf('\n', index));
      return /^\s*--[\w-]+\s*:\s*$/.test(text.slice(lineStart + 1, index));
    };

    const bareReads = allPackageFiles.flatMap((file) => {
      const text = read(file);
      return [...text.matchAll(/var\(\s*(--[\w-]+)/g)]
        .filter((m) => triplets.has(m[1]))
        .filter((m) => {
          const fn = enclosingColourFunction(text, m.index!);
          return fn === undefined ? !isTokenDerivation(text, m.index!) : fn !== 'hsl' && fn !== 'hsla';
        })
        .map((m) => `${where(file)}: ${m[1]} read outside hsl()`);
    });
    expect(bareReads).toEqual([]);
  });

  it('every semantic Tailwind colour utility any package renders maps to a declared token', () => {
    const unmapped = classListColourUtilities(packageSources)
      .filter(({ name }) => !NOT_A_RAW_COLOUR.test(name) && !PALETTE.test(name))
      .filter(({ name }) => !rootTokens.has(`--${name}`))
      .map(({ where: at, utility, name }) => `${at}: ${utility} (--${name})`);
    expect(unmapped).toEqual([]);
  });

  it('no package renders a raw colour: no palette/black/white utility and no colour literal', () => {
    const paletteUtilities = colourUtilities(packageSources)
      .filter(({ name }) => PALETTE.test(name))
      .map(({ where: at, utility }) => `${at}: ${utility}`);
    const literals = packageSources.flatMap((file) =>
      [...read(file).matchAll(SOURCE_COLOUR_LITERAL)].map((m) => `${where(file)}: ${m[0]}`),
    );
    // A var() fallback is a second, hidden value, and a bare HSL triplet in one slips past
    // SOURCE_COLOUR_LITERAL (it is only a colour inside hsl()).
    const fallbacks = packageSources.flatMap((file) =>
      sourceStrings(file).flatMap((text) =>
        sourceFallbackColours(text).map((colour) => `${where(file)}: raw colour "${colour}" in a var() fallback`),
      ),
    );
    expect([...paletteUtilities, ...literals, ...fallbacks]).toEqual([]);
  });

  it('the source fallback check decodes Tailwind arbitrary values and catches every raw-colour form', () => {
    expect(sourceFallbackColours('bg-[hsl(var(--x,_0_84%_60%))]')).toEqual(['0 84% 60%']);
    expect(sourceFallbackColours('text-[hsl(var(--a,_var(--b,_220_14%_96%)))]')).toEqual(['220 14% 96%']);
    expect(sourceFallbackColours('border-[color:var(--x,_white)]')).toEqual(['white']);
    expect(sourceFallbackColours('hsl(var(--muted, 220 14% 96%))')).toEqual(['220 14% 96%']);
    expect(sourceFallbackColours('bg-[hsl(var(--probe-bg,_var(--muted)))]')).toEqual([]);
    expect(sourceFallbackColours('h-[calc(var(--app-dvh,_var(--app-vh,_1vh))_*_100)]')).toEqual([]);
    expect(sourceFallbackColours('bg-[hsl(var(--muted))]')).toEqual([]);
  });

  it('no package carries a Tailwind shadow utility, and every elevation hook rendered is a theme-core recipe', () => {
    const utilities = packageSources.flatMap((file) =>
      [...read(file).matchAll(SHADOW_UTILITY)].map((m) => `${where(file)}: ${m[1]}`),
    );
    const undefinedHooks = packageSources.flatMap((file) =>
      [...read(file).matchAll(ELEVATION_HOOK)]
        .map((m) => m[1])
        .filter((hook) => !themeClasses.has(hook))
        .map((hook) => `${where(file)}: .${hook}`),
    );
    expect([...utilities, ...undefinedHooks]).toEqual([]);
  });

  it('every theme-core recipe takes its shadow from a shadow token', () => {
    const offToken = themeRules.flatMap((rule) =>
      rule.declarations
        .filter(([property, value]) => property === 'box-shadow' && value !== 'none')
        .filter(([, value]) => !/^var\(--[\w-]*shadow[\w-]*\)$/.test(value))
        .map(([, value]) => `${rule.file} ${rule.selector} { box-shadow: ${value} }`),
    );
    expect(offToken).toEqual([]);
  });

  // A Tailwind ring utility (a focus ring) writes the WHOLE box-shadow, as a composite
  // ending in var(--tw-shadow). A layered recipe that set only box-shadow would vanish
  // while its element is focused; setting --tw-shadow too keeps elevation under the ring.
  it('every theme-core shadow composes with a Tailwind focus ring (--tw-shadow carries the same token)', () => {
    const shadowed = themeRules.filter((rule) =>
      rule.declarations.some(([property, value]) => property === 'box-shadow' && value !== 'none'),
    );
    expect(shadowed.map((r) => r.selector)).toEqual(expect.arrayContaining(['.elevation-raised', '.tabs-trigger[data-state="active"]']));
    const uncomposed = shadowed.flatMap((rule) => {
      const decls = new Map(rule.declarations);
      return decls.get('--tw-shadow') === decls.get('box-shadow')
        ? []
        : [`${rule.file} ${rule.selector}: box-shadow ${decls.get('box-shadow')} / --tw-shadow ${decls.get('--tw-shadow') ?? '(unset)'}`];
    });
    expect(uncomposed).toEqual([]);
  });

  // A var() fallback is a second, hidden value: `hsl(var(--muted, 220 14% 96%))` renders
  // the literal whenever the token is missing, and the bare triplet slips past a literal
  // check because it is only a colour inside hsl(). Every token a package reads resolves
  // from theme-core's :root, so a colour fallback is never needed — in any declaration,
  // token declarations included.
  it('no raw colour literal survives in a theme-core or package stylesheet outside a token declaration, nor in any var() fallback', () => {
    const literals = [...themeRules, ...packageStyleRules].flatMap((rule) =>
      rule.declarations
        .filter(([property, value]) => !property.startsWith('--') && STYLESHEET_COLOUR_LITERAL.test(value))
        .map(([property, value]) => `${rule.file} ${rule.selector} { ${property}: ${value} }`),
    );
    const fallbacks = [...themeRules, ...packageStyleRules].flatMap((rule) =>
      rule.declarations
        .filter(([, value]) => varFallbacks(value).some(isRawColour))
        .map(([property, value]) => `${rule.file} ${rule.selector} { ${property}: ${value} } (raw colour in a var() fallback)`),
    );
    expect([...literals, ...fallbacks]).toEqual([]);
  });

  it('the fallback check catches every raw-colour form and passes token and non-colour fallbacks', () => {
    const raw = (value: string) => varFallbacks(value).some(isRawColour);
    expect(raw('hsl(var(--destructive, 0 84% 60%) / 0.1)')).toBe(true);
    expect(raw('hsl(var(--muted, 220 14% 96%))')).toBe(true);
    expect(raw('var(--scrim, #000)')).toBe(true);
    expect(raw('var(--scrim, rgb(0 0 0 / 0.8))')).toBe(true);
    expect(raw('var(--avatar-fallback, white)')).toBe(true);
    expect(raw('hsl(var(--a, var(--b, 0 0% 50%)))')).toBe(true);
    expect(raw('hsl(var(--probe-bg, var(--muted)))')).toBe(false);
    expect(raw('var(--radius, 0.375rem)')).toBe(false);
    expect(raw('calc(var(--vh, 1vh) * 100)')).toBe(false);
    expect(raw('hsl(var(--muted))')).toBe(false);
  });

  it('every black-drop-shadow token is redeclared to read on the dark canvases', () => {
    const BLACK = /rgba?\(\s*0[\s,]+0[\s,]+0\b/;
    const root = blockDeclarations(':root');
    const blackShadows = [...root]
      .filter(([name, value]) => /shadow/.test(name) && BLACK.test(value))
      .map(([name]) => name);
    expect(blackShadows.length).toBeGreaterThan(0);

    const unreadable = DARK_CANVAS_BLOCKS.flatMap((block) => {
      const decls = blockDeclarations(block);
      return blackShadows
        .filter((name) => !decls.has(name) || BLACK.test(decls.get(name)!))
        .map((name) => `${block} ${name}: ${decls.get(name) ?? '(inherits the black :root default)'}`);
    });
    expect(unreadable).toEqual([]);
  });
});

// A solid status fill carries ITS OWN status foreground. A fill from one family under
// another family's text is unreadable in some theme even though both tokens resolve: the
// ui-core success Button once rendered the default button's text-primary-foreground on the
// green fill (2.09:1 on a dark canvas). Every package's class lists and stylesheets.
describe('status fills carry their own status foreground', () => {
  it('flags a status fill under another family\'s text, and passes the same fill under its own', () => {
    expect(classListPairingViolations('bg-[color:var(--button-success)] text-primary-foreground border-2')).toEqual([
      '--button-success fill carries --primary-foreground text (needs a success foreground)',
    ]);
    expect(classListPairingViolations('bg-[color:var(--button-success)] text-[hsl(var(--success-foreground))]')).toEqual([]);
    expect(classListPairingViolations('bg-destructive text-warning-foreground')).toHaveLength(1);
    expect(classListPairingViolations('bg-destructive')).toHaveLength(1);
    // Not a solid resting fill: a tint, or a hover-only fill.
    expect(classListPairingViolations('bg-destructive/10 text-foreground')).toEqual([]);
    expect(classListPairingViolations('hover:bg-destructive/90 text-primary-foreground')).toEqual([]);
  });

  it('every solid status fill in a package class list carries its own status foreground', () => {
    const violations = packageSources.flatMap((file) =>
      classStrings(file).flatMap((list) => classListPairingViolations(list).map((v) => `${where(file)}: ${v}`)),
    );
    expect(violations).toEqual([]);
  });

  it('every solid status fill in a theme-core or package stylesheet carries its own status foreground', () => {
    const exempt = (rule: CssRule) => TEXTLESS_STATUS_FILLS.some((e) => e.file === rule.file && e.selector === rule.selector);
    const violations = [...themeRules, ...packageStyleRules]
      .filter((rule) => !exempt(rule))
      .flatMap((rule) => cssRulePairingViolations(rule).map((v) => `${rule.file} ${rule.selector}: ${v}`));
    expect(violations).toEqual([]);
  });

  it('every text-less exemption is still a solid status fill that sets no text colour', () => {
    const stale = TEXTLESS_STATUS_FILLS.filter(({ file, selector }) => {
      const rule = [...themeRules, ...packageStyleRules].find((r) => r.file === file && r.selector === selector);
      return !rule || cssRulePairingViolations(rule).length !== 1 || new Map(rule.declarations).has('color');
    });
    expect(stale).toEqual([]);
  });
});
