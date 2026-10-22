import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { viewOfText, type FileView } from '@ttt-productions/repo-guards';
import { packageSource } from './workspace';

const sourceFiles = packageSource(['code', 'stylesheet']);

const SPINNER_ICONS = [
  'Loader2',
  'Loader2Icon',
  'LucideLoader2',
  'LoaderCircle',
  'LoaderCircleIcon',
  'LucideLoaderCircle',
];

const CLASS_HELPERS = new Set(['cn', 'clsx', 'classNames', 'cx', 'twMerge', 'cva']);

const SPIN_CLASS = /(?<![\w-])animate-spin(?![\w-])/;

function stringsIn(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteralLike(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n))
      out.push(n.head.text, ...n.templateSpans.map((span) => span.literal.text));
    if (
      (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) &&
      ts.isStringLiteralLike(n.name)
    )
      out.push(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

function appliedSpinClass(file: FileView): number[] {
  if (file.kind === 'stylesheet') {
    const lines: number[] = [];
    for (const m of file.code.matchAll(/@apply\b[^;{}]*|[^{};]*\{/g)) {
      const text = m[0];
      const applies = text.startsWith('@apply')
        ? SPIN_CLASS.test(text)
        : /\.animate-spin(?![\w-])/.test(text);
      if (applies) lines.push(file.lineOf((m.index ?? 0) + text.search(/animate-spin/)));
    }
    return lines;
  }
  const sf = file.sourceFile;
  const lines: number[] = [];
  const at = (node: ts.Node) => file.lineOf(node.getStart(sf));
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      ['className', 'class'].includes(node.name.getText(sf)) &&
      node.initializer
    ) {
      if (stringsIn(node.initializer).some((s) => SPIN_CLASS.test(s))) lines.push(at(node));
      return;
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CLASS_HELPERS.has(node.expression.text)
    ) {
      if (node.arguments.some((arg) => stringsIn(arg).some((s) => SPIN_CLASS.test(s))))
        lines.push(at(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines;
}

const namesSpinnerIcon = (file: FileView): boolean =>
  file.imports.some(
    ({ kind, spec, named }) =>
      (kind === 'import' || kind === 'export') &&
      spec === 'lucide-react' &&
      named.some((n) => SPINNER_ICONS.includes(n.imported)),
  );

describe('boundary: canonical spinner', () => {
  it('scans a plausible number of package source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('allows the spinner icon only inside ui-core Spinner, imported or re-exported under any of its names', () => {
    const allowed = 'packages/ui-core/src/react/components/spinner.tsx';
    const violations = sourceFiles
      .filter((file) => file.kind === 'code')
      .filter(namesSpinnerIcon)
      .map((file) => file.path)
      .filter((file) => file !== allowed);

    expect(
      violations,
      `lucide's spinner icon imported outside ui-core Spinner — render <Spinner> or pass \`pending\`:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('applies the animate-spin utility nowhere (theme-core spinner classes own the animation)', () => {
    const violations = sourceFiles.flatMap((file) =>
      appliedSpinClass(file).map((line) => `${file.path}:${line}`),
    );

    expect(
      violations,
      `animate-spin applied as a class — render <Spinner> instead:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('finds the spinner icon imported, aliased, or re-exported, and nothing else lucide exports', () => {
    expect(
      namesSpinnerIcon(viewOfText('a.tsx', "import { Loader2 as Busy } from 'lucide-react';")),
    ).toBe(true);
    expect(
      namesSpinnerIcon(viewOfText('b.ts', "export { Loader2Icon } from 'lucide-react';")),
    ).toBe(true);
    expect(namesSpinnerIcon(viewOfText('c.tsx', "import { RefreshCw } from 'lucide-react';"))).toBe(
      false,
    );
  });

  it('finds the class wherever it is applied, and nowhere it is only named', () => {
    const flagged = [
      viewOfText('a.tsx', 'export const a = <RefreshCw className="icon-xs animate-spin" />;'),
      viewOfText(
        'b.tsx',
        'export const b = <i className={`icon ${busy ? "animate-spin" : ""}`} />;',
      ),
      viewOfText(
        'c.tsx',
        "export const c = <i className={cn('icon', { 'animate-spin': busy })} />;",
      ),
      viewOfText('d.ts', "export const d = clsx('icon', busy && 'motion-safe:animate-spin');"),
      viewOfText('e.css', '.icon { @apply animate-spin; }'),
      viewOfText('f.css', '.list .animate-spin { color: red; }'),
    ];
    for (const file of flagged) expect(appliedSpinClass(file), file.path).toHaveLength(1);

    const passed = [
      viewOfText('g.ts', 'export const pattern = /\\banimate-spin\\b/;'),
      viewOfText(
        'h.ts',
        'export const sample = tsx(\'<RefreshCw className="icon-xs animate-spin" />\');',
      ),
      viewOfText(
        'i.tsx',
        '// className="animate-spin" in prose only\nexport const i = <Spinner size="xs" />;',
      ),
      viewOfText(
        'j.css',
        '/* .animate-spin in prose */ .spinner { animation: spinner-turn 1s linear infinite; }',
      ),
      viewOfText('k.tsx', 'export const k = <i className="animate-spinner" />;'),
    ];
    for (const file of passed) expect(appliedSpinClass(file), file.path).toEqual([]);
  });
});
