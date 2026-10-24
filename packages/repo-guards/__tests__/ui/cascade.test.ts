import { describe, expect, it } from 'vitest';
import {
  pinnedStatements,
  stylesheetEntryGuard,
  tailwindSourcesGuard,
  themeTokensGuard,
  utilityCollisionGuard,
} from '../../src/modules/ui/cascade.js';
import { viewOfText } from '../../src/reader/view.js';
import { allFindings, installed, runDefinition } from './helpers.js';
import { factProblemsOf } from '../helpers/configured.js';

const ENTRY = 'src/app/styles/globals.css';
const LAYOUT = 'src/app/layout.tsx';

describe('one stylesheet entry, in its pinned order', () => {
  const globals = [
    '/* the order is the cascade */',
    '@layer theme, base, components, utilities, overrides;',
    "@import '@kit/theme/styles.css' layer(base);",
    '@import "./components.css" layer(base);',
    "@import './overrides.css' layer(overrides);",
    "@import 'tailwindcss';",
    "@source '../../../node_modules/@kit/ui/dist/**/*.{js,ts,jsx,tsx}';",
    '@source "../../../node_modules/@kit/media/dist/**/*.{js,ts,jsx,tsx}";',
    '@theme {\n  --color-card: hsl(var(--card));\n  @keyframes fade { from { opacity: 0; } }\n}',
  ].join('\n');
  const pinnedOrder = [
    '@layer theme, base, components, utilities, overrides',
    '@import "@kit/theme/styles.css" layer(base)',
    '@import "./components.css" layer(base)',
    '@import "./overrides.css" layer(overrides)',
    '@import "tailwindcss"',
    '@source …',
    '@theme { … }',
  ];
  const facts = { layoutModule: LAYOUT, entryStylesheet: ENTRY, pinnedOrder };
  const clean = {
    [LAYOUT]:
      "import { Toaster } from '@kit/ui';\nimport './styles/globals.css';\n// ./styles/print.css is named in prose only",
    [ENTRY]: globals,
    'src/ui/card.tsx': "import { Card } from '@kit/ui/react';",
  };

  it('reads the entry statements with quoting normalized, blocks collapsed, and one run of @source lines', () => {
    expect(pinnedStatements(viewOfText(ENTRY, globals).code)).toEqual(pinnedOrder);
    const split = viewOfText(
      ENTRY,
      `${globals}\n@source "../../../node_modules/@kit/upload/dist/**/*.js";`,
    );
    expect(pinnedStatements(split.code)).toEqual([...pinnedOrder, '@source …']);
  });

  it('passes the one layout import of the entry stylesheet in its pinned order', async () => {
    expect(await allFindings(stylesheetEntryGuard, facts, clean)).toEqual([]);
  });

  it('flags a stylesheet imported anywhere but the layout, in every import form, and a second sheet in the layout', async () => {
    const findings = await allFindings(stylesheetEntryGuard, facts, {
      ...clean,
      [LAYOUT]: "import './styles/globals.css';\nimport './styles/print.css';",
      'src/ui/card.tsx':
        "import './card.css';\nexport const load = () => import(\n  '@kit/media/styles'\n);",
      'src/ui/header.tsx': "import styles from '../app/styles/components.css';",
    });
    expect(findings).toEqual([
      'src/app/layout.tsx:2 imports the stylesheet ./styles/print.css',
      'src/ui/card.tsx:1 imports the stylesheet ./card.css',
      'src/ui/card.tsx:3 imports the stylesheet @kit/media/styles',
      'src/ui/header.tsx:1 imports the stylesheet ../app/styles/components.css',
    ]);
  });

  it('flags a layout that no longer imports the entry stylesheet', async () => {
    expect(
      await allFindings(stylesheetEntryGuard, facts, { ...clean, [LAYOUT]: 'export {};' }),
    ).toEqual([
      'src/app/layout.tsx imports the entry stylesheet src/app/styles/globals.css 0 times; it must import it exactly once',
    ]);
  });

  it('flags a reordered entry, a sheet that lost its layer, an added sheet, a changed layer order, and a stray top-level rule', async () => {
    const run = async (text: string) =>
      (await runDefinition(stylesheetEntryGuard, facts, { ...clean, [ENTRY]: text }))[
        'the entry stylesheet keeps its pinned statements in their pinned order'
      ];
    expect(
      await run(
        globals.replace(
          "@import './overrides.css' layer(overrides);\n@import 'tailwindcss';",
          "@import 'tailwindcss';\n@import './overrides.css' layer(overrides);",
        ),
      ),
    ).toEqual([
      'src/app/styles/globals.css statement 4 is @import "tailwindcss"; pinned: @import "./overrides.css" layer(overrides)',
    ]);
    expect(
      await run(
        globals.replace('@import "./components.css" layer(base);', '@import "./components.css";'),
      ),
    ).toEqual([
      'src/app/styles/globals.css statement 3 is @import "./components.css"; pinned: @import "./components.css" layer(base)',
    ]);
    expect(
      await run(
        globals.replace(
          '@import "./components.css" layer(base);',
          '@import "./components.css" layer(base);\n@import "./print.css" layer(base);',
        ),
      ),
    ).toEqual([
      'src/app/styles/globals.css statement 4 is @import "./print.css" layer(base); pinned: @import "./overrides.css" layer(overrides)',
    ]);
    expect(await run(globals.replace('utilities, overrides;', 'utilities;'))).toEqual([
      'src/app/styles/globals.css statement 1 is @layer theme, base, components, utilities; pinned: @layer theme, base, components, utilities, overrides',
    ]);
    expect(await run(`${globals}\nbody { margin: 0; }`)).toEqual([
      'src/app/styles/globals.css statement 8 is body { … }; pinned: (nothing)',
    ]);
  });

  it('refuses facts with no pinned order', () => {
    expect(
      stylesheetEntryGuard.factProblems({
        layoutModule: LAYOUT,
        entryStylesheet: ENTRY,
        pinnedOrder: [],
      }),
    ).toEqual(['pinnedOrder is missing or empty']);
  });
});

describe('Tailwind scans every installed package that renders classes', () => {
  const packages = {
    ...installed(
      '@kit/ui',
      { dependencies: { '@kit/inner': '*', react: '*' } },
      {
        'dist/button.js': 'jsx("button", { className: "btn" });',
        'dist/button.d.ts': 'export {};',
      },
    ),
    ...installed(
      '@kit/inner',
      {},
      {
        'dist/chip/chip.js': 'jsx("span", { className: "chip" });',
        'dist/chip/chip.d.ts': 'export {};',
      },
    ),
    ...installed(
      '@kit/data',
      {},
      { 'dist/index.js': 'export const x = 1;', 'dist/index.d.ts': 'export {};' },
    ),
  };
  const manifest = JSON.stringify({
    dependencies: { '@kit/ui': '*', '@kit/data': '*', react: '*' },
  });
  const facts = { entryStylesheet: ENTRY, manifest: 'package.json', packageScopes: ['@kit/'] };
  const sources = (...lines: string[]) => ["@import 'tailwindcss';", ...lines].join('\n');

  it('passes when every class-rendering package, transitive ones included, has a covering @source in either quoting', async () => {
    const findings = await allFindings(tailwindSourcesGuard, facts, {
      ...packages,
      'package.json': manifest,
      [ENTRY]: sources(
        "@source '../../../node_modules/@kit/ui/dist/**/*.{js,ts,jsx,tsx}';",
        '@source "../../../node_modules/@kit/inner/dist/**/*.js";',
      ),
    });
    expect(findings).toEqual([]);
  });

  it('flags a package reached only through another one, and a scan line that is commented out or points elsewhere', async () => {
    const findings = await allFindings(tailwindSourcesGuard, facts, {
      ...packages,
      'package.json': manifest,
      [ENTRY]: sources(
        "@source '../../../node_modules/@kit/ui/src/**/*.tsx';",
        '/* @source "../../../node_modules/@kit/inner/dist/**/*.js"; */',
      ),
    });
    expect(findings).toEqual([
      'src/app/styles/globals.css no @source line covers @kit/inner, which renders classes in node_modules/@kit/inner/dist/chip/chip.js',
      'src/app/styles/globals.css no @source line covers @kit/ui, which renders classes in node_modules/@kit/ui/dist/button.js',
    ]);
  });

  it('flags a dependency that is not installed, and an installed package whose build it cannot read', async () => {
    const findings = await allFindings(tailwindSourcesGuard, facts, {
      ...installed('@kit/css-only', {}, { 'dist/x.css': '.a {}' }),
      'package.json': JSON.stringify({ dependencies: { '@kit/gone': '*', '@kit/css-only': '*' } }),
      [ENTRY]: sources(),
    });
    expect(findings).toEqual([
      'package.json @kit/gone is a dependency but is not installed, so its build cannot be read',
      'node_modules/@kit/css-only ships no type declarations, so its build files cannot be read',
    ]);
  });

  it('refuses facts with no package scope', () => {
    expect(tailwindSourcesGuard.factProblems({ ...facts, packageScopes: [] })).toEqual([
      'packageScopes is empty',
    ]);
  });
});

describe('a semantic text class keeps its color against the same-named utility', () => {
  const theme = installed(
    '@kit/theme',
    { exports: { './components.css': './dist/components.css' } },
    {
      'dist/components.css':
        '.text-muted {\n  font-size: 0.875rem;\n  color: hsl(var(--muted-foreground));\n}\n.text-body { color: hsl(var(--foreground)); }',
    },
  );
  const entry = [
    '@layer theme, base, components, utilities, overrides;',
    "@import '@kit/theme/components.css' layer(base);",
    "@import './components.css' layer(base);",
    "@import './overrides.css' layer(overrides);",
    '@theme {\n  --color-muted: hsl(var(--muted));\n  --color-foreground: hsl(var(--foreground));\n}',
  ].join('\n');
  const facts = { entryStylesheet: ENTRY };
  const files = (overrides: string, components = '.card { color: hsl(var(--foreground)); }') => ({
    ...theme,
    [ENTRY]: entry,
    'src/app/styles/components.css': components,
    'src/app/styles/overrides.css': overrides,
  });

  it('passes when the overrides layer pins the semantic color', async () => {
    expect(
      await allFindings(
        utilityCollisionGuard,
        facts,
        files('.text-muted { color: hsl(var(--muted-foreground)); }'),
      ),
    ).toEqual([]);
  });

  it('flags a theme class the utility outranks with no pin, or a pin of another color', async () => {
    const expected = [
      "node_modules/@kit/theme/dist/components.css:3 .text-muted paints hsl(var(--muted-foreground)), but Tailwind's same-named utility paints hsl(var(--muted)) and wins; pin `.text-muted { color: hsl(var(--muted-foreground)); }` in a sheet above the utilities layer",
    ];
    expect(await allFindings(utilityCollisionGuard, facts, files(''))).toEqual(expected);
    expect(
      await allFindings(
        utilityCollisionGuard,
        facts,
        files('.text-muted { color: hsl(var(--muted)); }'),
      ),
    ).toEqual(expected);
  });

  it('flags an app re-color of a utility class below the utilities layer, and passes one above it', async () => {
    const components =
      '.card { color: hsl(var(--foreground)); }\n.paper .text-muted {\n  color: hsl(var(--ink-muted));\n}';
    expect(
      await allFindings(
        utilityCollisionGuard,
        facts,
        files('.text-muted { color: hsl(var(--muted-foreground)); }', components),
      ),
    ).toEqual([
      "src/app/styles/components.css:3 .paper .text-muted sets color: hsl(var(--ink-muted)), but Tailwind's text-muted utility (hsl(var(--muted))) sits in a later layer and wins",
    ]);
    expect(
      await allFindings(
        utilityCollisionGuard,
        facts,
        files(
          '.text-muted { color: hsl(var(--muted-foreground)); }\n.paper .text-muted { color: hsl(var(--ink-muted)); }',
        ),
      ),
    ).toEqual([]);
  });

  it('flags an entry with no layer order naming the utilities layer', async () => {
    expect(
      await allFindings(utilityCollisionGuard, facts, {
        ...files(''),
        [ENTRY]: entry.replace('@layer theme, base, components, utilities, overrides;\n', ''),
      }),
    ).toEqual([
      'src/app/styles/globals.css declares no cascade layer order naming the utilities layer, so no rule can be placed against it',
    ]);
  });
});

describe('every theme token is declared in each theme block, and high contrast is monochrome', () => {
  const theme = installed(
    '@kit/theme',
    { exports: { './styles.css': './dist/tokens.css' } },
    {
      'dist/tokens.css': [
        ':root { --background: 0 0% 100%; --foreground: 0 0% 0%; --button-success: oklch(72% 0.2 150); }',
        '.high-contrast { --background: 0 0% 0%; --foreground: 0 0% 100%; }',
      ].join('\n'),
    },
  );
  const entry = "@import '@kit/theme/styles.css' layer(base);\n@import './brand.css' layer(base);";
  const brand = (root: string, dark: string, hc: string, extra = '') =>
    `:root {\n${root}\n}\n.dark {\n${dark}\n}\n.high-contrast {\n${hc}\n}\n${extra}`;
  const cleanBrand = brand(
    '  --primary: 270 50% 40%;\n  --button-success: hsl(var(--primary));\n  --radius: 0.5rem;',
    '  --primary: 270 50% 70%;',
    '  --primary: 0 0% 100%;',
  );
  const facts = { entryStylesheet: ENTRY, tokenSheet: 'src/app/styles/brand.css' };
  const run = (brandCss: string, extra: Record<string, string> = {}) =>
    allFindings(themeTokensGuard, facts, {
      ...theme,
      [ENTRY]: entry,
      'src/app/styles/brand.css': brandCss,
      ...extra,
    });

  it('passes three ordered blocks that declare every theme color, over a monochrome high contrast', async () => {
    expect(await run(cleanBrand)).toEqual([]);
  });

  it('counts a token set in a :root selector list as set at :root', async () => {
    const listed = brand(
      '  --primary: 270 50% 40%;',
      '  --primary: 270 50% 70%;',
      '  --primary: 0 0% 100%;',
      ':root, .scope { --button-success: hsl(var(--primary)); }',
    );
    expect(await run(listed)).toEqual([]);
  });

  it('flags a missing block, and blocks out of order', async () => {
    expect(await run(':root { --primary: 0 0% 0%; }\n.dark { --primary: 0 0% 0%; }')).toEqual([
      'src/app/styles/brand.css declares no top-level .high-contrast block',
    ]);
    const swapped = `.dark {\n  --primary: 270 50% 70%;\n}\n:root {\n  --primary: 270 50% 40%;\n  --button-success: hsl(var(--primary));\n}\n.high-contrast {\n  --primary: 0 0% 100%;\n}`;
    expect(await run(swapped)).toEqual([
      'src/app/styles/brand.css the theme blocks must come in the order :root, .dark, .high-contrast — they tie on specificity, so the later block wins',
    ]);
  });

  it('flags a theme color missing from a block, whether it varies or is a triplet only :root declares', async () => {
    const findings = await run(
      brand(
        '  --primary: 270 50% 40%;\n  --button-success: hsl(var(--primary));\n  --letterbox: 0 0% 0%;',
        '  --primary: 270 50% 70%;',
        '  --ring: 0 0% 100%;',
      ),
    );
    expect(findings).toEqual([
      "src/app/styles/brand.css --primary is a theme color but is missing from .high-contrast, so that theme takes another block's value",
      "src/app/styles/brand.css --ring is a theme color but is missing from :root, so that theme takes another block's value",
      "src/app/styles/brand.css --ring is a theme color but is missing from .dark, so that theme takes another block's value",
      "src/app/styles/brand.css --letterbox is a theme color but is missing from .dark, so that theme takes another block's value",
      "src/app/styles/brand.css --letterbox is a theme color but is missing from .high-contrast, so that theme takes another block's value",
      'src/app/styles/brand.css --primary resolves to 270 50% 40% in high contrast; high contrast is monochrome (saturation 0)',
    ]);
  });

  it('flags a literal color only :root declares, and a theme package literal default the app never sets', async () => {
    const findings = await run(
      brand(
        '  --primary: 270 50% 40%;\n  --overlay: rgb(0 0 0 / 0.5);',
        '  --primary: 270 50% 70%;',
        '  --primary: 0 0% 100%;',
      ),
    );
    expect(findings).toEqual([
      'src/app/styles/brand.css:1 --overlay is a literal color declared only in :root, so every theme paints it the same',
      "src/app/styles/brand.css --button-success keeps the theme package's literal default (oklch(72% 0.2 150)); set it in :root from the app's tokens",
    ]);
  });

  it('flags a hued high-contrast token and a moved anchor', async () => {
    const findings = await run(
      brand(
        '  --primary: 270 50% 40%;\n  --button-success: hsl(var(--primary));',
        '  --primary: 270 50% 70%;',
        '  --primary: 270 50% 70%;\n  --background: 0 0% 10%;',
      ),
    );
    expect(findings).toEqual([
      "src/app/styles/brand.css --background is a theme color but is missing from :root, so that theme takes another block's value",
      "src/app/styles/brand.css --background is a theme color but is missing from .dark, so that theme takes another block's value",
      'src/app/styles/brand.css --primary resolves to 270 50% 70% in high contrast; high contrast is monochrome (saturation 0)',
      'src/app/styles/brand.css --background resolves to 0 0% 10% in high contrast; it must be 0 0% 0%',
    ]);
  });

  it('refuses facts with no token sheet', () => {
    expect(factProblemsOf(themeTokensGuard, { entryStylesheet: ENTRY })).toEqual([
      'tokenSheet is missing',
    ]);
  });
});
