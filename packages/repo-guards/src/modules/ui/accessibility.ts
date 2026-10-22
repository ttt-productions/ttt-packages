import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import {
  reviewedAllowlist,
  type AllowlistEntry,
  type Hit,
  type Matcher,
} from '../../shapes/shapes.js';
import { forEachNode } from '../../support/ast.js';
import { allowlistProblems, namesProblem, objectProblem } from '../../support/facts.js';
import { isUnder } from '../../support/text.js';
import { identifierListProblem, pathListProblem } from '../frontend-reads/shared.js';
import { APP_CODE } from './styling.js';

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

const openingOf = (node: ts.Node): Opening | undefined =>
  ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;

const attr = (open: Opening, name: string): ts.JsxAttribute | undefined =>
  open.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  );

const hasSpread = (open: Opening): boolean =>
  open.attributes.properties.some((p) => ts.isJsxSpreadAttribute(p));

const parentOpening = (node: ts.Node): ts.JsxOpeningElement | undefined =>
  node.parent && ts.isJsxElement(node.parent) ? node.parent.openingElement : undefined;

const inSurfaces =
  (surfaceTrees: readonly string[], match: Matcher): Matcher =>
  (file) =>
    surfaceTrees.some((tree) => isUnder(file.path, tree)) ? match(file) : [];

const writtenValue = (open: Opening, name: string, sf: ts.SourceFile): string | undefined =>
  attr(open, name)?.initializer?.getText(sf);

export function unnamedIconButtons(
  file: FileView,
  component: string,
  iconSizes: readonly string[],
): Hit[] {
  const sf = file.sourceFile;
  const sizes = new Set(iconSizes.map((size) => `"${size}"`));
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    const open = openingOf(node);
    if (!open || open.tagName.getText(sf) !== component) return;
    const size = writtenValue(open, 'size', sf);
    if (size === undefined || !sizes.has(size)) return;
    if (
      attr(open, 'aria-label') ||
      attr(open, 'aria-labelledby') ||
      attr(open, 'asChild') ||
      hasSpread(open)
    )
      return;
    let srOnlyChild = false;
    if (ts.isJsxElement(node)) {
      forEachNode(node, (inner) => {
        const innerOpen = openingOf(inner);
        const cls = innerOpen && writtenValue(innerOpen, 'className', sf);
        if (cls && /\bsr-only\b/.test(cls)) srOnlyChild = true;
      });
    }
    if (!srOnlyChild)
      hits.push({ index: node.getStart(sf), detail: `an unnamed size=${size} ${component}` });
  });
  return hits;
}

export function untypedFormButtons(file: FileView, buttonComponents: readonly string[]): Hit[] {
  const sf = file.sourceFile;
  const buttons = new Set(['button', ...buttonComponents]);
  const hits: Hit[] = [];
  const visit = (node: ts.Node, inForm: boolean): void => {
    const open = openingOf(node);
    let nowInForm = inForm;
    if (open) {
      const tag = open.tagName.getText(sf);
      if (tag === 'form') nowInForm = true;
      if (inForm && buttons.has(tag)) {
        const parent = parentOpening(node);
        const typedByTrigger =
          parent !== undefined &&
          /Trigger$/.test(parent.tagName.getText(sf)) &&
          attr(parent, 'asChild') !== undefined;
        if (!attr(open, 'type') && !attr(open, 'asChild') && !hasSpread(open) && !typedByTrigger)
          hits.push({ index: node.getStart(sf), detail: `an untyped <${tag}> inside a <form>` });
      }
    }
    ts.forEachChild(node, (child) => visit(child, nowInForm));
  };
  visit(sf, false);
  return hits;
}

const CONTROL_HANDLERS = ['onClick', 'onKeyDown', 'onKeyUp', 'onPointerDown'];

export function interactiveDisplayElements(
  file: FileView,
  displayComponents: readonly string[],
): Hit[] {
  const sf = file.sourceFile;
  const display = new Set(displayComponents);
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    const open = openingOf(node);
    if (!open) return;
    const tag = open.tagName.getText(sf);
    if (!display.has(tag)) return;
    const handler = CONTROL_HANDLERS.find((name) => attr(open, name));
    const parent = parentOpening(node);
    const asChildChild = parent !== undefined && attr(parent, 'asChild') !== undefined;
    let triggerValue = false;
    for (let up: ts.Node | undefined = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
      if (ts.isJsxAttribute(up)) {
        triggerValue = up.name.getText(sf) === 'trigger';
        break;
      }
      if (ts.isJsxElement(up) || ts.isJsxSelfClosingElement(up)) break;
    }
    const why = handler
      ? `given ${handler}`
      : asChildChild
        ? 'handed to an asChild parent'
        : triggerValue
          ? 'passed as a trigger'
          : undefined;
    if (why) hits.push({ index: node.getStart(sf), detail: `a ${tag} ${why}` });
  });
  return hits;
}

export interface AccessibleControlFacts {
  surfaceTrees: readonly string[];
  button: { component: string; iconSizes: readonly string[] };
  displayComponents: readonly string[];
}

export const accessibleControlsGuard: GenericGuardDefinition<AccessibleControlFacts> = {
  id: 'accessibleControls',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathListProblem(facts.surfaceTrees, 'surfaceTrees', problems);
    if (objectProblem(facts.button, 'button', problems)) {
      identifierListProblem([facts.button.component], 'button.component', problems, {
        nonEmpty: true,
      });
      namesProblem(facts.button.iconSizes, 'button.iconSizes', problems);
    }
    identifierListProblem(facts.displayComponents, 'displayComponents', problems, {
      nonEmpty: true,
    });
    return problems;
  },
  build(facts) {
    const { component, iconSizes } = facts.button;
    const surface = `${facts.surfaceTrees[0]}/sample.tsx`;
    const sample = (text: string) => ({ path: surface, text });
    const icon = iconSizes[0];
    const display = facts.displayComponents[0];
    return [
      reviewedAllowlist({
        title: 'an icon-only button carries an accessible name',
        description:
          `An icon-only ${component} (size ${iconSizes.map((s) => `"${s}"`).join(' or ')}) is named by an aria-label, an ` +
          'aria-labelledby, or an sr-only text child. A title alone is not reliably announced, and a row of icon buttons that all ' +
          'read "button" cannot be told apart.',
        scope: APP_CODE,
        match: inSurfaces(facts.surfaceTrees, (file) =>
          unnamedIconButtons(file, component, iconSizes),
        ),
        allowlist: [],
        samples: {
          flags: [
            sample(`const a = <${component} size="${icon}"><X /></${component}>;`),
            sample(`const a = <${component} size="${icon}" title="Reset"><X /></${component}>;`),
          ],
          passes: [
            sample(
              `const a = <${component} size="${icon}" aria-label="Reset color"><X /></${component}>;`,
            ),
            sample(
              `const a = <${component} size="${icon}"><X /><span className="sr-only">Reset</span></${component}>;`,
            ),
            sample(
              `const a = <${component} size="${icon}" asChild><a href="/x" aria-label="Open" /></${component}>;`,
            ),
          ],
        },
      }),
      reviewedAllowlist({
        title: 'a button inside a form states its type',
        description:
          `A button (<button>, or ${component}) inside a <form> declares type="submit" for the one submit control and ` +
          'type="button" for every other. An untyped button in a form is a submit button: pressing it, or Enter in a field, ' +
          'submits the form. A child of an asChild trigger is typed by the trigger.',
        scope: APP_CODE,
        match: inSurfaces(facts.surfaceTrees, (file) => untypedFormButtons(file, [component])),
        allowlist: [],
        samples: {
          flags: [
            sample(`const f = <form><${component} onClick={clear}>Clear</${component}></form>;`),
            sample('const f = <form><div><button onClick={pick}>Pick</button></div></form>;'),
          ],
          passes: [
            sample(
              `const f = <form><${component} type="button" onClick={clear}>Clear</${component}></form>;`,
            ),
            sample(
              `const f = <form><PopoverTrigger asChild><${component}>Pick a date</${component}></PopoverTrigger></form>;`,
            ),
            sample(`const f = <div><${component} onClick={go}>Go</${component}></div>;`),
          ],
        },
      }),
      reviewedAllowlist({
        title: 'a display-only component is never a trigger or a control',
        description:
          `${facts.displayComponents.join(', ')} render${facts.displayComponents.length === 1 ? 's' : ''} a non-interactive ` +
          'element, so one given a click or key handler, handed to an asChild trigger, or passed as a trigger is a control Tab ' +
          'never reaches and a screen reader never names. Use a real button styled to look the same.',
        scope: APP_CODE,
        match: inSurfaces(facts.surfaceTrees, (file) =>
          interactiveDisplayElements(file, facts.displayComponents),
        ),
        allowlist: [],
        samples: {
          flags: [
            sample(
              `const a = <TooltipTrigger asChild><${display}>3 online</${display}></TooltipTrigger>;`,
            ),
            sample(`const a = <Dialog trigger={<${display}>Drama</${display}>} title="t" />;`),
            sample(`const a = <${display} onClick={remove}>Drama</${display}>;`),
          ],
          passes: [
            sample(
              `const a = <div><${display}>Drama</${display}><button aria-label="Remove">x</button></div>;`,
            ),
            sample(
              'const a = <TooltipTrigger asChild><button type="button">3</button></TooltipTrigger>;',
            ),
          ],
        },
      }),
    ];
  },
};

const PREFIX_PARSERS = new Set(['parseInt', 'parseFloat']);

export function prefixNumberParses(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee) && callee.expression.getText(sf) === 'Number'
        ? callee.name.text
        : '';
    if (PREFIX_PARSERS.has(name))
      hits.push({ index: node.getStart(sf), detail: `${callee.getText(sf)}()` });
  });
  return hits;
}

export interface WholeInputNumberFacts {
  surfaceTrees: readonly string[];
  allowlist: readonly AllowlistEntry[];
}

export const wholeInputNumbersGuard: GenericGuardDefinition<WholeInputNumberFacts> = {
  id: 'wholeInputNumbers',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathListProblem(facts.surfaceTrees, 'surfaceTrees', problems);
    allowlistProblems(facts.allowlist, 'allowlist', problems);
    return problems;
  },
  build(facts) {
    const sample = (text: string) => ({ path: `${facts.surfaceTrees[0]}/sample.tsx`, text });
    return [
      reviewedAllowlist({
        title: 'a render surface reads a typed number from the whole input',
        description:
          'parseInt and parseFloat read a numeric prefix ("1.9" becomes 1, "12abc" becomes 12), so a form that parses its text ' +
          'with them submits a value nobody typed. Read the whole input: Number(...) with a finiteness or integer check, or the ' +
          "app's one parser for the value.",
        scope: APP_CODE,
        match: inSurfaces(facts.surfaceTrees, prefixNumberParses),
        allowlist: facts.allowlist,
        samples: {
          flags: [
            sample('const n = parseInt(text, 10);'),
            sample('const n = Number.parseInt(text, 10);'),
            sample('const n = parseFloat(amount);'),
            sample('const n = Number.parseFloat(amount);'),
          ],
          passes: [
            sample('const n = Number(text.trim());'),
            sample('const n = parseShareCount(text);'),
          ],
        },
      }),
    ];
  },
};
