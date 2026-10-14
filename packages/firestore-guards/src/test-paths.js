// The test-code path checker: test code builds a Firestore path through the same core builders the
// code under test uses, never by hand. A test that seeds `profiles/abc` while the code reads
// another key seeds a document the code never touches: the case proves nothing, or fails for a
// reason nobody can see. Literals are read with the TypeScript parser, so comments are never read
// and a path quoted inside a longer string — a test's name, a snippet fed to another guard — is
// not a literal that begins with one.

import ts from 'typescript';

const SEGMENT_CALLS = new Set(['doc', 'collection', 'collectionGroup']);

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const scriptKindOf = (file) =>
  file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.(m|c)?js$/.test(file)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

/**
 * Every hand-typed Firestore path in the given test-code files, as `path:line`. Two forms are
 * hand-typed:
 *  - a string, no-substitution template, or template head that BEGINS with a declared collection
 *    name followed by a slash (`'profiles/abc'`, `` `profiles/${uid}` ``);
 *  - a string exactly equal to a declared collection name passed as an argument to a `doc`,
 *    `collection`, or `collectionGroup` call (`doc(db, 'profiles', uid)`, `db.collection('profiles')`).
 * Builder calls, collection constants, bare names anywhere else, and prose pass.
 *
 * @param {Array<{ path: string, content: string }>} files
 * @param {{ collectionNames: readonly string[] }} options the core's declared collection names
 * @returns {string[]}
 */
export function findHandTypedFirestorePaths(files, { collectionNames }) {
  const names = [...new Set(collectionNames)].filter((name) => typeof name === 'string' && name);
  if (!names.length) throw new Error('firestore-guards: findHandTypedFirestorePaths needs the core collection names');
  const declared = new Set(names);
  const handTypedPath = new RegExp(`^(?:${names.map(escapeForRegExp).join('|')})/`);
  const offenders = [];
  for (const { path, content } of files) {
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKindOf(path));
    const report = (node) => offenders.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
    const visit = (node) => {
      const plain = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
      const opening = plain ? node.text : ts.isTemplateExpression(node) ? node.head.text : null;
      if (opening !== null && handTypedPath.test(opening)) {
        report(node);
      } else if (plain && declared.has(node.text) && ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)) {
        const callee = node.parent.expression;
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
        if (name && SEGMENT_CALLS.has(name)) report(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return offenders;
}
