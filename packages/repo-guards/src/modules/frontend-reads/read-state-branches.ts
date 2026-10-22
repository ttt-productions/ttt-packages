import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import { allowlistProblems, objectProblem } from '../../support/facts.js';
import { isUnder } from '../../support/text.js';
import {
  APP_CODE,
  filesUnder,
  identifierListProblem,
  isHookName,
  pathListProblem,
} from './shared.js';

const RETRY_STATE_HELPERS = new Set(['useReadRetryState']);

export interface ReadStateBranchFacts {
  surfaceTrees: readonly string[];
  fields: {
    data: readonly string[];
    failure: readonly string[];
    failureCarriers: readonly string[];
    loading: readonly string[];
  };
  exceptions: {
    failureBranches: readonly AllowlistEntry[];
    loadingWithoutFailure: readonly AllowlistEntry[];
  };
}

type Fields = ReadStateBranchFacts['fields'];
type Category = 'data' | 'failure' | 'carrier' | 'loading';

interface ReadRef {
  read: string;
  category: Category;
  node: ts.Expression;
}

function categoryOf(name: string, fields: Fields): Category | null {
  if (fields.data.includes(name)) return 'data';
  if (fields.failure.includes(name)) return 'failure';
  if (fields.failureCarriers.includes(name)) return 'carrier';
  if (fields.loading.includes(name)) return 'loading';
  return null;
}

const unwrapped = (node: ts.Expression): ts.Expression => {
  let e = node;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
};

function bindingFor(name: ts.BindingName, text: string): ts.Node | null {
  if (ts.isIdentifier(name)) return name.text === text ? name.parent : null;
  for (const el of name.elements) {
    if (ts.isOmittedExpression(el)) continue;
    const hit = bindingFor(el.name, text);
    if (hit) return hit;
  }
  return null;
}

function declarationOf(id: ts.Identifier): ts.Node | null {
  for (let scope: ts.Node | undefined = id.parent; scope; scope = scope.parent) {
    if (ts.isFunctionLike(scope))
      for (const parameter of scope.parameters) {
        const hit = bindingFor(parameter.name, id.text);
        if (hit) return hit;
      }
    const statements =
      ts.isBlock(scope) ||
      ts.isSourceFile(scope) ||
      ts.isModuleBlock(scope) ||
      ts.isCaseClause(scope) ||
      ts.isDefaultClause(scope)
        ? scope.statements
        : null;
    for (const statement of statements ?? []) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const d of statement.declarationList.declarations) {
        const hit = bindingFor(d.name, id.text);
        if (hit) return hit;
      }
    }
  }
  return null;
}

type Binding =
  | { kind: 'hook'; read: string }
  | { kind: 'retry'; source: ts.Expression }
  | { kind: 'field'; read: string; category: Category };

export const readName = (read: string): string => read.replace(/@\d+$/, '()').replace(/#\d+$/, '');

export function readRefs(file: FileView, fields: Fields): ReadRef[] {
  const sf = file.sourceFile;
  const bindings = new Map<ts.Node, Binding>();
  const visitBindings = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = unwrapped(node.initializer);
      if (ts.isCallExpression(init)) {
        const callee = init.expression.getText(sf);
        if (ts.isObjectBindingPattern(node.name) && isHookName(callee)) {
          const read = `${callee}@${node.getStart(sf)}`;
          for (const el of node.name.elements) {
            if (el.dotDotDotToken || !ts.isIdentifier(el.name)) continue;
            const category = categoryOf((el.propertyName ?? el.name).getText(sf), fields);
            if (category) bindings.set(el, { kind: 'field', read, category });
          }
        } else if (
          ts.isIdentifier(node.name) &&
          RETRY_STATE_HELPERS.has(callee) &&
          init.arguments[0]
        ) {
          bindings.set(node, { kind: 'retry', source: init.arguments[0] });
        } else if (ts.isIdentifier(node.name) && isHookName(callee)) {
          bindings.set(node, { kind: 'hook', read: `${node.name.text}#${node.getStart(sf)}` });
        }
      }
    }
    ts.forEachChild(node, visitBindings);
  };
  visitBindings(sf);

  const bindingOf = (id: ts.Identifier): Binding | undefined => {
    const declaration = declarationOf(id);
    return declaration ? bindings.get(declaration) : undefined;
  };

  const ownerOf = (receiver: ts.Expression, depth = 0): string => {
    const r = unwrapped(receiver);
    if (ts.isIdentifier(r)) {
      const binding = bindingOf(r);
      if (binding?.kind === 'hook' || binding?.kind === 'field') return binding.read;
      if (binding?.kind === 'retry' && depth < 8) return ownerOf(binding.source, depth + 1);
      return r.text;
    }
    if (ts.isPropertyAccessExpression(r) && fields.failureCarriers.includes(r.name.text))
      return ownerOf(r.expression, depth);
    return r.getText(sf);
  };

  const isRead = (receiver: ts.Expression): boolean => {
    const r = unwrapped(receiver);
    if (ts.isIdentifier(r)) {
      const binding = bindingOf(r);
      return (
        binding?.kind === 'hook' ||
        binding?.kind === 'retry' ||
        (binding?.kind === 'field' && binding.category === 'carrier')
      );
    }
    return ts.isPropertyAccessExpression(r) && fields.failureCarriers.includes(r.name.text)
      ? isRead(r.expression)
      : false;
  };

  const refs: ReadRef[] = [];
  const isReceiver = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      const category = categoryOf(node.name.text, fields);
      if (category && !(category === 'carrier' && isReceiver(node)) && isRead(node.expression))
        refs.push({ read: ownerOf(node.expression), category, node });
    } else if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const isName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        ((ts.isBindingElement(parent) ||
          ts.isVariableDeclaration(parent) ||
          ts.isPropertyAssignment(parent) ||
          ts.isParameter(parent)) &&
          parent.name === node) ||
        (ts.isBindingElement(parent) && parent.propertyName === node) ||
        ts.isShorthandPropertyAssignment(parent) ||
        ts.isJsxAttribute(parent);
      const binding = isName ? undefined : bindingOf(node);
      if (binding?.kind === 'field' && !(binding.category === 'carrier' && isReceiver(node)))
        refs.push({ read: binding.read, category: binding.category, node });
      else if (binding?.kind === 'retry' && !isReceiver(node))
        refs.push({ read: ownerOf(node), category: 'carrier', node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return refs;
}

const within = (node: ts.Node, root: ts.Node) =>
  node.getStart() >= root.getStart() && node.getEnd() <= root.getEnd();

const isNot = (node: ts.Node): node is ts.PrefixUnaryExpression =>
  ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken;

const isAnd = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;

function outerParens(node: ts.Node): ts.Node {
  let at = node;
  while (ts.isParenthesizedExpression(at.parent) || ts.isNonNullExpression(at.parent))
    at = at.parent;
  return at;
}

function chainTop(node: ts.Node): ts.Node {
  let at = outerParens(node);
  while (isAnd(at.parent)) at = outerParens(at.parent);
  return at;
}

function noDataCheck(node: ts.Expression): ts.Node | null {
  const at = outerParens(node);
  const parent = at.parent;
  if (isNot(parent)) return isNot(outerParens(parent).parent) ? null : parent;
  if (
    ts.isBinaryExpression(parent) &&
    [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(
      parent.operatorToken.kind,
    )
  ) {
    const other = unwrapped(parent.left === at ? parent.right : parent.left);
    const absent =
      other.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(other) && other.text === 'undefined');
    return absent ? parent : null;
  }
  return null;
}

function conjoinedNoData(failure: ReadRef, inside: readonly ReadRef[]): boolean {
  const top = chainTop(failure.node);
  return inside.some((r) => {
    if (r.category !== 'data' || r.read !== failure.read) return false;
    const check = noDataCheck(r.node);
    return !!check && isAnd(outerParens(check).parent) && chainTop(check) === top;
  });
}

function isNegated(node: ts.Expression): boolean {
  let at: ts.Node = node;
  while (ts.isParenthesizedExpression(at.parent)) at = at.parent;
  return (
    ts.isPrefixUnaryExpression(at.parent) && at.parent.operator === ts.SyntaxKind.ExclamationToken
  );
}

const returns = (statement: ts.Statement): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found || ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(statement);
  return found;
};

function replacingConditions(file: FileView): ts.Expression[] {
  const out: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isConditionalExpression(node)) out.push(node.condition);
    else if (ts.isIfStatement(node) && returns(node.thenStatement)) out.push(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return out;
}

export function failureBranchesWithoutNoData(file: FileView, fields: Fields): Hit[] {
  const refs = readRefs(file, fields);
  const hits: Hit[] = [];
  for (const condition of replacingConditions(file)) {
    const inside = refs.filter((r) => within(r.node, condition));
    const failures = inside.filter((r) => r.category === 'failure' && !isNegated(r.node));
    const reported = new Set<string>();
    for (const failure of failures) {
      if (reported.has(failure.read)) continue;
      if (conjoinedNoData(failure, inside)) continue;
      reported.add(failure.read);
      hits.push({
        index: failure.node.getStart(file.sourceFile),
        detail: `${failure.node.getText(file.sourceFile)} branches without checking that ${readName(failure.read)} holds no answer`,
      });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function loadingWithoutFailure(file: FileView, fields: Fields): Hit[] {
  const refs = readRefs(file, fields);
  const failing = new Set(
    refs.filter((r) => r.category === 'failure' || r.category === 'carrier').map((r) => r.read),
  );
  const hits: Hit[] = [];
  const reported = new Set<string>();
  for (const ref of refs) {
    if (ref.category !== 'loading' || failing.has(ref.read) || reported.has(ref.read)) continue;
    reported.add(ref.read);
    hits.push({
      index: ref.node.getStart(file.sourceFile),
      detail: `${ref.node.getText(file.sourceFile)} is used, but ${readName(ref.read)}'s failure never is`,
    });
  }
  return hits.sort((a, b) => a.index - b.index);
}

export const readStateBranchesGuard: GenericGuardDefinition<ReadStateBranchFacts> = {
  id: 'readStateBranches',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathListProblem(facts?.surfaceTrees, 'surfaceTrees', problems);
    if (objectProblem(facts?.fields, 'fields', problems)) {
      identifierListProblem(facts.fields.data, 'fields.data', problems, { nonEmpty: true });
      identifierListProblem(facts.fields.failure, 'fields.failure', problems, { nonEmpty: true });
      identifierListProblem(facts.fields.failureCarriers, 'fields.failureCarriers', problems, {
        nonEmpty: false,
      });
      identifierListProblem(facts.fields.loading, 'fields.loading', problems, { nonEmpty: true });
      const all = [
        ...(facts.fields.data ?? []),
        ...(facts.fields.failure ?? []),
        ...(facts.fields.failureCarriers ?? []),
        ...(facts.fields.loading ?? []),
      ];
      const seen = new Set<string>();
      for (const name of all) {
        if (seen.has(name)) problems.push(`fields names ${name} in two roles`);
        seen.add(name);
      }
    }
    if (objectProblem(facts?.exceptions, 'exceptions', problems)) {
      allowlistProblems(facts.exceptions.failureBranches, 'exceptions.failureBranches', problems);
      allowlistProblems(
        facts.exceptions.loadingWithoutFailure,
        'exceptions.loadingWithoutFailure',
        problems,
      );
    }
    return problems;
  },
  build(facts) {
    const { fields } = facts;
    const inTrees = (file: FileView) => facts.surfaceTrees.some((tree) => isUnder(file.path, tree));
    const sample = `${facts.surfaceTrees[0]}/sample.tsx`;
    const [data] = fields.data;
    const [failure] = fields.failure;
    const [loading] = fields.loading;
    const failureBranch = reviewedAllowlist({
      title: 'a failure branch that replaces a read also checks that nothing answered',
      description:
        `In a render surface (${facts.surfaceTrees.join(', ')}), a branch that swaps the content for the failure — a ` +
        `ternary, or an if that returns — on a read's failure (${[...fields.failure, ...fields.failureCarriers].join(' / ')}) ` +
        `is conjoined with a check that the same read holds no answer (!${fields.data.join(' / !')}, or a compare with ` +
        'null or undefined). A read that answered and then fails keeps its answer: the content, and any editor open in ' +
        'it, stays on screen with the failure inline, and only a failure with nothing answered replaces it. A reviewed ' +
        'exception names the file and its why.',
      scope: APP_CODE,
      match: (file) => (inTrees(file) ? failureBranchesWithoutNoData(file, fields) : []),
      allowlist: facts.exceptions.failureBranches,
      samples: {
        flags: [
          {
            path: sample,
            text: `const { ${data}, ${failure} } = useRows();\nreturn ${failure} ? <Failed /> : <List rows={${data}} />;`,
          },
          {
            path: sample,
            text: `const rows = useRows();\nif (rows.${failure}) return <Failed />;\nreturn <List rows={rows.${data}} />;`,
          },
        ],
        passes: [
          {
            path: sample,
            text: `const { ${data}, ${failure} } = useRows();\nreturn ${failure} && !${data} ? <Failed /> : <List rows={${data}} />;`,
          },
          {
            path: sample,
            text: `const rows = useRows();\nif (rows.${failure} && rows.${data} === undefined) return <Failed />;\nreturn <List rows={rows.${data}} />;`,
          },
          {
            path: sample,
            text: `const rows = useRows();\nreturn <>{rows.${failure} && <InlineFailure />}<List rows={rows.${data}} /></>;`,
          },
        ],
      },
    });
    const loadingAlone = reviewedAllowlist({
      title: "a surface that renders a read's loading state also renders its failure",
      description:
        `A render surface (${facts.surfaceTrees.join(', ')}) that reads a read's loading state ` +
        `(${fields.loading.join(' / ')}) also reads that read's failure (${[...fields.failure, ...fields.failureCarriers].join(' / ')}). ` +
        'A surface with a loading branch and no failure branch renders a failed read as an endless pending state or ' +
        'as an empty answer. A reviewed exception names the file and its why.',
      scope: APP_CODE,
      match: (file) => (inTrees(file) ? loadingWithoutFailure(file, fields) : []),
      allowlist: facts.exceptions.loadingWithoutFailure,
      samples: {
        flags: [
          {
            path: sample,
            text: `const { ${data}, ${loading} } = useRows();\nif (${loading}) return <Spinner />;\nreturn <List rows={${data}} />;`,
          },
        ],
        passes: [
          {
            path: sample,
            text: `const { ${data}, ${loading}, ${failure} } = useRows();\nif (${loading}) return <Spinner />;\nif (${failure} && !${data}) return <Failed />;\nreturn <List rows={${data}} />;`,
          },
        ],
      },
    });
    const withTrees = (guard: typeof failureBranch): typeof failureBranch => ({
      ...guard,
      async run(context) {
        return [...filesUnder(context, facts.surfaceTrees).findings, ...(await guard.run(context))];
      },
    });
    return [withTrees(failureBranch), withTrees(loadingAlone)];
  },
};
