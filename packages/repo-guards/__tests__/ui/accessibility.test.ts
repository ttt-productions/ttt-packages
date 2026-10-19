// The accessibility guards: an icon-only button is named, a button in a form states its type, a
// display-only component is never a control, and a typed number is read from the whole input.

import { describe, expect, it } from 'vitest';
import {
  accessibleControlsGuard,
  wholeInputNumbersGuard,
  type AccessibleControlFacts,
  type WholeInputNumberFacts,
} from '../../src/modules/ui/accessibility.js';
import { allFindings, runDefinition } from './helpers.js';

const CONTROLS: AccessibleControlFacts = {
  surfaceTrees: ['src/components', 'src/app'],
  button: { component: 'Button', iconSizes: ['icon'] },
  displayComponents: ['Badge'],
};

const ICON = 'an icon-only button carries an accessible name';
const FORM = 'a button inside a form states its type';
const DISPLAY = 'a display-only component is never a trigger or a control';

describe('an icon-only button carries an accessible name', () => {
  it('flags an unnamed and a title-only icon button, and passes every naming shape', async () => {
    const found = await runDefinition(accessibleControlsGuard, CONTROLS, {
      'src/components/bad.tsx': [
        'const a = <Button size="icon"><X /></Button>;',
        'const b = <Button size="icon" title="Reset"><X /></Button>;',
      ].join('\n'),
      'src/components/good.tsx': [
        'const a = <Button size="icon" aria-label="Reset color"><X /></Button>;',
        'const b = <Button size="icon" aria-labelledby="reset-label"><X /></Button>;',
        'const c = <Button size="icon"><X /><span className="sr-only">Reset</span></Button>;',
        'const d = <Button size="icon" asChild><a href="/x" aria-label="Open" /></Button>;',
        'const e = <Button size="icon" {...props} />;',
        'const f = <Button size="sm"><X /></Button>;',
      ].join('\n'),
    });
    expect(found[ICON]).toEqual([
      'src/components/bad.tsx:1 not on the reviewed list: an unnamed size="icon" Button',
      'src/components/bad.tsx:2 not on the reviewed list: an unnamed size="icon" Button',
    ]);
  });

  it('reads only the render-surface trees', async () => {
    const found = await runDefinition(accessibleControlsGuard, CONTROLS, {
      'src/lib/helper.tsx': 'const a = <Button size="icon"><X /></Button>;',
    });
    expect(found[ICON]).toEqual([]);
  });
});

describe('a button inside a form states its type', () => {
  it('flags an untyped button inside a form, and passes typed, trigger-typed, and form-less buttons', async () => {
    const found = await runDefinition(accessibleControlsGuard, CONTROLS, {
      'src/app/form.tsx': [
        'const a = <form><Button onClick={clear}>Clear</Button></form>;',
        'const b = <form><div><button onClick={pick}>Pick</button></div></form>;',
        'const c = <form><Button type="button" onClick={clear}>Clear</Button></form>;',
        'const d = <form><Button type="submit">Save</Button></form>;',
        'const e = <form><PopoverTrigger asChild><Button>Pick a date</Button></PopoverTrigger></form>;',
        'const f = <div><Button onClick={go}>Go</Button></div>;',
      ].join('\n'),
    });
    expect(found[FORM]).toEqual([
      'src/app/form.tsx:1 not on the reviewed list: an untyped <Button> inside a <form>',
      'src/app/form.tsx:2 not on the reviewed list: an untyped <button> inside a <form>',
    ]);
  });
});

describe('a display-only component is never a trigger or a control', () => {
  it('flags one handed to an asChild trigger, passed as a trigger, or given a handler, and passes a display use', async () => {
    const found = await runDefinition(accessibleControlsGuard, CONTROLS, {
      'src/components/tags.tsx': [
        'const a = <TooltipTrigger asChild><Badge>3 online</Badge></TooltipTrigger>;',
        'const b = <ConsequenceDialog trigger={<Badge className="x">Drama<X /></Badge>} title="t" />;',
        'const c = <Badge onClick={remove}>Drama</Badge>;',
        'const d = <Badge onKeyDown={remove}>Drama</Badge>;',
        'const e = <div><Badge variant="secondary">Drama</Badge><Button aria-label="Remove">x</Button></div>;',
        'const f = <TooltipTrigger asChild><button type="button" className={badgeVariants()}>3</button></TooltipTrigger>;',
      ].join('\n'),
    });
    expect(found[DISPLAY]).toEqual([
      'src/components/tags.tsx:1 not on the reviewed list: a Badge handed to an asChild parent',
      'src/components/tags.tsx:2 not on the reviewed list: a Badge passed as a trigger',
      'src/components/tags.tsx:3 not on the reviewed list: a Badge given onClick',
      'src/components/tags.tsx:4 not on the reviewed list: a Badge given onKeyDown',
    ]);
  });
});

describe('the facts the control guards take', () => {
  it('refuses missing trees, a button with no icon sizes, and no display components', () => {
    expect(
      accessibleControlsGuard.factProblems({
        surfaceTrees: [],
        button: { component: 'Button', iconSizes: [] },
        displayComponents: [],
      }),
    ).toEqual(['surfaceTrees is empty', 'button.iconSizes is empty', 'displayComponents is empty']);
    expect(accessibleControlsGuard.factProblems(CONTROLS)).toEqual([]);
  });
});

describe('a render surface reads a typed number from the whole input', () => {
  const facts: WholeInputNumberFacts = {
    surfaceTrees: ['src/components'],
    allowlist: [
      {
        path: 'src/components/reviewed.tsx',
        why: 'parses a type="number" input the browser validated',
      },
    ],
  };

  it('flags every prefix-parser spelling outside the reviewed file, and passes whole-input parsing', async () => {
    expect(
      await allFindings(wholeInputNumbersGuard, facts, {
        'src/components/count.tsx': [
          'const a = parseInt(text, 10);',
          'const b = Number.parseInt(text, 10);',
          'const c = parseFloat(amount);',
          'const d = Number.parseFloat(amount);',
          'const e = Number(text.trim());',
        ].join('\n'),
        'src/components/reviewed.tsx': 'const n = parseInt(input.value, 10);',
        'src/lib/math.ts': 'const n = parseInt(text, 10);',
      }),
    ).toEqual([
      'src/components/count.tsx:1 not on the reviewed list: parseInt()',
      'src/components/count.tsx:2 not on the reviewed list: Number.parseInt()',
      'src/components/count.tsx:3 not on the reviewed list: parseFloat()',
      'src/components/count.tsx:4 not on the reviewed list: Number.parseFloat()',
    ]);
  });

  it('fails a reviewed file that no longer prefix-parses', async () => {
    const findings = await allFindings(wholeInputNumbersGuard, facts, {
      'src/components/reviewed.tsx': 'const n = Number(input.value);',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/^src\/components\/reviewed\.tsx /);
  });
});
