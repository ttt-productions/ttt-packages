import { describe, expect, it } from 'vitest';
import {
  colorLiteralsGuard,
  scaleClassesGuard,
  shadowOwnershipGuard,
  stackRowsGuard,
  statusForegroundGuard,
  unavailableAffordanceGuard,
} from '../../src/modules/ui/styling.js';
import { allFindings, installed } from './helpers.js';
import { factProblemsOf } from '../helpers/configured.js';

describe('every color resolves through a theme token', () => {
  const clean = {
    'src/ui/card.tsx':
      'export const C = () => <div className="bg-card text-muted-foreground border-border" style={{ color: "hsl(var(--primary))" }} />;',
    'src/app/styles/brand.css':
      ':root {\n  --gold: 45 65% 62%;\n}\n.a { color: hsl(var(--gold)); }',
  };

  it('passes token colors, raw token triplets, and colors named only in comments', async () => {
    expect(
      await allFindings(
        colorLiteralsGuard,
        { exceptions: [] },
        { ...clean, 'src/ui/note.ts': '// #fff and bg-white in prose\nexport {};' },
      ),
    ).toEqual([]);
  });

  it('flags a hex, a numeric functional color, and every stock palette class, in code and in stylesheets', async () => {
    const findings = await allFindings(
      colorLiteralsGuard,
      { exceptions: [] },
      {
        ...clean,
        'src/ui/bad.tsx': [
          'export const a = "#fff";',
          'export const b = "rgba(0,0,0,.5)";',
          'export const c = <p className="text-gray-500 dark:bg-amber-500/10" />;',
          'export const d = <p className="bg-white text-black" />;',
        ].join('\n'),
        'src/app/styles/bad.css': '.a {\n  color: hsl(258 50% 40%);\n}',
      },
    );
    expect(findings).toEqual([
      'src/app/styles/bad.css:2 not on the reviewed list: hsl(258 50% 40%)',
      'src/ui/bad.tsx:1 not on the reviewed list: #fff',
      'src/ui/bad.tsx:2 not on the reviewed list: rgba(0,0,0,.5)',
      'src/ui/bad.tsx:3 not on the reviewed list: text-gray-500',
      'src/ui/bad.tsx:3 not on the reviewed list: bg-amber-500',
      'src/ui/bad.tsx:4 not on the reviewed list: bg-white',
      'src/ui/bad.tsx:4 not on the reviewed list: text-black',
    ]);
  });

  it('leaves test code alone', async () => {
    expect(
      await allFindings(
        colorLiteralsGuard,
        { exceptions: [] },
        { ...clean, 'src/ui/card.test.tsx': 'const x = "#ffffff";' },
      ),
    ).toEqual([]);
  });

  it('lets a reviewed exception hold its literals, and fails the entry once the file holds none', async () => {
    const exceptions = [
      { path: 'src/ui/puppet.tsx', why: 'an SVG whose paint cannot be a token', count: 1 },
    ];
    expect(
      await allFindings(
        colorLiteralsGuard,
        { exceptions },
        { ...clean, 'src/ui/puppet.tsx': 'export const fill = "#123456";' },
      ),
    ).toEqual([]);
    expect(
      await allFindings(
        colorLiteralsGuard,
        { exceptions },
        { ...clean, 'src/ui/puppet.tsx': 'export const fill = "hsl(var(--x))";' },
      ),
    ).toEqual([
      'src/ui/puppet.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });

  it('refuses an exception that carries no why', () => {
    expect(
      colorLiteralsGuard.factProblems({ exceptions: [{ path: 'src/a.tsx', why: ' ' }] }),
    ).toEqual(['exceptions entry src/a.tsx carries no why']);
    expect(factProblemsOf(colorLiteralsGuard, {})).toEqual([
      'exceptions is missing (declare [] when there is none)',
    ]);
  });
});

describe("the site definition's two colours are the one concrete colour app code writes", () => {
  const SITE = 'src/lib/site.ts';
  const site = (...body: string[]) =>
    [
      "import type { SiteDefinition } from '@ttt-productions/site-core';",
      ...body,
      'export const site: SiteDefinition = {',
      "  name: 'Site',",
      "  themeColor: '#1a2b3c',",
      "  backgroundColor: '#ffffff',",
      '};',
    ].join('\n');
  const declared = { exceptions: [], siteDefinitionModule: SITE };

  it('passes themeColor and backgroundColor of the one site definition in the declared module', async () => {
    expect(await allFindings(colorLiteralsGuard, declared, { [SITE]: site() })).toEqual([]);
  });

  it('passes the site definition written with satisfies and an aliased import', async () => {
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: [
          "import type { SiteDefinition as Site } from '@ttt-productions/site-core';",
          "export const site = { themeColor: '#000', backgroundColor: 'rgb(255 255 255)' } satisfies Site;",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('fails any other colour in the declared module, a third field included', async () => {
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: site(
          "export const accent = '#abcdef';",
          "export const card = { themeColor: '#123123' };",
        ),
      }),
    ).toEqual([
      'src/lib/site.ts:2 not on the reviewed list: #abcdef',
      'src/lib/site.ts:3 not on the reviewed list: #123123',
    ]);
  });

  it('fails a colour field whose value is not a single string literal', async () => {
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: [
          "import type { SiteDefinition } from '@ttt-productions/site-core';",
          'export const site: SiteDefinition = {',
          "  themeColor: dark ? '#000000' : '#ffffff',",
          "  backgroundColor: '#ffffff',",
          '};',
        ].join('\n'),
      }),
    ).toEqual([
      'src/lib/site.ts:3 not on the reviewed list: #000000',
      'src/lib/site.ts:3 not on the reviewed list: #ffffff',
    ]);
  });

  it('fails the same two fields in any module other than the declared one', async () => {
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: site(),
        'src/lib/other-site.ts': site(),
      }),
    ).toEqual([
      'src/lib/other-site.ts:4 not on the reviewed list: #1a2b3c',
      'src/lib/other-site.ts:5 not on the reviewed list: #ffffff',
    ]);
  });

  it('allows nothing when no site definition module is declared', async () => {
    expect(await allFindings(colorLiteralsGuard, { exceptions: [] }, { [SITE]: site() })).toEqual([
      'src/lib/site.ts:4 not on the reviewed list: #1a2b3c',
      'src/lib/site.ts:5 not on the reviewed list: #ffffff',
    ]);
  });

  it('allows nothing in a module that holds two site definitions, and says so', async () => {
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: site("export const spare: SiteDefinition = { themeColor: '#010101' };"),
      }),
    ).toEqual([
      'src/lib/site.ts:2 not on the reviewed list: #010101',
      'src/lib/site.ts:5 not on the reviewed list: #1a2b3c',
      'src/lib/site.ts:6 not on the reviewed list: #ffffff',
      'src/lib/site.ts holds 2 objects typed SiteDefinition; the app declares its one site definition once',
    ]);
  });

  it('fails a declared module that is missing or holds no site definition', async () => {
    expect(await allFindings(colorLiteralsGuard, declared, {})).toEqual([
      'src/lib/site.ts the declared site definition module is not app source the guard reads: it is missing, a test file, or outside the app root',
    ]);
    expect(
      await allFindings(colorLiteralsGuard, declared, {
        [SITE]: "export const site = { themeColor: 'hsl(var(--primary))' };",
      }),
    ).toEqual([
      'src/lib/site.ts holds no object typed SiteDefinition from @ttt-productions/site-core, so the allowance for its two colours matches nothing',
    ]);
  });

  it('refuses a site definition module that is not a repo-relative path', () => {
    expect(
      factProblemsOf(colorLiteralsGuard, { exceptions: [], siteDefinitionModule: '/src/site.ts' }),
    ).toEqual(['siteDefinitionModule (/src/site.ts) must be repo-relative and forward-slashed']);
  });
});

describe('every scale class app code uses is declared by a loaded stylesheet', () => {
  const theme = installed(
    '@kit/theme',
    { exports: { './styles.css': './dist/styles/index.css' } },
    {
      'dist/styles/index.css': "@import './components.css';",
      'dist/styles/components.css':
        '.stack-1 > * + * { margin-top: 0.25rem; }\n.icon-xs { width: 0.75rem; }',
    },
  );
  const base = {
    ...theme,
    'src/app/styles/globals.css':
      "@import '@kit/theme/styles.css' layer(base);\n@import './app.css' layer(base);",
    'src/app/styles/app.css': '.spinner-xs { width: 1rem; }',
    'src/app/styles/orphan.css': '.icon-huge { width: 9rem; }',
  };
  const facts = { entryStylesheet: 'src/app/styles/globals.css' };

  it('passes steps the theme package and the app sheets declare, through every class-string spelling', async () => {
    expect(
      await allFindings(scaleClassesGuard, facts, {
        ...base,
        'src/ui/row.tsx':
          'export const r = <div className={cn("stack-1", `md:spinner-xs ${x}`, \'icon-xs\')} />;',
      }),
    ).toEqual([]);
  });

  it('flags an undeclared step, and a step only an unloaded sheet declares', async () => {
    expect(
      await allFindings(scaleClassesGuard, facts, {
        ...base,
        'src/ui/row.tsx':
          'export const r = <div className="stack-0" />;\nexport const s = <i className="icon-huge" />;',
      }),
    ).toEqual([
      'src/ui/row.tsx:1 stack-0 is declared by no loaded stylesheet',
      'src/ui/row.tsx:2 icon-huge is declared by no loaded stylesheet',
    ]);
  });

  it('flags an import it cannot resolve, and a cascade that declares no scale at all', async () => {
    expect(
      await allFindings(scaleClassesGuard, facts, {
        'src/app/styles/globals.css': "@import '@kit/missing/styles.css';",
      }),
    ).toEqual([
      "src/app/styles/globals.css:1 cannot resolve the stylesheet import @import '@kit/missing/styles.css'",
      'src/app/styles/globals.css no loaded stylesheet declares a scale class, so nothing could be checked',
    ]);
  });

  it('refuses facts with no entry stylesheet', () => {
    expect(factProblemsOf(scaleClassesGuard, {})).toEqual(['entryStylesheet is missing']);
  });
});

describe('a status foreground sits on its own solid fill', () => {
  it('flags a foreground on a tint or under another variant prefix, and passes the solid pairings', async () => {
    const findings = await allFindings(
      statusForegroundGuard,
      {},
      {
        'src/ui/pill.tsx': [
          'export const a = <p className="text-warning-foreground bg-warning/10" />;',
          'export const b = <p className="hover:text-destructive-foreground bg-destructive" />;',
          'export const c = <p className="bg-success text-success-foreground" />;',
          'export const d = <p className="hover:bg-info hover:text-info-foreground" />;',
        ].join('\n'),
      },
    );
    expect(findings).toEqual([
      'src/ui/pill.tsx:1 not on the reviewed list: text-warning-foreground',
      'src/ui/pill.tsx:2 not on the reviewed list: hover:text-destructive-foreground',
    ]);
  });
});

describe('shadows are owned by classes and survive a focus ring', () => {
  it('flags an unpaired, a mismatched, and a void `none` box-shadow, and passes the paired forms', async () => {
    const findings = await allFindings(
      shadowOwnershipGuard,
      {},
      {
        'src/app/styles/a.css': [
          '.a { box-shadow: 0 0 1rem hsl(var(--ring)); }',
          '.b { --tw-shadow: 0 0 1rem red; box-shadow: 0 0 2rem red; }',
          '.c { --tw-shadow: none; box-shadow: none; }',
          '.d { --tw-shadow: 0 0 1rem hsl(var(--ring)); box-shadow: 0  0 1rem hsl(var(--ring)); }',
          '.e { --tw-shadow: 0 0 transparent; box-shadow: none; }',
          '.f { transition: box-shadow var(--motion-fast) var(--motion-ease); }',
        ].join('\n'),
      },
    );
    expect(findings).toEqual([
      'src/app/styles/a.css:1 not on the reviewed list: box-shadow: 0 0 1rem hsl(var(--ring)) — --tw-shadow: (missing)',
      'src/app/styles/a.css:2 not on the reviewed list: box-shadow: 0 0 2rem red — --tw-shadow: 0 0 1rem red',
      'src/app/styles/a.css:3 not on the reviewed list: box-shadow: none — --tw-shadow: none',
    ]);
  });

  it('flags every shadow-adding utility spelling, and passes shadow-none and prose', async () => {
    const findings = await allFindings(
      shadowOwnershipGuard,
      {},
      {
        'src/ui/card.tsx': [
          'export const a = <Card className="w-full shadow-md" />;',
          "export const b = cn('hover:shadow', 'md:shadow-[0_0_4px_red]', 'drop-shadow-sm');",
          'export const c = <Card className="border-none shadow-none" />;',
          "export const d = 'a little shadow hatching';",
        ].join('\n'),
      },
    );
    expect(findings).toEqual([
      'src/ui/card.tsx:1 not on the reviewed list: shadow-md',
      'src/ui/card.tsx:2 not on the reviewed list: hover:shadow',
      'src/ui/card.tsx:2 not on the reviewed list: md:shadow-[0_0_4px_red]',
      'src/ui/card.tsx:2 not on the reviewed list: drop-shadow-sm',
    ]);
  });
});

describe('a vertical stack is never on a horizontal row', () => {
  it('flags stack-N on a flex or inline-flex row, test code included, and passes columns and gap rows', async () => {
    const findings = await allFindings(
      stackRowsGuard,
      {},
      {
        'src/ui/row.tsx': [
          'export const a = <label className="flex items-center stack-2" />;',
          'export const b = <label className="inline-flex md:stack-3" />;',
          'export const c = <div className="flex flex-col stack-2" />;',
          'export const d = <div className="stack-4" />;',
          'export const e = <div className="flex gap-2" />;',
        ].join('\n'),
        'src/ui/row.test.tsx': 'render(<div className="flex stack-1" />);',
      },
    );
    expect(findings).toEqual([
      'src/ui/row.test.tsx:1 not on the reviewed list: stack-1',
      'src/ui/row.tsx:1 not on the reviewed list: stack-2',
      'src/ui/row.tsx:2 not on the reviewed list: md:stack-3',
    ]);
  });
});

describe('an unavailable control never wears the clickable affordance', () => {
  it('flags a pointer cursor or press effect on a button that does not exclude both unavailable forms', async () => {
    const findings = await allFindings(
      unavailableAffordanceGuard,
      {},
      {
        'src/app/styles/base.css': [
          'button:not(:disabled) { cursor: pointer; }',
          "[role='button'] { cursor: pointer; }",
          ":is(button, a).btn:active:not([aria-disabled='true']) { transform: scale(0.97); }",
        ].join('\n'),
      },
    );
    expect(findings).toEqual([
      "src/app/styles/base.css:1 not on the reviewed list: button:not(:disabled) gives the pointer cursor without :not([aria-disabled='true'])",
      "src/app/styles/base.css:2 not on the reviewed list: [role='button'] gives the pointer cursor without :not([aria-disabled='true'])",
      "src/app/styles/base.css:3 not on the reviewed list: :is(button, a).btn:active:not([aria-disabled='true']) gives the press effect without :not(:disabled)",
    ]);
  });

  it('passes rules that exclude both forms, and leaves custom surfaces and non-buttons alone', async () => {
    const findings = await allFindings(
      unavailableAffordanceGuard,
      {},
      {
        'src/app/styles/base.css': [
          "button:not(:disabled):not([aria-disabled='true']),\n[role='button']:not([aria-disabled='true']),\nsummary,\nlabel[for] { cursor: pointer; }",
          ":is(button, a).btn:active:not(:disabled):not([aria-disabled='true']) { transform: scale(0.97); }",
          '.coin { cursor: pointer; }',
          '.button-like { cursor: pointer; }',
        ].join('\n'),
      },
    );
    expect(findings).toEqual([]);
  });
});
