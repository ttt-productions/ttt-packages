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
const SHADOW_UTILITY = /(?<=^|[\s"'`:!])((?:inset-|drop-)?shadow(?:-[^\s"'`]*)?)(?=$|[\s"'`])/g;
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

/**
 * The strings a file uses as CLASS LISTS: a `className` / `*ClassName` JSX attribute, an
 * argument of cn / cva / clsx / cx / twMerge, or a variable or property named as a class
 * string (`triggerClass`, `SIZE_CLASS`). Parsed with the TypeScript compiler, so prose
 * in comments and CSS text in style strings (`"stroke-dashoffset 0.1s"`) never count.
 */
function classStrings(file: string): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
  const out: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push(node.text);
    }
    ts.forEachChild(node, collect);
  };
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
    expect([...paletteUtilities, ...literals]).toEqual([]);
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

  it('no raw colour literal survives in a theme-core or package stylesheet outside a token declaration', () => {
    const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[-\d.]|\b(white|black)\b/i;
    const literals = [...themeRules, ...packageStyleRules].flatMap((rule) =>
      rule.declarations
        .filter(([property, value]) => !property.startsWith('--') && COLOUR_LITERAL.test(value))
        .map(([property, value]) => `${rule.file} ${rule.selector} { ${property}: ${value} }`),
    );
    expect(literals).toEqual([]);
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
