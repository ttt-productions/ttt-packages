import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import type { Hit } from '../../shapes/shapes.js';
import { objectProblem } from '../../support/facts.js';
import { APP_CODE, collapse, reviewedCallProblem, type ReviewedCall } from './shared.js';

export interface ReadsOnlyWhenShownFacts {
  readsAhead: readonly ReviewedCall[];
}

const READ_AHEAD_CALLS: ReadonlySet<string> = new Set([
  'prefetchQuery',
  'prefetchInfiniteQuery',
  'ensureQueryData',
  'ensureInfiniteQueryData',
  'usePrefetchQuery',
  'usePrefetchInfiniteQuery',
]);

const calleeName = (callee: ts.Expression): ts.Identifier | ts.PrivateIdentifier | null =>
  ts.isPropertyAccessExpression(callee) ? callee.name : ts.isIdentifier(callee) ? callee : null;

export function readsAhead(file: FileView): Array<{ index: number; call: string }> {
  const sf = file.sourceFile;
  const out: Array<{ index: number; call: string }> = [];
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name && READ_AHEAD_CALLS.has(name.text)) {
        const index = name.getStart(sf);
        out.push({ index, call: collapse(file.code.slice(index, node.getEnd())) });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

const isFalse = (node: ts.Expression | undefined): boolean =>
  node !== undefined && node.kind === ts.SyntaxKind.FalseKeyword;

function tagOf(node: ts.Node): string {
  const element = node.parent?.parent;
  if (element && (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)))
    return element.tagName.getText();
  return 'an element';
}

export function keptMounted(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'forceMount') {
      const value =
        node.initializer && ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : undefined;
      if (!isFalse(value))
        hits.push({
          index: node.getStart(sf),
          detail: `<${tagOf(node)} forceMount> keeps content mounted while it is not shown`,
        });
    } else if (
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      node.name.getText(sf) === 'forceMount' &&
      !(ts.isPropertyAssignment(node) && isFalse(node.initializer))
    ) {
      hits.push({
        index: node.getStart(sf),
        detail: 'a forceMount prop keeps content mounted while it is not shown',
      });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return hits;
}

export const readsOnlyWhenShownGuard: GenericGuardDefinition<ReadsOnlyWhenShownFacts> = {
  id: 'readsOnlyWhenShown',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    reviewedCallProblem(facts.readsAhead, 'readsAhead', problems);
    return problems;
  },
  build(facts) {
    const sample = (text: string) => ({ path: 'src/sample.tsx', text });
    return [
      {
        title: 'nothing reads ahead of the person outside a reviewed entry',
        description:
          'A read starts only when something on screen needs its answer: no prefetchQuery, prefetchInfiniteQuery, ' +
          'ensureQueryData, ensureInfiniteQueryData, usePrefetchQuery, or usePrefetchInfiniteQuery fetches data for a tab, ' +
          'dialog, menu, or page nobody has opened, on hover or otherwise. Read it with the query its content runs once that ' +
          'content is shown (fetchQuery stays free for a read a click makes). A place where reading ahead is right is ' +
          'declared once, with its why, as a reviewed entry naming its file and its whitespace-collapsed call.',
        run(context) {
          const findings: Finding[] = [];
          const reviewed = new Set(facts.readsAhead.map((r) => `${r.path} ${r.call}`));
          const present = new Set<string>();
          for (const file of context.files(APP_CODE)) {
            for (const { index, call } of readsAhead(file)) {
              present.add(`${file.path} ${call}`);
              if (reviewed.has(`${file.path} ${call}`)) continue;
              findings.push({
                file: file.path,
                line: file.lineOf(index),
                detail: `reads ahead of the person: ${call.slice(0, 120)}`,
              });
            }
          }
          for (const r of facts.readsAhead)
            if (!present.has(`${r.path} ${r.call}`))
              findings.push({
                file: r.path,
                detail: `stale reviewed read ahead: ${r.call} is no longer there`,
              });
          return findings;
        },
        samples: {
          flags: [
            sample(
              'const open = () => queryClient.prefetchQuery({ queryKey: k.detail(id), queryFn });',
            ),
            sample('export const Row = () => { usePrefetchQuery(options); return <li />; };'),
          ],
          passes: [
            sample('const onClick = async () => queryClient.fetchQuery({ queryKey: k, queryFn });'),
          ],
          probe: (view) => readsAhead(view),
        },
      },
      {
        title: 'content that is not shown is never kept mounted',
        description:
          'A closed tab, collapsed section, dialog, or menu holds no read and no listener: its content is not mounted while ' +
          'it is not shown. No forceMount — on a tab, dialog, collapsible, or any other content part, as a JSX prop or in a ' +
          'props object — keeps it mounted so its reads and listeners run. Let the part unmount its content, and keep a ' +
          'transition on what is shown.',
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(APP_CODE))
            for (const hit of keptMounted(file))
              findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail! });
          return findings;
        },
        samples: {
          flags: [
            sample('export const T = () => <TabsContent value="a" forceMount>{a}</TabsContent>;'),
            sample('const props = { forceMount: true as const };'),
          ],
          passes: [
            sample('export const T = () => <TabsContent value="a">{a}</TabsContent>;'),
            sample('export const D = () => <DialogContent forceMount={false} />;'),
          ],
          probe: (view) => keptMounted(view),
        },
      },
    ];
  },
};
