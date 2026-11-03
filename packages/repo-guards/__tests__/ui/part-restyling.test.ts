import { describe, expect, it } from 'vitest';
import {
  partRestylingGuard,
  partTokens,
  sheetClassProperties,
  uiPartsIn,
  utilityProperties,
  type PartRestylingFacts,
} from '../../src/modules/ui/part-restyling.js';
import { allFindings, installed } from './helpers.js';
import { factProblemsOf } from '../helpers/configured.js';

const ENTRY = 'src/app/styles/globals.css';

// Compiled the way tsc emits a ui-core component module.
const CARD_JS = [
  "import { jsx as _jsx } from 'react/jsx-runtime';",
  "import * as React from 'react';",
  "import { cva } from 'class-variance-authority';",
  "import { cn } from '../../lib/utils.js';",
  "const cardHeaderVariants = cva('flex flex-col', { variants: { variant: { default: 'p-6', page: 'page-card-header' } }, defaultVariants: { variant: 'default' } });",
  "const CardHeader = React.forwardRef(({ className, variant, ...props }, ref) => (_jsx('div', { ref: ref, className: cn(cardHeaderVariants({ variant }), className), ...props })));",
  "const CardContent = React.forwardRef(({ className, inset, ...props }, ref) => (_jsx('div', { ref: ref, className: cn('p-6 pt-0 sm:p-8', inset && 'pl-12', className), ...props })));",
  "const labelVariants = cva('leading-none', { variants: { variant: { default: 'text-sm font-bold', caption: 'text-caption' } }, defaultVariants: { variant: 'default' } });",
  "const Label = React.forwardRef(({ className, variant, ...props }, ref) => (_jsx('label', { ref: ref, className: cn(labelVariants({ variant }), className), ...props })));",
  'export { CardHeader, CardContent, Label };',
].join('\n');

const UI = installed(
  '@kit/ui',
  {
    exports: { './react': { types: './dist/react/index.d.ts', default: './dist/react/index.js' } },
  },
  {
    'dist/react/index.js': "export { CardHeader, CardContent, Label } from './components/card.js';",
    'dist/react/components/card.js': CARD_JS,
  },
);

const THEME = installed(
  '@kit/theme',
  { exports: { './styles.css': './dist/components.css' } },
  {
    'dist/components.css': [
      '.page-card-header { text-align: center; padding: 1rem; }',
      '@media (min-width: 640px) { .page-card-header { padding: 1.5rem; } }',
      '.text-caption { font-size: 0.75rem; line-height: 1rem; color: hsl(var(--muted-foreground)); }',
      '.stack-4 > * + * { margin-top: 1rem; }',
      '.same-pad { padding: 1.5rem; }',
      '.loud { font-size: 2rem !important; }',
      '.hover-only:hover { padding: 0; }',
      '@media (prefers-contrast: more) { .contrast-pad { padding: 0; } }',
    ].join('\n'),
  },
);

const GLOBALS = [
  '@layer theme, base, components, utilities, overrides;',
  "@import '@kit/theme/styles.css' layer(base);",
  "@import './components.css' layer(base);",
  "@import './overrides.css' layer(overrides);",
  '@theme { --color-muted-foreground: hsl(var(--muted-foreground)); }',
].join('\n');

const facts: PartRestylingFacts = {
  entryStylesheet: ENTRY,
  uiModule: '@kit/ui/react',
  exceptions: [],
};

function repo(code: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...UI,
    ...THEME,
    [ENTRY]: GLOBALS,
    'src/app/styles/components.css': '.app-pad { padding-left: 0.5rem; }',
    'src/app/styles/overrides.css': '.over-pad { padding: 0; }',
    'src/ui/screen.tsx': `import { CardHeader, CardContent, Label } from '@kit/ui/react';\n${code}`,
    ...extra,
  };
}

describe('what a utility and a sheet class set', () => {
  it('reads spacing, type, color and breakpoint utilities, and leaves a state utility unjudged', () => {
    const theme = new Map([['--color-card', 'hsl(var(--card))']]);
    expect(utilityProperties('px-3')).toEqual([
      { property: 'padding-left', value: '0.75rem', from: 0 },
      { property: 'padding-right', value: '0.75rem', from: 0 },
    ]);
    expect(utilityProperties('sm:pt-0')).toEqual([
      { property: 'padding-top', value: '0rem', from: 640 },
    ]);
    expect(utilityProperties('text-sm')).toEqual([
      { property: 'font-size', value: '0.875rem', from: 0 },
      { property: 'line-height', value: '1.25rem', from: 0, fallback: true },
    ]);
    expect(utilityProperties('bg-card', theme)).toEqual([
      { property: 'background-color', value: 'hsl(var(--card))', from: 0 },
    ]);
    expect(utilityProperties('border-2').map((p) => p.property)).toEqual([
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
    ]);
    expect(utilityProperties('hover:bg-card', theme)).toEqual([]);
    expect(utilityProperties('page-card-header')).toEqual([]);
  });

  it('reads a plain class rule, its shorthand expanded and its breakpoint kept, and skips states, nesting, other media and important values', () => {
    const declared = sheetClassProperties(THEME['node_modules/@kit/theme/dist/components.css']);
    expect(declared.get('page-card-header')?.filter((d) => d.property === 'padding-top')).toEqual([
      expect.objectContaining({ value: '1rem', from: 0 }),
      expect.objectContaining({ value: '1.5rem', from: 640 }),
    ]);
    expect(declared.has('stack-4')).toBe(false);
    expect(declared.has('hover-only')).toBe(false);
    expect(declared.has('contrast-pad')).toBe(false);
    expect(declared.get('loud')).toEqual([]);
  });

  it('reads each part and the tokens a variant prop resolves to, leaving out a conditional class', () => {
    const parts = new Map(uiPartsIn('card.js', CARD_JS).map((p) => [p.name, p]));
    expect([...parts.keys()]).toEqual(['CardHeader', 'CardContent', 'Label']);
    expect(partTokens(parts.get('CardHeader')!)).toEqual(['flex', 'flex-col', 'p-6']);
    expect(partTokens(parts.get('CardHeader')!, { variant: 'page' })).toEqual([
      'flex',
      'flex-col',
      'page-card-header',
    ]);
    expect(partTokens(parts.get('CardContent')!)).toEqual(['p-6', 'pt-0', 'sm:p-8']);
  });
});

describe('a stylesheet class never restyles what a ui-core part already sets', () => {
  it('flags a theme class the built-in padding outranks, naming each property and the utility that wins', async () => {
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo('const a = <CardHeader className="page-card-header" />;'),
      ),
    ).toEqual([
      "src/ui/screen.tsx:2 .page-card-header on <CardHeader> loses to the part's built-in utilities — padding-top: 1rem (its built-in p-6 sets 1.5rem); padding-right: 1rem (its built-in p-6 sets 1.5rem); padding-bottom: 1rem (its built-in p-6 sets 1.5rem); padding-left: 1rem (its built-in p-6 sets 1.5rem)",
    ]);
  });

  it('passes the variant that owns the look, and a class put on through cn()', async () => {
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo(
          'const a = <CardHeader variant="page" className={cn("page-card-header", x && "stack-4")} />;',
        ),
      ),
    ).toEqual([]);
  });

  it('flags a class that loses only from a breakpoint up, and an app sheet class', async () => {
    const findings = await allFindings(
      partRestylingGuard,
      facts,
      repo('const a = <CardContent className="same-pad app-pad" />;'),
    );
    expect(findings).toEqual([
      "src/ui/screen.tsx:2 .same-pad on <CardContent> loses to the part's built-in utilities — padding-top: 1.5rem (its built-in pt-0 sets 0rem); padding-right: 1.5rem (its built-in sm:p-8 sets 2rem); padding-bottom: 1.5rem (its built-in sm:p-8 sets 2rem); padding-left: 1.5rem (its built-in sm:p-8 sets 2rem)",
      "src/ui/screen.tsx:2 .app-pad on <CardContent> loses to the part's built-in utilities — padding-left: 0.5rem (its built-in p-6 sets 1.5rem)",
    ]);
  });

  it('passes a layout class, a class above the utilities layer, an important value, a state rule and a Tailwind utility', async () => {
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo(
          'const a = <CardHeader className="stack-4 over-pad loud hover-only contrast-pad px-2" />;',
        ),
      ),
    ).toEqual([]);
  });

  it('judges a text look against the variant a prop picks, and every value of a prop passed as an expression', async () => {
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo('const a = <Label className="text-caption" />;'),
      ),
    ).toEqual([
      "src/ui/screen.tsx:2 .text-caption on <Label> loses to the part's built-in utilities — font-size: 0.75rem (its built-in text-sm sets 0.875rem); line-height: 1rem (its built-in leading-none sets 1)",
    ]);
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo('const a = <Label variant="caption" className="text-caption" />;'),
      ),
    ).toEqual([
      "src/ui/screen.tsx:2 .text-caption on <Label> loses to the part's built-in utilities — line-height: 1rem (its built-in leading-none sets 1)",
    ]);
    expect(
      await allFindings(
        partRestylingGuard,
        facts,
        repo('const a = <CardHeader variant={look} className="page-card-header" />;'),
      ),
    ).toHaveLength(1);
  });

  it('passes a same-named component from another module', async () => {
    expect(
      await allFindings(partRestylingGuard, facts, {
        ...repo(''),
        'src/ui/other.tsx':
          'import { CardHeader } from \'./my-card\';\nconst a = <CardHeader className="page-card-header" />;',
      }),
    ).toEqual([]);
  });

  it('holds a reviewed exception, and flags one that no longer loses', async () => {
    const reviewed = {
      ...facts,
      exceptions: [
        {
          path: 'src/ui/screen.tsx',
          part: 'CardHeader',
          className: 'page-card-header',
          why: 'a reviewed case',
        },
      ],
    };
    expect(
      await allFindings(
        partRestylingGuard,
        reviewed,
        repo('const a = <CardHeader className="page-card-header" />;'),
      ),
    ).toEqual([]);
    expect(
      await allFindings(partRestylingGuard, reviewed, repo('const a = <CardHeader />;')),
    ).toEqual([
      'src/ui/screen.tsx stale exception: .page-card-header on <CardHeader> no longer loses to a built-in',
    ]);
  });

  it('says so when the ui module is not installed or its entry names no layer order', async () => {
    const { ['node_modules/@kit/ui/package.json']: _gone, ...noUi } = repo('');
    expect(await allFindings(partRestylingGuard, facts, noUi)).toEqual([
      'src/app/styles/globals.css the installed @kit/ui/react declares no part to judge',
    ]);
    expect(
      await allFindings(partRestylingGuard, facts, {
        ...repo(''),
        [ENTRY]: '/* no layer order */',
      }),
    ).toEqual([
      'src/app/styles/globals.css declares no cascade layer order naming the utilities layer, so no class can be placed against it',
    ]);
  });

  it('rejects malformed facts', () => {
    expect(
      factProblemsOf(partRestylingGuard, {
        entryStylesheet: ENTRY,
        exceptions: [{ path: 'a.tsx' }],
      }),
    ).toEqual(
      expect.arrayContaining([
        'uiModule is missing or empty',
        'exceptions entry a.tsx names no its part and class',
      ]),
    );
  });
});
