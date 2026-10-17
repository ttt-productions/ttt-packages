// The Firestore WRITE guard: every field a local writer stores on a registered document must be
// declared by that document's schema in the app's core package (`COLLECTION_SCHEMAS`).
//
// Zod only validates where code calls it, and no writer calls it. A registry completeness test
// proves every collection HAS a schema — never that a schema is COMPLETE. This module closes that
// gap statically: it resolves every Firestore write's target document through the core's
// PATH_BUILDERS / COLLECTIONS to a `COLLECTION_SCHEMAS` template, reads the written keys out of the
// payload, and diffs them against the schema's declared keys.
//
// It FAILS CLOSED. A write whose target document or whose payload it cannot read is a violation,
// not a skip — a guard that silently drops what it cannot parse grades the codebase on the subset
// it happened to understand. So is a call whose invoked METHOD is chosen at runtime and cannot be
// narrowed to a finite set of names excluding set/update/create/add: unless the receiver is
// positively not a Firestore handle, it is reported as `unclassified-write-call`. An analysis
// ceiling ends the same way — a capped resolution is a violation, never silence. The only way past
// it is a specific, reviewed exception entry bound to the structural write site and carrying its
// justification; there are no pattern-wide or tree-wide exemptions.
//
// A second, INDEPENDENT structural sweep (`enumerateWriteCallSites`) cross-checks that. It shares
// the file list with the classifier and nothing else — its own method names, its own ceiling, its
// own non-Firestore evidence, its own minimal selector reading — because a cross-check built from
// the classifier's parts shares every blind spot by construction.
//
// Everything app-specific arrives in a GUARD PROFILE (`createGuardProfile`): the core package's
// specifier and the installed library root read for what it declares and returns, import aliases,
// extra transaction-shaped handle types, and removal-only tables. This module is pure — it reads
// no file; the `./node` entry walks the trees and reads installed packages.
import ts from 'typescript';

/** posix `join` + normalization over repo-relative paths. */
function joinPosix(...parts) {
  const out = [];
  for (const segment of parts.filter(Boolean).join('/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else out.push(segment);
  }
  return out.join('/') || '.';
}

/** posix `dirname` over repo-relative paths. */
function dirnamePosix(relPath) {
  const index = relPath.lastIndexOf('/');
  return index < 0 ? '.' : relPath.slice(0, index) || '.';
}

/**
 * The normalized guard profile: what the analyzer knows about the consuming app.
 *
 * @param {object} config
 * @param {string} config.corePackage the app's core package specifier (`@scope/core`)
 * @param {string} [config.coreLibraryRoot] repo-relative root of the core package's code read as
 *   library code (its installed `dist`, or its source in a workspace) — the module a core specifier
 *   resolves to inside it
 * @param {Record<string, string>} [config.importAliases] specifier prefix -> repo-relative folder
 *   (`{ '@/': 'src/' }`)
 * @param {string[]} [config.transactionTypeNames] app types a write handle parameter may be
 *   annotated with, beside `Transaction` / `WriteBatch` / `BulkWriter`
 * @param {string[]} [config.handleModulePrefixes] module specifier prefixes, beside Firebase's own,
 *   whose exports can hand back a real Firestore handle (the app's own packages)
 * @param {Array<{ exportName: string, module: string, label: string }>} [config.removalOnlyTables]
 *   tables of `{ collection, documentId }` entries naming documents no schema owns, which a write
 *   may only remove from; `module` is the repo-relative file declaring `exportName`
 */
export function createGuardProfile({
  corePackage,
  coreLibraryRoot = null,
  importAliases = {},
  transactionTypeNames = [],
  removalOnlyTables = [],
  handleModulePrefixes = [],
}) {
  if (typeof corePackage !== 'string' || !corePackage) throw new Error('firestore-guards: a profile needs its corePackage');
  const typeNames = ['Transaction', 'WriteBatch', 'BulkWriter', ...transactionTypeNames];
  for (const name of typeNames) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`firestore-guards: ${name} is not a type name`);
  }
  return Object.freeze({
    corePackage,
    coreLibraryRoot: coreLibraryRoot ? joinPosix(coreLibraryRoot) : null,
    importAliases: Object.freeze({ ...importAliases }),
    transactionType: new RegExp(`\\b(${typeNames.join('|')})\\b`),
    removalOnlyTables: Object.freeze(removalOnlyTables.map((table) => Object.freeze({ ...table }))),
    handleModule: new RegExp(
      ['firebase', 'firestore', ...handleModulePrefixes.map((prefix) => `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)].join('|'),
      'i',
    ),
  });
}

import { objectShape, unwrap, kindOf } from './zod-shape.js';

// ---------------------------------------------------------------------------
// Violation kinds
// ---------------------------------------------------------------------------

export const VIOLATION_KINDS = Object.freeze({
  UNDECLARED_FIELD: 'undeclared-field',
  UNRESOLVED_TARGET: 'unresolved-target',
  UNREADABLE_PAYLOAD: 'unreadable-payload',
  PAYLOAD_CAST: 'payload-cast',
  HAND_BUILT_PATH: 'hand-built-path',
  /** A registered template whose declared keys cannot be read, so nothing was diffed. */
  UNDIFFABLE_TEMPLATE: 'undiffable-template',
  /** A write-method call the classifier never reached an explicit outcome for. */
  UNCLASSIFIED_CALL: 'unclassified-write-call',
  /** A package-builder assertion entry whose bound canonical schema no longer reads. */
  PACKAGE_BUILDER: 'package-builder',
});

/** Firestore write methods on a DocumentReference / CollectionReference / tx / batch. */
const WRITE_METHODS = new Set(['set', 'update', 'create', 'add']);

/** Function methods that invoke another function indirectly. */
const INDIRECTION_METHODS = new Set(['bind', 'call', 'apply']);

/**
 * How deep a selector alias chain is followed before analysis stops. Exceeding it is not a
 * quiet empty answer: an analysis CEILING resolves to nothing, and "nothing" is exactly the
 * state a bypass produces, so the ceiling reports UNRESOLVED and the call fails closed.
 */
const SELECTOR_DEPTH = 12;

/** A selector that resolved to a finite, fully-read set of names. */
const RESOLVED = (names) => ({ names: [...new Set(names)], resolved: true });
/** A selector the analyzer could not narrow to a finite set — never an empty answer. */
const UNRESOLVED = { names: [], resolved: false };

/**
 * The write method a call invokes, for `ref.set(…)` AND `ref['set'](…)`. A bracket call
 * with a literal name is the same call; reading only property access made it invisible.
 *
 * Returns the FINITE set of names the selector can take, or `resolved: false` when it cannot
 * be narrowed to one. Those two answers are not the same: an empty finite set means the call
 * is provably not a write, while an unresolved selector may be any name at all.
 *
 * @returns {{ names: string[], resolved: boolean }}
 */
function writeMethodCandidates(node, facts, seen = new Set(), depth = 0) {
  if (!node) return UNRESOLVED;
  if (depth > SELECTOR_DEPTH) return UNRESOLVED;
  const candidate = stripWrappers(node);
  const key = `${candidate.pos}:${candidate.end}`;
  if (seen.has(key)) return UNRESOLVED;
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  if (ts.isStringLiteralLike(candidate)) return RESOLVED([candidate.text]);
  if (ts.isTemplateExpression(candidate)) {
    let value = candidate.head.text;
    for (const span of candidate.templateSpans) {
      const inner = writeMethodCandidates(span.expression, facts, nextSeen, depth + 1);
      if (!inner.resolved || inner.names.length !== 1) return UNRESOLVED;
      value += inner.names[0] + span.literal.text;
    }
    return RESOLVED([value]);
  }
  if (ts.isConditionalExpression(candidate)) {
    const left = writeMethodCandidates(candidate.whenTrue, facts, nextSeen, depth + 1);
    const right = writeMethodCandidates(candidate.whenFalse, facts, nextSeen, depth + 1);
    if (!left.resolved || !right.resolved) return UNRESOLVED;
    return RESOLVED([...left.names, ...right.names]);
  }
  if (ts.isIdentifier(candidate)) {
    // EVERY visible assignment is read, exactly as a payload variable's are: a `let` whose
    // declaration is harmless and whose reassignment is a write method is the whole point.
    const declarations = facts?.varDecls.get(candidate.text) ?? [];
    const initialized = declarations.filter((decl) => decl.initializer);
    if (initialized.length) {
      const names = [];
      for (const decl of initialized) {
        const inner = writeMethodCandidates(decl.initializer, facts, nextSeen, depth + 1);
        if (!inner.resolved) return UNRESOLVED;
        names.push(...inner.names);
      }
      return RESOLVED(names);
    }
    if (declarations.length) return UNRESOLVED;
    for (let parent = candidate.parent; parent; parent = parent.parent) {
      if (!ts.isFunctionLike(parent)) continue;
      const parameter = parent.parameters.find(
        (entry) => ts.isIdentifier(entry.name) && entry.name.text === candidate.text,
      );
      if (!parameter?.type) break;
      // Only a type built out of string literals names a finite set. `string`, `keyof T`
      // and every other widened annotation names an unbounded one.
      const literals = [...parameter.type.getText(facts.source).matchAll(/['"`]([^'"`]+)['"`]/g)]
        .map((match) => match[1]);
      return literals.length ? RESOLVED(literals) : UNRESOLVED;
    }
    return UNRESOLVED;
  }
  if (ts.isElementAccessExpression(candidate)) {
    const base = stripWrappers(candidate.expression);
    let initializer = base;
    if (ts.isIdentifier(base)) {
      const declaration = (facts?.varDecls.get(base.text) ?? []).find((entry) => entry.initializer);
      if (!declaration?.initializer) return UNRESOLVED;
      initializer = stripWrappers(declaration.initializer);
    }
    const readAll = (nodes) => {
      const names = [];
      for (const entry of nodes) {
        const inner = writeMethodCandidates(entry, facts, nextSeen, depth + 1);
        if (!inner.resolved) return UNRESOLVED;
        names.push(...inner.names);
      }
      return RESOLVED(names);
    };
    if (ts.isObjectLiteralExpression(initializer)) {
      if (!initializer.properties.every((property) => ts.isPropertyAssignment(property))) return UNRESOLVED;
      return readAll(initializer.properties.map((property) => property.initializer));
    }
    if (ts.isArrayLiteralExpression(initializer)) return readAll([...initializer.elements]);
  }
  return UNRESOLVED;
}

/**
 * What a call's callee invokes on its receiver.
 *
 * @returns {{ methods: string[], receiver: ts.Expression, resolved: boolean } | null}
 *   `null` means the selector is a finite set holding no write method — provably not a
 *   write. `resolved: false` means the selector could be a write method and nothing narrows
 *   it, which is a candidate that must still end in an explicit outcome.
 */
function writeMethodAccess(node, facts) {
  if (ts.isPropertyAccessExpression(node) && WRITE_METHODS.has(node.name.text)) {
    return { methods: [node.name.text], receiver: node.expression, resolved: true };
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const selector = writeMethodCandidates(node.argumentExpression, facts);
    if (!selector.resolved) return { methods: [], receiver: node.expression, resolved: false };
    const methods = selector.names.filter((method) => WRITE_METHODS.has(method));
    if (methods.length) return { methods, receiver: node.expression, resolved: true };
  }
  return null;
}

/** An identifier that names a Firestore ROOT (`db.collection(...)`, `args.db.doc(...)`). */
const ROOT_NAME = /^(db|firestore|adminDb|adminFirestore|getFirestore|getAdminFirestore|getDb)$/i;

/** Query-builder methods that narrow a collection without changing which collection it is. */
const QUERY_PASSTHROUGH = new Set([
  'where',
  'orderBy',
  'limit',
  'limitToLast',
  'startAt',
  'startAfter',
  'endAt',
  'endBefore',
  'select',
  'offset',
  'withConverter',
]);

/** Array methods whose callback parameter is one element of the receiver. */
const ARRAY_ITERATORS = new Set(['map', 'forEach', 'filter', 'flatMap', 'find', 'some', 'every', 'reduce']);

/**
 * Promise combinators that pass the resolved value through unchanged. `.catch(() => null)`
 * on a discovery query is the standard "a failed query is not a crash" shape here, and the
 * snapshot that DOES arrive is still the queried collection's.
 */
const PROMISE_PASSTHROUGH = new Set(['catch', 'finally']);

/** Array methods that return a subset of the SAME elements. */
const ARRAY_PASSTHROUGH = new Set(['slice', 'filter', 'sort', 'reverse', 'concat', 'flat']);

/**
 * Constructors whose instances own a `.set` / `.add` that is definitively NOT a Firestore
 * write. This list is the POSITIVE evidence side of the classifier: a candidate write is
 * dropped only when something like this names it, never because its receiver failed to
 * look Firestore-shaped.
 */
const NOT_FIRESTORE_CONSTRUCTORS = new Set([
  'Map', 'Set', 'WeakMap', 'WeakSet', 'URLSearchParams', 'Headers', 'FormData', 'URL',
  'Array', 'AbortController', 'DataTransfer', 'EventTarget',
]);

/** Type annotations that name a non-Firestore container. */
const NOT_FIRESTORE_TYPE =
  /^(readonly\s+)?(Map|Set|WeakMap|WeakSet|ReadonlyMap|ReadonlySet|URLSearchParams|ReadonlyURLSearchParams|Headers|ReadonlyHeaders|FormData|URL|Storage|DOMTokenList|CookieStore|ResponseCookies|RequestCookies|HTMLElement|HTMLDivElement|Element|Node|Document|EventTarget|Response|Request|NextResponse|NextRequest)\s*(<|\||$)/;


/** Factories whose result owns a non-Firestore `.set` (`createDevicePreferenceStore` is theme-core's
 *  browser-storage preference store — its `.set(value)` writes local storage, never Firestore). */
const NOT_FIRESTORE_FACTORIES = new Set([
  'cookies', 'headers', 'draftMode', 'createHash', 'createHmac', 'useRef', 'createRef',
  'createDevicePreferenceStore',
]);

/**
 * A function's return expressions with every call to the same local function kept once:
 * `return skip('a')` and `return skip('b')` hand back that function's one returned object,
 * so they are one shape, whatever their arguments.
 */
function distinctReturnShapes(returns) {
  const seen = new Set();
  return returns.filter((returnExpr) => {
    const returned = stripWrappers(returnExpr);
    if (!ts.isCallExpression(returned) || !ts.isIdentifier(returned.expression)) return true;
    if (seen.has(returned.expression.text)) return false;
    seen.add(returned.expression.text);
    return true;
  });
}

/**
 * The collection whose `.entries()` an expression walks — `map.entries()`, `list.entries()`,
 * or `[...map.entries()]` — or null. Each entry is a `[key, value]` tuple of it.
 */
function entriesSource(expr) {
  let node = stripWrappers(expr);
  if (ts.isArrayLiteralExpression(node) && node.elements.length === 1 && ts.isSpreadElement(node.elements[0])) {
    node = stripWrappers(node.elements[0].expression);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'entries' &&
    node.arguments.length === 0
  ) {
    return node.expression.expression;
  }
  return null;
}

/**
 * Whether an object literal holds only plain values: string, number, boolean, and template
 * literals, functions, and nested object or array literals of the same. Any spread, reference,
 * or call leaves it unproven.
 */
function isPlainValueTable(node, depth = 0) {
  if (depth > 8) return false;
  return node.properties.every((property) => {
    if (ts.isMethodDeclaration(property)) return true;
    if (!ts.isPropertyAssignment(property)) return false;
    return isPlainValue(property.initializer, depth + 1);
  });
}

function isPlainValue(expr, depth) {
  const value = stripWrappers(expr);
  if (
    ts.isStringLiteralLike(value) ||
    ts.isNumericLiteral(value) ||
    ts.isTemplateExpression(value) ||
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword ||
    value.kind === ts.SyntaxKind.NullKeyword ||
    ts.isArrowFunction(value) ||
    ts.isFunctionExpression(value)
  ) {
    return true;
  }
  if (ts.isObjectLiteralExpression(value)) return isPlainValueTable(value, depth + 1);
  if (ts.isArrayLiteralExpression(value)) return value.elements.every((element) => isPlainValue(element, depth + 1));
  return false;
}

/** Whether an expression is `FieldValue.delete()`. */
function isFieldValueDelete(expr) {
  const node = stripWrappers(expr);
  return (
    ts.isCallExpression(node) &&
    node.arguments.length === 0 &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'delete' &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'FieldValue'
  );
}

/**
 * Whether an update payload only removes: an object literal whose every value is
 * `FieldValue.delete()`, or `Object.fromEntries(list.map((field) => [field, FieldValue.delete()]))`.
 */
function isRemovalPayload(expr) {
  const node = stripWrappers(expr);
  if (ts.isObjectLiteralExpression(node)) {
    return (
      node.properties.length > 0 &&
      node.properties.every((property) => ts.isPropertyAssignment(property) && isFieldValueDelete(property.initializer))
    );
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'Object' &&
    node.expression.name.text === 'fromEntries' &&
    node.arguments.length === 1
  ) {
    const mapped = stripWrappers(node.arguments[0]);
    if (!ts.isCallExpression(mapped) || !ts.isPropertyAccessExpression(mapped.expression) || mapped.expression.name.text !== 'map') {
      return false;
    }
    const callback = mapped.arguments[0];
    if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return false;
    const returns = callbackReturns(callback);
    return (
      returns.length > 0 &&
      returns.every((returned) => {
        const entry = stripWrappers(returned);
        return ts.isArrayLiteralExpression(entry) && entry.elements.length === 2 && isFieldValueDelete(entry.elements[1]);
      })
    );
  }
  return false;
}

/** Node's Hash and Hmac factories, whose `.update()` hands back the same object. */
const HASH_FACTORIES = new Set(['createHash', 'createHmac']);

/** Whether an expression is a Hash: a hash factory's result, or its `.update()` chained on one. */
function isHashChain(expr) {
  const node = stripWrappers(expr);
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return HASH_FACTORIES.has(node.expression.text);
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'update' &&
    isHashChain(node.expression.expression)
  );
}

/** Firebase Firestore trigger factories whose event.data.ref has the declared document path. */
const DOCUMENT_TRIGGER_FACTORIES = new Set([
  'onDocumentCreated',
  'onDocumentUpdated',
  'onDocumentWritten',
  'onDocumentDeleted',
]);

/**
 * Analysis is intentionally bounded. Sixteen permits a small, directly-enumerated
 * selector registry while still requiring every candidate to be statically readable;
 * a larger registry is dynamic to this analyzer and fails closed.
 */
const MAX_CANDIDATES = 16;

/**
 * Recursion ceilings. They exist only to keep analysis finite — every branch is already
 * bounded by the candidate limits above — so they are generous enough for a real carrier
 * chain (a ref built in one array, spread into a second, read back in a later loop) rather
 * than a number that silently turns a long-but-finite chain into an unresolved target.
 */
const RESOLVE_DEPTH = 32;
const CARRIER_DEPTH = 28;
/** A payload is read through the same carriers a target is, so it gets the same budget. */
const PAYLOAD_DEPTH = CARRIER_DEPTH;

/**
 * The carrier property names worth indexing on an ARRAY a helper returns. A write through
 * an array of carriers reaches the document through one of these; indexing every property
 * name a codebase might use would be unbounded work for no extra coverage.
 */
const ARRAY_CARRIER_PROPERTIES = Object.freeze(['ref', 'target', 'docRef', 'data', 'patch']);

/**
 * A pending-write QUEUE legitimately has many construction sites — a cascade builds one
 * entry per touched document across several builders. Each entry is still resolved and
 * checked individually; this bound only keeps the analysis finite, so it is larger than the
 * selector-registry bound, which exists to stop a dynamic lookup being treated as static.
 */
const MAX_QUEUE_ENTRIES = 96;
const MAX_CALLBACK_RETURNS = 8;

/** Stands in for one `${...}` interpolation while a template-literal path is split on '/'. */
const MARKER = String.fromCharCode(0);

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Top-level keys a document schema DECLARES. A union/discriminated union declares a
 * key when ANY member declares it; an intersection declares both sides' keys.
 * `open: true` means the shape cannot be diffed (a record/any/unknown schema).
 *
 * @returns {{ keys: Set<string>, open: boolean } | null}
 */
export function declaredKeys(schema) {
  const s = unwrap(schema);
  const kind = kindOf(s);
  if (kind === 'object') {
    const shape = objectShape(s);
    if (!shape) return null;
    return { keys: new Set(Object.keys(shape)), open: false };
  }
  if (kind === 'union' || kind === 'discriminatedunion' || kind === 'discriminated_union') {
    const raw = s._def.options ?? [];
    const options = raw instanceof Map ? [...raw.values()] : raw;
    const keys = new Set();
    let open = false;
    for (const option of options) {
      const inner = declaredKeys(option);
      if (!inner) {
        open = true;
        continue;
      }
      for (const key of inner.keys) keys.add(key);
      open ||= inner.open;
    }
    return { keys, open };
  }
  if (kind === 'intersection') {
    const left = declaredKeys(s._def.left);
    const right = declaredKeys(s._def.right);
    if (!left || !right) return null;
    return { keys: new Set([...left.keys, ...right.keys]), open: left.open || right.open };
  }
  return null; // record / any / unknown — nothing to diff against.
}

/**
 * The guard may trust a `.parse()` result only when the exact imported export is a
 * top-level-closed core schema with no top-level transform/pipe/unknown/record
 * escape hatch. A parse strips unknown top-level keys, so the output keys come from
 * this schema, not its input. Nested values may be open or factory-produced unions:
 * this guard checks only the document payload's top-level fields, and nested openness
 * cannot create a new top-level key.
 */
export function closedCanonicalKeys(schema, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || !schema._def || seen.has(schema)) return null;
  const branchSeen = new Set(seen);
  branchSeen.add(schema);
  const kind = kindOf(schema);
  if (
    kind === 'effects' ||
    kind === 'pipe' ||
    kind === 'transform' ||
    kind === 'unknown' ||
    kind === 'any' ||
    kind === 'record'
  ) {
    return null;
  }
  if (kind === 'optional' || kind === 'nullable' || kind === 'default' || kind === 'nonoptional' || kind === 'readonly' || kind === 'catch') {
    return closedCanonicalKeys(schema._def.innerType, branchSeen);
  }
  if (kind === 'object') {
    const shape = objectShape(schema);
    const catchall = schema._def.catchall;
    if (
      !shape ||
      schema._def.unknownKeys === 'passthrough' ||
      (catchall && kindOf(catchall) !== 'never')
    ) return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'union' || kind === 'discriminatedunion' || kind === 'discriminated_union') {
    const options = schema._def.options instanceof Map ? [...schema._def.options.values()] : schema._def.options ?? [];
    if (!options.length) return null;
    for (const option of options) if (!closedCanonicalKeys(option, branchSeen)) return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'intersection') {
    if (!closedCanonicalKeys(schema._def.left, branchSeen) || !closedCanonicalKeys(schema._def.right, branchSeen)) return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'array') {
    const element = schema._def.element ?? (typeof schema._def.type === 'object' ? schema._def.type : null);
    return closedCanonicalKeys(element, branchSeen) ? { keys: new Set(), open: false } : null;
  }
  if (kind === 'tuple') {
    const items = schema._def.items ?? [];
    if (!Array.isArray(items) || !items.length || items.some((item) => !closedCanonicalKeys(item, branchSeen))) return null;
    return { keys: new Set(), open: false };
  }
  // Scalars are safe nested members, but only this small explicit set is trusted.
  return new Set([
    'string', 'number', 'boolean', 'bigint', 'date', 'literal', 'enum', 'nativeenum',
    'null', 'undefined', 'void', 'never', 'nan', 'symbol',
  ]).has(kind)
    ? { keys: new Set(), open: false }
    : null;
}

/** One path segment of a resolved target: a literal name, or an unknown id. */
const LIT = (value) => ({ t: 'lit', v: value });
const ANY = { t: 'any' };

/** Segment shape per builder name — populated by buildRegistry, shared by the resolver. */
const builderSegments = new Map();

/** Segment shape per COLLECTION_REFS name — a COLLECTION path, one segment short of a document. */
const collectionRefSegments = new Map();

/**
 * Narrow a union/discriminated-union schema to the members a payload's readable
 * discriminant literals admit, then take those members' declared keys.
 *
 * Without this, "declared if ANY member declares it" lets a payload that plainly
 * identifies itself as one member carry another member's field. With no readable
 * discriminant the any-member rule still applies — a stated limit of this guard.
 *
 * @param {unknown} schema
 * @param {Map<string, Set<string>>} literals key -> the literal string values the payload writes
 * @returns {{ keys: Set<string>, open: boolean } | null} null when no narrowing applies
 */
export function narrowedDeclaredKeys(schema, literals) {
  if (!literals || !literals.size) return null;
  const s = unwrap(schema);
  const kind = kindOf(s);
  if (kind !== 'union' && kind !== 'discriminatedunion' && kind !== 'discriminated_union') return null;
  const raw = s._def.options ?? [];
  const options = raw instanceof Map ? [...raw.values()] : raw;
  if (options.length < 2) return null;

  const literalValue = (field) => {
    const inner = unwrap(field);
    if (kindOf(inner) !== 'literal') return null;
    const value = inner._def.values ?? inner._def.value;
    if (value instanceof Set) return [...value];
    return Array.isArray(value) ? value : [value];
  };

  const kept = options.filter((option) => {
    const shape = objectShape(option);
    if (!shape) return true; // unreadable member — never narrowed away
    for (const [key, values] of literals) {
      if (values.size !== 1) continue;
      const field = shape[key];
      if (!field) continue;
      const declaredValues = literalValue(field);
      if (!declaredValues) continue;
      if (!declaredValues.some((value) => values.has(String(value)))) return false;
    }
    return true;
  });
  if (!kept.length || kept.length === options.length) return null;

  const keys = new Set();
  let open = false;
  for (const option of kept) {
    const inner = declaredKeys(option);
    if (!inner) {
      open = true;
      continue;
    }
    for (const key of inner.keys) keys.add(key);
    open ||= inner.open;
  }
  return { keys, open };
}

/**
 * The segment shape of a canonical builder that VALIDATES a numeric argument before deriving a
 * segment from it (a builder that turns a numeric version into `v{version}` refuses a non-integer),
 * so the string sentinel throws. The builder is evaluated twice with two different whole-number
 * sentinels instead: a slot that differs between the runs is argument-derived (returned as
 * 'ID'), a slot that matches is the builder's own literal. Null when it still cannot run.
 */
export function numericSentinelSegments(fn) {
  const arity = Math.max(fn.length, 6);
  try {
    const first = fn(...Array.from({ length: arity }, () => 1));
    const second = fn(...Array.from({ length: arity }, () => 2));
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return null;
    return first.map((segment, index) => (String(segment) === String(second[index]) ? segment : 'ID'));
  } catch {
    return null;
  }
}

/**
 * Build the resolution registry from the core exports.
 *
 * @param {object} deps
 * @param {Record<string, Function>} deps.PATH_BUILDERS
 * @param {Record<string, unknown>} deps.COLLECTION_SCHEMAS
 * @param {Record<string, Record<string, string>>} deps.constantMaps  e.g. { COLLECTIONS, NESTED_SUBCOLLECTIONS, … }
 */
export function buildRegistry({
  PATH_BUILDERS,
  COLLECTION_SCHEMAS,
  constantMaps,
  canonicalSchemas = {},
  COLLECTION_REFS = {},
  coreExports = null,
}) {
  const templates = Object.keys(COLLECTION_SCHEMAS);
  const templateSegments = new Map(
    templates.map((template) => [template, template.split('/')]),
  );

  /**
   * Match built segments to ONE registry template. A template's literal segment must
   * match a literal segment exactly; a template placeholder accepts anything. The
   * candidate matching the MOST literal segments wins (so a fixed-id template like
   * `_config/singleton` beats a wildcard sibling), and a tie
   * between two different templates is ambiguous — which fails closed.
   */
  function matchSegments(segments, { allowUnknownCollectionName = false } = {}) {
    if (!Array.isArray(segments) || segments.length === 0) return [];
    let best = [];
    let bestScore = -1;
    for (const template of templates) {
      const parts = templateSegments.get(template);
      if (parts.length !== segments.length) continue;
      let score = 0;
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isPlaceholder = part.startsWith('{') && part.endsWith('}');
        if (isPlaceholder) continue;
        if (segments[i].t === 'lit' && segments[i].v === part) {
          score += 1;
          continue;
        }
        if (allowUnknownCollectionName && segments[i].t === 'any') continue;
        ok = false;
        break;
      }
      if (!ok) continue;
      if (score > bestScore) {
        best = [template];
        bestScore = score;
      } else if (score === bestScore) {
        best.push(template);
      }
    }
    // A subcollection whose NAME is chosen at runtime (one subcollection per
    // kind, chosen by a selector) addresses any of several templates. A second, looser pass admits that —
    // but ONLY when the rest of the path anchors it on a known literal, so an entirely
    // unknown path never quietly matches every collection of its length. Every candidate is
    // kept: a written key must be declared by EVERY one of them, never by the convenient one.
    if (!best.length && !allowUnknownCollectionName) {
      const loose = matchSegments(segments, { allowUnknownCollectionName: true });
      const anchored = segments.some((segment) => segment.t === 'lit');
      return anchored ? loose : [];
    }
    return best;
  }

  // PATH_BUILDERS.<name>() -> the registry template it addresses.
  const builderTemplate = new Map();
  const builderPatterns = new Map();
  for (const [name, fn] of Object.entries(PATH_BUILDERS)) {
    if (typeof fn !== 'function') continue;
    let segments;
    try {
      segments = fn(...Array.from({ length: Math.max(fn.length, 6) }, () => 'ID'));
    } catch {
      segments = numericSentinelSegments(fn);
      if (!segments) continue;
    }
    if (!Array.isArray(segments)) continue;
    const built = segments.map((segment) => (segment === 'ID' ? ANY : LIT(String(segment))));
    const matched = matchSegments(built);
    if (matched.length === 1) builderTemplate.set(name, matched[0]);
    // The builder's own segment shape is kept even when it addresses no registered
    // template, so a composed path (`[...PATH_BUILDERS.x(id), NESTED.Y]`) still resolves.
    builderSegments.set(name, built);
    // Preserve which output slots come from which builder arguments. A literal
    // argument such as a subcollection constant is evidence about the target collection;
    // collapsing it to ANY creates a false target/payload cross-product. The
    // pattern comes only from the canonical builder, never an app-local path function.
    try {
      const sentinels = Array.from({ length: Math.max(fn.length, 6) }, (_, index) => `__GUARD_ARG_${index}__`);
      const patterned = fn(...sentinels);
      if (Array.isArray(patterned)) {
        builderPatterns.set(
          name,
          patterned.map((segment) => {
            const index = sentinels.indexOf(segment);
            if (index >= 0) return { t: 'arg', index };
            return typeof segment === 'string' && segment ? LIT(segment) : ANY;
          }),
        );
      }
    } catch {
      // Keep the all-unknown fallback in builderSegments. A builder whose shape
      // cannot be evaluated is never granted literal specialization.
    }
  }

  // COLLECTION_REFS.<name>(...) -> the COLLECTION path segments it addresses. Derived from
  // the installed core exactly as PATH_BUILDERS is, so `COLLECTION_REFS.x(id).doc()` is a
  // canonical auto-id mint and a `.doc(id)` on it a canonical document; neither is hand-built.
  const collectionRefPatterns = new Map();
  for (const [name, fn] of Object.entries(COLLECTION_REFS ?? {})) {
    if (typeof fn !== 'function') continue;
    try {
      const segments = fn(...Array.from({ length: Math.max(fn.length, 6) }, () => 'ID'));
      if (!Array.isArray(segments)) continue;
      collectionRefSegments.set(
        name,
        segments.map((segment) =>
          segment === 'ID' || typeof segment !== 'string' || !segment ? ANY : LIT(segment),
        ),
      );
    } catch {
      continue;
    }
    try {
      const sentinels = Array.from({ length: Math.max(fn.length, 6) }, (_, index) => `__GUARD_ARG_${index}__`);
      const patterned = fn(...sentinels);
      if (Array.isArray(patterned)) {
        collectionRefPatterns.set(
          name,
          patterned.map((segment) => {
            const index = sentinels.indexOf(segment);
            if (index >= 0) return { t: 'arg', index };
            return typeof segment === 'string' && segment ? LIT(segment) : ANY;
          }),
        );
      }
    } catch {
      // Keep the conservative all-unknown fallback.
    }
  }

  // "COLLECTIONS.USER_PROFILES" -> "userProfiles", for every exported constant map.
  const constantValue = new Map();
  for (const [mapName, map] of Object.entries(constantMaps ?? {})) {
    if (!map || typeof map !== 'object') continue;
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === 'string') constantValue.set(`${mapName}.${key}`, value);
    }
  }

  const declaredCache = new Map();
  function declaredFor(template) {
    if (!declaredCache.has(template)) {
      declaredCache.set(template, declaredKeys(COLLECTION_SCHEMAS[template]) ?? null);
    }
    return declaredCache.get(template);
  }

  // Identity matters: only a direct imported core export is canonical. A local alias
  // could be reassigned or wrap a transform, so it intentionally remains unreadable.
  const canonicalParseKeys = new Map();
  const canonicalParseSchema = new Map();
  // The reverse lookup, for a schema reached as a VALUE inside a core const map rather than
  // through its import binding: it is canonical only when it is the very object a core export
  // names, so a map entry's schema pairs with its template exactly as an imported one does.
  const canonicalParseName = new Map();
  for (const [name, schema] of Object.entries(canonicalSchemas)) {
    const keys = closedCanonicalKeys(schema);
    if (keys && keys.keys.size) {
      canonicalParseKeys.set(name, keys);
      canonicalParseSchema.set(name, schema);
      if (!canonicalParseName.has(schema)) canonicalParseName.set(schema, name);
    }
  }

  /**
   * EVERY template whose last collection is this group name — a collection-group document.
   *
   * A fixed-id nested singleton (`…/privateDetails/requester`) is a document of that group
   * exactly as a wildcard-id sibling is, so both are candidates and a written key must be
   * declared by all of them. Keeping only the wildcard shape made a collection-group write
   * over a singleton group resolve to nothing at all.
   */
  function templatesForGroup(segment) {
    if (!segment || segment.t !== 'lit') return [];
    return templates.filter((template) => {
      const parts = templateSegments.get(template);
      return parts.length >= 2 && parts[parts.length - 2] === segment.v;
    });
  }

  /**
   * A closed const map EXPORTED by the installed core, resolved at analysis time.
   * This is how a computed key drawn from a canonical field map (`MAP[kind]`,
   * `MAP[kind].field`) is read: the written key set is the union of the map's values, and
   * every one of them must be declared by every candidate target.
   */
  const exportedValues = coreExports ?? canonicalSchemas;
  function coreConstMap(name) {
    const value = exportedValues?.[name];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value._def) return null; // a Zod schema is not a const map
    return value;
  }

  return {
    templates,
    matchSegments,
    templatesForGroup,
    builderTemplate,
    builderSegments,
    builderPatterns,
    collectionRefSegments,
    collectionRefPatterns,
    constantValue,
    declaredFor,
    schemaFor: (template) => COLLECTION_SCHEMAS[template],
    coreConstMap,
    canonicalParseKeys,
    canonicalParseSchema,
    canonicalParseName,
  };
}

// ---------------------------------------------------------------------------
// Package type declarations
// ---------------------------------------------------------------------------

/**
 * A package's shipped `.d.ts` files, parsed once per reader. `packageDeclarations` is the caller's
 * reader — `(packageName) => [{ file, text }]` — so this module never touches the file system.
 */
const declarationCache = new WeakMap();
function packageDeclarationFiles(packageName, packageDeclarations) {
  if (typeof packageDeclarations !== 'function') return [];
  let cache = declarationCache.get(packageDeclarations);
  if (!cache) declarationCache.set(packageDeclarations, (cache = new Map()));
  if (cache.has(packageName)) return cache.get(packageName);
  const files = (packageDeclarations(packageName) ?? []).map(({ file, text }) => ({
    file,
    source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
  }));
  cache.set(packageName, files);
  return files;
}

/** An argument's source text with its whitespace collapsed, for exact `args` binding. */
export function normalizedArgText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/**
 * Whether a package-builder entry's optional `args` binding admits a call. An entry with
 * `args` covers ONLY a call whose argument list is exactly those source texts — the
 * binding for an OVERLOADED builder, whose keys the guard reads from the first declared
 * signature and which is therefore true only for the call that selects that signature.
 * An entry without `args` covers every call of the callee (a single-signature builder).
 */
export function packageBuilderArgsMatch(entryArgs, callArgs) {
  if (entryArgs === undefined) return true;
  if (!Array.isArray(entryArgs) || !Array.isArray(callArgs)) return false;
  return (
    entryArgs.length === callArgs.length &&
    entryArgs.every((arg, i) => normalizedArgText(arg) === normalizedArgText(callArgs[i]))
  );
}

/** The package a specifier names (`@scope/pkg/sub` -> `@scope/pkg`), or null for a local path. */
export function packageNameOf(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('@/')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * The KEYS a package function DECLARES it returns, read from the package's own shipped
 * `.d.ts`.
 *
 * A package-builder assertion that simply granted the bound schema's whole key set was a
 * far larger licence than the builder needs: report-core's `BuiltUserReportAdminTask.doc`
 * is a hand-written 13-key object type, not `z.infer` of the 29-key registry schema.
 * Reading the declaration means a key the PACKAGE adds, which the registry does not
 * declare, fails the guard instead of riding in on the assertion.
 *
 * Returns `{ keys }` for a declared object shape, or `{ inferOf }` when the declaration
 * says the return type IS `z.infer<typeof Schema>` — in which case the assertion is exactly
 * what the package states and the schema's own keys apply.
 */
export function packageBuilderReturnKeys({ packageName, callee, property, packageDeclarations }) {
  const files = packageDeclarationFiles(packageName, packageDeclarations);
  if (!files.length) return null;

  const findTypeDeclaration = (name) => {
    for (const candidate of files) {
      let found = null;
      const visit = (node) => {
        if (found) return;
        if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name?.text === name) {
          found = node;
        }
        ts.forEachChild(node, visit);
      };
      visit(candidate.source);
      if (found) return { declaration: found, source: candidate.source };
    }
    return null;
  };

  const memberNames = (members) => {
    const keys = new Set();
    for (const member of members ?? []) {
      if (!ts.isPropertySignature(member) || !member.name) return null;
      if (!ts.isIdentifier(member.name) && !ts.isStringLiteralLike(member.name)) return null;
      keys.add(member.name.text);
    }
    return keys.size ? keys : null;
  };

  // In a type position `null` is a LiteralTypeNode wrapping NullKeyword, not a bare
  // NullKeyword — reading only the bare form made every `X | null` return type unreadable.
  const isNullishType = (type) =>
    type.kind === ts.SyntaxKind.NullKeyword ||
    type.kind === ts.SyntaxKind.UndefinedKeyword ||
    type.kind === ts.SyntaxKind.VoidKeyword ||
    (ts.isLiteralTypeNode(type) && type.literal.kind === ts.SyntaxKind.NullKeyword);

  const unwrapNullable = (typeNode) => {
    if (!typeNode || !ts.isUnionTypeNode(typeNode)) return typeNode;
    const live = typeNode.types.filter((type) => !isNullishType(type));
    return live.length === 1 ? live[0] : null;
  };

  const readShape = (typeNode, depth) => {
    const node = unwrapNullable(typeNode);
    if (!node || depth > 6) return null;
    if (ts.isTypeLiteralNode(node)) {
      const keys = memberNames(node.members);
      return keys ? { keys, via: 'a declared object type' } : null;
    }
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)) return null;
    const name = node.typeName.text;
    const found = findTypeDeclaration(name);
    if (!found) return null;
    if (ts.isInterfaceDeclaration(found.declaration)) {
      const keys = memberNames(found.declaration.members);
      return keys ? { keys, via: 'interface ' + name } : null;
    }
    const aliasText = found.declaration.type?.getText(found.source) ?? '';
    const infer = /z\.infer<\s*typeof\s+([A-Za-z_$][\w$]*)\s*>/.exec(aliasText);
    if (infer) return { inferOf: infer[1], via: 'type ' + name + ' = z.infer<typeof ' + infer[1] + '>' };
    return readShape(found.declaration.type, depth + 1);
  };

  for (const candidate of files) {
    let declaration = null;
    const visit = (node) => {
      if (declaration) return;
      if (ts.isFunctionDeclaration(node) && node.name?.text === callee) declaration = node;
      ts.forEachChild(node, visit);
    };
    visit(candidate.source);
    if (!declaration?.type) continue;

    let target = declaration.type;
    if (property) {
      const container = unwrapNullable(target);
      let members = null;
      if (container && ts.isTypeLiteralNode(container)) members = container.members;
      else if (container && ts.isTypeReferenceNode(container) && ts.isIdentifier(container.typeName)) {
        const found = findTypeDeclaration(container.typeName.text);
        if (found) {
          members = ts.isInterfaceDeclaration(found.declaration)
            ? found.declaration.members
            : found.declaration.type?.members;
        }
      }
      const member = (members ?? []).find(
        (entry) => ts.isPropertySignature(entry) && entry.name && entry.name.text === property,
      );
      if (!member?.type) continue;
      target = member.type;
    }
    // A package may declare the same function in several bundles; keep looking until one
    // of them yields a readable shape rather than giving up on the first.
    const shape = readShape(target, 0);
    if (shape) return shape;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-file syntax facts
// ---------------------------------------------------------------------------

function stripWrappers(node) {
  let current = node;
  for (let i = 0; i < 12 && current; i++) {
    if (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
    } else if (ts.isSatisfiesExpression?.(current)) {
      current = current.expression;
    } else if (ts.isAwaitExpression(current)) {
      current = current.expression;
    } else {
      break;
    }
  }
  return current;
}

/**
 * The written ENTRY at `index` of a directly readable tuple — `[a, b]` or
 * `await Promise.all([a, b])` — or null when no entry is statically that index.
 */
function tupleEntry(initializer, index) {
  let tuple = stripWrappers(initializer);
  if (
    ts.isCallExpression(tuple) &&
    ts.isPropertyAccessExpression(tuple.expression) &&
    tuple.expression.name.text === 'all' &&
    tuple.arguments.length === 1
  ) {
    tuple = stripWrappers(tuple.arguments[0]);
  }
  if (!ts.isArrayLiteralExpression(tuple)) return null;
  const entries = tuple.elements.slice(0, index + 1);
  if (entries.length <= index || entries.some((entry) => ts.isSpreadElement(entry))) return null;
  return entries[index];
}

/** The enclosing block/function scope of a node — used so a variable named `ref` in one
 *  function is never matched to an unrelated `ref` declared in another. */
function scopeOf(node) {
  let current = node.parent;
  while (
    current &&
    !(
      ts.isBlock(current) ||
      ts.isSourceFile(current) ||
      ts.isModuleBlock(current) ||
      ts.isCaseClause(current) ||
      ts.isDefaultClause(current) ||
      ts.isFunctionLike(current)
    )
  ) {
    current = current.parent;
  }
  return current ?? null;
}

/** The enclosing function (or the file) — the scope a `let` assignment is visible in. */
function functionScopeOf(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return current;
  }
  return null;
}

function encloses(scope, node) {
  for (let current = node; current; current = current.parent) if (current === scope) return true;
  return false;
}

/** Every expression a function-like node can RETURN, bounded and direct. */
function callbackReturns(node) {
  const returns = [];
  if (!node) return returns;
  if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) return [node.body];
  if (!node.body) return returns;
  const collect = (inner) => {
    if (inner !== node.body && ts.isFunctionLike(inner)) return;
    if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
    ts.forEachChild(inner, collect);
  };
  ts.forEachChild(node.body, collect);
  return returns.length <= MAX_CALLBACK_RETURNS ? returns : [];
}

/** Name of a function-like declaration, or null for an anonymous one. */
function functionName(node) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name && ts.isIdentifier(node.name) ? node.name.text : null;
  }
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const parent = node.parent;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  }
  return null;
}

/**
 * The named function or method a node sits in — the STRUCTURAL identity a reviewed
 * exception binds to. Anonymous callbacks (a `runTransaction` body, an array callback) are
 * transparent: the write belongs to the named function that owns them. A line number would
 * go stale on the next unrelated edit above it; a name goes stale when the code really moves.
 */
function enclosingWriteFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isFunctionLike(current)) continue;
    const name = functionName(current);
    if (!name) continue;
    if (ts.isMethodDeclaration(current)) {
      const owner = current.parent;
      const ownerName =
        (ts.isClassDeclaration(owner) || ts.isClassExpression(owner)) && owner.name ? owner.name.text : null;
      return ownerName ? `${ownerName}.${name}` : name;
    }
    return name;
  }
  // No named function anywhere above: the write sits in a callback handed to a factory, and
  // the declaration that factory's result is bound to is what the codebase calls it.
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isFunctionLike(current)) continue;
    const owned = declaredOwnerName(current);
    if (owned) return owned;
  }
  return '(module)';
}

/**
 * The named declaration an unnamed function belongs to — `export const runX = onCall(…, async
 * (request) => …)` is `runX`. Only NON-function nodes are crossed, so a callback nested inside
 * another function keeps belonging to that function, not to the outer declaration.
 */
function declaredOwnerName(fn) {
  for (let current = fn.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current)) return null;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) return current.name.text;
  }
  return null;
}

/** Parse one file into the facts the resolver needs. */
export function parseFile(relPath, text, { library = false } = {}) {
  const source = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
  const facts = {
    relPath,
    source,
    text,
    /** name -> [{ pos, initializer | iterOf, scope }] */
    varDecls: new Map(),
    /** module-scope `const X = …`, for cross-file resolution of an imported constant */
    moduleConsts: new Map(),
    /** name -> literal string value (module/function const) */
    stringConsts: new Map(),
    /** name -> [{ pos, key }] for `x.key = …` built up after declaration */
    propAssigns: new Map(),
    /** name -> [{ pos, argument }] for `queue.push(…)` — a queue built up after declaration */
    pushCalls: new Map(),
    /** name -> [{ pos, value, scope }] for `map.set(key, value)` — a Map filled after declaration */
    mapSetCalls: new Map(),
    /** class field name -> initializer, so `this.held` resolves to what it was built as */
    classFields: new Map(),
    /** interface/type-literal name -> member name -> its declared type name */
    typeMembers: new Map(),
    /** method name -> parameter name -> declared type, from interface METHOD signatures */
    typeMethodParams: new Map(),
    /** method names declared more than once with differing shapes — never trusted */
    ambiguousTypeMethods: new Set(),
    /** local name -> { module, imported } */
    imports: new Map(),
    /** re-exported name -> the module it is re-exported FROM */
    reExports: new Map(),
    /** modules re-exported whole — `export * from './x.js'` */
    starExports: [],
    /** read for what it declares, never swept for writes — the core's source */
    library,
    /** function name -> { node, params: [{ name, typeText }], returns: [expr] } */
    functions: new Map(),
    /** Event callback parameter -> canonical document expression for Firestore triggers. */
    triggerEvents: [],
    /** every call expression, for the call-site graph */
    calls: [],
    writes: [],
  };

  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  /**
   * Each name an object pattern binds, as that property of its source: `bindingOf` a value,
   * or `elementOf` an array whose every element carries the property.
   */
  const indexObjectBinding = (pattern, source, pos, scope) => {
    for (const element of pattern.elements) {
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
      const propertyName = element.propertyName
        ? (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName)
          ? element.propertyName.text
          : null)
        : element.name.text;
      if (!propertyName) continue;
      push(facts.varDecls, element.name.text, source.bindingOf
        ? { pos, bindingOf: source.bindingOf, bindingProperty: propertyName, scope }
        : { pos, elementOf: source.elementOf, elementProperty: propertyName, scope });
    }
  };

  const indexFunction = (node) => {
    const name = functionName(node);
    if (!name) return;
    const params = node.parameters.map((parameter) => ({
      name: ts.isIdentifier(parameter.name) ? parameter.name.text : null,
      typeText: parameter.type ? parameter.type.getText(source) : '',
    }));
    const returns = [];
    const collectReturns = (inner) => {
      if (inner !== node && ts.isFunctionLike(inner)) return; // a nested function's returns are its own
      if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
      ts.forEachChild(inner, collectReturns);
    };
    if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) returns.push(node.body);
    else if (node.body) ts.forEachChild(node.body, collectReturns);
    facts.functions.set(name, { node, params, returns });
  };

  const index = (node) => {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          facts.imports.set(element.name.text, {
            module: specifier,
            imported: element.propertyName ? element.propertyName.text : element.name.text,
          });
        }
      }
      // DEFAULT and NAMESPACE imports are bindings too. Missing them meant `import Stripe
      // from 'stripe'` looked like an unknown local name, so nothing it produced could be
      // recognised as coming from another package.
      if (node.importClause.name) {
        facts.imports.set(node.importClause.name.text, { module: specifier, imported: 'default' });
      }
      if (bindings && ts.isNamespaceImport(bindings)) {
        facts.imports.set(bindings.name.text, { module: specifier, imported: '*' });
      }
    }
    // `export { x } from '<pkg>'` — a local file that only forwards a package export.
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        facts.reExports.set(element.name.text, node.moduleSpecifier.text);
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      !node.exportClause &&
      !node.isTypeOnly
    ) {
      facts.starExports.push(node.moduleSpecifier.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.initializer) {
        push(facts.varDecls, node.name.text, {
          pos: node.pos,
          initializer: node.initializer,
          scope: scopeOf(node),
        });
        const initializer = stripWrappers(node.initializer);
        if (ts.isStringLiteralLike(initializer)) facts.stringConsts.set(node.name.text, initializer.text);
        const parentList = node.parent;
        const statement = parentList?.parent;
        if (
          parentList &&
          ts.isVariableDeclarationList(parentList) &&
          statement &&
          ts.isVariableStatement(statement) &&
          ts.isSourceFile(statement.parent)
        ) {
          facts.moduleConsts.set(node.name.text, node.initializer);
        }
      } else {
        // `for (const doc of snap.docs)` — the binding IS the loop's element.
        const list = node.parent;
        const loop = list?.parent;
        if (loop && ts.isForOfStatement(loop)) {
          push(facts.varDecls, node.name.text, {
            pos: node.pos,
            iterOf: loop.expression,
            scope: scopeOf(loop.statement) ?? scopeOf(loop),
          });
        }
      }
    }
    // `const [a, b, c] = await Promise.all([x, y, z])` — each binding is that INDEX of the
    // initializer, so a ref resolved in parallel with its reads stays resolvable.
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer) {
      node.name.elements.forEach((element, index) => {
        if (!ts.isBindingElement(element)) return;
        if (ts.isIdentifier(element.name)) {
          push(facts.varDecls, element.name.text, {
            pos: node.pos,
            indexOf: node.initializer,
            bindingIndex: index,
            scope: scopeOf(node),
          });
          return;
        }
        // `const [{ ref, signup }] = await Promise.all([readSignup(tx, id), …])` — the nested
        // pattern destructures that index's ENTRY, which is a node in the source.
        const entry = tupleEntry(node.initializer, index);
        if (entry && ts.isObjectBindingPattern(element.name)) {
          indexObjectBinding(element.name, { bindingOf: entry }, node.pos, scopeOf(node));
        }
      });
    }
    // `for (const [index, candidate] of candidates.entries())` — the second name is a VALUE of
    // the collection whose entries the loop walks.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      !node.initializer &&
      node.parent?.parent &&
      ts.isForOfStatement(node.parent.parent)
    ) {
      const loop = node.parent.parent;
      const collection = entriesSource(loop.expression);
      const value = node.name.elements[1];
      if (collection && value && ts.isBindingElement(value) && ts.isIdentifier(value.name)) {
        push(facts.varDecls, value.name.text, {
          pos: node.pos,
          entryOf: collection,
          scope: scopeOf(loop.statement) ?? scopeOf(loop),
        });
      }
    }
    // `for (const { ref, game } of edits)` — each bound name is that PROPERTY of the loop's
    // element.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      !node.initializer &&
      node.parent?.parent &&
      ts.isForOfStatement(node.parent.parent)
    ) {
      const loop = node.parent.parent;
      indexObjectBinding(node.name, { elementOf: loop.expression }, node.pos, scopeOf(loop.statement) ?? scopeOf(loop));
    }
    // `const { refs } = args` keeps the carrier relationship; index the bound
    // name as a finite property of its initializer instead of treating the
    // destructured variable as a fresh, opaque value.
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      indexObjectBinding(node.name, { bindingOf: node.initializer }, node.pos, scopeOf(node));
    }
    // `pending.push({ op, ref, data })` — a generic pending-write sink is built one entry at
    // a time. Each entry is recorded at its CONSTRUCTION site, which is where the ref and its
    // payload are still correlated; the replay loop only reads them back.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'push' &&
      ts.isIdentifier(node.expression.expression) &&
      node.arguments.length >= 1
    ) {
      for (const argument of node.arguments) {
        // Scoped to the enclosing function: three cascade builders in one file each own a
        // local `writes`, and merging their queues would check one cascade's entries
        // against another's replay.
        push(facts.pushCalls, node.expression.expression.text, {
          pos: node.pos,
          argument,
          call: node,
        });
      }
    }
    // `profiles.set(userId, { ref, profile })` — a Map filled entry by entry. Recorded for every
    // identifier receiver; a read trusts it only when the receiver is declared `new Map(…)`, so a
    // Firestore reference's own `.set` is never mistaken for an entry.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      ts.isIdentifier(node.expression.expression) &&
      node.arguments.length === 2
    ) {
      push(facts.mapSetCalls, node.expression.expression.text, {
        pos: node.pos,
        call: node,
        value: node.arguments[1],
      });
    }
    // `snap.docs.map((doc) => …)` — the callback parameter IS the loop's element.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ARRAY_ITERATORS.has(node.expression.name.text) &&
      node.arguments.length >= 1
    ) {
      const callback = node.arguments[0];
      if ((ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && callback.parameters.length) {
        const first = callback.parameters[0];
        if (ts.isIdentifier(first.name)) {
          push(facts.varDecls, first.name.text, {
            pos: callback.pos,
            iterOf: node.expression.expression,
            scope: callback,
          });
        } else if (ts.isArrayBindingPattern(first.name) && node.expression.name.text !== 'reduce') {
          // `[...byKey.entries()].map(([key, reservation]) => …)` — the second name is a value.
          const collection = entriesSource(node.expression.expression);
          const value = first.name.elements[1];
          if (collection && value && ts.isBindingElement(value) && ts.isIdentifier(value.name)) {
            push(facts.varDecls, value.name.text, { pos: callback.pos, entryOf: collection, scope: callback });
          }
        } else if (ts.isObjectBindingPattern(first.name) && node.expression.name.text !== 'reduce') {
          // `games.flatMap(({ id, ref }) => …)` — each bound name is that property of the
          // element. A `reduce` callback's first parameter is its accumulator, not an element.
          indexObjectBinding(first.name, { elementOf: node.expression.expression }, callback.pos, callback);
        }
      }
    }
    // `onDocumentCreated({ document: 'pendingMedia/{docId}' }, async (event) => …)`.
    // The event's `.data.ref` is a canonical reference to THAT declared path; record
    // only the concrete Firestore trigger shape, never an arbitrary callback's `.ref`.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && DOCUMENT_TRIGGER_FACTORIES.has(node.expression.text)) {
      const config = node.arguments[0];
      const callback = node.arguments[1];
      if (
        config &&
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        callback.parameters.length &&
        ts.isIdentifier(callback.parameters[0].name)
      ) {
        let documentExpression = null;
        if (ts.isObjectLiteralExpression(stripWrappers(config))) {
          const documentProperty = stripWrappers(config).properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
              property.name.text === 'document',
          );
          if (documentProperty && ts.isPropertyAssignment(documentProperty)) documentExpression = documentProperty.initializer;
        } else if (ts.isStringLiteralLike(stripWrappers(config)) || ts.isTemplateExpression(stripWrappers(config))) {
          documentExpression = config;
        }
        if (documentExpression) {
          facts.triggerEvents.push({
            name: callback.parameters[0].name.text,
            scope: callback,
            documentExpression,
          });
        }
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isPropertyAccessExpression(node.left) && ts.isIdentifier(node.left.expression)) {
        push(facts.propAssigns, node.left.expression.text, { pos: node.pos, key: node.left.name.text });
      }
      // `let ref; … ref = db.doc(…)` — the assignment IS where the value comes from.
      if (ts.isIdentifier(node.left)) {
        // Scoped to the enclosing FUNCTION, not the enclosing block: a `let` declared at the
        // top of a core and assigned inside an `if` is read after that block closes.
        push(facts.varDecls, node.left.text, {
          pos: node.pos,
          initializer: node.right,
          scope: functionScopeOf(node),
          assigned: true,
        });
      }
    }
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      indexFunction(node);
    }
    // `interface Args { stripe: Stripe }` — a destructured parameter carries its type
    // here, not on the binding, so this is where a binding's declared type is readable.
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
      const members = new Map();
      const collectMembers = (type) => {
        if (!type || !type.members) return;
        for (const member of type.members) {
          if (!ts.isPropertySignature(member) || !member.name || !member.type) continue;
          if (!ts.isIdentifier(member.name) && !ts.isStringLiteralLike(member.name)) continue;
          members.set(member.name.text, member.type.getText(source));
        }
        for (const member of type.members) {
          // A method SIGNATURE carries the parameter types an object-literal implementation
          // leaves unannotated (`register(id, el: HTMLElement | null)`).
          if (!ts.isMethodSignature(member) || !member.name || !ts.isIdentifier(member.name)) continue;
          const byParam = new Map();
          for (const parameter of member.parameters) {
            if (ts.isIdentifier(parameter.name) && parameter.type) {
              byParam.set(parameter.name.text, parameter.type.getText(source));
            }
          }
          if (!byParam.size) continue;
          if (facts.typeMethodParams.has(member.name.text)) facts.ambiguousTypeMethods.add(member.name.text);
          else facts.typeMethodParams.set(member.name.text, byParam);
        }
      };
      collectMembers(ts.isInterfaceDeclaration(node) ? node : node.type);
      if (members.size) facts.typeMembers.set(node.name.text, members);
    }
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    ) {
      facts.classFields.set(node.name.text, node.initializer);
    }
    if (ts.isCallExpression(node)) facts.calls.push(node);
    ts.forEachChild(node, index);
  };
  index(source);

  return facts;
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

/**
 * Resolve every Firestore write across the given parsed files.
 *
 * Helper-passed `DocumentReference` parameters are the bulk of what a single-file
 * sweep cannot see, so resolution is a CROSS-FILE fixed point:
 *
 *   1. A function whose every `return` resolves to the same template exports that
 *      template as its return target (`jobRef(id)` → `notificationFanoutJobs/{jobId}`).
 *   2. A parameter's target is the union of what its CALL SITES pass — resolved with
 *      the same resolver, so a caller that itself received the ref keeps propagating.
 *   3. Repeat until nothing new resolves. A parameter reached by call sites addressing
 *      DIFFERENT documents keeps all of them, and a written key must be declared by
 *      EVERY candidate — the union of possibilities, never the convenient one.
 *
 * The same propagation carries COLLECTION-shaped parameters (so a generic sweep helper's
 * `doc.ref` is that collection plus any id), callback parameters whose result the helper
 * writes, and pending-write queues whose `{ ref, data }` pairs are resolved where they were
 * constructed rather than where they are replayed.
 *
 * There is no in-code exception channel: a write is checked, or it is a violation, or it
 * carries a reviewed entry in the exceptions file. Nothing in a comment can exempt it.
 */
export function analyzeFiles({
  files: writerFiles,
  libraryFiles = [],
  registry,
  profile,
  maxRounds = 6,
  exceptions = [],
  packageDeclarations = null,
}) {
  if (!profile?.corePackage) throw new Error('firestore-guards: analyzeFiles needs a guard profile (createGuardProfile)');
  const CORE_PACKAGE = profile.corePackage;
  const CORE_LIBRARY_ROOT = profile.coreLibraryRoot;
  // Library files — the core package's code — are read for what they declare and return, so a
  // core helper is as readable as a local one; only the writer files are swept for writes.
  const files = [...writerFiles, ...libraryFiles];
  const packageBuilderEntries = exceptions.filter((entry) => entry.kind === VIOLATION_KINDS.PACKAGE_BUILDER);
  const packageBuilderUses = [];
  const byPath = new Map(files.map((facts) => [facts.relPath, facts]));

  /** fnKey -> Set<template>; every returned branch remains a candidate. */
  let returnTargets = new Map();
  /** paramKey -> Set<template> */
  let paramTargets = new Map();
  /** paramKey -> { keys, opaque } for a PAYLOAD passed into a helper that writes it */
  const paramPayloads = new Map();
  /** `${paramKey}.${property}` -> static values passed in direct carrier objects. */
  const paramCarrierProperties = new Map();
  /** paramKey -> Set<serialized collection segments> for a COLLECTION passed into a helper. */
  const paramCollections = new Map();
  /** paramKey -> { keys, opaque } for a CALLBACK whose result the helper writes. */
  const paramCallbackPayloads = new Map();
  /** paramKey -> AST expressions pushed into / held by an ARRAY passed into a helper. */
  const paramArrayEntries = new Map();
  /** paramKey -> the reason EVERY call site fills this parameter with a non-Firestore value. */
  const paramNotFirestore = new Map();
  /**
   * paramKey -> the AST values every call site passes. The generic form of every other
   * parameter propagation here: a lane table's `build` function, a status field NAME, a
   * collection constant. Bounded, and a parameter no call site fills stays unreadable.
   */
  const paramValues = new Map();
  /** fnKey -> Set<serialized COLLECTION segments> a function returns. */
  let returnCollections = new Map();
  /** fnKey -> Set<collection-group name> a function returns. */
  let returnGroups = new Map();
  /** paramKey -> Set<collection-group name> passed into a helper. */
  const paramGroups = new Map();
  /** fnKey -> the reason every one of a function's returns is a non-Firestore value. */
  let returnNonFirestore = new Map();
  /**
   * fnKey -> the parameter index a function simply RUNS and hands back
   * (`getCollectionGroupOrCapture(query) { return await query.get(); }`). A pass-through is
   * resolved at ITS CALL SITE, not through the union of every caller's query — otherwise one
   * shared "run this query and capture failures" helper makes every caller's documents
   * candidates for every other caller's write.
   */
  let returnPassThrough = new Map();
  /** fnKey -> static properties returned from a finite direct carrier object. */
  let returnCarrierProperties = new Map();
  /** fnKey -> per-property values of every element of an ARRAY of carriers it returns. */
  let returnArrayProperties = new Map();

  const fnKey = (relPath, name) => `${relPath}#${name}`;
  const paramKey = (relPath, name, index) => `${relPath}#${name}@${index}`;

  /** Resolve an import specifier to a file in the scanned set. */
  function resolveImport(fromPath, specifier) {
    let base;
    if (specifier.startsWith('.')) {
      base = joinPosix(dirnamePosix(fromPath), specifier);
    } else if (CORE_LIBRARY_ROOT && (specifier === CORE_PACKAGE || specifier.startsWith(`${CORE_PACKAGE}/`))) {
      // Each export entry of the core package is a folder (or file) of the same name under its
      // library root, the entry point itself being `index`.
      base = joinPosix(CORE_LIBRARY_ROOT, specifier.slice(CORE_PACKAGE.length + 1) || 'index');
    } else {
      const alias = Object.keys(profile.importAliases).find((prefix) => specifier.startsWith(prefix));
      if (!alias) return null;
      base = joinPosix(profile.importAliases[alias], specifier.slice(alias.length));
    }
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mts`,
      `${base}.mjs`,
      `${base}.js`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
      `${base}/index.js`,
      `${base}/index.mjs`,
    ];
    // `./x.js` in ESM-emitting TypeScript means `./x.ts`.
    if (/\.js$/.test(base)) candidates.push(base.replace(/\.js$/, '.ts'));
    for (const candidate of candidates) if (byPath.has(candidate)) return candidate;
    return null;
  }

  /**
   * The field name a computed key writes, or null when it cannot be read.
   *
   * A DOTTED field path in an `update()` — `` [`totals.${kind}`] `` — addresses the
   * TOP-LEVEL field named before the first dot (BACKEND-104), which is a literal even when
   * the rest of the path is not; that top-level name is what the schema declares.
   */
  function computedKeyName(inner, facts, source) {
    const names = computedKeyNames(inner, facts, source);
    return names?.length === 1 ? names[0] : null;
  }

  /**
   * The `MAP[selector]` lookup a `const` names, through `const` hops alone, or the node itself.
   * A rebound or non-`const` binding is not one value, so it is returned unfollowed.
   */
  function constLookup(node, facts) {
    let current = node;
    for (let hop = 0; hop < 8 && ts.isIdentifier(current); hop++) {
      const decls = resolverFor(facts).visibleDecls(current.text, current.pos, current);
      const declaration = decls.length === 1 ? decls[0].initializer?.parent : null;
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        !ts.isVariableDeclarationList(declaration.parent) ||
        (declaration.parent.flags & ts.NodeFlags.Const) === 0
      ) {
        return current;
      }
      current = stripParens(stripWrappers(declaration.initializer));
    }
    return current;
  }

  /**
   * EVERY field name a computed key can write, or null when it cannot be read.
   *
   * A writer may address its field through a CLOSED const map owned by
   * core — `[FIELD_BY_KIND[job.kind]]: value`, or one property hop
   * further, `[MAP[kind].field]: value`. The map is resolved from the INSTALLED core at
   * analysis time, so the written key set is the union of its values and every one of them
   * must be declared by every candidate target. That is a real check, not a waiver: bending
   * the writer into a hand-unrolled field chain to satisfy the analyzer is the defect this
   * capability exists to prevent (ARCH-102).
   */
  function computedKeyNames(inner, facts, source, isUpdate = false) {
    if (ts.isStringLiteralLike(inner)) return [inner.text];
    if (ts.isIdentifier(inner)) {
      if (facts.stringConsts.has(inner.text)) return [facts.stringConsts.get(inner.text)];
      // `const field = \`totals.\${kind}\`` — the key is its one constant initializer.
      const declarations = resolverFor(facts).visibleDecls(inner.text, inner.pos, inner);
      const initializer = declarations.length === 1 ? declarations[0].initializer : null;
      const declaration = initializer?.parent;
      if (
        initializer &&
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const fromInitializer = computedKeyNames(stripParens(initializer), facts, source, isUpdate);
        if (fromInitializer) return fromInitializer;
      }
      const external = importedValue(facts, inner.text);
      if (external) {
        const node = stripParens(external.node);
        if (ts.isStringLiteralLike(node)) return [node.text];
      }
      // A shared patch builder addresses its field through a NAME its callers supply
      // (`genericResetPatch(activeValue, statusField, now)` → `{ [statusField]: … }`).
      // Every name a call site can pass is a written key, and every one must be declared.
      return resolverFor(facts).literalStringCandidates(inner);
    }
    if (ts.isPropertyAccessExpression(inner)) {
      const key = `${inner.expression.getText(source)}.${inner.name.text}`;
      const constant = registry.constantValue.get(key);
      if (constant) return [constant];
      // `MAP[selector].field` — one property hop off a canonical map's entry, whether the
      // lookup is written in place or named once in a `const` (`const slot = MAP[kind]`).
      const base = constLookup(stripParens(inner.expression), facts);
      if (ts.isElementAccessExpression(base)) {
        const entries = coreMapEntries(base, facts, source);
        if (!entries) return null;
        const names = new Set();
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
          const value = entry[inner.name.text];
          if (typeof value !== 'string') return null;
          names.add(value);
        }
        return names.size && names.size <= MAX_CANDIDATES ? [...names] : null;
      }
      // `[lane.statusField]: …` — every literal the carrier's property can hold, through a
      // parameter's call sites and a local table's entries; unreadable stays null.
      return resolverFor(facts).literalStringCandidates(inner);
    }
    if (ts.isElementAccessExpression(inner)) {
      const entries = coreMapEntries(inner, facts, source);
      if (!entries) return null;
      const names = new Set();
      for (const entry of entries) {
        if (typeof entry === 'string') names.add(entry);
        else if (Array.isArray(entry) && entry.every((value) => typeof value === 'string')) {
          for (const value of entry) names.add(value);
        } else return null;
      }
      return names.size && names.size <= MAX_CANDIDATES ? [...names] : null;
    }
    if (ts.isTemplateExpression(inner)) {
      // In an `update()` a dotted path addresses the TOP-LEVEL field named before the
      // first dot, which is a literal even when the rest is not. In a set / merge-set /
      // create the SAME text is a literal top-level field NAME containing a dot
      // (BACKEND-104) — so an interpolated one is a key this guard cannot read, not a
      // key it may quietly shorten to its prefix.
      const head = inner.head.text;
      return isUpdate && head.includes('.') ? [head.slice(0, head.indexOf('.'))] : null;
    }
    return null;
  }

  /**
   * A `MAP[selector]` access the analysis is reading under ONE entry, by key: the case split
   * `sharedMapEntryBinding` makes when a write's target and its payload read the same lookup.
   */
  const narrowedEntries = new Map();

  /**
   * The values a `MAP[selector]` element access can produce, read from the installed
   * core export. A literal selector narrows to its one entry; an unknown selector keeps
   * every entry. Only a direct core import counts — a local object could be reassigned.
   */
  function coreMapEntries(node, facts, source) {
    const base = stripParens(node.expression);
    if (!ts.isIdentifier(base)) return null;
    const imported = facts.imports.get(base.text);
    if (!isCoreImport(facts, imported)) return null;
    const map = registry.coreConstMap(imported.imported);
    if (!map) return null;
    if (narrowedEntries.has(node)) return [map[narrowedEntries.get(node)]];
    const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
    const selector = index ? computedKeyName(index, facts, source) : null;
    if (selector !== null && Object.prototype.hasOwnProperty.call(map, selector)) return [map[selector]];
    const values = Object.values(map);
    return values.length && values.length <= MAX_CANDIDATES ? values : null;
  }

  /**
   * A reviewed package-builder assertion: a payload built by a function this guard cannot
   * read into (it lives in a published package's compiled output) whose output type IS the
   * named canonical schema type. The entry is keyed to the exact callee + import specifier +
   * file, carries its justification, and is stale-detected like every other exception. There
   * is deliberately NO general "trust any package call" rule.
   */
  function packageBuilderKeys(facts, callNode, property) {
    const callee = stripWrappers(callNode.expression);
    if (!ts.isIdentifier(callee)) return null;
    const imported = facts.imports.get(callee.text);
    if (!imported) return null;
    const callArgs = callNode.arguments.map((arg) => normalizedArgText(arg.getText(facts.source)));
    const entry = packageBuilderEntries.find(
      (candidate) =>
        candidate.file === facts.relPath &&
        candidate.callee === callee.text &&
        candidate.module === imported.module &&
        (candidate.property ?? null) === (property ?? null) &&
        packageBuilderArgsMatch(candidate.args, callArgs),
    );
    if (!entry) return null;
    const bound = registry.canonicalParseKeys.get(entry.schema);
    // A bound schema that no longer reads as a closed canonical shape is not an assertion
    // the guard can stand behind. Fail closed and let the entry report as stale.
    if (!bound) return null;

    // The PACKAGE's own declaration decides which keys the builder produces. A local
    // re-export file is followed to the package it re-exports from — a file in this repo is
    // never itself the package.
    let specifier = imported.module;
    if (!packageNameOf(specifier)) {
      const file = resolveImport(facts.relPath, specifier);
      const reExport = file ? byPath.get(file)?.reExports.get(imported.imported) : null;
      if (!reExport) return null;
      specifier = reExport;
    }
    const packageName = packageNameOf(specifier);
    if (!packageName) return null;
    const declared = packageBuilderReturnKeys({
      packageName,
      callee: entry.callee,
      property: entry.property ?? null,
      packageDeclarations,
    });
    // No readable declaration is no assertion: fail closed rather than grant the schema.
    if (!declared) return null;
    packageBuilderUses.push(entry);
    // `z.infer<typeof Schema>` means the package states its output IS that schema — the
    // assertion holds only when it is the SAME schema the entry bound.
    if (declared.inferOf) return declared.inferOf === entry.schema ? bound : null;
    // Otherwise the declared keys are what gets written, and they are diffed against the
    // target like any other payload — a key the package adds that the registry does not
    // declare fails here rather than being waved through by the entry.
    return { keys: declared.keys, open: false };
  }

  /** Strip parentheses / non-null assertions without unwrapping a cast. */
  function stripParens(node) {
    let current = node;
    while (current && (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current))) {
      current = current.expression;
    }
    return current;
  }

  /**
   * A module-scope constant this file IMPORTS (or declares), so a payload spread of a
   * shared seed object is read rather than waved through as opaque.
   */
  function importedValue(facts, name) {
    if (facts.moduleConsts.has(name)) return { facts, node: facts.moduleConsts.get(name) };
    const imported = facts.imports.get(name);
    if (!imported) return null;
    const file = declaringFile(resolveImport(facts.relPath, imported.module), imported.imported);
    if (!file) return null;
    const target = byPath.get(file);
    const node = target?.moduleConsts.get(imported.imported);
    return node ? { facts: target, node } : null;
  }

  /**
   * The swept file that DECLARES `name`, starting at `file` and following its named and
   * whole-module re-exports — an index that only re-exports is not where a value is built.
   */
  function declaringFile(file, name, seen = new Set()) {
    if (!file || seen.has(file)) return null;
    seen.add(file);
    const target = byPath.get(file);
    if (!target) return null;
    if (target.functions.has(name) || target.moduleConsts.has(name)) return file;
    const named = target.reExports.get(name);
    if (named) return declaringFile(resolveImport(file, named), name, seen);
    for (const specifier of target.starExports) {
      const found = declaringFile(resolveImport(file, specifier), name, seen);
      if (found) return found;
    }
    return null;
  }

  /**
   * Whether an import names a core-package export: the package itself, or — inside the core's own
   * library code — a relative import of one of its modules, which is the same export.
   */
  function isCoreImport(facts, imported) {
    if (!imported) return false;
    if (imported.module === CORE_PACKAGE || imported.module.startsWith(`${CORE_PACKAGE}/`)) return true;
    if (!facts.library || !imported.module.startsWith('.')) return false;
    return Boolean(CORE_LIBRARY_ROOT) && joinPosix(dirnamePosix(facts.relPath), imported.module).startsWith(`${CORE_LIBRARY_ROOT}/`);
  }

  /**
   * Whether an identifier is the core's own `PATH_BUILDERS` — imported from the core, under any
   * local name. A local or foreign object that merely shares the name builds whatever its own
   * functions build, so it is never read as the canonical builders.
   */
  function isCoreBuilders(facts, identifier) {
    const imported = facts.imports.get(identifier.text);
    return imported?.imported === 'PATH_BUILDERS' && isCoreImport(facts, imported);
  }

  /** One resolver per file, rebuilt each round so it sees that round's knowledge. */
  let resolverCache = new Map();
  function resolverFor(facts) {
    if (!resolverCache.has(facts.relPath)) resolverCache.set(facts.relPath, makeResolver(facts));
    return resolverCache.get(facts.relPath);
  }

  // One resolver instance per round, closing over the round's knowledge.
  function makeResolver(facts) {
    const { source } = facts;

    /**
     * Set whenever a recursion or candidate CEILING stopped the analysis. A ceiling is
     * not a finding: it means the guard ran out of budget, so the write must end as a
     * violation and may never be handed to a drop rule.
     */
    let hitCeiling = false;
    const ceiling = () => {
      hitCeiling = true;
      return null;
    };

    /**
     * Is this identifier the transaction a `db.runTransaction(cb)` callback was handed?
     * The callback's FIRST parameter is the transaction, whatever it was named — which is
     * the only thing that actually makes it one.
     */
    function isTransactionCallbackParam(identifier) {
      for (let current = identifier.parent; current; current = current.parent) {
        if (!ts.isFunctionLike(current)) continue;
        const first = current.parameters?.[0];
        if (!first || !ts.isIdentifier(first.name) || first.name.text !== identifier.text) continue;
        const call = current.parent;
        if (
          call &&
          ts.isCallExpression(call) &&
          ts.isPropertyAccessExpression(call.expression) &&
          call.expression.name.text === 'runTransaction'
        ) return true;
      }
      return false;
    }

    const visibleDecls = (name, pos, node) =>
      (facts.varDecls.get(name) ?? [])
        .filter((decl) => decl.pos < pos && (!decl.scope || encloses(decl.scope, node)))
        .sort((a, b) => b.pos - a.pos);

    const nearestDecl = (name, pos, node) => visibleDecls(name, pos, node)[0] ?? null;

    /** Whether a declaration binds a PROPERTY of another value — a destructured name. */
    const isPropertyBinding = (decl) =>
      Boolean((decl?.bindingOf && decl.bindingProperty) || (decl?.elementOf && decl.elementProperty) || decl?.entryOf);

    /**
     * Every value a destructured name can hold: the property of the value it destructures, or
     * of each element of the array a `for…of` pattern walks. Null when not statically readable.
     */
    function boundValues(decl, depth = 0) {
      if (decl.bindingOf && decl.bindingProperty) return staticPropertyCandidates(decl.bindingOf, decl.bindingProperty, depth);
      if (decl.elementOf && decl.elementProperty) return propertyValuesFromArray(decl.elementOf, decl.elementProperty, depth);
      // An entries tuple's value: what a provable Map stored, or an array's elements.
      if (decl.entryOf) return mapEntryValues(decl.entryOf, depth) ?? arrayEntryExpressions(decl.entryOf, depth);
      return null;
    }

    /**
     * The indexed function that declares `paramName`, walking OUT through nested callbacks:
     * a helper's `ref` parameter is still its parameter when the write happens inside an
     * arrow function defined in its body.
     */
    const enclosingFunction = (node, paramName = null) => {
      for (let current = node; current; current = current.parent) {
        if (!ts.isFunctionLike(current)) continue;
        const name = functionName(current);
        if (!name) continue;
        const params = facts.functions.get(name)?.params ?? [];
        if (!paramName || params.some((parameter) => parameter.name === paramName)) {
          return { node: current, name };
        }
      }
      return null;
    };

    /**
     * The values every CALL SITE passes for a parameter, or null when none did.
     *
     * The generic form of the propagations already here: a lane table's `build` function
     * handed to a wrapper, a status FIELD NAME handed to a shared reset builder, a
     * collection constant handed to a sweep. Without it, a writer that factors its shared
     * shape into one helper is less readable to the guard than one that repeats itself.
     */
    function parameterValues(identifier) {
      const owner = enclosingFunction(identifier, identifier.text);
      if (!owner) return null;
      const params = facts.functions.get(owner.name)?.params ?? [];
      const index = params.findIndex((candidate) => candidate.name === identifier.text);
      if (index < 0) return null;
      const values = paramValues.get(paramKey(facts.relPath, owner.name, index));
      return values?.length && values.length <= MAX_CANDIDATES ? values : null;
    }

    /**
     * Every LITERAL STRING an expression can be, bounded — a collection name, a status
     * field name, a computed key. Null when the set is not statically provable.
     */
    function literalStringCandidates(expr, depth = 0) {
      if (depth > CARRIER_DEPTH || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isStringLiteralLike(node)) return [node.text];
      if (ts.isPropertyAccessExpression(node)) {
        const key = `${node.expression.getText(source)}.${node.name.text}`;
        const constant = registry.constantValue.get(key);
        if (constant) return [constant];
        const candidates = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
        const found = new Set();
        for (const candidate of candidates) {
          const inner = resolverFor(candidate.facts).literalStringCandidates(candidate.node, depth + 1);
          if (!inner) return null;
          for (const value of inner) found.add(value);
        }
        return found.size && found.size <= MAX_CANDIDATES ? [...found] : null;
      }
      if (ts.isConditionalExpression(node)) {
        const left = literalStringCandidates(node.whenTrue, depth + 1);
        const right = literalStringCandidates(node.whenFalse, depth + 1);
        if (!left || !right) return null;
        const found = new Set([...left, ...right]);
        return found.size <= MAX_CANDIDATES ? [...found] : null;
      }
      if (ts.isElementAccessExpression(node)) {
        const entries = coreMapEntries(node, facts, source);
        if (entries?.every((value) => typeof value === 'string')) return [...new Set(entries)];
        const properties = objectProperties(node.expression, depth + 1);
        if (!properties) return null;
        const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
        const selector = index ? computedKeyName(index, facts, source) : null;
        const values = selector !== null ? properties.get(selector) ?? null : [...properties.values()].flat();
        if (!values?.length || values.length > MAX_CANDIDATES) return null;
        const found = new Set();
        for (const value of values) {
          const inner = resolverFor(value.facts).literalStringCandidates(value.node, depth + 1);
          if (!inner) return null;
          for (const text of inner) found.add(text);
        }
        return found.size && found.size <= MAX_CANDIDATES ? [...found] : null;
      }
      if (ts.isIdentifier(node)) {
        if (facts.stringConsts.has(node.text)) return [facts.stringConsts.get(node.text)];
        const decls = visibleDecls(node.text, node.pos, node);
        if (decls.length) {
          const found = new Set();
          for (const decl of decls) {
            let inner = null;
            if (decl.initializer) inner = literalStringCandidates(decl.initializer, depth + 1);
            else if (decl.iterOf) inner = literalStringArrayCandidates(decl.iterOf, depth + 1);
            else if (isPropertyBinding(decl)) {
              const outer = boundValues(decl, depth + 1);
              if (outer?.length) {
                inner = [];
                for (const value of outer) {
                  const nested = resolverFor(value.facts).literalStringCandidates(value.node, depth + 1);
                  if (!nested) { inner = null; break; }
                  inner.push(...nested);
                }
              }
            }
            if (!inner) return null;
            for (const value of inner) found.add(value);
          }
          return found.size && found.size <= MAX_CANDIDATES ? [...found] : null;
        }
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).literalStringCandidates(external.node, depth + 1);
        const supplied = parameterValues(node);
        if (!supplied) return null;
        const found = new Set();
        for (const value of supplied) {
          const inner = resolverFor(value.facts).literalStringCandidates(value.node, depth + 1);
          if (!inner) return null;
          for (const text of inner) found.add(text);
        }
        return found.size && found.size <= MAX_CANDIDATES ? [...found] : null;
      }
      return null;
    }

    /** Every literal string a bounded ARRAY of them can yield (`for (const c of [A, B])`). */
    function literalStringArrayCandidates(expr, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        if (!node.elements.length || node.elements.length > MAX_CANDIDATES) return null;
        const found = new Set();
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) return null;
          const inner = literalStringCandidates(element, depth + 1);
          if (!inner) return null;
          for (const value of inner) found.add(value);
        }
        return found.size ? [...found] : null;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return literalStringArrayCandidates(decl.initializer, depth + 1);
      }
      return null;
    }

    /**
     * Every name a constant LIST of field names holds — `['name', 'icon', ...OTHER_FIELDS]`,
     * through a declaration, an import, a spread of another such list, or a subset of one.
     * Null unless every element is a literal string.
     */
    function literalStringList(expr, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        const found = new Set();
        for (const element of node.elements) {
          const inner = ts.isSpreadElement(element)
            ? literalStringList(element.expression, depth + 1)
            : literalStringCandidates(element, depth + 1);
          if (!inner) return null;
          for (const value of inner) found.add(value);
        }
        return found.size && found.size <= MAX_QUEUE_ENTRIES ? [...found] : null;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ARRAY_PASSTHROUGH.has(node.expression.name.text)
      ) {
        return literalStringList(node.expression.expression, depth + 1);
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return literalStringList(decl.initializer, depth + 1);
        if (decl) return null;
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).literalStringList(external.node, depth + 1);
      }
      return null;
    }

    /** A literal path segment from an expression, or ANY when it is an unknown id. */
    function segmentOf(expr) {
      const node = stripWrappers(expr);
      if (ts.isStringLiteralLike(node)) return LIT(node.text);
      if (ts.isPropertyAccessExpression(node)) {
        const key = `${node.expression.getText(source)}.${node.name.text}`;
        const value = registry.constantValue.get(key);
        if (value) return LIT(value);
        // `slot.subcollection` off `const slot = MAP[kind]`, a core const map: a literal only
        // while the lookup reads ONE entry — a literal selector, or the case split a write
        // makes when its target and payload read the same lookup. Several entries stay unknown.
        const base = constLookup(stripParens(node.expression), facts);
        if (ts.isElementAccessExpression(base)) {
          const entries = coreMapEntries(base, facts, source);
          const entry = entries?.length === 1 ? entries[0] : null;
          const segment = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry[node.name.text] : null;
          if (typeof segment === 'string' && segment) return LIT(segment);
        }
      }
      if (ts.isIdentifier(node) && facts.stringConsts.has(node.text)) return LIT(facts.stringConsts.get(node.text));
      return ANY;
    }

    /** Direct carrier properties: local/imported objects and bounded carrier arrays. */
    function staticPropertyCandidates(baseExpr, propertyName, depth = 0) {
      if (!baseExpr || !propertyName) return null;
      if (depth > CARRIER_DEPTH) return ceiling();
      const node = stripWrappers(baseExpr);
      if (ts.isObjectLiteralExpression(node)) {
        // A SPREAD can replace the property being asked for with a runtime value, so the
        // direct scan below is only safe on a literal without one. `objectProperties`
        // owns the spread rules and fails closed on an unreadable spread.
        if (node.properties.some((property) => ts.isSpreadAssignment(property))) {
          const properties = objectProperties(node, depth + 1);
          const values = properties?.get(propertyName);
          return values?.length && values.length <= MAX_CANDIDATES ? values : null;
        }
        const found = [];
        for (const property of node.properties) {
          if (ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
              property.name.text === propertyName) {
            found.push({ facts, node: property.initializer });
          }
          if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
            found.push({ facts, node: property.name });
          }
        }
        return found.length ? found : null;
      }
      // `destinations.profiles.get(userId)` — a Map read: the property of every entry that
      // Map's own `.set` calls stored. A receiver not provably a local `new Map()` falls through.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'get' &&
        node.arguments.length === 1
      ) {
        const entries = mapEntryValues(node.expression.expression, depth + 1);
        if (entries) {
          const found = [];
          for (const entry of entries) {
            const values = resolverFor(entry.facts).staticPropertyCandidates(entry.node, propertyName, depth + 1);
            if (!values) return null;
            found.push(...values);
          }
          return found.length && found.length <= MAX_CANDIDATES ? found : null;
        }
      }
      if (ts.isConditionalExpression(node)) {
        // An optional carrier often has an explicit `undefined`/`null` branch that
        // a caller guards before dereferencing. That branch has no property and cannot
        // become a write target; retain the readable branch. An opaque non-null branch
        // still fails closed rather than being silently ignored.
        const isNullish = (value) => {
          const branch = stripWrappers(value);
          return (
            branch.kind === ts.SyntaxKind.NullKeyword ||
            branch.kind === ts.SyntaxKind.UndefinedKeyword ||
            (ts.isIdentifier(branch) && branch.text === 'undefined')
          );
        };
        const left = isNullish(node.whenTrue) ? [] : staticPropertyCandidates(node.whenTrue, propertyName, depth + 1);
        const right = isNullish(node.whenFalse) ? [] : staticPropertyCandidates(node.whenFalse, propertyName, depth + 1);
        if (!left || !right || (!left.length && !right.length) || left.length + right.length > MAX_CANDIDATES) return null;
        return [...left, ...right];
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return staticPropertyCandidates(decl.initializer, propertyName, depth + 1);
        if (isPropertyBinding(decl)) {
          const outer = boundValues(decl, depth + 1);
          if (!outer) return null;
          const nested = [];
          for (const value of outer) {
            const values = resolverFor(value.facts).staticPropertyCandidates(value.node, propertyName, depth + 1);
            if (!values) return null;
            nested.push(...values);
          }
          return nested.length && nested.length <= MAX_CANDIDATES ? nested : null;
        }
        if (decl?.iterOf) return propertyValuesFromArray(decl.iterOf, propertyName, depth + 1);
        // `const [snapshot, stored] = await Promise.all([…, readGame(tx, id)])` — that index's entry.
        if (decl?.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? staticPropertyCandidates(entry, propertyName, depth + 1) : null;
        }
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).staticPropertyCandidates(external.node, propertyName, depth + 1);
        const owner = enclosingFunction(node, node.text);
        if (!owner) return null;
        const params = facts.functions.get(owner.name)?.params ?? [];
        const index = params.findIndex((parameter) => parameter.name === node.text);
        const values = index < 0 ? null : paramCarrierProperties.get(`${paramKey(facts.relPath, owner.name, index)}.${propertyName}`);
        if (values?.length && values.length <= MAX_CANDIDATES) return values;
        // Fall back to the whole value every call site passes, then take the property off it.
        const supplied = parameterValues(node);
        if (!supplied) return null;
        const found = [];
        for (const value of supplied) {
          const inner = resolverFor(value.facts).staticPropertyCandidates(value.node, propertyName, depth + 1);
          if (!inner) return null;
          found.push(...inner);
        }
        return found.length && found.length <= MAX_CANDIDATES ? found : null;
      }
      if (ts.isPropertyAccessExpression(node)) {
        const outer = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (!outer) return null;
        const nested = [];
        for (const value of outer) {
          const owner = resolverFor(value.facts);
          const values = owner.staticPropertyCandidates(value.node, propertyName, depth + 1);
          if (!values) {
            // An entry whose shape is fully readable and simply does NOT declare this
            // property contributes nothing — a lane without its own `resetPatch` is not an
            // unreadable lane. An entry whose shape cannot be read still fails closed.
            if (owner.objectProperties(value.node, depth + 1)) continue;
            return null;
          }
          nested.push(...values);
        }
        return nested.length && nested.length <= MAX_CANDIDATES ? nested : null;
      }
      if (ts.isElementAccessExpression(node)) {
        // A finite object registry indexed by a runtime selector retains ALL of its
        // direct entries. It is not a dynamic-path exemption: every possible carrier
        // property is followed and every resulting target is checked.
        const properties = objectProperties(node.expression, depth + 1);
        // `conversions[index]` — an element of an array of carriers: the property of each.
        if (!properties) return propertyValuesFromArray(node.expression, propertyName, depth + 1);
        const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
        const literal = index ? computedKeyName(index, facts, source) : null;
        const entries = literal
          ? properties.get(literal) ?? null
          : [...properties.values()].flat();
        if (!entries?.length || entries.length > MAX_CANDIDATES) return null;
        const nested = [];
        for (const value of entries) {
          const owner = resolverFor(value.facts);
          const values = owner.staticPropertyCandidates(value.node, propertyName, depth + 1);
          if (!values) {
            // An entry whose shape is fully readable and simply does NOT declare this
            // property contributes nothing — a lane without its own `resetPatch` is not an
            // unreadable lane. An entry whose shape cannot be read still fails closed.
            if (owner.objectProperties(value.node, depth + 1)) continue;
            return null;
          }
          nested.push(...values);
        }
        return nested.length && nested.length <= MAX_CANDIDATES ? nested : null;
      }
      if (ts.isCallExpression(node)) {
        const key = calleeKey(node);
        const values = key ? returnCarrierProperties.get(key)?.get(propertyName) : null;
        if (values?.length && values.length <= MAX_CANDIDATES) return values;
        // A CALLBACK supplied on a carrier (`options.validate(raw, id).quarantine`): read
        // the property off what that callback actually returns, at the call site where the
        // callback is a syntactically finite function.
        const callbacks = callbackFunctions(node, depth + 1);
        if (!callbacks?.length) return null;
        const found = [];
        for (const callback of callbacks) {
          const resolver = resolverFor(callback.facts);
          for (const returned of callbackReturns(callback.node)) {
            const inner = resolver.staticPropertyCandidates(returned, propertyName, depth + 1);
            if (inner) found.push(...inner);
          }
        }
        return found.length && found.length <= MAX_CANDIDATES ? found : null;
      }
      return null;
    }

    /**
     * The syntactically finite functions a CALLBACK callee can be. Only a directly readable
     * inline function or method counts; an arbitrary function value stays unreadable.
     */
    function callbackFunctions(callExpr, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const callee = stripWrappers(callExpr.expression);
      if (!ts.isPropertyAccessExpression(callee)) return null;
      const candidates = staticPropertyCandidates(callee.expression, callee.name.text, depth + 1);
      if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
      const functions = [];
      for (const candidate of candidates) {
        const node = stripWrappers(candidate.node);
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
          functions.push({ facts: candidate.facts, node });
        } else return null;
      }
      return functions.length ? functions : null;
    }

    /** A direct carrier property on every bounded member of an array/callback result. */
    /**
     * Every value stored into the Map an expression is — the second argument of each
     * `map.set(key, value)` after its `new Map()` declaration, in that declaration's scope —
     * followed through a property a carrier hands back and a parameter every call site fills.
     * Null unless every candidate is provably such a Map: a Map seeded through its constructor,
     * or any other receiver, is not read.
     */
    function mapEntryValues(expr, depth = 0) {
      if (depth > CARRIER_DEPTH) return ceiling();
      const node = stripWrappers(expr);
      const merged = (candidates) => {
        if (!candidates?.length) return null;
        const values = [];
        for (const candidate of candidates) {
          const inner = resolverFor(candidate.facts).mapEntryValues(candidate.node, depth + 1);
          if (!inner) return null;
          values.push(...inner);
        }
        return values.length <= MAX_QUEUE_ENTRIES ? values : null;
      };
      if (ts.isPropertyAccessExpression(node)) return merged(staticPropertyCandidates(node.expression, node.name.text, depth + 1));
      if (!ts.isIdentifier(node)) return null;
      const decl = nearestDecl(node.text, node.pos, node);
      if (!decl) return merged(parameterValues(node));
      if (isPropertyBinding(decl)) return merged(boundValues(decl, depth + 1));
      const initializer = decl.initializer ? stripWrappers(decl.initializer) : null;
      if (
        !initializer ||
        !ts.isNewExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== 'Map' ||
        (initializer.arguments?.length ?? 0) > 0
      ) {
        return null;
      }
      return (facts.mapSetCalls.get(node.text) ?? [])
        .filter((entry) => entry.pos > decl.pos && (!decl.scope || encloses(decl.scope, entry.call)))
        .map((entry) => ({ facts, node: entry.value }));
    }

    function propertyValuesFromArray(expr, propertyName, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        if (node.elements.length > MAX_CANDIDATES) return null;
        const values = [];
        for (const element of node.elements) {
          // `[...byId.values(), extra]` — a spread adds the elements of an array that is itself
          // readable; an unreadable one leaves the whole array unread.
          const found = ts.isSpreadElement(element)
            ? propertyValuesFromArray(element.expression, propertyName, depth + 1)
            : staticPropertyCandidates(element, propertyName, depth + 1);
          if (!found) return null;
          values.push(...found);
        }
        return values.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        // `await Promise.all(docs.map(convert))` — the awaited elements of that array.
        if (method === 'all' && node.arguments.length === 1) {
          return propertyValuesFromArray(node.arguments[0], propertyName, depth + 1);
        }
        // `byId.values()` on a provable Map — the entries its `.set` calls stored.
        if (method === 'values' && node.arguments.length === 0) {
          const entries = mapEntryValues(node.expression.expression, depth + 1);
          if (entries) {
            const values = [];
            for (const entry of entries) {
              const found = resolverFor(entry.facts).staticPropertyCandidates(entry.node, propertyName, depth + 1);
              if (!found) return null;
              values.push(...found);
            }
            return values.length && values.length <= MAX_CANDIDATES ? values : null;
          }
        }
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return null;
          const returns = [];
          if (!ts.isBlock(callback.body)) returns.push(callback.body);
          else {
            const collect = (inner) => {
              if (inner !== callback && ts.isFunctionLike(inner)) return;
              if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
              ts.forEachChild(inner, collect);
            };
            ts.forEachChild(callback.body, collect);
          }
          if (!returns.length || returns.length > MAX_CALLBACK_RETURNS) return null;
          const values = [];
          for (const returned of returns) {
            // A `flatMap` callback returns an ARRAY of elements; a `map` callback returns one.
            const found = method === 'flatMap'
              ? propertyValuesFromArray(returned, propertyName, depth + 1)
              : staticPropertyCandidates(returned, propertyName, depth + 1);
            if (!found) return null;
            values.push(...found);
          }
          return values.length && values.length <= MAX_CANDIDATES ? values : null;
        }
        if (ARRAY_PASSTHROUGH.has(method)) return propertyValuesFromArray(node.expression.expression, propertyName, depth + 1);
      }
      // `cond ? await collectTargets(id) : []` — an empty branch contributes no element.
      if (ts.isConditionalExpression(node)) {
        const isEmpty = (value) => {
          const branch = stripWrappers(value);
          return ts.isArrayLiteralExpression(branch) && branch.elements.length === 0;
        };
        const left = isEmpty(node.whenTrue) ? [] : propertyValuesFromArray(node.whenTrue, propertyName, depth + 1);
        const right = isEmpty(node.whenFalse) ? [] : propertyValuesFromArray(node.whenFalse, propertyName, depth + 1);
        if (!left || !right || (!left.length && !right.length)) return null;
        const values = [...left, ...right];
        return values.length <= MAX_CANDIDATES ? values : null;
      }
      // `plan.teams` — an array a carrier holds: the elements of every value the property can be.
      if (ts.isPropertyAccessExpression(node)) {
        const arrays = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (!arrays?.length) return null;
        const values = [];
        for (const array of arrays) {
          const found = resolverFor(array.facts).propertyValuesFromArray(array.node, propertyName, depth + 1);
          if (!found) return null;
          values.push(...found);
        }
        return values.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      // An ARRAY of carriers returned by a helper (`const targets = collectTargets(...)`).
      // The elements were built there, so that is where their refs and payloads are read.
      if (ts.isCallExpression(node)) {
        const key = calleeKey(node);
        const values = key ? returnArrayProperties.get(key)?.get(propertyName) : null;
        return values?.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      if (ts.isIdentifier(node)) {
        // An array built up entry by entry (`const candidates: C[] = []; candidates.push(…)`)
        // and read back in a later loop: each entry is still readable where it was created.
        const entries = arrayEntryExpressions(node, depth + 1);
        if (entries?.length) {
          const values = [];
          for (const entry of entries) {
            const found = resolverFor(entry.facts).staticPropertyCandidates(entry.node, propertyName, depth + 1);
            if (!found) return null;
            values.push(...found);
          }
          return values.length && values.length <= MAX_QUEUE_ENTRIES ? values : null;
        }
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return propertyValuesFromArray(decl.initializer, propertyName, depth + 1);
        // `const [teams, ids] = await Promise.all([readTeams(id), …])` — that index's entry.
        if (decl?.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? propertyValuesFromArray(entry, propertyName, depth + 1) : null;
        }
        const supplied = parameterValues(node);
        if (!supplied?.length) return null;
        const values = [];
        for (const value of supplied) {
          const inner = resolverFor(value.facts).propertyValuesFromArray(value.node, propertyName, depth + 1);
          if (!inner) return null;
          values.push(...inner);
        }
        return values.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      return null;
    }

    /** All direct, statically named properties of a carrier for call-site propagation. */
    function objectProperties(baseExpr, depth = 0) {
      if (depth > CARRIER_DEPTH || !baseExpr) return null;
      const node = stripWrappers(baseExpr);
      if (ts.isObjectLiteralExpression(node)) {
        // Properties are read in SOURCE ORDER and a later definition replaces an earlier
        // one, exactly as the language evaluates them. `{ ...candidate, order: liveOrder }`
        // is a readable carrier, not an ambiguous one — rejecting it because the override
        // repeats a spread key made a whole cascade of queued refs unresolvable. An
        // UNREADABLE spread still poisons the object, which is the case that matters.
        const properties = new Map();
        for (const property of node.properties) {
          if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))) {
            properties.set(property.name.text, [{ facts, node: property.initializer }]);
          } else if (ts.isShorthandPropertyAssignment(property)) {
            properties.set(property.name.text, [{ facts, node: property.name }]);
          } else if (
            (ts.isMethodDeclaration(property) || ts.isFunctionExpression(property)) &&
            property.name &&
            (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
          ) {
            // A method on the carrier (`validate(raw, id) { … }`) is a named property like
            // any other. Rejecting the WHOLE carrier because one property is a method threw
            // away the ref and payload properties beside it — which is how a generic sweep
            // helper's collection stopped resolving.
            if (properties.has(property.name.text)) return null;
            properties.set(property.name.text, [{ facts, node: property }]);
          } else if (ts.isSpreadAssignment(property)) {
            // A finite conditional spread is safe only when it cannot overwrite a
            // direct carrier property. An arbitrary spread stays opaque: it could
            // replace `ref`/`patch` with a runtime value the guard cannot inspect.
            const spread = objectProperties(property.expression, depth + 1);
            if (!spread) return null;
            for (const [name, values] of spread) properties.set(name, values);
          } else {
            return null;
          }
        }
        return properties;
      }
      if (ts.isConditionalExpression(node)) {
        const isNullish = (value) => {
          const branch = stripWrappers(value);
          return (
            branch.kind === ts.SyntaxKind.NullKeyword ||
            branch.kind === ts.SyntaxKind.UndefinedKeyword ||
            (ts.isIdentifier(branch) && branch.text === 'undefined')
          );
        };
        const left = isNullish(node.whenTrue) ? new Map() : objectProperties(node.whenTrue, depth + 1);
        const right = isNullish(node.whenFalse) ? new Map() : objectProperties(node.whenFalse, depth + 1);
        if (!left || !right || (!left.size && !right.size)) return null;
        const merged = new Map();
        for (const sourceProperties of [left, right]) {
          for (const [property, values] of sourceProperties) {
            const existing = merged.get(property) ?? [];
            existing.push(...values);
            if (existing.length > MAX_CANDIDATES) return null;
            merged.set(property, existing);
          }
        }
        return merged;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return objectProperties(decl.initializer, depth + 1);
        // `for (const candidate of candidates) { next.push({ ...candidate, order }) }` —
        // the loop variable is one entry of that array, and a carrier spread into a second
        // array must keep the properties it came with.
        if (decl?.iterOf) {
          const entries = arrayEntryExpressions(decl.iterOf, depth + 1);
          if (!entries?.length) return null;
          const merged = new Map();
          for (const entry of entries) {
            const inner = resolverFor(entry.facts).objectProperties(entry.node, depth + 1);
            if (!inner) return null;
            for (const [property, values] of inner) {
              const existing = merged.get(property) ?? [];
              existing.push(...values);
              if (existing.length > MAX_QUEUE_ENTRIES) return null;
              merged.set(property, existing);
            }
          }
          return merged.size ? merged : null;
        }
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).objectProperties(external.node, depth + 1);
        // A carrier parameter several call sites fill (`flatLane(build, lane)` once per
        // lane): every caller's properties stay candidates, exactly as a target does.
        const supplied = parameterValues(node);
        if (!supplied?.length) return null;
        const merged = new Map();
        for (const value of supplied) {
          const inner = resolverFor(value.facts).objectProperties(value.node, depth + 1);
          if (!inner) return null;
          for (const [property, values] of inner) {
            const existing = merged.get(property) ?? [];
            existing.push(...values);
            if (existing.length > MAX_QUEUE_ENTRIES) return null;
            merged.set(property, existing);
          }
        }
        return merged.size ? merged : null;
      }
      if (ts.isCallExpression(node)) {
        const key = calleeKey(node);
        return key ? returnCarrierProperties.get(key) ?? null : null;
      }
      return null;
    }

    /** Correlated properties from the SAME finite carrier branch (never a cross-product). */
    function correlatedCarrierPairs(baseExpr, leftName, rightName, depth = 0) {
      if (depth > CARRIER_DEPTH || !baseExpr || !leftName || !rightName) return null;
      const node = stripWrappers(baseExpr);
      if (ts.isObjectLiteralExpression(node)) {
        const properties = objectProperties(node, depth + 1);
        const left = properties?.get(leftName);
        const right = properties?.get(rightName);
        if (!left?.length || !right?.length || left.length !== 1 || right.length !== 1) return null;
        return [{ left: left[0], right: right[0] }];
      }
      if (ts.isConditionalExpression(node)) {
        const left = correlatedCarrierPairs(node.whenTrue, leftName, rightName, depth + 1);
        const right = correlatedCarrierPairs(node.whenFalse, leftName, rightName, depth + 1);
        if (!left || !right || left.length + right.length > MAX_CANDIDATES) return null;
        return [...left, ...right];
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return correlatedCarrierPairs(decl.initializer, leftName, rightName, depth + 1);
        // `for (const w of writes.slice(i, i + MAX))` — one queued entry.
        if (decl?.iterOf) return correlatedPairsFromArray(decl.iterOf, leftName, rightName, depth + 1);
        const external = importedValue(facts, node.text);
        if (external) {
          return resolverFor(external.facts).correlatedCarrierPairs(external.node, leftName, rightName, depth + 1);
        }
        // A carrier PARAMETER — one argument object per call site. Each call site supplies both
        // halves at once, so its `ref` and its patch stay the pair that call site wrote; the
        // property-by-property union would cross-product one caller's document with another
        // caller's payload. Only a name nothing ever assigns to qualifies: a rebound binding is
        // not one value. An unreadable call site, or more than the candidate bound, yields no
        // pairing at all, and the caller then falls back to that union — a superset of these
        // pairs, so it can only report more, never less.
        if (facts.varDecls.get(node.text)?.length) return null;
        const supplied = parameterValues(node);
        if (!supplied?.length || supplied.length > MAX_CANDIDATES) return null;
        const pairs = [];
        for (const value of supplied) {
          const found = resolverFor(value.facts).correlatedCarrierPairs(value.node, leftName, rightName, depth + 1);
          if (!found) return null;
          pairs.push(...found);
        }
        return pairs.length && pairs.length <= MAX_CANDIDATES ? pairs : null;
      }
      if (ts.isElementAccessExpression(node)) return correlatedPairsFromArray(node.expression, leftName, rightName, depth + 1);
      return null;
    }

    /**
     * Every `{ ref, data }` pair a bounded ARRAY can hold.
     *
     * A generic pending-write sink (`writes.push({ op, ref, data })`, replayed by a
     * `commitWrites`-style loop) is checkable exactly once: at the CONSTRUCTION site, where
     * the reference and its payload are still correlated. The replay site sees only an
     * array of opaque entries, so resolving there would either fail closed on every cascade
     * or invent a target/payload cross-product.
     */
    function correlatedPairsFromArray(expr, leftName, rightName, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        if (node.elements.length > MAX_CANDIDATES) return null;
        const pairs = [];
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) return null;
          const found = correlatedCarrierPairs(element, leftName, rightName, depth + 1);
          if (!found) return null;
          pairs.push(...found);
        }
        return pairs.length && pairs.length <= MAX_CANDIDATES ? pairs : null;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        if (ARRAY_PASSTHROUGH.has(node.expression.name.text)) {
          return correlatedPairsFromArray(node.expression.expression, leftName, rightName, depth + 1);
        }
        return null;
      }
      if (ts.isIdentifier(node)) {
        const entries = arrayEntryExpressions(node, depth + 1);
        if (!entries) return null;
        const pairs = [];
        for (const entry of entries) {
          const found = resolverFor(entry.facts).correlatedCarrierPairs(entry.node, leftName, rightName, depth + 1);
          if (!found) return null;
          pairs.push(...found);
        }
        return pairs.length && pairs.length <= MAX_QUEUE_ENTRIES ? pairs : null;
      }
      return null;
    }

    /**
     * Every expression a local or call-site-supplied ARRAY variable can hold: its literal
     * elements plus everything `push`ed onto it. Null when the array is not bounded and
     * directly readable — which fails closed, as it must.
     */
    function arrayEntryExpressions(expr, depth = 0) {
      if (depth > CARRIER_DEPTH || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        const entries = [];
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) {
            const inner = arrayEntryExpressions(element.expression, depth + 1);
            if (!inner) return null;
            entries.push(...inner);
            continue;
          }
          entries.push({ facts, node: element });
        }
        return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
      }
      // A queue handed over as a carrier property or a helper's return — the construction
      // site is still where its entries are readable.
      // `cond ? [] : [entry]` — each branch's entries; an empty branch adds none.
      if (ts.isConditionalExpression(node)) {
        const entries = [];
        for (const branch of [node.whenTrue, node.whenFalse]) {
          const inner = stripWrappers(branch);
          if (ts.isArrayLiteralExpression(inner) && inner.elements.length === 0) continue;
          const found = arrayEntryExpressions(branch, depth + 1);
          if (!found) return null;
          entries.push(...found);
        }
        return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        // `entries.slice(0, n)` — a subset of the same entries.
        if (ARRAY_PASSTHROUGH.has(method)) return arrayEntryExpressions(node.expression.expression, depth + 1);
        // `created.values()` on a provable Map — the values its `.set` calls stored.
        if (method === 'values' && node.arguments.length === 0) {
          const values = mapEntryValues(node.expression.expression, depth + 1);
          return values?.length && values.length <= MAX_QUEUE_ENTRIES ? values : null;
        }
        // `events.map((event) => ({ path, data: event }))` — each callback return is an entry;
        // a `flatMap` callback returns an array of them.
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return null;
          const returns = callbackReturns(callback);
          if (!returns.length) return null;
          const entries = [];
          for (const returned of returns) {
            if (method === 'map') {
              entries.push({ facts, node: returned });
              continue;
            }
            const inner = stripWrappers(returned);
            if (ts.isArrayLiteralExpression(inner) && inner.elements.length === 0) continue;
            const found = arrayEntryExpressions(returned, depth + 1);
            if (!found) return null;
            entries.push(...found);
          }
          return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
        }
      }
      // `const writes = gameCopyWrites(id, game)` — the entries of every array the helper returns.
      if (ts.isCallExpression(node) && ts.isIdentifier(stripWrappers(node.expression))) {
        const key = calleeKey(node);
        const at = key ? key.lastIndexOf('#') : -1;
        const owner = at > 0 ? byPath.get(key.slice(0, at)) : null;
        const returns = owner?.functions.get(key.slice(at + 1))?.returns ?? [];
        if (!returns.length || returns.length > MAX_CALLBACK_RETURNS) return null;
        const entries = [];
        for (const returned of returns) {
          const found = resolverFor(owner).arrayEntryExpressions(returned, depth + 1);
          if (!found) return null;
          entries.push(...found);
        }
        return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
      }
      if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) {
        const candidates = ts.isPropertyAccessExpression(node)
          ? staticPropertyCandidates(node.expression, node.name.text, depth + 1)
          : null;
        if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
        const entries = [];
        for (const candidate of candidates) {
          const inner = resolverFor(candidate.facts).arrayEntryExpressions(candidate.node, depth + 1);
          if (!inner) return null;
          entries.push(...inner);
        }
        return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
      }
      if (!ts.isIdentifier(node)) return null;
      const decl = nearestDecl(node.text, node.pos, node);
      const entries = [];
      if (decl?.initializer) {
        // An empty `[]` holds only what is pushed onto it below.
        const initializer = stripWrappers(decl.initializer);
        if (!(ts.isArrayLiteralExpression(initializer) && initializer.elements.length === 0)) {
          const inner = arrayEntryExpressions(initializer, depth + 1);
          if (!inner) return null;
          entries.push(...inner);
        }
      } else if (isPropertyBinding(decl)) {
        // `const { writes } = await buildWrites(...)` — the queue arrives
        // destructured and the caller pushes its own entries onto the SAME array, so both
        // construction sites contribute.
        const outer = boundValues(decl, depth + 1);
        if (!outer?.length) return null;
        for (const value of outer) {
          const inner = resolverFor(value.facts).arrayEntryExpressions(value.node, depth + 1);
          if (!inner) return null;
          entries.push(...inner);
        }
      } else if (!decl) {
        const supplied = parameterArrayEntries(node);
        if (!supplied?.length) return null;
        return supplied.length <= MAX_QUEUE_ENTRIES ? supplied : null;
      } else {
        return null;
      }
      for (const pushed of facts.pushCalls.get(node.text) ?? []) {
        // A push onto THIS array — its receiver is the same declaration — wherever it sits,
        // a callback inside the function included. Another function's same-named array is not.
        if (nearestDecl(node.text, pushed.call.pos, pushed.call) !== decl) continue;
        // `writes.push(...cascade.writes)` — one queue folded into another. Its entries are
        // still readable at THEIR construction site.
        if (ts.isSpreadElement(pushed.argument)) {
          const inner = arrayEntryExpressions(pushed.argument.expression, depth + 1);
          if (!inner) return null;
          entries.push(...inner);
          continue;
        }
        entries.push({ facts, node: pushed.argument });
      }
      return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
    }

    /** The queue entries every call site supplied for an array PARAMETER. */
    function parameterArrayEntries(identifier) {
      const owner = enclosingFunction(identifier, identifier.text);
      if (!owner) return null;
      const params = facts.functions.get(owner.name)?.params ?? [];
      const index = params.findIndex((parameter) => parameter.name === identifier.text);
      if (index < 0) return null;
      return paramArrayEntries.get(paramKey(facts.relPath, owner.name, index)) ?? null;
    }

    /** A property lookup that only has one candidate (legacy callers need one). */
    function staticProperty(baseExpr, propertyName, depth = 0) {
      const candidates = staticPropertyCandidates(baseExpr, propertyName, depth);
      return candidates?.length === 1 ? candidates[0] : null;
    }

    function resolveForeign(value, state, depth) {
      return value ? resolverFor(value.facts).resolve(value.node, state, depth + 1) : null;
    }

    function resolveForeignCandidates(values, state, depth) {
      if (!values?.length) return null;
      if (values.length > MAX_CANDIDATES) return ceiling();
      const templates = new Set();
      const segments = [];
      for (const value of values) {
        const resolved = resolveForeign(value, state, depth + 1);
        if (!resolved) return null;
        if (resolved.templates) for (const template of resolved.templates) templates.add(template);
        else if (resolved.segments) segments.push(resolved.segments);
        else return null;
      }
      if (segments.length === 1 && !templates.size) return { segments: segments[0] };
      // Several candidates that are all COLLECTIONS — a generic helper's collection carried
      // on a context object, filled differently by each call site. They stay collections, so
      // `carrier.collection.doc(id)` still resolves to one document of each of them.
      if (
        !templates.size &&
        segments.length > 1 &&
        segments.every((candidate) => !registry.matchSegments(candidate).length &&
          registry.matchSegments([...candidate, ANY]).length)
      ) {
        return { collections: segments.map((candidate) => ({ segments: candidate, canonical: false })) };
      }
      for (const candidate of segments) {
        const matched = registry.matchSegments(candidate);
        if (!matched.length) return null;
        for (const template of matched) templates.add(template);
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    /** A finite alias of PATH_BUILDERS.x — no arbitrary functions or dynamic lookup. */
    function builderNames(expr, depth = 0) {
      if (depth > CARRIER_DEPTH || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        if (isCoreBuilders(facts, node.expression) && builderSegments.has(node.name.text)) return new Set([node.name.text]);
      }
      if (ts.isPropertyAccessExpression(node)) {
        const candidates = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
        const names = new Set();
        for (const candidate of candidates) {
          const resolved = resolverFor(candidate.facts).builderNames(candidate.node, depth + 1);
          // A direct function that always throws cannot produce a path or reach a
          // write. Ignore that finite branch, but keep every branch that can return;
          // an arbitrary/non-returning-looking expression remains unreadable.
          const candidateNode = stripWrappers(candidate.node);
          const alwaysThrows =
            (ts.isArrowFunction(candidateNode) || ts.isFunctionExpression(candidateNode)) &&
            ts.isBlock(candidateNode.body) &&
            candidateNode.body.statements.length === 1 &&
            ts.isThrowStatement(candidateNode.body.statements[0]);
          if (!resolved) {
            if (alwaysThrows) continue;
            return null;
          }
          for (const name of resolved) names.add(name);
        }
        return names.size && names.size <= MAX_CANDIDATES ? names : null;
      }
      if (ts.isConditionalExpression(node)) {
        const left = builderNames(node.whenTrue, depth + 1);
        const right = builderNames(node.whenFalse, depth + 1);
        if (!left || !right) return null;
        const names = new Set([...left, ...right]);
        return names.size <= MAX_CANDIDATES ? names : null;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return builderNames(decl.initializer, depth + 1);
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).builderNames(external.node, depth + 1);
        // A canonical builder handed to a wrapper (`flatLane(PATH_BUILDERS.x, …)`) is still
        // that builder; the wrapper is the single owner of the lane's shape, not a disguise.
        const supplied = parameterValues(node);
        if (!supplied) return null;
        const names = new Set();
        for (const value of supplied) {
          const resolved = resolverFor(value.facts).builderNames(value.node, depth + 1);
          if (!resolved) return null;
          for (const name of resolved) names.add(name);
        }
        return names.size && names.size <= MAX_CANDIDATES ? names : null;
      }
      if (ts.isElementAccessExpression(node)) {
        const properties = objectProperties(node.expression, depth + 1);
        if (!properties) return null;
        const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
        const literal = index ? computedKeyName(index, facts, source) : null;
        const candidates = literal ? properties.get(literal) ?? null : [...properties.values()].flat();
        if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
        const names = new Set();
        for (const candidate of candidates) {
          const resolved = resolverFor(candidate.facts).builderNames(candidate.node, depth + 1);
          const candidateNode = stripWrappers(candidate.node);
          const alwaysThrows =
            (ts.isArrowFunction(candidateNode) || ts.isFunctionExpression(candidateNode)) &&
            ts.isBlock(candidateNode.body) &&
            candidateNode.body.statements.length === 1 &&
            ts.isThrowStatement(candidateNode.body.statements[0]);
          if (!resolved) {
            if (alwaysThrows) continue;
            return null;
          }
          for (const name of resolved) names.add(name);
        }
        return names.size && names.size <= MAX_CANDIDATES ? names : null;
      }
      return null;
    }

    /**
     * The canonical builder pattern preserves literal call arguments at their
     * corresponding path slots. Unknown/missing arguments remain ANY, so this is
     * only more precise than the existing conservative builderSegments fallback.
     */
    function segmentsForBuilderCall(name, args) {
      const pattern = registry.builderPatterns.get(name);
      if (!pattern) return builderSegments.get(name) ?? null;
      return pattern.map((segment) =>
        segment.t === 'arg' ? (args[segment.index] ? segmentOf(args[segment.index]) : ANY) : segment,
      );
    }

    /**
     * `MAP[selector].builder(args)` where MAP is a canonical core const map of path
     * builders. The builder is INVOKED with sentinels exactly as PATH_BUILDERS is, so the
     * literal segments it owns are preserved and the argument slots take the call's own
     * arguments. Returns one segment set, a bounded set of collections, or their templates.
     */
    function coreMapBuilderCall(node, state) {
      const callee = stripWrappers(node.expression);
      if (!ts.isPropertyAccessExpression(callee)) return null;
      // `const paths = MAP[type]; paths.subItem(...)` — the lookup is normally named once
      // and used several times, so follow the declaration back to it.
      let base = stripParens(callee.expression);
      for (let hop = 0; hop < 8 && ts.isIdentifier(base); hop++) {
        const decl = nearestDecl(base.text, base.pos, base);
        if (!decl?.initializer) return null;
        base = stripParens(stripWrappers(decl.initializer));
      }
      if (!ts.isElementAccessExpression(base)) return null;
      const entries = coreMapEntries(base, facts, source);
      if (!entries?.length || entries.length > MAX_CANDIDATES) return null;

      const built = [];
      for (const entry of entries) {
        const builder = entry && typeof entry === 'object' ? entry[callee.name.text] : null;
        if (typeof builder !== 'function') return null;
        const sentinels = Array.from(
          { length: Math.max(builder.length, node.arguments.length, 4) },
          (_, index) => `__GUARD_ARG_${index}__`,
        );
        let produced;
        try {
          produced = builder(...sentinels);
        } catch {
          return null;
        }
        if (!Array.isArray(produced)) return null;
        built.push(
          produced.map((segment) => {
            const index = sentinels.indexOf(segment);
            if (index >= 0) return node.arguments[index] ? segmentOf(node.arguments[index]) : ANY;
            return typeof segment === 'string' && segment ? LIT(segment) : ANY;
          }),
        );
      }
      if (!built.length) return null;
      state.usedBuilder = true;
      if (built.length === 1) return { segments: built[0] };
      if (built.every((segments) => segments.length % 2 === 1)) {
        return { collections: built.map((segments) => ({ segments, canonical: true })) };
      }
      const templates = new Set();
      for (const segments of built) {
        const matched = registry.matchSegments(segments);
        if (!matched.length) return null;
        for (const template of matched) templates.add(template);
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    /**
     * Is this expression the core's own `COLLECTION_REFS` — imported from the core, under any local
     * name? A local or foreign object that merely shares the name refers to whatever its own
     * functions return, so it is never read as the canonical registry (the `isCoreBuilders` rule).
     */
    function isCollectionRefsBase(expr) {
      const node = stripWrappers(expr);
      if (!ts.isIdentifier(node)) return false;
      const imported = facts.imports.get(node.text);
      return Boolean(
        imported?.imported === 'COLLECTION_REFS' && isCoreImport(facts, imported),
      );
    }

    /** Preserve literal call arguments at their slots, exactly as builder calls do. */
    function segmentsForCollectionRefCall(name, args) {
      const pattern = registry.collectionRefPatterns.get(name);
      if (!pattern) return registry.collectionRefSegments.get(name) ?? null;
      return pattern.map((segment) =>
        segment.t === 'arg' ? (args[segment.index] ? segmentOf(args[segment.index]) : ANY) : segment,
      );
    }

    /**
     * The SEGMENTS a `.collection(<arg>)` argument names. A canonical collection path is
     * several segments (`orders/{id}/orderLines`), so collapsing the argument
     * to one segment would match the wrong template — or none.
     */
    function collectionArgumentSegments(expr, state, depth) {
      const node = stripWrappers(expr);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toPath') {
        const inner = node.arguments[0] ? stripWrappers(node.arguments[0]) : null;
        if (!inner) return null;
        const resolved = resolve(inner, state, depth + 1);
        if (resolved?.segments) return resolved.segments;
        return segmentsFromArray(inner, state, depth + 1);
      }
      if (ts.isElementAccessExpression(node)) {
        const outer = collectionArgumentSegments(node.expression, state, depth + 1);
        if (!outer) return null;
        const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
        if (!index || !ts.isNumericLiteral(index)) return null;
        const segment = outer[Number(index.text)];
        return segment ? [segment] : null;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        isCollectionRefsBase(node.expression.expression) &&
        registry.collectionRefSegments.has(node.expression.name.text)
      ) {
        const segments = segmentsForCollectionRefCall(node.expression.name.text, node.arguments);
        if (segments) state.usedBuilder = true;
        return segments;
      }
      if (ts.isArrayLiteralExpression(node)) return segmentsFromArray(node, state, depth + 1);
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return collectionArgumentSegments(decl.initializer, state, depth + 1);
      }
      return null;
    }

    /** Segments for a `toPath([...])` / path-array expression. */
    function segmentsFromArray(expr, state, depth) {
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        const segments = [];
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) {
            const inner = resolve(element.expression, state, depth + 1);
            if (!inner || !inner.segments) return null;
            segments.push(...inner.segments);
          } else {
            segments.push(segmentOf(element));
          }
        }
        return segments;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return segmentsFromArray(decl.initializer, state, depth + 1);
      }
      const resolved = resolve(node, state, depth + 1);
      return resolved && resolved.segments ? resolved.segments : null;
    }

    /**
     * Segments for a string / template-literal path. The template is flattened into one
     * pattern string with a marker per interpolation, then split on `/`, so a segment that
     * MIXES text and an expression (`prefix_${id}`) resolves to an unknown id rather than a
     * name the guard would then match against the wrong template.
     */
    function segmentsFromLiteralPath(node) {
      let pattern;
      const expressions = [];
      if (ts.isStringLiteralLike(node)) {
        pattern = node.text;
      } else if (ts.isTemplateExpression(node)) {
        pattern = node.head.text;
        for (const span of node.templateSpans) {
          expressions.push(span.expression);
          pattern += `${MARKER}${span.literal.text}`;
        }
      } else {
        return null;
      }
      if (!pattern.includes('/') && expressions.length === 0) return null; // a doc id, not a path
      let consumed = 0;
      return pattern.split('/').map((part) => {
        const markers = part.split(MARKER).length - 1;
        const owned = expressions.slice(consumed, consumed + markers);
        consumed += markers;
        if (markers === 0) return LIT(part);
        if (markers === 1 && part === MARKER) return segmentOf(owned[0]);
        return ANY;
      });
    }

    /** Resolve `event.data.ref` only for a statically declared Firestore document trigger. */
    function resolveTriggerRef(node) {
      const candidate = stripWrappers(node);
      if (
        !ts.isPropertyAccessExpression(candidate) ||
        candidate.name.text !== 'data' ||
        !ts.isIdentifier(candidate.expression)
      ) return null;
      const trigger = facts.triggerEvents.find(
        (entry) => entry.name === candidate.expression.text && encloses(entry.scope, candidate),
      );
      if (!trigger) return null;
      const segments = segmentsFromLiteralPath(stripWrappers(trigger.documentExpression));
      return segments ? { segments } : null;
    }

    /**
     * Resolve a reference expression.
     * @returns {{ segments?: Array, templates?: Set<string>, handBuilt?: boolean,
     *            usedBuilder?: boolean, reason?: string } | null}
     */
    function resolve(expr, state, depth = 0) {
      if (!expr) return null;
      if (depth > RESOLVE_DEPTH) return ceiling();
      const node = stripWrappers(expr);

      // toPath([...]) / toPath(PATH_BUILDERS.x(...))
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toPath') {
        const segments = segmentsFromArray(node.arguments[0], state, depth);
        if (segments) return { segments };
        // `toPath` only joins the segments it is handed, so whatever they resolved to —
        // one document, a bounded set of templates, or a bounded set of COLLECTIONS —
        // passes straight through.
        const inner = resolve(node.arguments[0], state, depth + 1);
        return inner?.templates || inner?.collections ? inner : null;
      }

      // PATH_BUILDERS.x(...)
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        isCoreBuilders(facts, node.expression.expression)
      ) {
        const name = node.expression.name.text;
        const segments = segmentsForBuilderCall(name, node.arguments);
        if (!segments) return null;
        state.usedBuilder = true;
        return { segments: [...segments] };
      }

      // COLLECTION_REFS.x(...) — the canonical COLLECTION path builder. Its result is a
      // collection, so `…doc()` mints an auto-id and `…doc(id)` addresses one document of
      // it; neither is a hand-built path.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        isCollectionRefsBase(node.expression.expression) &&
        registry.collectionRefSegments.has(node.expression.name.text)
      ) {
        const segments = segmentsForCollectionRefCall(node.expression.name.text, node.arguments);
        if (!segments) return null;
        state.usedBuilder = true;
        return { segments: [...segments] };
      }

      // A canonical core const map whose entries hold PATH BUILDER FUNCTIONS —
      // `PATHS_BY_KIND[kind].item(...)`. This is the same
      // "one owner switches on the type" shape as PATH_BUILDERS itself, so it is derived
      // the same way: the live function is called with sentinels and its output slots read.
      // Every entry the selector can choose stays a candidate.
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const fromCoreMap = coreMapBuilderCall(node, state);
        if (fromCoreMap) return fromCoreMap;
      }

      // A finite config-selected alias such as
      // `const path = modern ? PATH_BUILDERS.a : PATH_BUILDERS.b; path(id)`.
      // Every possible builder remains a target candidate; a key must fit all of them.
      if (ts.isCallExpression(node)) {
        const names = builderNames(node.expression);
        if (names) {
          const templates = new Set();
          for (const name of names) {
            const segments = builderSegments.get(name);
            const matched = segments && registry.matchSegments(segments);
            if (!matched?.length) return null;
            for (const template of matched) templates.add(template);
          }
          if (!templates.size || templates.size > MAX_CANDIDATES) return null;
          state.usedBuilder = true;
          return { templates };
        }
      }

      // <base>.doc(...) / <base>.collection(...)
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'doc' || method === 'collection') {
          const base = node.expression.expression;
          let baseSegments = null;
          const resolvedBase = resolve(base, state, depth + 1);
          if (resolvedBase && resolvedBase.segments) baseSegments = resolvedBase.segments;
          else if (resolvedBase && resolvedBase.collections) {
            // A COLLECTION arriving as a parameter. `param.doc(id)` is one document of each
            // collection a call site can pass; every one of them stays a candidate.
            if (method === 'collection') return null;
            if (node.arguments.length === 0) state.autoId = true;
            const tail = node.arguments.length === 0 ? ANY : segmentOf(stripWrappers(node.arguments[0]));
            // A preset id on a CANONICAL collection is a canonical document, not a
            // hand-built path — the builder owns the collection either way.
            if (resolvedBase.collections.every((candidate) => candidate.canonical)) state.usedBuilder = true;
            const templates = new Set();
            for (const collection of resolvedBase.collections) {
              for (const template of registry.matchSegments([...collection.segments, tail])) templates.add(template);
            }
            return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
          }
          else if (resolvedBase && resolvedBase.templates) return null; // a doc handle cannot own a subcollection chain we can name
          else if (isFirestoreRoot(base)) baseSegments = [];
          if (!baseSegments) return null;

          if (method === 'collection') {
            // A collection reference is not itself a document path: minting an auto-id
            // (`collection(COLLECTIONS.X).doc().id`) and building a collection for a query
            // are explicitly NOT hand-built paths. A canonical COLLECTION_REFS argument
            // names SEVERAL segments, so it is expanded rather than collapsed to one.
            const canonical = collectionArgumentSegments(node.arguments[0], state, depth);
            if (canonical?.length) return { segments: [...baseSegments, ...canonical] };
            // A per-work-type path RESOLVER (`workSubItemCollectionPath(type, …)`) is the
            // one owner of that routing — it switches on the type and returns a canonical
            // builder's path. Its result is the collection, however many segments it names.
            const resolved = resolve(node.arguments[0], state, depth + 1);
            if (resolved?.segments?.length && resolved.segments.length % 2 === 1) {
              return { segments: [...baseSegments, ...resolved.segments] };
            }
            if (resolved?.collections?.length) {
              return {
                collections: resolved.collections.map((candidate) => ({
                  segments: [...baseSegments, ...candidate.segments],
                  canonical: candidate.canonical,
                })),
              };
            }
            const named = segmentOf(node.arguments[0]);
            if (named.t === 'any' && node.arguments[0]) {
              // A collection NAME chosen from a bounded set — a scrub that runs the same
              // pass over `[PENDING_MEDIA, PENDING_MEDIA_ARCHIVE]`, or a name held on a
              // canonical config object. Every name stays a candidate.
              const names = literalStringCandidates(node.arguments[0]);
              if (names?.length === 1) return { segments: [...baseSegments, LIT(names[0])] };
              if (names?.length) {
                return {
                  collections: names.map((name) => ({
                    segments: [...baseSegments, LIT(name)],
                    canonical: Boolean(state.usedBuilder),
                  })),
                };
              }
            }
            return { segments: [...baseSegments, named] };
          }
          if (node.arguments.length === 0) {
            state.autoId = true;
            return { segments: [...baseSegments, ANY] };
          }
          const argument = stripWrappers(node.arguments[0]);
          // `db.doc(<path>)` — one argument that IS a whole path.
          if (baseSegments.length === 0) {
            const literal = segmentsFromLiteralPath(argument);
            if (literal) {
              state.literalPath = true;
              return { segments: literal };
            }
            const inner = resolve(argument, state, depth + 1);
            if (inner && inner.segments) return { segments: inner.segments };
            if (inner && inner.templates) return inner;
            return null;
          }
          state.manualDocId = true;
          return { segments: [...baseSegments, segmentOf(argument)] };
        }
      }

      // `doc.ref.parent.parent` — the document a subcollection document sits under: each
      // candidate template with its last collection and id dropped, itself a registered one.
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === 'parent' &&
        ts.isPropertyAccessExpression(stripWrappers(node.expression)) &&
        stripWrappers(node.expression).name.text === 'parent'
      ) {
        const child = resolve(stripWrappers(node.expression).expression, state, depth + 1);
        const childTemplates = !child
          ? null
          : child.templates
            ? [...child.templates]
            : child.segments
              ? registry.matchSegments(child.segments)
              : child.group && child.document !== false
                ? registry.templatesForGroup(child.group)
                : null;
        if (!childTemplates?.length) return null;
        const parents = new Set();
        for (const template of childTemplates) {
          const parent = template.split('/').slice(0, -2).join('/');
          if (!registry.templates.includes(parent)) return null;
          parents.add(parent);
        }
        return parents.size && parents.size <= MAX_CANDIDATES ? { templates: parents } : null;
      }

      // snapshot.ref / change.after.ref / a carrier object's `.ref`
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'ref') {
        return (
          resolveTriggerRef(node.expression) ??
          resolveSnapshot(node.expression, state, depth + 1) ??
          resolveForeignCandidates(staticPropertyCandidates(node.expression, 'ref'), state, depth + 1) ??
          resolve(node.expression, state, depth + 1)
        );
      }

      // A statically-declared carrier property may itself hold a reference or canonical path.
      if (ts.isPropertyAccessExpression(node)) {
        const values = staticPropertyCandidates(node.expression, node.name.text);
        if (values) return resolveForeignCandidates(values, state, depth + 1);
      }

      // A path STRING — a helper that returns one, or a literal handed to `db.doc(…)`.
      if (ts.isTemplateExpression(node) || ts.isStringLiteralLike(node)) {
        const segments = segmentsFromLiteralPath(node);
        if (!segments) return null;
        state.literalPath = true;
        return { segments };
      }

      // `cond ? refA : refB` — both branches are possible targets. An explicit
      // `undefined`/`null` branch is not one: an optional ref is guarded before it is
      // dereferenced, so that branch can never reach a write.
      if (ts.isConditionalExpression(node)) {
        const isNullish = (value) => {
          const branch = stripWrappers(value);
          return (
            branch.kind === ts.SyntaxKind.NullKeyword ||
            branch.kind === ts.SyntaxKind.UndefinedKeyword ||
            (ts.isIdentifier(branch) && branch.text === 'undefined')
          );
        };
        const live = [node.whenTrue, node.whenFalse].filter((branch) => !isNullish(branch));
        if (!live.length) return null;
        const branches = live.map((branch) => resolve(branch, state, depth + 1));
        if (branches.some((branch) => !branch)) return null;
        const templates = new Set();
        for (const branch of branches) {
          if (branch.templates) for (const template of branch.templates) templates.add(template);
          else if (branch.segments) {
            const matched = registry.matchSegments(branch.segments);
            if (!matched.length) return null;
            for (const template of matched) templates.add(template);
          } else return null;
        }
        return { templates };
      }

      // `refs[i]` — one element of an array of references built by a `.map(...)`.
      if (ts.isElementAccessExpression(node)) {
        return resolveArrayElement(node.expression, state, depth + 1);
      }

      // `{ data: () => ev, ref: snap.ref }` — a carrier object built around a document.
      if (ts.isObjectLiteralExpression(node)) {
        const property = node.properties.find(
          (candidate) =>
            (ts.isPropertyAssignment(candidate) || ts.isShorthandPropertyAssignment(candidate)) &&
            candidate.name &&
            ts.isIdentifier(candidate.name) &&
            candidate.name.text === 'ref',
        );
        if (!property) return null;
        return resolve(
          ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer,
          state,
          depth + 1,
        );
      }

      // A query narrows a collection; it never changes WHICH collection it is.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        QUERY_PASSTHROUGH.has(node.expression.name.text)
      ) {
        return resolve(node.expression.expression, state, depth + 1);
      }

      // `db.collectionGroup(name)` — the collection NAME is known, its parents are not.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'collectionGroup'
      ) {
        return { group: segmentOf(node.arguments[0]) };
      }

      // `entry.build(id)` — the callee is a path builder held on a lane-registry entry.
      // Each candidate is either a canonical PATH_BUILDERS alias or a small inline builder
      // whose returns are canonical segments; every lane stays a candidate.
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(stripWrappers(node.expression))) {
        const callee = stripWrappers(node.expression);
        const candidates = staticPropertyCandidates(callee.expression, callee.name.text, depth + 1);
        if (candidates?.length && candidates.length <= MAX_CANDIDATES) {
          const templates = new Set();
          let ok = true;
          for (const candidate of candidates) {
            const owner = resolverFor(candidate.facts);
            // The entry usually NAMES its builder (`build: replayPathFor`), so
            // follow the name to the declaration before deciding what kind of builder it is.
            let fn = stripWrappers(candidate.node);
            for (let hop = 0; hop < 6 && ts.isIdentifier(fn); hop++) {
              const inner = owner.nearestDecl(fn.text, fn.pos, fn);
              if (!inner?.initializer) break;
              fn = stripWrappers(inner.initializer);
            }
            const alwaysThrows =
              (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
              ts.isBlock(fn.body) &&
              fn.body.statements.length === 1 &&
              ts.isThrowStatement(fn.body.statements[0]);
            if (alwaysThrows) continue;
            if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) {
              const returns = callbackReturns(fn);
              if (!returns.length) {
                ok = false;
                break;
              }
              for (const returned of returns) {
                const resolved = owner.resolveTarget(returned);
                if (!resolved.templates) {
                  ok = false;
                  break;
                }
                for (const template of resolved.templates) templates.add(template);
              }
            } else {
              const names = owner.builderNames(candidate.node, depth + 1);
              if (!names) {
                ok = false;
                break;
              }
              for (const name of names) {
                const segments = builderSegments.get(name);
                const matched = segments && registry.matchSegments(segments);
                if (!matched?.length) {
                  ok = false;
                  break;
                }
                for (const template of matched) templates.add(template);
              }
            }
            if (!ok) break;
          }
          if (ok && templates.size && templates.size <= MAX_CANDIDATES) {
            state.usedBuilder = true;
            return { templates };
          }
        }
      }

      // A call to a function whose returns resolve — a document, a COLLECTION, or a
      // collection GROUP. A helper that owns a query (`activePostsCollection()`,
      // `parentKeyActivationJobsQuery(key)`) is the canonical shape for "one collection,
      // one owner"; losing it forced the writer to inline the collection at every site.
      if (ts.isCallExpression(node)) {
        const target = calleeKey(node);
        const passThrough = target ? returnPassThrough.get(target) : undefined;
        if (passThrough !== undefined && node.arguments[passThrough]) {
          return resolve(node.arguments[passThrough], state, depth + 1);
        }
        if (target && returnTargets.has(target)) {
          const templates = returnTargets.get(target);
          if (templates?.size && templates.size <= MAX_CANDIDATES) return { templates: new Set(templates) };
        }
        if (target && returnCollections.has(target)) {
          const collections = [...returnCollections.get(target)].map((value) => JSON.parse(value));
          if (collections.every((candidate) => candidate.canonical)) state.usedBuilder = true;
          if (collections.length === 1) return { segments: collections[0].segments };
          if (collections.length && collections.length <= MAX_CANDIDATES) return { collections };
        }
        if (target && returnGroups.has(target)) {
          const groups = [...returnGroups.get(target)];
          if (groups.length === 1) return { group: LIT(groups[0]) };
        }
        return null;
      }

      if (ts.isIdentifier(node)) {
        // EVERY in-scope declaration/assignment that could be live here, not just the
        // nearest: `let ref; if (a) ref = X; else ref = Y;` writes to either document, and
        // one unresolvable branch makes the whole target unresolved.
        const candidates = visibleDecls(node.text, node.pos, node);
        if (candidates.length) {
          const segments = [];
          const templates = new Set();
          for (const decl of candidates) {
            const inner = decl.initializer
              ? resolve(decl.initializer, state, depth + 1)
              : isPropertyBinding(decl)
                ? resolveForeignCandidates(boundValues(decl, depth + 1), state, depth + 1)
                : decl.indexOf !== undefined
                  ? resolveIndexedElement(decl.indexOf, decl.bindingIndex, state, depth + 1)
                  : decl.iterOf
                    ? resolveDocElement(decl.iterOf, state, depth + 1)
                    : null;
            if (!inner) return null;
            if (inner.templates) for (const template of inner.templates) templates.add(template);
            else if (inner.segments) segments.push(inner.segments);
            else return inner;
          }
          if (segments.length === 1 && !templates.size) return { segments: segments[0] };
          for (const set of segments) {
            const matched = registry.matchSegments(set);
            if (!matched.length) return null;
            for (const template of matched) templates.add(template);
          }
          return templates.size ? { templates } : null;
        }
        // A module constant imported from another swept file — a canonical path string
        // shared between a walker and its writer is still that path.
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).resolve(external.node, state, depth + 1);
        const owner = enclosingFunction(node, node.text);
        if (owner) {
          const params = facts.functions.get(owner.name)?.params ?? [];
          const index = params.findIndex((parameter) => parameter.name === node.text);
          if (index >= 0) {
            const key = paramKey(facts.relPath, owner.name, index);
            const known = paramTargets.get(key);
            if (known && known.size) return { templates: new Set(known) };
            // A COLLECTION-shaped parameter: `archiveSweep(sourceCollection, …)` writes
            // through `doc.ref`, which is that collection plus ANY id. Every collection a
            // call site passes stays a candidate.
            const collections = paramCollections.get(key);
            if (collections && collections.size && collections.size <= MAX_CANDIDATES) {
              const parsed = [...collections].map((value) => JSON.parse(value));
              if (parsed.every((candidate) => candidate.canonical)) state.usedBuilder = true;
              return { collections: parsed };
            }
            const groups = paramGroups.get(key);
            if (groups && groups.size === 1) return { group: LIT([...groups][0]) };
            return { reason: `parameter '${node.text}' of ${owner.name}() — no call site resolved it` };
          }
        }
        return null;
      }

      return null;
    }

    /** ONE indexed element of a directly readable tuple — `Promise.all([a, b, c])[i]`. */
    function resolveIndexedElement(expr, index, state, depth) {
      if (depth > RESOLVE_DEPTH || index === undefined) return null;
      const node = stripWrappers(expr);
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === 'all' || node.expression.name.text === 'allSettled') &&
        node.arguments.length === 1
      ) {
        return resolveIndexedElement(node.arguments[0], index, state, depth + 1);
      }
      if (ts.isArrayLiteralExpression(node)) {
        const element = node.elements[index];
        return element && !ts.isSpreadElement(element) ? resolve(element, state, depth + 1) : null;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return resolveIndexedElement(decl.initializer, index, state, depth + 1);
      }
      return null;
    }

    /** A snapshot expression back to the DOCUMENT it describes. */
    function resolveSnapshot(expr, state, depth) {
      if (depth > RESOLVE_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'get') {
          // A provable Map's `.get(key)` reads an entry, not a document.
          if (node.arguments.length === 1 && mapEntryValues(node.expression.expression, depth + 1)) return null;
          // tx.get(ref) / ref.get()
          if (node.arguments.length === 1) return resolve(node.arguments[0], state, depth + 1);
          return resolve(node.expression.expression, state, depth + 1);
        }
        if (PROMISE_PASSTHROUGH.has(method)) return resolveSnapshot(node.expression.expression, state, depth + 1);
        if (method === 'getAll') return null; // several refs, one call — not one document
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer) return resolveSnapshot(decl.initializer, state, depth + 1);
        if (decl && decl.iterOf) return resolveDocElement(decl.iterOf, state, depth + 1);
        // `const [snap] = await Promise.all([transaction.get(query)])` — that index's entry.
        if (decl && decl.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? resolveSnapshot(entry, state, depth + 1) : null;
        }
        // `const { snapshot } = await readThing(tx)` — every value the property can hold.
        if (isPropertyBinding(decl)) {
          const values = boundValues(decl, depth + 1);
          if (!values?.length) return null;
          return mergeDocCandidates(values, (value) => resolverFor(value.facts).resolveSnapshot(value.node, state, depth + 1));
        }
        if (!decl) {
          // A SNAPSHOT passed into a helper — the BACKEND-101 shape, where the caller reads
          // the document in the reads phase and hands the snapshot down so the helper can
          // write through `snap.ref` without a second read.
          const supplied = parameterValues(node);
          if (supplied?.length) {
            const templates = new Set();
            for (const value of supplied) {
              const inner = resolverFor(value.facts).resolveSnapshot(value.node, state, depth + 1);
              if (!inner) return null;
              if (inner.templates) for (const template of inner.templates) templates.add(template);
              else if (inner.segments) {
                const matched = registry.matchSegments(inner.segments);
                if (!matched.length) return null;
                for (const template of matched) templates.add(template);
              } else return null;
            }
            return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
          }
        }
      }
      // `change.after` / `change.before` on a Firestore trigger.
      if (ts.isPropertyAccessExpression(node) && (node.name.text === 'after' || node.name.text === 'before')) {
        return resolveSnapshot(node.expression, state, depth + 1);
      }
      return null;
    }

    /** One element of an ARRAY of references — `refs = targets.map((t) => db.doc(…))`. */
    function resolveArrayElement(expr, state, depth) {
      if (depth > RESOLVE_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        const templates = new Set();
        for (const element of node.elements) {
          const inner = resolve(element, state, depth + 1);
          if (!inner) return null;
          if (inner.templates) for (const template of inner.templates) templates.add(template);
          else if (inner.segments) {
            const matched = registry.matchSegments(inner.segments);
            if (!matched.length) return null;
            for (const template of matched) templates.add(template);
          } else return null;
        }
        return templates.size ? { templates } : null;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
            if (!ts.isBlock(callback.body)) return resolve(callback.body, state, depth + 1);
            const returns = [];
            const collect = (inner) => {
              if (inner !== callback && ts.isFunctionLike(inner)) return;
              if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
              ts.forEachChild(inner, collect);
            };
            ts.forEachChild(callback.body, collect);
            return returns.length === 1 ? resolve(returns[0], state, depth + 1) : null;
          }
          return null;
        }
        if (ARRAY_PASSTHROUGH.has(method)) return resolveArrayElement(node.expression.expression, state, depth + 1);
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'docs') {
        return resolveDocElement(node, state, depth + 1);
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer) return resolveArrayElement(decl.initializer, state, depth + 1);
      }
      // A snapshot ARRAY — `db.getAll(...)`, `snap.docs` — is an array of documents.
      return resolveDocElement(node, state, depth + 1);
    }

    /**
     * One DOCUMENT out of an iterable of snapshots — `for (const doc of snap.docs)`,
     * `snap.docs.map(d => d.ref)`, `chunk.slice(0, 450)`. The element is a document of the
     * queried collection, so its target is that collection plus an unknown id.
     */
    function resolveDocElement(expr, state, depth) {
      if (depth > RESOLVE_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'docs') {
        const collection = resolve(node.expression, state, depth + 1);
        if (collection && collection.segments) return { segments: [...collection.segments, ANY] };
        if (collection && collection.group) return { group: collection.group, document: true };
        if (collection && collection.collections) return templatesFromCollections(collection.collections);
        // A snapshot that already resolved to document templates (a collection-GROUP query,
        // or a helper that returned one) IS the set of documents being iterated.
        if (collection && collection.templates) return { templates: collection.templates };
        const snapshot = resolveSnapshot(node.expression, state, depth + 1);
        if (snapshot && snapshot.segments) return { segments: [...snapshot.segments, ANY] };
        if (snapshot && snapshot.group) return { group: snapshot.group, document: true };
        if (snapshot && snapshot.collections) return templatesFromCollections(snapshot.collections);
        if (snapshot && snapshot.templates) return snapshot;
        return null;
      }
      // `db.getAll(refA, refB)` hands back one snapshot per reference, so the element is
      // any one of those documents. Every argument stays a candidate.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'getAll'
      ) {
        const templates = new Set();
        for (const argument of node.arguments) {
          // `db.getAll(...refs)` — the spread's ARRAY holds the references.
          const resolved = ts.isSpreadElement(argument)
            ? resolveArrayElement(argument.expression, state, depth + 1)
            : resolve(argument, state, depth + 1);
          if (!resolved) return null;
          if (resolved.templates) for (const template of resolved.templates) templates.add(template);
          else if (resolved.segments) {
            const matched = registry.matchSegments(resolved.segments);
            if (!matched.length) return null;
            for (const template of matched) templates.add(template);
          } else return null;
        }
        return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        PROMISE_PASSTHROUGH.has(node.expression.name.text)
      ) {
        return resolveDocElement(node.expression.expression, state, depth + 1);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ARRAY_PASSTHROUGH.has(node.expression.name.text)) {
        return resolveDocElement(node.expression.expression, state, depth + 1);
      }
      // `await Promise.all(ids.map((id) => col.doc(id).get()))` — a batch of single-document
      // reads. Each element is the snapshot of the reference the callback built.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === 'all' || node.expression.name.text === 'allSettled') &&
        node.arguments.length === 1
      ) {
        return resolveDocElement(node.arguments[0], state, depth + 1);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === 'map' || node.expression.name.text === 'flatMap')
      ) {
        const callback = node.arguments[0];
        if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return null;
        const returns = callbackReturns(callback);
        if (returns.length !== 1) return null;
        return resolveSnapshot(returns[0], state, depth + 1) ?? resolve(returns[0], state, depth + 1);
      }
      if (ts.isElementAccessExpression(node)) return resolveDocElement(node.expression, state, depth + 1);
      // `[refA, refB]` — each entry is one of the documents; an empty array holds none.
      if (ts.isArrayLiteralExpression(node)) {
        // An entry must be a reference; an object entry is a carrier, which only the carrier
        // path reads — with its spreads, which can replace the ref it seems to hold.
        if (node.elements.some((element) => ts.isObjectLiteralExpression(stripWrappers(element)))) return null;
        return mergeDocCandidates(node.elements.map((element) => ({ facts, node: element })), (value) => {
          // `[...a.docs, ...b.docs]` — a spread adds the documents of a readable array.
          if (ts.isSpreadElement(value.node)) {
            return resolverFor(value.facts).resolveDocElement(value.node.expression, state, depth + 1);
          }
          // An entry is a reference itself; a COLLECTION reference is not a document.
          const resolved = resolverFor(value.facts).resolve(value.node, state, depth + 1);
          return resolved?.collections ? null : resolved;
        });
      }
      // `read.pendingRefs` — an array a reader handed back on its result: the documents are
      // the elements of every value that property can hold.
      if (ts.isPropertyAccessExpression(node)) {
        const values = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (values?.length) {
          return mergeDocCandidates(values, (value) => resolverFor(value.facts).resolveDocElement(value.node, state, depth + 1));
        }
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer) return resolveDocElement(decl.initializer, state, depth + 1);
        if (decl && decl.iterOf) return resolveDocElement(decl.iterOf, state, depth + 1);
        if (!decl) {
          // A PAGE of snapshots handed to a generic helper (`deleteContentDocsWithMedia(ctx,
          // snap.docs, …)`): the documents are the queried collection's, and every call site's
          // collection stays a candidate.
          const supplied = parameterValues(node);
          if (supplied?.length) {
            const templates = new Set();
            for (const value of supplied) {
              const inner = resolverFor(value.facts).resolveDocElement(value.node, state, depth + 1);
              if (!inner) return null;
              if (inner.templates) for (const template of inner.templates) templates.add(template);
              else if (inner.segments) {
                const matched = registry.matchSegments(inner.segments);
                if (!matched.length) return null;
                for (const template of matched) templates.add(template);
              } else if (inner.group) {
                for (const template of registry.templatesForGroup(inner.group)) templates.add(template);
              } else return null;
            }
            return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
          }
        }
      }
      // QuerySnapshot.forEach(doc => …) hands the callback one document. The same
      // provenance covers a typed `const docs: QueryDocumentSnapshot[] = snap.docs` loop.
      const snapshot = resolveSnapshot(node, state, depth + 1);
      if (snapshot?.segments) return { segments: [...snapshot.segments, ANY] };
      if (snapshot?.group) return { group: snapshot.group, document: true };
      if (snapshot?.collections) return templatesFromCollections(snapshot.collections);
      if (snapshot?.templates) return snapshot;
      return null;
    }

    /**
     * The documents a set of candidate values address, each resolved by `resolveOne`. An empty
     * array literal contributes none; any candidate that does not resolve leaves the whole set
     * unresolved, and so does a set no candidate contributed to.
     */
    function mergeDocCandidates(values, resolveOne) {
      const templates = new Set();
      for (const value of values) {
        const node = stripWrappers(value.node);
        if (ts.isArrayLiteralExpression(node) && node.elements.length === 0) continue;
        const resolved = resolveOne(value);
        if (!resolved) return null;
        if (resolved.templates) for (const template of resolved.templates) templates.add(template);
        else if (resolved.segments) {
          const matched = registry.matchSegments(resolved.segments);
          if (!matched.length) return null;
          for (const template of matched) templates.add(template);
        } else if (resolved.group) {
          for (const template of registry.templatesForGroup(resolved.group)) templates.add(template);
        } else if (resolved.collections) {
          const fromCollections = templatesFromCollections(resolved.collections);
          if (!fromCollections) return null;
          for (const template of fromCollections.templates) templates.add(template);
        } else return null;
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    /** Every document template a set of candidate COLLECTIONS can address. */
    function templatesFromCollections(collections) {
      const templates = new Set();
      for (const collection of collections) {
        for (const template of registry.matchSegments([...collection.segments, ANY])) templates.add(template);
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    function isFirestoreRoot(expr) {
      const node = stripWrappers(expr);
      if (ts.isIdentifier(node)) return ROOT_NAME.test(node.text);
      if (ts.isPropertyAccessExpression(node)) return ROOT_NAME.test(node.name.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return ROOT_NAME.test(node.expression.text);
      return false;
    }

    /** `fnKey` for a call whose callee is a local or relatively-imported function. */
    function calleeKey(call) {
      const callee = stripWrappers(call.expression);
      if (!ts.isIdentifier(callee)) return null;
      const name = callee.text;
      if (facts.functions.has(name)) return fnKey(facts.relPath, name);
      const imported = facts.imports.get(name);
      if (!imported) return null;
      const file = declaringFile(resolveImport(facts.relPath, imported.module), imported.imported);
      return file ? fnKey(file, imported.imported) : null;
    }

    /**
     * Resolve a reference expression to templates, with provenance flags.
     * `collectionAdd` marks `collectionRef.add(data)`, whose target is one auto-id document
     * of that collection — the same shape as `collection(X).doc()`, so never a hand-built path.
     */
    function resolveTarget(expr, { collectionAdd = false } = {}) {
      const state = {};
      hitCeiling = false;
      let result = resolve(expr, state, 0);
      const capped = hitCeiling;
      if (collectionAdd && result && result.segments) {
        result = { ...result, segments: [...result.segments, ANY] };
      }
      const handBuilt = Boolean((state.manualDocId || state.literalPath) && !state.usedBuilder);
      const shown = () => expr.getText(source).replace(/\s+/g, ' ').slice(0, 70);
      if (!result) return { templates: null, handBuilt, capped, reason: `target '${shown()}' did not resolve${capped ? ' (analysis ceiling reached)' : ''}` };
      if (result.templates) return { templates: result.templates, handBuilt, capped, reason: null };
      if (result.collections) {
        return { templates: null, handBuilt, reason: `target '${shown()}' is a COLLECTION reference, not a document` };
      }
      if (result.group) {
        const matched = registry.templatesForGroup(result.group);
        if (!matched.length) {
          return { templates: null, handBuilt, reason: 'collection group matches no registered template' };
        }
        return { templates: new Set(matched), handBuilt, reason: null };
      }
      if (result.segments) {
        const matched = registry.matchSegments(result.segments);
        if (!matched.length) {
          const shown = result.segments.map((segment) => (segment.t === 'lit' ? segment.v : '*')).join('/');
          return { templates: null, handBuilt, reason: `path '${shown}' matches no registered template` };
        }
        return { templates: new Set(matched), handBuilt, reason: null };
      }
      return { templates: null, handBuilt, reason: result.reason ?? 'target expression did not resolve' };
    }

    /**
     * POSITIVE evidence that a VALUE is a non-Firestore container, for call-site
     * propagation into a helper's parameter. Null means "not proven", never "assumed safe".
     */
    function nonFirestoreValue(expr, depth = 0) {
      if (depth > 8 || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        if (NOT_FIRESTORE_CONSTRUCTORS.has(node.expression.text)) return `new ${node.expression.text}()`;
        // Nothing in the Firestore SDKs is constructed with `new` in app code: a
        // reference comes from `db`, a builder, or a query. So an instance of a class
        // imported from any OTHER package is positively not a Firestore handle.
        const imported = facts.imports.get(node.expression.text);
        if (imported && !profile.handleModule.test(imported.module)) {
          return `new ${node.expression.text}() from ${imported.module}`;
        }
      }
      // `NextResponse.json(...)` — a value minted by a NAMESPACE imported from another
      // package. Firestore values come from `db`, a canonical builder, or a query.
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const namespace = stripWrappers(node.expression.expression);
        if (ts.isIdentifier(namespace)) {
          const imported = facts.imports.get(namespace.text);
          if (imported && !profile.handleModule.test(imported.module)) {
            return `${namespace.text}.${node.expression.name.text}() from ${imported.module}`;
          }
        }
      }
      // A local helper that only ever returns non-Firestore values (`getStripeClient()`).
      if (ts.isCallExpression(node) && ts.isIdentifier(stripWrappers(node.expression))) {
        const key = calleeKey(node);
        const known = key ? returnNonFirestore.get(key) : null;
        if (known) return known;
        // A function imported from an npm PACKAGE other than firebase / core. Those two
        // are the only packages in this tree that hand back a Firestore handle; a relative
        // import is excluded precisely because a local helper often does.
        const callee = stripWrappers(node.expression);
        const imported = facts.imports.get(callee.text);
        if (
          imported &&
          !imported.module.startsWith('.') &&
          !imported.module.startsWith('@/') &&
          !profile.handleModule.test(imported.module)
        ) {
          return `${callee.text}() from ${imported.module}`;
        }
      }
      if (ts.isArrayLiteralExpression(node)) return 'an array literal';
      // A table of plain values — text, numbers, functions, and nested tables of the same —
      // holds no Firestore handle: a copy table's message functions are never a write.
      if (ts.isObjectLiteralExpression(node) && isPlainValueTable(node)) return 'a table of plain values';
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        // A `.get()` lookup is evidence only when the CONTAINER resolves to a non-Firestore
        // one. The bare shape proves nothing: a helper that hands back a reference can be
        // called `get` just as easily as a Map can.
        if (method === 'get' || method === 'getAll') {
          const container = nonFirestoreValue(node.expression.expression, depth + 1);
          if (container) return `a .${method}() lookup on ${container}`;
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && NOT_FIRESTORE_FACTORIES.has(node.expression.text)) {
        return `${node.expression.text}()`;
      }
      // `createHash('sha1').update(a).update(b)` — a Hash's `.update` returns the same Hash.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'update' &&
        isHashChain(node.expression.expression)
      ) {
        return 'a Hash';
      }
      // `totals.get(id) ?? new Map()` — either side can be the value, so both must be evidence.
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        const left = nonFirestoreValue(node.left, depth + 1);
        const right = nonFirestoreValue(node.right, depth + 1);
        return left && right ? left : null;
      }
      if (ts.isConditionalExpression(node)) {
        const left = nonFirestoreValue(node.whenTrue, depth + 1);
        const right = nonFirestoreValue(node.whenFalse, depth + 1);
        return left && right ? left : null;
      }
      // `this.held` — a class field is declared with its container, so the declaration
      // says what it is.
      if (
        ts.isPropertyAccessExpression(node) &&
        stripWrappers(node.expression).kind === ts.SyntaxKind.ThisKeyword &&
        facts.classFields.has(node.name.text)
      ) {
        return nonFirestoreValue(facts.classFields.get(node.name.text), depth + 1);
      }
      // Any property of a positively non-Firestore value is itself non-Firestore
      // (`stripe.refunds`, `response.cookies`).
      if (ts.isPropertyAccessExpression(node)) {
        const base = nonFirestoreValue(node.expression, depth + 1);
        if (base) return `the .${node.name.text} of ${base}`;
      }
      // `seenRef.current` — read the PROPERTY's own value. Every candidate must be a
      // non-Firestore container; one unreadable candidate is no evidence at all.
      if (ts.isPropertyAccessExpression(node)) {
        const values = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (values?.length && values.length <= MAX_CANDIDATES) {
          let reason = null;
          for (const value of values) {
            const inner = resolverFor(value.facts).nonFirestoreValue(value.node, depth + 1);
            if (!inner) return null;
            reason ??= inner;
          }
          if (reason) return reason;
        }
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) return nonFirestoreValue(decl.initializer, depth + 1);
        if (decl) return null;
        // A module constant imported from another swept file is what that file declared it as.
        const external = importedValue(facts, node.text);
        if (external) return resolverFor(external.facts).nonFirestoreValue(external.node, depth + 1);
        // A DESTRUCTURED parameter has no name of its own, so the named lookup misses it;
        // fall back to the enclosing function and read the binding off its parameter type.
        const owner = enclosingFunction(node, node.text) ?? enclosingFunction(node);
        if (!owner) return null;
        const params = facts.functions.get(owner.name)?.params ?? [];
        const parameter = params.find((candidate) => candidate.name === node.text);
        if (parameter && NOT_FIRESTORE_TYPE.test(parameter.typeText.trim())) return parameter.typeText.trim();
        // An object-literal method implementing an interface leaves its parameters
        // unannotated; the interface's METHOD SIGNATURE is where their types are declared.
        if (parameter && !parameter.typeText && !facts.ambiguousTypeMethods.has(owner.name)) {
          const declared = facts.typeMethodParams.get(owner.name)?.get(node.text)?.trim();
          if (declared && NOT_FIRESTORE_TYPE.test(declared)) return declared;
        }
        // A DESTRUCTURED parameter carries its type on the object type — `{ stripe }:
        // { stripe: Stripe; … }`. A binding whose declared type is imported from another
        // package is positively not a Firestore handle.
        for (const candidate of params) {
          if (candidate.name) continue;
          const declared = candidate.typeText?.trim() ?? '';
          // Either an inline object type, or a named interface this file declares.
          const inline = new RegExp(`\\b${node.text}\\s*:\\s*([A-Za-z_$][\\w$]*)`).exec(declared);
          const named = facts.typeMembers.get(declared)?.get(node.text);
          const typeName = named ? /^([A-Za-z_$][\w$]*)/.exec(named)?.[1] : inline?.[1];
          const imported = typeName ? facts.imports.get(typeName) : null;
          if (imported && !profile.handleModule.test(imported.module)) {
            return `a ${typeName} from ${imported.module}`;
          }
        }
        const index = params.findIndex((candidate) => candidate.name === node.text);
        return index >= 0 ? paramNotFirestore.get(paramKey(facts.relPath, owner.name, index)) ?? null : null;
      }
      return null;
    }

    /**
     * The COLLECTION an expression names, for call-site propagation into a generic helper.
     * A collection path has an ODD segment count and matches no document template, which is
     * exactly what separates it from a document reference.
     */
    function resolveCollectionSegments(expr) {
      const state = {};
      const result = resolve(expr, state, 0);
      if (!result?.segments || !result.segments.length) return null;
      if (result.segments.length % 2 === 0) return null;
      if (registry.matchSegments(result.segments).length) return null;
      if (!registry.matchSegments([...result.segments, ANY]).length) return null;
      // Whether the collection came from a CANONICAL builder travels with it: a document
      // minted on a canonical collection is not a hand-built path, and that fact must not
      // be lost just because the collection was named once in a helper (ENG-002).
      return { segments: result.segments, canonical: Boolean(state.usedBuilder) };
    }

    /** The document(s) a SNAPSHOT expression read, for a row that is written back. */
    function resolveReadBack(expr) {
      const state = {};
      const snapshot = resolveSnapshot(expr, state, 0) ?? resolve(expr, state, 0);
      if (!snapshot) return null;
      if (snapshot.templates) return { templates: snapshot.templates };
      if (snapshot.segments) {
        const matched = registry.matchSegments(snapshot.segments);
        return matched.length ? { templates: new Set(matched) } : null;
      }
      return null;
    }

    /** The collection-GROUP name an expression names, for the same call-site propagation. */
    function resolveCollectionGroup(expr) {
      const result = resolve(expr, {}, 0);
      return result?.group?.t === 'lit' ? result.group.v : null;
    }

    return {
      resolveTarget,
      resolve,
      resolveCollectionSegments,
      resolveCollectionGroup,
      resolveReadBack,
      isFirestoreRoot,
      isTransactionCallbackParam,
      resolveSnapshot,
      nonFirestoreValue,
      literalStringCandidates,
      parameterValues,
      nearestDecl,
      visibleDecls,
      calleeKey,
      enclosingFunction,
      staticProperty,
      staticPropertyCandidates,
      isPropertyBinding,
      boundValues,
      mapEntryValues,
      literalStringList,
      objectProperties,
      callbackFunctions,
      resolveDocElement,
      correlatedCarrierPairs,
      propertyValuesFromArray,
      arrayEntryExpressions,
      builderNames,
    };
  }

  // ---- payload keys -------------------------------------------------------

  function payloadKeys(hostFacts, hostResolver, expr, isUpdate) {
    const keys = new Set();
    const casts = [];
    /** key -> the literal string values the payload writes, for union narrowing. */
    const literals = new Map();
    /**
     * The canonical core schema EXPORTS whose parse output this payload is, and whether
     * every key came from one. A payload that IS a registered schema's parse output is
     * verified for the template that schema is bound to, by construction.
     */
    let opaque = null;

    const noteLiteral = (key, valueNode) => {
      const value = valueNode ? stripWrappers(valueNode) : null;
      if (!value || !ts.isStringLiteralLike(value)) return;
      if (!literals.has(key)) literals.set(key, new Set());
      literals.get(key).add(value.text);
    };

    const readObject = (node, depth, facts, resolver) => {
      const { source } = facts;
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          readSpread(property.expression, depth + 1, facts, resolver);
          continue;
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          keys.add(property.name.text);
          continue;
        }
        if (ts.isMethodDeclaration(property)) {
          if (ts.isIdentifier(property.name)) keys.add(property.name.text);
          else opaque ??= 'computed method name';
          continue;
        }
        const name = property.name;
        if (!name) {
          opaque ??= 'unnamed property';
          continue;
        }
        if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
          const key = isUpdate ? name.text.split('.')[0] : name.text;
          keys.add(key);
          if (ts.isPropertyAssignment(property)) noteLiteral(key, property.initializer);
          continue;
        }
        if (ts.isComputedPropertyName(name)) {
          const inner = stripWrappers(name.expression);
          const names = computedKeyNames(inner, facts, source, isUpdate);
          if (!names?.length) {
            opaque ??= `computed key ${inner.getText(source).replace(/\s+/g, ' ').slice(0, 60)}`;
            continue;
          }
          for (const literal of names) keys.add(isUpdate ? literal.split('.')[0] : literal);
          continue;
        }
        opaque ??= 'unreadable property name';
      }
    };

    const readSpread = (expr_, depth, facts, resolver) => {
      if (depth > PAYLOAD_DEPTH) {
        opaque ??= 'spread nested too deep';
        return;
      }
      const node = stripWrappers(expr_);
      if (ts.isObjectLiteralExpression(node)) {
        readObject(node, depth, facts, resolver);
        return;
      }
      // ...(cond ? { a } : {}) and ...(cond && { a }) — both branches contribute a key.
      if (ts.isConditionalExpression(node)) {
        readSpread(node.whenTrue, depth + 1, facts, resolver);
        readSpread(node.whenFalse, depth + 1, facts, resolver);
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
      ) {
        readSpread(node.left, depth + 1, facts, resolver);
        readSpread(node.right, depth + 1, facts, resolver);
        return;
      }
      if (
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword
      ) {
        return;
      }
      readValue(node, depth + 1, facts, resolver);
    };

    /** One payload value out of a statically bounded array/callback result. */
    const readArrayElement = (expr_, depth, facts, resolver) => {
      if (depth > PAYLOAD_DEPTH) {
        opaque ??= 'payload callback nested too deep';
        return;
      }
      const node = stripWrappers(expr_);
      if (ts.isArrayLiteralExpression(node)) {
        if (node.elements.length > MAX_CALLBACK_RETURNS) {
          opaque ??= 'payload array has too many candidates';
          return;
        }
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) {
            opaque ??= 'payload array spread is not statically bounded';
            return;
          }
          readValue(element, depth + 1, facts, resolver);
        }
        return;
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
            opaque ??= 'payload callback is not an inline function';
            return;
          }
          const returns = [];
          if (!ts.isBlock(callback.body)) returns.push(callback.body);
          else {
            const collect = (inner) => {
              if (inner !== callback && ts.isFunctionLike(inner)) return;
              if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
              ts.forEachChild(inner, collect);
            };
            ts.forEachChild(callback.body, collect);
          }
          if (!returns.length || returns.length > MAX_CALLBACK_RETURNS) {
            opaque ??= 'payload callback has no bounded return';
            return;
          }
          for (const returned of returns) readValue(returned, depth + 1, facts, resolver);
          return;
        }
        if (ARRAY_PASSTHROUGH.has(method)) {
          readArrayElement(node.expression.expression, depth + 1, facts, resolver);
          return;
        }
      }
      if (ts.isIdentifier(node)) {
        const decl = resolver.nearestDecl(node.text, node.pos, node);
        if (decl?.initializer) {
          readArrayElement(decl.initializer, depth + 1, facts, resolver);
          return;
        }
      }
      // Any other array the resolver can enumerate — a carrier's property, a helper's return,
      // entries pushed one at a time, a Map's values: each entry is read as the payload.
      const entries = resolver.arrayEntryExpressions(node);
      if (entries?.length) {
        for (const entry of entries) readValue(entry.node, depth + 1, entry.facts, resolverFor(entry.facts));
        return;
      }
      opaque ??= 'payload array element is not statically readable';
    };

    /**
     * The keys `Object.fromEntries(list.map((element) => [key, value]))` writes, or null.
     * A key that IS the element reads the list's literal names; a key that is a property of
     * the element reads that property's every value across the list; any other key is read
     * as a computed key.
     */
    const fromEntriesKeys = (argument, facts, resolver, isUpdate) => {
      const mapped = stripWrappers(argument);
      if (
        !ts.isCallExpression(mapped) ||
        !ts.isPropertyAccessExpression(mapped.expression) ||
        mapped.expression.name.text !== 'map'
      ) return null;
      const callback = mapped.arguments[0];
      if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return null;
      const element = callback.parameters[0]?.name;
      if (!element || !ts.isIdentifier(element)) return null;
      const list = mapped.expression.expression;
      const returns = callbackReturns(callback);
      if (!returns.length) return null;
      const names = new Set();
      for (const returned of returns) {
        const entry = stripWrappers(returned);
        if (!ts.isArrayLiteralExpression(entry) || entry.elements.length !== 2) return null;
        const key = stripWrappers(entry.elements[0]);
        let found;
        if (ts.isIdentifier(key) && key.text === element.text) {
          found = resolver.literalStringList(list);
        } else if (
          ts.isPropertyAccessExpression(key) &&
          ts.isIdentifier(stripWrappers(key.expression)) &&
          stripWrappers(key.expression).text === element.text
        ) {
          const values = resolver.propertyValuesFromArray(list, key.name.text);
          if (!values?.length) return null;
          found = [];
          for (const value of values) {
            const inner = computedKeyNames(stripWrappers(value.node), value.facts, value.facts.source, isUpdate);
            if (!inner) return null;
            found.push(...inner);
          }
        } else {
          found = computedKeyNames(key, facts, facts.source, isUpdate);
        }
        if (!found?.length) return null;
        for (const name of found) names.add(name);
      }
      return names.size ? [...names] : null;
    };

    const readValue = (expr_, depth, facts, resolver) => {
      if (depth > PAYLOAD_DEPTH) {
        opaque ??= 'payload nested too deep';
        return;
      }
      const { source } = facts;
      let node = expr_;
      // A cast on the payload is itself a violation AND it hides the shape.
      for (let i = 0; i < 8 && node; i++) {
        // `<Record<string, unknown>>payload` is the same cast as `payload as
        // Record<string, unknown>` — the angle-bracket form was reaching disk unflagged.
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
          const typeText = node.type.getText(source);
          const inner = stripParens(node.expression);
          if (/Record\s*<\s*string\s*,\s*(unknown|any)\s*>/.test(typeText) || /\bany\b/.test(typeText)) {
            casts.push(typeText);
          } else if (ts.isAsExpression(inner) || ts.isTypeAssertionExpression(inner)) {
            casts.push(inner.type.getText(source) + ' as ' + typeText);
          }
          node = node.expression;
        } else if (
          ts.isParenthesizedExpression(node) ||
          ts.isNonNullExpression(node) ||
          ts.isSatisfiesExpression?.(node)
        ) {
          node = node.expression;
        } else if (ts.isAwaitExpression(node)) {
          node = node.expression;
        } else break;
      }
      if (!node) {
        opaque ??= 'empty payload expression';
        return;
      }
      // A `null` or `undefined` candidate stores nothing: writing it throws. A converter's
      // "nothing to copy" branch therefore adds no field, and every other branch is still read.
      if (
        node.kind === ts.SyntaxKind.NullKeyword ||
        node.kind === ts.SyntaxKind.UndefinedKeyword ||
        (ts.isIdentifier(node) && node.text === 'undefined')
      ) {
        return;
      }
      if (ts.isObjectLiteralExpression(node)) {
        readObject(node, depth, facts, resolver);
        return;
      }
      if (ts.isConditionalExpression(node)) {
        readValue(node.whenTrue, depth + 1, facts, resolver);
        readValue(node.whenFalse, depth + 1, facts, resolver);
        return;
      }
      // `entry.patch?.() ?? genericPatch(…)` — an optional patch with a fallback. Both
      // sides are payloads the write can carry, so both are read.
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        readValue(node.left, depth + 1, facts, resolver);
        readValue(node.right, depth + 1, facts, resolver);
        return;
      }
      if (ts.isElementAccessExpression(node)) {
        // A lane/registry table holding PATCHES, looked up by key — the same bounded
        // capability the target resolver already has. Every entry is read; over the bound
        // it fails closed.
        const properties = resolver.objectProperties(node.expression);
        if (properties) {
          const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
          const selector = index ? computedKeyName(index, facts, source) : null;
          const entries = selector !== null
            ? properties.get(selector) ?? null
            : [...properties.values()].flat();
          if (!entries?.length || entries.length > MAX_CANDIDATES) {
            opaque ??= 'payload registry lookup is not statically bounded';
            return;
          }
          for (const entry of entries) {
            readValue(entry.node, depth + 1, entry.facts, resolverFor(entry.facts));
          }
          return;
        }
        readArrayElement(node.expression, depth + 1, facts, resolver);
        return;
      }
      if (ts.isPropertyAccessExpression(node)) {
        // A direct canonical schema's `safeParse(...).data` is the same closed,
        // unknown-key-stripped value as its `.parse(...)` output. The schema identity
        // still has to be an immutable core import: do not trust a local schema,
        // local alias, wrapper, or arbitrary factory merely because it has `safeParse`.
        // The guard checks stored fields, not surrounding control flow; writing `.data`
        // without checking `success` remains a runtime Firestore error.
        const canonicalSafeParseKeys = (property) => {
          if (property.name.text !== 'data') return null;
          let result = stripWrappers(property.expression);
          if (ts.isIdentifier(result)) {
            const decl = resolver.nearestDecl(result.text, result.pos, result);
            if (!decl?.initializer) return null;
            result = stripWrappers(decl.initializer);
          }
          if (!ts.isCallExpression(result) || result.arguments.length !== 1) return null;
          const callee = stripWrappers(result.expression);
          if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'safeParse') return null;
          // `<CanonicalSchema>.pick({ a: true, b: true }).safeParse(x).data` — exactly the
          // picked keys, each of which the canonical schema must itself declare.
          let schema = stripWrappers(callee.expression);
          let picked = null;
          if (
            ts.isCallExpression(schema) &&
            ts.isPropertyAccessExpression(schema.expression) &&
            schema.expression.name.text === 'pick' &&
            schema.arguments.length === 1
          ) {
            const mask = stripWrappers(schema.arguments[0]);
            if (!ts.isObjectLiteralExpression(mask)) return null;
            picked = [];
            for (const property of mask.properties) {
              if (
                !ts.isPropertyAssignment(property) ||
                !(ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ||
                property.initializer.kind !== ts.SyntaxKind.TrueKeyword
              ) return null;
              picked.push(property.name.text);
            }
            schema = stripWrappers(schema.expression.expression);
          }
          // `slot.schema.safeParse(x).data` off `const slot = MAP[kind]`, a core const map whose
          // entries carry each document's schema: every entry the lookup can produce must hold a
          // closed canonical schema a core export names, exactly as the `.parse()` reader asks.
          if (picked === null && ts.isPropertyAccessExpression(schema)) {
            const base = constLookup(stripParens(schema.expression), facts);
            const entries = ts.isElementAccessExpression(base) ? coreMapEntries(base, facts, source) : null;
            const names = entries?.map((entry) =>
              entry && typeof entry === 'object' && !Array.isArray(entry)
                ? registry.canonicalParseName.get(entry[schema.name.text])
                : undefined,
            );
            if (!names?.length || !names.every(Boolean)) return null;
            const keys = new Set();
            for (const name of names) for (const key of registry.canonicalParseKeys.get(name).keys) keys.add(key);
            return { keys };
          }
          if (!ts.isIdentifier(schema)) return null;
          const imported = facts.imports.get(schema.text);
          if (!isCoreImport(facts, imported)) return null;
          const found = registry.canonicalParseKeys.get(imported.imported);
          if (!found) return null;
          if (picked === null) return found;
          if (!picked.length || picked.some((key) => !found.keys.has(key))) return null;
          return { keys: new Set(picked) };
        };
        // `<CanonicalSchema>.parse(input).data` — a NESTED field of a closed canonical
        // core schema's parse output, merge-set as the document patch. The nested
        // schema is the declaration of what that field can hold, so its keys are the
        // written keys; deriving from it is what ENG-005 asks for.
        const canonicalNestedKeys = (property) => {
          const container = stripWrappers(property.expression);
          let parseCall = container;
          if (ts.isIdentifier(container)) {
            const decl = resolver.nearestDecl(container.text, container.pos, container);
            if (!decl?.initializer) return null;
            parseCall = stripWrappers(decl.initializer);
            // The try/catch IIFE shape: the value is what the inline function returns.
            if (ts.isCallExpression(parseCall)) {
              const iife = stripWrappers(parseCall.expression);
              if (ts.isArrowFunction(iife) || ts.isFunctionExpression(iife)) {
                const returns = callbackReturns(iife);
                if (returns.length !== 1) return null;
                parseCall = stripWrappers(returns[0]);
              }
            }
          }
          if (!ts.isCallExpression(parseCall) || parseCall.arguments.length !== 1) return null;
          const parseCallee = stripWrappers(parseCall.expression);
          if (
            !ts.isPropertyAccessExpression(parseCallee) ||
            parseCallee.name.text !== 'parse' ||
            !ts.isIdentifier(stripWrappers(parseCallee.expression))
          ) return null;
          const schemaIdentifier = stripWrappers(parseCallee.expression);
          const imported = facts.imports.get(schemaIdentifier.text);
          if (!isCoreImport(facts, imported)) return null;
          const schema = registry.canonicalParseSchema.get(imported.imported);
          const shape = schema ? objectShape(schema) : null;
          const nested = shape?.[property.name.text];
          if (!nested) return null;
          const nestedKeys = closedCanonicalKeys(nested);
          return nestedKeys && nestedKeys.keys.size ? nestedKeys : null;
        };
        const canonical = canonicalSafeParseKeys(node) ?? canonicalNestedKeys(node);
        if (canonical) {
          for (const key of canonical.keys) keys.add(isUpdate ? key.split('.')[0] : key);
          return;
        }
        const properties = resolver.staticPropertyCandidates(node.expression, node.name.text);
        if (properties) {
          for (const property of properties) {
            readValue(property.node, depth + 1, property.facts, resolverFor(property.facts));
          }
          return;
        }
        // `buildUserReportAdminTaskDoc(...).doc` — a payload built INSIDE a published
        // package, whose source this guard cannot read. Only a reviewed entry naming the
        // exact callee, import specifier and file asserts its output type.
        const packageCall = stripWrappers(node.expression);
        if (ts.isCallExpression(packageCall)) {
          const asserted = packageBuilderKeys(facts, packageCall, node.name.text);
          if (asserted) {
            for (const key of asserted.keys) keys.add(isUpdate ? key.split('.')[0] : key);
            return;
          }
        }
        opaque ??= 'payload expression ' + node.getText(source).slice(0, 60).replace(/\s+/g, ' ');
        return;
      }
      if (ts.isIdentifier(node)) {
        // EVERY visible declaration/assignment, not just the nearest. Target resolution
        // already unions them; reading only the nearest meant `let patch = {a};
        // if (cond) patch = {b};` was checked against half its possible shapes — a
        // silently partial check, which is the one thing worse than no check.
        const visible = resolver.visibleDecls(node.text, node.pos, node);
        const assignments = visible.filter((candidate) => candidate.initializer);
        if (assignments.length) {
          for (const decl of assignments) readValue(decl.initializer, depth + 1, facts, resolver);
          // Fields attached after the declaration (payload.x = …) are written too.
          const earliest = Math.min(...assignments.map((candidate) => candidate.pos));
          for (const assignment of facts.propAssigns.get(node.text) ?? []) {
            if (assignment.pos > earliest) keys.add(isUpdate ? assignment.key.split('.')[0] : assignment.key);
          }
          return;
        }
        const decl = resolver.nearestDecl(node.text, node.pos, node);
        if (resolver.isPropertyBinding(decl)) {
          const bound = decl.bindingOf ? stripWrappers(decl.bindingOf) : null;
          if (bound && ts.isCallExpression(bound)) {
            // `const { doc } = buildUserReportAdminTaskDoc(...)` — the same reviewed
            // package-builder assertion, reached through a destructure.
            const assertedFromBinding = packageBuilderKeys(facts, bound, decl.bindingProperty);
            if (assertedFromBinding) {
              for (const key of assertedFromBinding.keys) keys.add(isUpdate ? key.split('.')[0] : key);
              return;
            }
          }
          const values = resolver.boundValues(decl);
          if (values) {
            for (const value of values) {
              readValue(value.node, depth + 1, value.facts, resolverFor(value.facts));
            }
            return;
          }
        }
        if (decl?.iterOf) {
          readArrayElement(decl.iterOf, depth + 1, facts, resolver);
          return;
        }
        const external = importedValue(facts, node.text);
        if (external) {
          readValue(external.node, depth + 1, external.facts, resolverFor(external.facts));
          return;
        }
        // A payload PARAMETER: what its call sites pass is what this helper writes.
        const owner = resolver.enclosingFunction(node, node.text);
        if (owner) {
          const params = facts.functions.get(owner.name)?.params ?? [];
          const index = params.findIndex((parameter) => parameter.name === node.text);
          if (index >= 0) {
            const known = paramPayloads.get(paramKey(facts.relPath, owner.name, index));
            if (known && (known.keys.size || known.opaque)) {
              for (const found of known.keys) keys.add(isUpdate ? found.split('.')[0] : found);
              if (known.opaque) opaque ??= "payload parameter '" + node.text + "': " + known.opaque;
              return;
            }
            opaque ??= "payload parameter '" + node.text + "' of " + owner.name + '() — no call site resolved it';
            return;
          }
        }
        opaque ??= "payload variable '" + node.text + "' has no readable declaration";
        return;
      }
      if (ts.isCallExpression(node)) {
        const callee = stripWrappers(node.expression);
        const label = ts.isIdentifier(callee) ? callee.text : callee.getText(source).slice(0, 40);
        // A `.parse()` output is readable only for a closed canonical core schema: a
        // direct import, or a core const map entry's schema that a core export names.
        // A renamed *import binding* is still that immutable export;
        // a local alias is deliberately not followed, because it can be reassigned or
        // wrap the schema. `safeParse()` returns a result wrapper; transforms/open
        // schemas are deliberately opaque rather than a way around the declared-fields check.
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'parse' &&
          node.arguments.length === 1
        ) {
          const schema = stripWrappers(callee.expression);
          if (ts.isIdentifier(schema)) {
            const imported = facts.imports.get(schema.text);
            const canonical =
              isCoreImport(facts, imported) &&
              registry.canonicalParseKeys.get(imported.imported);
            if (canonical) {
              for (const key of canonical.keys) keys.add(isUpdate ? key.split('.')[0] : key);
              return;
            }
          }
          // `MAP[selector].schema.parse(x)`, the lookup written in place or named once in a
          // `const`: a core const map whose entries carry each document's schema beside its
          // path. Every entry the lookup can produce must hold a closed canonical schema that
          // a core export names; one entry that does not makes the payload opaque. When the
          // write's target reads the same `const` lookup, the entries are narrowed one at a
          // time, so each document is diffed against its own entry's schema.
          if (ts.isPropertyAccessExpression(schema)) {
            const base = constLookup(stripParens(schema.expression), facts);
            const entries = ts.isElementAccessExpression(base) ? coreMapEntries(base, facts, source) : null;
            const names = entries?.map((entry) =>
              entry && typeof entry === 'object' && !Array.isArray(entry)
                ? registry.canonicalParseName.get(entry[schema.name.text])
                : undefined,
            );
            if (names?.length && names.every(Boolean)) {
              for (const name of names) {
                for (const key of registry.canonicalParseKeys.get(name).keys) {
                  keys.add(isUpdate ? key.split('.')[0] : key);
                }
              }
              return;
            }
          }
          opaque ??= 'payload parsed by a non-canonical or open schema';
          return;
        }
        // `snap.data()` — a row READ BACK from a registered document, spread into the
        // patch that writes it again. What the read can hold is exactly what that
        // document's schema declares, so those are the keys it contributes; whether the
        // stored DATA has drifted is the drift checker's half of the system, not this one.
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'data' &&
          node.arguments.length === 0
        ) {
          const readBack = resolver.resolveReadBack(callee.expression);
          if (readBack?.templates?.size) {
            let readable = true;
            const found = new Set();
            for (const template of readBack.templates) {
              const declared = registry.declaredFor(template);
              if (!declared || declared.open) {
                readable = false;
                break;
              }
              for (const key of declared.keys) found.add(key);
            }
            if (readable) {
              for (const key of found) keys.add(isUpdate ? key.split('.')[0] : key);
              return;
            }
          }
        }
        // An IIFE is a syntactically finite function: `const parsed = (() => { … })()` is
        // the try/catch-around-a-parse shape, and what it RETURNS is the payload.
        if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
          const returns = callbackReturns(callee);
          if (returns.length) {
            for (const returned of returns) readValue(returned, depth + 1, facts, resolver);
            return;
          }
        }
        // `Object.fromEntries(FIELDS.map((field) => [field, value]))` — the written keys are
        // the first slot of each entry: a field list's names, or each element's named property.
        // The second slot is a field VALUE, never a key.
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === 'Object' &&
          callee.name.text === 'fromEntries' &&
          node.arguments.length === 1
        ) {
          const names = fromEntriesKeys(node.arguments[0], facts, resolver, isUpdate);
          if (names) {
            for (const name of names) keys.add(isUpdate ? name.split('.')[0] : name);
          } else {
            opaque ??= 'payload built by Object.fromEntries()';
          }
          return;
        }
        // `Object.freeze(payload)` returns the SAME object; freezing a payload says
        // something about mutation, nothing about its shape.
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === 'Object' &&
          (callee.name.text === 'freeze' || callee.name.text === 'assign') &&
          node.arguments.length >= 1
        ) {
          for (const argument of node.arguments) readValue(argument, depth + 1, facts, resolver);
          return;
        }
        // A payload BUILT by a local or imported function: read what that function returns.
        const key = resolver.calleeKey(node);
        const builders = key ? payloadBuilders.get(key) : null;
        const builder = builders ? (isUpdate ? builders.update : builders.set) : null;
        if (builder) {
          for (const found of builder.keys) keys.add(isUpdate ? found.split('.')[0] : found);
          if (builder.opaque) opaque ??= 'payload built by ' + label + '(): ' + builder.opaque;
          return;
        }
        // A CALLBACK parameter the helper writes: `archiveSweep(…, (doc) => ({ … }))`.
        // Resolved from the call sites where the callback is a syntactically finite
        // function; anything else stays unreadable.
        if (ts.isIdentifier(callee)) {
          const owner = resolver.enclosingFunction(node, callee.text);
          if (owner) {
            const params = facts.functions.get(owner.name)?.params ?? [];
            const index = params.findIndex((parameter) => parameter.name === callee.text);
            if (index >= 0) {
              const known = paramCallbackPayloads.get(paramKey(facts.relPath, owner.name, index));
              if (known && (known.keys.size || known.opaque)) {
                for (const found of known.keys) keys.add(isUpdate ? found.split('.')[0] : found);
                if (known.opaque) opaque ??= "payload callback '" + callee.text + "': " + known.opaque;
                return;
              }
              opaque ??= "payload callback '" + callee.text + "' of " + owner.name + '() — no call site resolved it';
              return;
            }
          }
        }
        const asserted = packageBuilderKeys(facts, node, null);
        if (asserted) {
          for (const found of asserted.keys) keys.add(isUpdate ? found.split('.')[0] : found);
          return;
        }
        // A CALLBACK supplied on a carrier (`options.transform(data, now)`) — the generic
        // helper writes what its caller's function returns. Readable exactly when that
        // function is syntactically finite at the call site.
        const callbacks = resolver.callbackFunctions(node);
        if (callbacks?.length) {
          let read = false;
          for (const callback of callbacks) {
            for (const returned of callbackReturns(callback.node)) {
              readValue(returned, depth + 1, callback.facts, resolverFor(callback.facts));
              read = true;
            }
          }
          if (read) return;
        }
        opaque ??= 'payload built by ' + label + '()';
        return;
      }
      opaque ??= 'payload expression ' + node.getText(source).slice(0, 60).replace(/\s+/g, ' ');
    };

    readValue(expr, 0, hostFacts, hostResolver);
    return {
      keys,
      casts,
      opaque,
      literals,
    };
  }

  /**
   * The payload a carrier's own PATCH FUNCTION produces — the union over its direct returns,
   * read in the file that wrote it. Null when the carrier property is not a syntactically
   * finite function or returns nothing readable, which keeps a pairing fail-closed instead of
   * inventing a shape for a value the guard cannot see.
   */
  function payloadKeysOfCallback(value, isUpdate) {
    const node = stripWrappers(value.node);
    if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node) && !ts.isMethodDeclaration(node)) return null;
    const returns = callbackReturns(node);
    if (!returns.length) return null;
    const resolver = resolverFor(value.facts);
    const keys = new Set();
    const casts = [];
    const literals = new Map();
    let opaque = null;
    for (const returned of returns) {
      const read = payloadKeys(value.facts, resolver, returned, isUpdate);
      for (const key of read.keys) keys.add(key);
      casts.push(...read.casts);
      opaque ??= read.opaque;
      for (const [key, values] of read.literals) {
        if (!literals.has(key)) literals.set(key, new Set());
        for (const literal of values) literals.get(key).add(literal);
      }
    }
    return { keys, casts, opaque, literals };
  }

  /** fnKey -> { keys:Set, opaque } for functions that RETURN a payload object literal. */
  const payloadBuilders = new Map();

  // ---- the write sweep ----------------------------------------------------

  function sweep({ collectKnowledge }) {
    const writes = [];
    /** Write-method calls positively identified as NOT Firestore, with the evidence. */
    const notFirestore = [];
    /** Runtime-selected method calls the classifier could neither read nor rule out. */
    const unclassified = [];
    const pendingParamArgs = new Map(); // paramKey -> Set<template>
    const pendingReturns = new Map(); // fnKey -> Set<template>
    const pendingParamPayloads = new Map(); // paramKey -> { keys, opaque }
    const pendingParamCarrierProperties = new Map(); // `${paramKey}.${property}` -> AST values
    const pendingReturnCarrierProperties = new Map(); // fnKey -> Map<property, AST values>
    const pendingParamCollections = new Map(); // paramKey -> Set<serialized collection segments>
    const pendingParamCallbackPayloads = new Map(); // paramKey -> { keys, opaque }
    const pendingParamArrayEntries = new Map(); // paramKey -> AST entry expressions
    const pendingParamNotFirestore = new Map(); // paramKey -> { reason, unknown }
    const pendingParamValues = new Map(); // paramKey -> AST values from call sites
    const pendingParamGroups = new Map(); // paramKey -> Set<collection-group name>
    const pendingReturnCollections = new Map(); // fnKey -> Set<serialized collection segments>
    const pendingReturnGroups = new Map(); // fnKey -> Set<collection-group name>
    const pendingReturnArrayProperties = new Map(); // fnKey -> Map<property, AST values>
    const pendingPassThrough = new Map(); // fnKey -> pass-through parameter index
    const pendingNonFirestoreReturns = new Map(); // fnKey -> non-Firestore return reason
    resolverCache = new Map(); // this round's knowledge, not the previous round's

    for (const facts of files) {
      const resolver = resolverFor(facts);
      const { source } = facts;
      const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

      if (collectKnowledge) {
        // (1) function return targets
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length) continue;
          const found = new Set();
          let ok = true;
          for (const returnExpr of fn.returns) {
            const returned = stripWrappers(returnExpr);
            // A finite resolver can return null for an invalid-input branch. That
            // branch cannot feed a write target; retain every actual ref branch.
            if (
              returned.kind === ts.SyntaxKind.NullKeyword ||
              returned.kind === ts.SyntaxKind.UndefinedKeyword ||
              (ts.isIdentifier(returned) && returned.text === 'undefined')
            ) continue;
            const resolved = resolver.resolveTarget(returnExpr);
            if (!resolved.templates) {
              ok = false;
              break;
            }
            for (const template of resolved.templates) found.add(template);
          }
          if (ok && found.size && found.size <= MAX_CANDIDATES) pendingReturns.set(fnKey(facts.relPath, name), found);
        }
        // (1b) function return COLLECTIONS / GROUPS. A helper that owns one query
        // (`activePostsCollection()`, a `collectionGroup(...)` builder) is the single owner
        // of that collection name; its callers write through the documents it yields.
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length || fn.returns.length > MAX_CALLBACK_RETURNS) continue;
          const params = fn.params ?? [];
          const passThroughIndex = (() => {
            let found = null;
            for (const returnExpr of fn.returns) {
              let current = stripWrappers(returnExpr);
              if (
                current.kind === ts.SyntaxKind.NullKeyword ||
                current.kind === ts.SyntaxKind.UndefinedKeyword ||
                (ts.isIdentifier(current) && current.text === 'undefined')
              ) continue;
              for (let hop = 0; hop < 8; hop++) {
                if (
                  ts.isCallExpression(current) &&
                  ts.isPropertyAccessExpression(current.expression) &&
                  (current.expression.name.text === 'get' ||
                    QUERY_PASSTHROUGH.has(current.expression.name.text) ||
                    PROMISE_PASSTHROUGH.has(current.expression.name.text))
                ) {
                  current = stripWrappers(current.expression.expression);
                  continue;
                }
                break;
              }
              if (!ts.isIdentifier(current)) return null;
              const index = params.findIndex((parameter) => parameter.name === current.text);
              if (index < 0 || (found !== null && found !== index)) return null;
              found = index;
            }
            return found;
          })();
          if (passThroughIndex !== null) pendingPassThrough.set(fnKey(facts.relPath, name), passThroughIndex);
          // A helper whose EVERY return is positively non-Firestore hands back a
          // non-Firestore value, so its callers may be dropped on that evidence.
          {
            let reason = null;
            let allNonFirestore = fn.returns.length > 0;
            for (const returnExpr of fn.returns) {
              const found = resolver.nonFirestoreValue(returnExpr);
              if (!found) {
                allNonFirestore = false;
                break;
              }
              reason ??= found;
            }
            if (allNonFirestore && reason) pendingNonFirestoreReturns.set(fnKey(facts.relPath, name), reason);
          }
          const collections = new Set();
          const groups = new Set();
          let ok = true;
          for (const returnExpr of fn.returns) {
            const returned = stripWrappers(returnExpr);
            if (
              returned.kind === ts.SyntaxKind.NullKeyword ||
              returned.kind === ts.SyntaxKind.UndefinedKeyword ||
              (ts.isIdentifier(returned) && returned.text === 'undefined')
            ) continue;
            const segments = resolver.resolveCollectionSegments(returnExpr);
            if (segments) {
              collections.add(JSON.stringify(segments));
              continue;
            }
            const group = resolver.resolveCollectionGroup(returnExpr);
            if (group) {
              groups.add(group);
              continue;
            }
            // A helper that RUNS the query and hands back the snapshot
            // (`getCollectionGroupOrCapture`) still names one collection or group.
            const snapshot = resolver.resolveSnapshot(returnExpr, {}, 0);
            if (snapshot?.group?.t === 'lit') {
              groups.add(snapshot.group.v);
              continue;
            }
            if (snapshot?.segments?.length && snapshot.segments.length % 2 === 1) {
              collections.add(JSON.stringify({ segments: snapshot.segments, canonical: false }));
              continue;
            }
            // A collection-GROUP query already resolves to the document templates it can
            // reach, so the snapshot the helper returns is over exactly those documents.
            if (snapshot?.templates?.size) {
              const existing = pendingReturns.get(fnKey(facts.relPath, name)) ?? new Set();
              for (const template of snapshot.templates) existing.add(template);
              if (existing.size <= MAX_CANDIDATES) pendingReturns.set(fnKey(facts.relPath, name), existing);
              continue;
            }
            ok = false;
            break;
          }
          if (!ok) continue;
          if (collections.size) pendingReturnCollections.set(fnKey(facts.relPath, name), collections);
          if (groups.size) pendingReturnGroups.set(fnKey(facts.relPath, name), groups);
        }
        // (2) call-site argument targets
        for (const call of facts.calls) {
          const key = resolver.calleeKey(call);
          if (!key) continue;
          const [calleePath, calleeName] = key.split('#');
          const callee = byPath.get(calleePath)?.functions.get(calleeName);
          if (!callee) continue;
          call.arguments.forEach((argument, index) => {
            const parameter = callee.params[index];
            if (!parameter || !parameter.name) return;
            const target = paramKey(calleePath, calleeName, index);
            // Every parameter is tried: a document arrives as a DocumentReference, as a
            // QueryDocumentSnapshot, or inside a carrier object, under a name that says none
            // of that. An argument that is not a document simply does not resolve and
            // records nothing.
            const resolved = resolver.resolveTarget(argument);
            if (resolved.templates) {
              if (!pendingParamArgs.has(target)) pendingParamArgs.set(target, new Set());
              for (const template of resolved.templates) pendingParamArgs.get(target).add(template);
            }
            // (2b) a PAYLOAD passed into a helper that writes it — the same propagation,
            // for the data side. Each call site contributes its keys; a call site whose
            // payload is unreadable makes the parameter unreadable too (fail closed).
            const shape = stripWrappers(argument);
            if (
              ts.isObjectLiteralExpression(shape) ||
              ts.isIdentifier(shape) ||
              ts.isConditionalExpression(shape) ||
              ts.isCallExpression(shape) ||
              // \`gameCopyWrites(id, parsed.data)\` — a parse output, or a carrier's property.
              ts.isPropertyAccessExpression(shape)
            ) {
              const read = payloadKeys(facts, resolver, argument, false);
              // An argument that reads as nothing is not a payload — it is some other kind
              // of value, and the propagations below still have to look at it. Recording an
              // empty-and-opaque read here would make every helper's payload unreadable.
              if (read.keys.size || !read.opaque) {
                const existing = pendingParamPayloads.get(target) ?? { keys: new Set(), opaque: null };
                for (const key of read.keys) existing.keys.add(key);
                existing.opaque ??= read.opaque;
                pendingParamPayloads.set(target, existing);
              }
            }
            // (2c) a COLLECTION passed into a generic helper — `archiveSweep(source,
            // archive, …)`. The helper's `doc.ref` is that collection plus ANY id, so a
            // generic sweep stays checkable without being rewritten into a specific writer.
            const collection = resolver.resolveCollectionSegments(argument);
            if (collection) {
              if (!pendingParamCollections.has(target)) pendingParamCollections.set(target, new Set());
              pendingParamCollections.get(target).add(JSON.stringify(collection));
            }
            const group = resolver.resolveCollectionGroup(argument);
            if (group) {
              if (!pendingParamGroups.has(target)) pendingParamGroups.set(target, new Set());
              pendingParamGroups.get(target).add(group);
            }
            // The generic value propagation: what every call site passes, verbatim.
            const suppliedValues = pendingParamValues.get(target) ?? [];
            if (!suppliedValues.some((candidate) => candidate.facts === facts && candidate.node === argument)) {
              suppliedValues.push({ facts, node: argument });
            }
            if (suppliedValues.length <= MAX_CANDIDATES) pendingParamValues.set(target, suppliedValues);
            // (2d) a CALLBACK whose result the helper writes — readable only when the
            // callback passed here is a syntactically finite inline function.
            if (ts.isArrowFunction(shape) || ts.isFunctionExpression(shape)) {
              const returns = [];
              if (!ts.isBlock(shape.body)) returns.push(shape.body);
              else {
                const collect = (inner) => {
                  if (inner !== shape && ts.isFunctionLike(inner)) return;
                  if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
                  ts.forEachChild(inner, collect);
                };
                ts.forEachChild(shape.body, collect);
              }
              if (returns.length && returns.length <= MAX_CALLBACK_RETURNS) {
                const existing = pendingParamCallbackPayloads.get(target) ?? { keys: new Set(), opaque: null };
                for (const returned of returns) {
                  const read = payloadKeys(facts, resolver, returned, false);
                  for (const key of read.keys) existing.keys.add(key);
                  existing.opaque ??= read.opaque;
                }
                pendingParamCallbackPayloads.set(target, existing);
              }
            }
            // (2f) POSITIVE not-Firestore evidence, propagated the same way. A parameter
            // every caller fills with a Map/Set/array/lookup-result is not a write handle.
            // A self-recursive pass-through (`addBinding(el.name, bucket)` inside
            // `addBinding`) hands the parameter back to itself and adds no information;
            // counting it as "unknown" would deadlock the fixed point forever.
            const selfPass =
              ts.isIdentifier(shape) &&
              (() => {
                const owner = resolver.enclosingFunction(shape, shape.text);
                if (!owner) return false;
                const ownParams = facts.functions.get(owner.name)?.params ?? [];
                const ownIndex = ownParams.findIndex((candidate) => candidate.name === shape.text);
                return ownIndex >= 0 && paramKey(facts.relPath, owner.name, ownIndex) === target;
              })();
            if (!selfPass) {
              const evidence = resolver.nonFirestoreValue(argument);
              const seen = pendingParamNotFirestore.get(target) ?? { reason: null, unknown: false };
              if (evidence) seen.reason ??= evidence;
              else seen.unknown = true;
              pendingParamNotFirestore.set(target, seen);
            }
            // (2e) an ARRAY built up at the call site and replayed inside the helper — the
            // pending-write sink. Its entries travel with their creating file.
            {
              const entries = resolver.arrayEntryExpressions(shape);
              if (entries?.length && entries.length <= MAX_QUEUE_ENTRIES) {
                const existing = pendingParamArrayEntries.get(target) ?? [];
                existing.push(...entries);
                if (existing.length <= MAX_QUEUE_ENTRIES) pendingParamArrayEntries.set(target, existing);
              }
            }
            // A direct object carrier is statically bounded. Propagate each named property
            // separately so `writeRefs(refs) { refs.groupRef.set(refs.patch) }` remains
            // checkable without pretending an arbitrary object parameter is readable.
            const properties = resolver.objectProperties(argument);
            if (properties && properties.size <= MAX_CANDIDATES) {
              for (const [property, values] of properties) {
                if (!values.length || values.length > MAX_CANDIDATES) continue;
                const carrierKey = `${target}.${property}`;
                const existing = pendingParamCarrierProperties.get(carrierKey) ?? [];
                existing.push(...values);
                if (existing.length <= MAX_CANDIDATES) pendingParamCarrierProperties.set(carrierKey, existing);
              }
            }
          });
        }
        // (3) payload-building functions — the union over EVERY return, so a helper with
        // several exits contributes every key any of them writes. Each is read both as a set
        // payload and as an update payload, whose dotted keys address their top-level field;
        // the write that calls the helper takes the reading its own method needs.
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length || fn.returns.length > 8) continue;
          const readings = { set: { keys: new Set(), opaque: null }, update: { keys: new Set(), opaque: null } };
          let payloadShaped = false;
          for (const returnExpr of fn.returns) {
            const returned = stripWrappers(returnExpr);
            if (
              !ts.isObjectLiteralExpression(returned) &&
              !ts.isIdentifier(returned) &&
              !ts.isConditionalExpression(returned) &&
              !ts.isCallExpression(returned) &&
              // \`return parsed.data\` — a canonical parse output, or a carrier's property.
              !ts.isPropertyAccessExpression(returned)
            ) {
              continue;
            }
            payloadShaped = true;
            for (const [mode, reading] of Object.entries(readings)) {
              const read = payloadKeys(facts, resolver, returnExpr, mode === 'update');
              for (const key of read.keys) reading.keys.add(key);
              reading.opaque ??= read.opaque;
            }
          }
          if (payloadShaped) payloadBuilders.set(fnKey(facts.relPath, name), readings);
        }
        // (4) Finite ref/payload carriers returned by local or imported functions.
        // AST values stay attached to their creating file, so an async factory is
        // accepted only when its direct returned object is fully readable — never
        // because a type annotation promises a particular shape.
        for (const [name, fn] of facts.functions) {
          const shapes = distinctReturnShapes(fn.returns);
          if (!shapes.length || shapes.length > MAX_CALLBACK_RETURNS) continue;
          const collected = new Map();
          let carrierShaped = false;
          let ok = true;
          for (const returnExpr of shapes) {
            const returned = stripWrappers(returnExpr);
            if (
              returned.kind === ts.SyntaxKind.NullKeyword ||
              returned.kind === ts.SyntaxKind.UndefinedKeyword ||
              (ts.isIdentifier(returned) && returned.text === 'undefined')
            ) continue;
            const properties = resolver.objectProperties(returned);
            if (!properties) {
              ok = false;
              break;
            }
            carrierShaped = true;
            for (const [property, values] of properties) {
              const existing = collected.get(property) ?? [];
              existing.push(...values);
              if (existing.length > MAX_CANDIDATES) {
                ok = false;
                break;
              }
              collected.set(property, existing);
            }
            if (!ok) break;
          }
          if (ok && carrierShaped && collected.size) {
            pendingReturnCarrierProperties.set(fnKey(facts.relPath, name), collected);
          }
        }
        // (5) Finite ARRAYS of carriers returned by a function. The elements are built
        // there, so that is the only place their ref/payload pairs are readable; the
        // caller only iterates them.
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length || fn.returns.length > MAX_CALLBACK_RETURNS) continue;
          const collected = new Map();
          for (const property of ARRAY_CARRIER_PROPERTIES) {
            const values = [];
            let ok = true;
            for (const returnExpr of fn.returns) {
              const found = resolver.propertyValuesFromArray(returnExpr, property);
              if (!found) { ok = false; break; }
              values.push(...found);
            }
            if (ok && values.length && values.length <= MAX_CANDIDATES) collected.set(property, values);
          }
          if (collected.size) pendingReturnArrayProperties.set(fnKey(facts.relPath, name), collected);
        }
        continue;
      }

      if (facts.library) continue;
      // The write sweep itself.
      const record = (node, methods, classified) => {
        if (classified.notFirestore) {
          notFirestore.push({
            file: facts.relPath,
            pos: node.getStart(source),
            at: `${facts.relPath}:${lineOf(node)}`,
            method: methods.join('|'),
            reason: classified.notFirestore,
          });
        } else {
          writes.push(buildWrite(facts, resolver, node, methods, classified, lineOf(node)));
        }
      };

      /**
       * A call through an element access whose selector cannot be narrowed to a finite set
       * EXCLUDING the write methods. It is a write candidate: the only way it stops being
       * one is POSITIVE evidence that the receiver is something else. Otherwise it ends
       * here, as its own reported outcome — never as silence.
       */
      const recordUnresolvedSelector = (node, receiver) => {
        const evidence = notFirestoreEvidence(facts, resolver, stripWrappers(receiver), [], node.arguments);
        if (evidence) {
          notFirestore.push({
            file: facts.relPath,
            pos: node.getStart(source),
            at: `${facts.relPath}:${lineOf(node)}`,
            method: 'computed',
            reason: evidence,
          });
          return;
        }
        unclassified.push({
          file: facts.relPath,
          pos: node.getStart(source),
          at: `${facts.relPath}:${lineOf(node)}`,
          method: 'computed',
          snippet: facts.text.slice(node.getStart(source), node.getEnd()).split('\n')[0].trim().slice(0, 120),
          reason:
            'the invoked method is selected at runtime and does not narrow to a finite set ' +
            'excluding set/update/create/add, and the receiver is not positively non-Firestore',
        });
      };

      const visit = (node) => {
        if (ts.isCallExpression(node)) {
          const callee = stripWrappers(node.expression);
          const direct = writeMethodAccess(callee, facts);
          if (direct && !direct.resolved) {
            recordUnresolvedSelector(node, direct.receiver);
          } else if (direct) {
            record(node, direct.methods, classifyWrite(facts, resolver, direct.receiver, direct.methods, node));
          } else {
            // `ref.set.bind(ref)` / `set.call(ref, data)` / `ref.set.apply(ref, [data])`
            // reach disk through the SAME method with no property-access call of their
            // own. The indirection site is where they must be accounted for.
            const indirect = resolveIndirectWrite(facts, resolver, callee, node);
            if (indirect && !indirect.resolved) {
              recordUnresolvedSelector(node, indirect.receiver);
            } else if (indirect) {
              record(node, indirect.methods, classifyWrite(facts, resolver, indirect.receiver, indirect.methods, node, { indirect: indirect.form }));
            } else if (
              ts.isPropertyAccessExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              callee.expression.text === 'Reflect' &&
              callee.name.text === 'apply' &&
              node.arguments.length >= 3
            ) {
              const reflected = writeMethodAccess(stripWrappers(node.arguments[0]), facts);
              const list = stripWrappers(node.arguments[2]);
              const dataExpr = ts.isArrayLiteralExpression(list) ? list.elements[0] ?? null : null;
              if (reflected && !reflected.resolved) {
                recordUnresolvedSelector(node, node.arguments[1] ?? reflected.receiver);
              } else if (reflected) {
                const receiver = node.arguments[1] ?? reflected.receiver;
                record(node, reflected.methods, classifyWrite(facts, resolver, receiver, reflected.methods, node, {
                  indirect: { refExpr: receiver, dataExpr, extraArgs: [] },
                }));
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    return {
      writes,
      pendingParamArgs,
      pendingReturns,
      pendingParamPayloads,
      pendingParamCarrierProperties,
      pendingReturnCarrierProperties,
      pendingParamCollections,
      pendingParamCallbackPayloads,
      pendingParamArrayEntries,
      pendingParamNotFirestore,
      pendingParamValues,
      pendingParamGroups,
      pendingReturnCollections,
      pendingReturnGroups,
      pendingReturnArrayProperties,
      pendingPassThrough,
      pendingNonFirestoreReturns,
      notFirestore,
      unclassified,
    };
  }

  /**
   * `ref.set.bind(ref)`, `set.call(ref, data)`, `ref.set.apply(ref, [data])` — a write
   * method invoked through a function indirection. The bytes land in exactly the same
   * document, so the indirection site is the write site; `bind` defers the payload to a
   * later, unknown call, which is unreadable and therefore a violation.
   */
  function resolveIndirectWrite(facts, resolver, callee, call) {
    if (!ts.isPropertyAccessExpression(callee) || !INDIRECTION_METHODS.has(callee.name.text)) return null;
    const bound = stripWrappers(callee.expression);
    let access = writeMethodAccess(bound, facts);
    if (!access && ts.isIdentifier(bound)) {
      const decl = resolver.nearestDecl(bound.text, bound.pos, bound);
      // `const { set } = ref; set.call(ref, …)`
      if (decl?.bindingOf && decl.bindingProperty && WRITE_METHODS.has(decl.bindingProperty)) {
        access = { methods: [decl.bindingProperty], receiver: decl.bindingOf, resolved: true };
      } else if (decl?.initializer) {
        // `const fn = ref[m]; fn.call(ref, …)` — the alias carries the element access, so
        // the selector is read where it was written, not where the alias is invoked.
        access = writeMethodAccess(stripWrappers(decl.initializer), facts);
      }
    }
    // `Function.prototype.call.call(ref.set, ref, …)` — the bound function is itself an
    // indirection, so the method actually invoked is the FIRST argument.
    if (!access && ts.isPropertyAccessExpression(bound) && INDIRECTION_METHODS.has(bound.name.text) && call.arguments[0]) {
      access = writeMethodAccess(stripWrappers(call.arguments[0]), facts);
      if (access) {
        return access.resolved
          ? {
            methods: access.methods,
            receiver: call.arguments[1] ?? access.receiver,
            resolved: true,
            form: {
              refExpr: call.arguments[1] ?? access.receiver,
              dataExpr: call.arguments[2] ?? null,
              extraArgs: call.arguments.slice(3),
            },
          }
          : { methods: [], receiver: call.arguments[1] ?? access.receiver, resolved: false };
      }
    }
    // A method obtained REFLECTIVELY carries no readable name at all. The call still
    // invokes whatever it extracted, so it is an unresolved selector, not an absent write.
    if (!access && reflectiveMethodSource(facts, resolver, bound)) {
      return { methods: [], receiver: call.arguments[0] ?? bound, resolved: false };
    }
    if (!access) return null;
    const kind = callee.name.text;
    const args = call.arguments;
    const receiver = args[0] ?? access.receiver;
    if (!access.resolved) return { methods: [], receiver, resolved: false };
    if (kind === 'call') {
      return { methods: access.methods, receiver, resolved: true, form: { refExpr: receiver, dataExpr: args[1] ?? null, extraArgs: args.slice(2) } };
    }
    if (kind === 'apply') {
      const list = args[1] ? stripWrappers(args[1]) : null;
      const first = list && ts.isArrayLiteralExpression(list) && !ts.isSpreadElement(list.elements[0] ?? {}) ? list.elements[0] : null;
      return { methods: access.methods, receiver, resolved: true, form: { refExpr: receiver, dataExpr: first ?? null, extraArgs: [] } };
    }
    // bind: the payload is supplied wherever the bound function is finally called.
    return { methods: access.methods, receiver, resolved: true, form: { refExpr: receiver, dataExpr: null, extraArgs: [] } };
  }

  /**
   * Was this function value pulled off an object by REFLECTION rather than named? A
   * descriptor's `.value` or a `Reflect.get(...)` result is a method with no readable name,
   * which is the same state as a selector that did not resolve.
   */
  function reflectiveMethodSource(facts, resolver, node, depth = 0) {
    if (!node || depth > 4) return false;
    const current = stripWrappers(node);
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const owner = stripWrappers(current.expression.expression);
      const method = current.expression.name.text;
      if (
        ts.isIdentifier(owner) &&
        ((owner.text === 'Object' && (method === 'getOwnPropertyDescriptor' || method === 'getOwnPropertyDescriptors')) ||
          (owner.text === 'Reflect' && (method === 'get' || method === 'getOwnPropertyDescriptor')))
      ) return true;
    }
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      return reflectiveMethodSource(facts, resolver, current.expression, depth + 1);
    }
    if (ts.isIdentifier(current)) {
      const decl = resolver.nearestDecl(current.text, current.pos, current);
      if (decl?.initializer) return reflectiveMethodSource(facts, resolver, decl.initializer, depth + 1);
    }
    return false;
  }

  /**
   * Is this `.set/.update/.create/.add` a FIRESTORE write, and in which form?
   *
   * EVERY candidate ends in an explicit outcome: a Firestore write form, or a
   * `{ notFirestore: <positive evidence> }` classification. There is no silent drop. The
   * earlier shape asked whether the receiver's SOURCE TEXT looked Firestore-ish, so a
   * `.set()` on a `DocumentReference`-typed local whose name happened to lack "ref" was
   * never recorded at all — an unchecked write that no coverage number could show.
   *
   * @returns {{ refExpr, dataExpr, extraArgs? , fieldPathArgs? } | { notFirestore: string }}
   */
  function classifyWrite(facts, resolver, receiver, methods, call, options = {}) {
    const receiverNode = stripWrappers(receiver);
    const args = call.arguments;

    /**
     * Is the receiver a Transaction / WriteBatch / BulkWriter? Decided by RESOLUTION, never
     * by NAME. A name is not evidence in either direction: a `DocumentReference` called `t`
     * is still a reference (and its single-argument write was being dropped as "not a
     * (ref, data) pair"), and a transaction called `firestoreTx` is still a transaction.
     * An undecidable receiver is never dropped — it falls through to an outcome.
     */
    const txHandle = () => {
      if (!ts.isIdentifier(receiverNode)) return false;
      const decl = resolver.nearestDecl(receiverNode.text, receiverNode.pos, receiverNode);
      if (decl?.initializer) {
        const initializer = stripWrappers(decl.initializer);
        return (
          ts.isCallExpression(initializer) &&
          ts.isPropertyAccessExpression(initializer.expression) &&
          (initializer.expression.name.text === 'batch' || initializer.expression.name.text === 'bulkWriter')
        );
      }
      if (decl) return false;
      const owner = resolver.enclosingFunction(receiverNode, receiverNode.text);
      if (owner) {
        const parameter = (facts.functions.get(owner.name)?.params ?? []).find((p) => p.name === receiverNode.text);
        if (parameter && profile.transactionType.test(parameter.typeText)) return true;
      }
      // `db.runTransaction(async (zz) => …)` — the callback's first parameter IS the
      // transaction, whatever it was named.
      return resolver.isTransactionCallbackParam(receiverNode);
    };

    // A bind/call/apply site carries its own already-decided form.
    if (options.indirect) return options.indirect;

    if (txHandle()) {
      if (methods.every((entry) => entry === 'add')) {
        return { notFirestore: 'a resolved Transaction/WriteBatch handle has no add()' };
      }
      if (args.length >= 2) return { refExpr: args[0], dataExpr: args[1], extraArgs: args.slice(2) };
      // A resolved handle called with one argument is malformed code, not an absent
      // write: record it so it still ends in an outcome.
      return { refExpr: receiver, dataExpr: args[0] ?? null, extraArgs: [] };
    }

    // ref.update('a.b', v, …) — the variadic field-path form. Only update() has it, so a
    // selector that could also be a set()/create() is not read this way.
    if (
      methods.length === 1 && methods[0] === 'update' &&
      args.length >= 2 && ts.isStringLiteralLike(stripWrappers(args[0]))
    ) {
      return { refExpr: receiver, dataExpr: null, fieldPathArgs: args };
    }

    // A target that RESOLVES to a registered document is Firestore, whatever it is called.
    const resolvedReceiver = resolver.resolveTarget(receiver);
    if (!resolvedReceiver.templates) {
      // Argument SHAPE may only drop a call whose RECEIVER is positively something else.
      // Reading the arguments of an unresolved receiver is how real writes went missing:
      // `ref.create(payload, {})` and a transaction handle the name test did not know
      // both "fail" a shape test while being perfectly ordinary Firestore writes. A
      // resolution that hit an analysis CEILING is not evidence of anything either, so a
      // capped resolution never reaches a drop rule.
      const evidence = resolvedReceiver.capped
        ? null
        : notFirestoreEvidence(facts, resolver, receiverNode, methods, args);
      if (evidence) return { notFirestore: evidence };
      // Ambiguous receiver: a call whose FIRST argument resolves to a document is the
      // transaction/batch form, whatever the handle was called.
      if (args.length >= 2 && resolver.resolveTarget(args[0]).templates) {
        return { refExpr: args[0], dataExpr: args[1], extraArgs: args.slice(2) };
      }
    }

    if (args.length === 0) {
      // Arity, not shape: a call with no arguments carries no payload, so no field of any
      // document can reach disk through it.
      return { notFirestore: `${methods.join('|')}() with no arguments carries no payload` };
    }
    return { refExpr: receiver, dataExpr: args[0], extraArgs: args.slice(1) };
  }

  /**
   * POSITIVE evidence that a `.set/.update/.create/.add` is not a Firestore write.
   *
   * Nothing here is "it did not look like Firestore". Each branch names the other thing it
   * actually is — a Map/Set/Headers/URLSearchParams receiver, a React ref's `.current`, a
   * resolved non-Firestore initializer, or an argument shape no Firestore overload accepts.
   * Anything this cannot name stays a candidate and fails closed.
   */
  function notFirestoreEvidence(facts, resolver, receiverNode, methods, args) {
    // The general value-level evidence: a Map/Set/array/lookup-result, directly or through
    // a declaration, a bounded conditional, or a parameter every call site fills with one.
    const value = resolver.nonFirestoreValue(receiverNode);
    if (value) return `receiver is ${value}`;

    // An ordinary dispatch table: the receiver's OWN members are the functions being
    // dispatched to. That is positive evidence about what the receiver IS — a Firestore
    // handle is never an object literal, and never a class this file declares.
    const own = ownMemberDispatch(facts, resolver, receiverNode, methods);
    if (own) return own;

    // There is deliberately NO property-NAME rule here. Every drop is backed by a
    // RESOLVED receiver — an initializer, a declared type, a package the value came from,
    // or what every call site passes. A name proves nothing in either direction.
    // `x.get(k).add(v)` is a Map/Set lookup — but only when `x` RESOLVES to one. The bare
    // `.get()` SHAPE is not evidence: a helper that hands back a reference can be called
    // anything at all.
    if (ts.isCallExpression(receiverNode) && ts.isPropertyAccessExpression(receiverNode.expression)) {
      const readMethod = receiverNode.expression.name.text;
      if (readMethod === 'get' || readMethod === 'getAll') {
        const container = resolver.nonFirestoreValue(receiverNode.expression.expression);
        if (container) return `receiver is a .${readMethod}() lookup on ${container}`;
      }
    }
    if (ts.isConditionalExpression(receiverNode)) {
      const left = notFirestoreEvidence(facts, resolver, stripWrappers(receiverNode.whenTrue), methods, args);
      const right = notFirestoreEvidence(facts, resolver, stripWrappers(receiverNode.whenFalse), methods, args);
      if (left && right) return `both receiver branches are non-Firestore (${left})`;
    }
    if (
      ts.isNewExpression(receiverNode) &&
      ts.isIdentifier(receiverNode.expression) &&
      NOT_FIRESTORE_CONSTRUCTORS.has(receiverNode.expression.text)
    ) {
      return `receiver is a new ${receiverNode.expression.text}()`;
    }
    if (
      ts.isCallExpression(receiverNode) &&
      ts.isIdentifier(receiverNode.expression) &&
      NOT_FIRESTORE_FACTORIES.has(receiverNode.expression.text)
    ) {
      return `receiver comes from ${receiverNode.expression.text}()`;
    }
    if (ts.isIdentifier(receiverNode)) {
      const owner = resolver.enclosingFunction(receiverNode, receiverNode.text);
      if (owner) {
        const params = facts.functions.get(owner.name)?.params ?? [];
        const parameter = params.find((candidate) => candidate.name === receiverNode.text);
        if (parameter && NOT_FIRESTORE_TYPE.test(parameter.typeText.trim())) {
          return `receiver is declared ${parameter.typeText.trim().slice(0, 40)}`;
        }
        // Evidence propagates into a parameter exactly as a target does: when EVERY call
        // site passes a positively non-Firestore container, so is the parameter.
        const index = params.findIndex((candidate) => candidate.name === receiverNode.text);
        const known = index >= 0 ? paramNotFirestore.get(paramKey(facts.relPath, owner.name, index)) : null;
        if (known) return `receiver is a parameter every call site fills with a non-Firestore value (${known})`;
      }
    }

    // There is deliberately no argument-SHAPE rule here. The shape of the arguments says
    // nothing about what the receiver is, and reading it as evidence drops real writes:
    // `ref.create(payload, {})`, `ref.set(payload, mergeOpts())` and a transaction handle
    // under any name all "fail" a shape test while being ordinary Firestore writes.
    return null;
  }

  /**
   * The receiver's own declaration supplies the dispatched method: an object literal with
   * that property, or `this` inside a class that declares that member. With an unresolved
   * selector there is no name to check, so the object literal / declared class itself is
   * the evidence — neither can ever be a Firestore handle.
   *
   * @returns {string | null}
   */
  function ownMemberDispatch(facts, resolver, receiverNode, methods) {
    const declares = (names) => !methods.length || methods.every((method) => names.has(method));

    if (receiverNode.kind === ts.SyntaxKind.ThisKeyword) {
      for (let parent = receiverNode.parent; parent; parent = parent.parent) {
        if (!ts.isClassDeclaration(parent) && !ts.isClassExpression(parent)) continue;
        const names = new Set();
        for (const member of parent.members) {
          if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name))) {
            names.add(member.name.text);
          }
        }
        if (declares(names)) {
          return `\`this\` in class ${parent.name?.text ?? '(anonymous)'}, whose own members supply the dispatched method`;
        }
        return null;
      }
      return null;
    }

    let literal = receiverNode;
    if (ts.isIdentifier(literal)) {
      const decl = resolver.nearestDecl(literal.text, literal.pos, literal);
      if (!decl?.initializer) return null;
      literal = stripWrappers(decl.initializer);
    }
    if (!ts.isObjectLiteralExpression(literal)) return null;
    const names = new Set();
    for (const property of literal.properties) {
      if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))) {
        names.add(property.name.text);
      }
    }
    return declares(names)
      ? 'receiver is an object literal whose own properties supply the dispatched method'
      : null;
  }

  /**
   * Which two properties of ONE carrier value this write reads, or null when the target and
   * the payload are not two halves of a single carrier.
   *
   * Two shapes qualify. `w.ref` / `w.data` reads both properties directly. The second is the
   * generic claimed-job shape: a carrier supplies the document AND the patch BUILDER
   * that shapes it, and the writer calls the builder into a local first —
   * `const claimPatch = args.claimPatch(current, expiry); tx.update(args.ref, claimPatch)`.
   * The two halves still come from one carrier value, so the possibilities are its call sites'
   * pairs, not the cross-product of every caller's document with every caller's patch. The
   * local must have exactly ONE visible declaration: a rebound binding is not one value.
   */
  /**
   * The one `const` binding of a core map entry that a write's target AND its payload both
   * read — `const slot = MAP[kind]`, then `db.doc(toPath(slot.ownerDoc(id)))` written with
   * `{ [slot.field]: value }` — or null. Both halves hold the SAME evaluation of the lookup, so
   * the write is one of the map's entries, never a mix of two: it is read once per entry, that
   * entry's document with that entry's keys, instead of every document against every key.
   *
   * Only `const` declarations are followed, through identifiers alone; a `let`, a parameter,
   * a helper's return, or a second lookup of the same map is a different evaluation, so it
   * contributes no binding and the write keeps the full cross-product.
   */
  function sharedMapEntryBinding(facts, resolver, refNode, dataNode) {
    if (!refNode || !dataNode) return null;
    const bindingsOf = (root) => {
      const found = new Set();
      const seen = new Set();
      const visit = (node, depth) => {
        if (depth > PAYLOAD_DEPTH * 4 || seen.has(node)) return;
        seen.add(node);
        if (ts.isIdentifier(node)) {
          const decls = resolver.visibleDecls(node.text, node.pos, node);
          const declaration = decls.length === 1 ? decls[0].initializer?.parent : null;
          if (
            !declaration ||
            !ts.isVariableDeclaration(declaration) ||
            !ts.isIdentifier(declaration.name) ||
            !ts.isVariableDeclarationList(declaration.parent) ||
            (declaration.parent.flags & ts.NodeFlags.Const) === 0
          ) {
            return;
          }
          const initializer = stripParens(stripWrappers(declaration.initializer));
          if (ts.isElementAccessExpression(initializer) && coreMapEntries(initializer, facts, facts.source)) {
            found.add(initializer);
            return;
          }
          visit(initializer, depth + 1);
          return;
        }
        // A property NAME is not a reference to a binding.
        if (ts.isPropertyAccessExpression(node)) {
          visit(node.expression, depth + 1);
          return;
        }
        ts.forEachChild(node, (child) => visit(child, depth + 1));
      };
      visit(root, 0);
      return found;
    };
    const fromRef = bindingsOf(refNode);
    if (!fromRef.size) return null;
    const shared = [...bindingsOf(dataNode)].filter((access) => fromRef.has(access));
    if (shared.length !== 1) return null;
    const access = shared[0];
    const imported = facts.imports.get(stripParens(access.expression).text);
    const keys = Object.keys(registry.coreConstMap(imported.imported));
    return keys.length > 1 && keys.length <= MAX_CANDIDATES ? { access, keys } : null;
  }

  function carrierPairing(facts, resolver, refNode, dataNode) {
    if (!dataNode || !refNode) return null;
    // `db.doc(op.path)` with `op.data` — the carrier holds the document's PATH beside its payload.
    if (
      ts.isCallExpression(refNode) &&
      ts.isPropertyAccessExpression(refNode.expression) &&
      refNode.expression.name.text === 'doc' &&
      refNode.arguments.length === 1 &&
      resolver.isFirestoreRoot(refNode.expression.expression)
    ) {
      const path = stripWrappers(refNode.arguments[0]);
      const paired = ts.isPropertyAccessExpression(path) ? carrierPairing(facts, resolver, path, dataNode) : null;
      return paired && !paired.invoke ? { ...paired, refIsPath: true } : null;
    }
    if (!ts.isPropertyAccessExpression(refNode)) return null;
    const { source } = facts;
    const carrierText = refNode.expression.getText(source);
    if (
      ts.isPropertyAccessExpression(dataNode) &&
      dataNode.expression.getText(source) === carrierText
    ) {
      return {
        carrier: refNode.expression,
        refProperty: refNode.name.text,
        dataProperty: dataNode.name.text,
        invoke: false,
      };
    }
    if (!ts.isIdentifier(dataNode)) return null;
    const declarations = resolver.visibleDecls(dataNode.text, dataNode.pos, dataNode);
    if (declarations.length !== 1 || !declarations[0].initializer) return null;
    const built = stripWrappers(declarations[0].initializer);
    if (!ts.isCallExpression(built)) return null;
    const callee = stripWrappers(built.expression);
    if (!ts.isPropertyAccessExpression(callee) || callee.expression.getText(source) !== carrierText) return null;
    return {
      carrier: refNode.expression,
      refProperty: refNode.name.text,
      dataProperty: callee.name.text,
      invoke: true,
    };
  }

  /**
   * The removal-only table entry a value is — `TABLE.entry`, or a const naming it — when `TABLE` is
   * the declaration a profile's `removalOnlyTables` names, in the module it names. Returns
   * `{ table, entry }` or null.
   */
  function v1SourceEntry(facts, resolver, expr, depth = 0) {
    if (depth > CARRIER_DEPTH) return null;
    const node = stripWrappers(expr);
    if (ts.isIdentifier(node)) {
      const declarations = resolver.visibleDecls(node.text, node.pos, node);
      return declarations.length === 1 && declarations[0].initializer
        ? v1SourceEntry(facts, resolver, declarations[0].initializer, depth + 1)
        : null;
    }
    if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression)) return null;
    const name = node.expression.text;
    const table = profile.removalOnlyTables.find((candidate) => candidate.exportName === name);
    if (!table) return null;
    const imported = facts.imports.get(name);
    const declaredIn = imported ? declaringFile(resolveImport(facts.relPath, imported.module), imported.imported) : facts.relPath;
    return declaredIn === table.module ? { table, entry: node.name.text } : null;
  }

  /**
   * The removal-only document a write targets — `db.collection(source.collection).doc(source.documentId)`
   * with both halves from ONE entry of one removal-only table — or null. Those documents are outside
   * the core's path builders and schemas, so a write may only remove from them.
   */
  function v1SourceDocument(facts, resolver, expr, depth = 0) {
    if (depth > CARRIER_DEPTH) return null;
    const node = stripWrappers(expr);
    if (ts.isIdentifier(node)) {
      const declarations = resolver.visibleDecls(node.text, node.pos, node);
      return declarations.length === 1 && declarations[0].initializer
        ? v1SourceDocument(facts, resolver, declarations[0].initializer, depth + 1)
        : null;
    }
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    if (node.expression.name.text !== 'doc' || node.arguments.length !== 1) return null;
    const collection = stripWrappers(node.expression.expression);
    if (
      !ts.isCallExpression(collection) ||
      !ts.isPropertyAccessExpression(collection.expression) ||
      collection.expression.name.text !== 'collection' ||
      collection.arguments.length !== 1
    ) return null;
    const documentId = stripWrappers(node.arguments[0]);
    const collectionName = stripWrappers(collection.arguments[0]);
    if (
      !ts.isPropertyAccessExpression(documentId) ||
      !ts.isPropertyAccessExpression(collectionName) ||
      documentId.name.text !== 'documentId' ||
      collectionName.name.text !== 'collection'
    ) return null;
    const entry = v1SourceEntry(facts, resolver, documentId.expression);
    const sibling = v1SourceEntry(facts, resolver, collectionName.expression);
    return entry && sibling && entry.table === sibling.table && entry.entry === sibling.entry ? entry : null;
  }

  function buildWrite(facts, resolver, call, methods, classified, line) {
    const { source } = facts;

    /**
     * One candidate method's reading of this call. `set`/`create`/`add` and `update` read a
     * DOTTED key differently (BACKEND-104) and address a collection differently, so a
     * selector with several candidates is checked under EVERY candidate's rules — a
     * violation under any one of them is a violation.
     */
    const readAs = (method) => {
      const isUpdate = method === 'update';
      const collectionAdd = method === 'add';

      // A removal-only document has no schema: a write may only REMOVE from it.
      const v1Entry = v1SourceDocument(facts, resolver, classified.refExpr);
      if (v1Entry) {
        const removal = isUpdate && classified.dataExpr && isRemovalPayload(classified.dataExpr);
        return {
          single: {
            method,
            templates: removal ? [] : null,
            unresolvedReason: removal
              ? null
              : `${v1Entry.table.exportName}.${v1Entry.entry} is a ${v1Entry.table.label}: a write may only remove from it`,
            handBuilt: false,
            keys: [],
            casts: [],
            opaque: null,
            literals: new Map(),
          },
        };
      }

      // `const choice = flag ? { ref: a, patch: aData } : { ref: b, patch: bData };`
      // followed by `choice.ref.set(choice.patch)` has TWO paired possibilities, not the
      // four target/payload combinations an independent union would invent. We accept only
      // a same-carrier, finite, syntactically direct pair; anything less stays fail-closed.
      const refNode = stripWrappers(classified.refExpr);
      const dataNode = classified.dataExpr ? stripWrappers(classified.dataExpr) : null;

      // `const slot = MAP[kind]` read by both the target and the payload: one branch per entry.
      const entryBinding = classified.fieldPathArgs ? null : sharedMapEntryBinding(facts, resolver, refNode, dataNode);
      if (entryBinding) {
        const perEntry = [];
        for (const key of entryBinding.keys) {
          narrowedEntries.set(entryBinding.access, key);
          try {
            const target = resolver.resolveTarget(classified.refExpr, { collectionAdd });
            const read = payloadKeys(facts, resolver, classified.dataExpr, isUpdate);
            perEntry.push({
              method,
              templates: target.templates ? [...target.templates] : null,
              unresolvedReason: target.reason,
              handBuilt: target.handBuilt,
              keys: [...read.keys],
              casts: read.casts,
              opaque: read.opaque,
              literals: read.literals,
            });
          } finally {
            narrowedEntries.delete(entryBinding.access);
          }
        }
        return { correlated: perEntry };
      }

      const pairing = classified.fieldPathArgs ? null : carrierPairing(facts, resolver, refNode, dataNode);
      if (pairing) {
        const pairs = resolver.correlatedCarrierPairs(pairing.carrier, pairing.refProperty, pairing.dataProperty);
        const correlated = [];
        let readable = Boolean(pairs?.length) && pairs.length <= MAX_CANDIDATES;
        for (const pair of readable ? pairs : []) {
          // A pair whose payload is the literal `null` stores nothing: a write of `null` throws.
          if (!pairing.invoke && stripWrappers(pair.right.node).kind === ts.SyntaxKind.NullKeyword) continue;
          // Each pair is resolved by ITS OWN file's resolver: a queue entry constructed
          // in another module is read there, and a foreign node's text read against this
          // file's source would name whatever happens to sit at that offset.
          const target = resolverFor(pair.left.facts).resolveTarget(pair.left.node, { collectionAdd });
          const read = pairing.invoke
            ? payloadKeysOfCallback(pair.right, isUpdate)
            : payloadKeys(pair.right.facts, resolverFor(pair.right.facts), pair.right.node, isUpdate);
          if (!read) {
            readable = false;
            break;
          }
          correlated.push({
            method,
            templates: target.templates ? [...target.templates] : null,
            unresolvedReason: target.reason,
            handBuilt: target.handBuilt,
            keys: [...read.keys],
            casts: read.casts,
            opaque: read.opaque,
            literals: read.literals,
          });
        }
        if (readable && correlated.length) return { correlated };
      }

      const target = resolver.resolveTarget(classified.refExpr, { collectionAdd });
      let keys = new Set();
      let casts = [];
      let opaque = null;
      let literals = new Map();
      if (classified.fieldPathArgs) {
        for (let i = 0; i < classified.fieldPathArgs.length; i += 2) {
          const argument = stripWrappers(classified.fieldPathArgs[i]);
          if (ts.isStringLiteralLike(argument)) keys.add(argument.text.split('.')[0]);
          else opaque ??= 'variadic update() field path is not a literal';
        }
      } else {
        const read = payloadKeys(facts, resolver, classified.dataExpr, isUpdate);
        keys = read.keys;
        casts = read.casts;
        opaque = read.opaque;
        literals = read.literals;
      }
      return {
        single: {
          method,
          templates: target.templates ? [...target.templates] : null,
          unresolvedReason: target.reason,
          handBuilt: target.handBuilt,
          keys: [...keys],
          casts,
          opaque,
          literals,
        },
      };
    };

    const readings = methods.map(readAs);
    const first = readings[0];
    const base = first.correlated ? first.correlated[0] : first.single;
    const correlatedBranches =
      readings.length === 1 && first.single
        ? null
        : readings.flatMap((reading) => reading.correlated ?? [reading.single]);

    const snippet = facts.text
      .slice(call.getStart(source), call.getEnd())
      .split('\n')[0]
      .trim()
      .slice(0, 120);
    return {
      file: facts.relPath,
      line,
      pos: call.getStart(source),
      method: methods.join('|'),
      fn: enclosingWriteFunction(call),
      at: `${facts.relPath}:${line}`,
      snippet,
      templates: base.templates,
      unresolvedReason: base.unresolvedReason,
      handBuilt: base.handBuilt,
      keys: base.keys,
      casts: base.casts,
      opaque: base.opaque,
      literals: base.literals,
      correlatedBranches,
    };
  }

  // ---- fixed point --------------------------------------------------------

  for (let round = 0; round < maxRounds; round++) {
    const {
      pendingParamArgs,
      pendingReturns,
      pendingParamPayloads,
      pendingParamCarrierProperties,
      pendingReturnCarrierProperties,
      pendingParamCollections,
      pendingParamCallbackPayloads,
      pendingParamArrayEntries,
      pendingParamNotFirestore,
      pendingParamValues,
      pendingParamGroups,
      pendingReturnCollections,
      pendingReturnGroups,
      pendingReturnArrayProperties,
      pendingPassThrough,
      pendingNonFirestoreReturns,
    } = sweep({ collectKnowledge: true });
    let changed = false;
    const mergeStringSets = (pending, into) => {
      for (const [key, values] of pending) {
        const existing = into.get(key) ?? new Set();
        for (const value of values) {
          if (!existing.has(value)) {
            existing.add(value);
            changed = true;
          }
        }
        if (existing.size <= MAX_CANDIDATES) into.set(key, existing);
      }
    };
    for (const [key, reason] of pendingNonFirestoreReturns) {
      if (returnNonFirestore.get(key) !== reason) {
        returnNonFirestore.set(key, reason);
        changed = true;
      }
    }
    for (const [key, index] of pendingPassThrough) {
      if (returnPassThrough.get(key) !== index) {
        returnPassThrough.set(key, index);
        changed = true;
      }
    }
    mergeStringSets(pendingParamGroups, paramGroups);
    mergeStringSets(pendingReturnCollections, returnCollections);
    mergeStringSets(pendingReturnGroups, returnGroups);
    for (const [key, values] of pendingParamValues) {
      const existing = paramValues.get(key) ?? [];
      for (const value of values) {
        if (!existing.some((candidate) => candidate.facts === value.facts && candidate.node === value.node)) {
          existing.push(value);
          changed = true;
        }
      }
      if (existing.length <= MAX_CANDIDATES) paramValues.set(key, existing);
    }
    for (const [key, seen] of pendingParamNotFirestore) {
      const settled = seen.reason && !seen.unknown ? seen.reason : null;
      if (settled && paramNotFirestore.get(key) !== settled) {
        paramNotFirestore.set(key, settled);
        changed = true;
      }
    }
    for (const [key, values] of pendingParamCollections) {
      const existing = paramCollections.get(key) ?? new Set();
      for (const value of values) {
        if (!existing.has(value)) {
          existing.add(value);
          changed = true;
        }
      }
      if (existing.size <= MAX_CANDIDATES) paramCollections.set(key, existing);
    }
    for (const [key, read] of pendingParamCallbackPayloads) {
      const existing = paramCallbackPayloads.get(key) ?? { keys: new Set(), opaque: null };
      for (const field of read.keys) {
        if (!existing.keys.has(field)) {
          existing.keys.add(field);
          changed = true;
        }
      }
      if (!existing.opaque && read.opaque) {
        existing.opaque = read.opaque;
        changed = true;
      }
      paramCallbackPayloads.set(key, existing);
    }
    for (const [key, entries] of pendingParamArrayEntries) {
      const existing = paramArrayEntries.get(key) ?? [];
      for (const entry of entries) {
        if (!existing.some((candidate) => candidate.facts === entry.facts && candidate.node === entry.node)) {
          existing.push(entry);
          changed = true;
        }
      }
      if (existing.length <= MAX_QUEUE_ENTRIES) paramArrayEntries.set(key, existing);
    }
    for (const [key, templates] of pendingReturns) {
      const existing = returnTargets.get(key);
      if (!existing) {
        returnTargets.set(key, new Set(templates));
        changed = true;
        continue;
      }
      for (const template of templates) {
        if (!existing.has(template)) {
          existing.add(template);
          changed = true;
        }
      }
    }
    for (const [key, templates] of pendingParamArgs) {
      const existing = paramTargets.get(key);
      if (!existing) {
        paramTargets.set(key, new Set(templates));
        changed = true;
        continue;
      }
      for (const template of templates) {
        if (!existing.has(template)) {
          existing.add(template);
          changed = true;
        }
      }
    }
    for (const [key, read] of pendingParamPayloads) {
      const existing = paramPayloads.get(key);
      if (!existing) {
        paramPayloads.set(key, { keys: new Set(read.keys), opaque: read.opaque });
        changed = true;
        continue;
      }
      for (const field of read.keys) {
        if (!existing.keys.has(field)) {
          existing.keys.add(field);
          changed = true;
        }
      }
      if (!existing.opaque && read.opaque) {
        existing.opaque = read.opaque;
        changed = true;
      }
    }
    for (const [key, values] of pendingParamCarrierProperties) {
      const existing = paramCarrierProperties.get(key) ?? [];
      let added = false;
      for (const value of values) {
        // AST identities are stable for this parsed tree; do not inflate candidates each round.
        if (!existing.some((candidate) => candidate.facts === value.facts && candidate.node === value.node)) {
          existing.push(value);
          added = true;
        }
      }
      if (existing.length <= MAX_CANDIDATES) {
        paramCarrierProperties.set(key, existing);
        changed ||= added;
      }
    }
    for (const [key, properties] of pendingReturnArrayProperties) {
      const existing = returnArrayProperties.get(key) ?? new Map();
      for (const [property, values] of properties) {
        const known = existing.get(property) ?? [];
        for (const value of values) {
          if (!known.some((candidate) => candidate.facts === value.facts && candidate.node === value.node)) {
            known.push(value);
            changed = true;
          }
        }
        if (known.length <= MAX_CANDIDATES) existing.set(property, known);
      }
      if (existing.size) returnArrayProperties.set(key, existing);
    }
    for (const [key, properties] of pendingReturnCarrierProperties) {
      const existing = returnCarrierProperties.get(key) ?? new Map();
      let added = false;
      for (const [property, values] of properties) {
        const known = existing.get(property) ?? [];
        for (const value of values) {
          if (!known.some((candidate) => candidate.facts === value.facts && candidate.node === value.node)) {
            known.push(value);
            added = true;
          }
        }
        if (known.length > MAX_CANDIDATES) {
          existing.clear();
          added = false;
          break;
        }
        existing.set(property, known);
      }
      if (existing.size) {
        returnCarrierProperties.set(key, existing);
        changed ||= added;
      }
    }
    if (!changed) break;
  }

  packageBuilderUses.length = 0;
  const { writes, notFirestore, unclassified } = sweep({ collectKnowledge: false });
  return { writes, notFirestore, unclassified, packageBuilderUses, returnTargets, paramTargets };
}

/**
 * The INDEPENDENT structural sweep. It shares the FILE LIST with the classifier and nothing
 * else: its own write-method names, its own indirection names, its own non-Firestore
 * constructor list, its own ceiling, and its own (deliberately minimal) selector reading.
 * Reusing the classifier's resolver, call-shape predicate or drop list is what made the two
 * halves share every blind spot by construction, which is no cross-check at all.
 *
 * It is deliberately DUMBER and STRICTER than the classifier. It flags:
 *   - every call whose callee is a property access naming a write method;
 *   - every call whose callee is an ELEMENT ACCESS, unless the selector is a literal that is
 *     not a write method, or the receiver is positively non-Firestore;
 *   - the same through `.call` / `.apply` / `.bind` / `Reflect.apply`, and through a method
 *     obtained reflectively, which carries no readable name at all.
 *
 * Each site it finds must be accounted for by the analyzer — as a classified write, as an
 * explicit not-Firestore classification, or as a reported unclassified call. A site the
 * classifier never saw is a hole, and a hole in a fail-closed guard reads as a clean tree.
 * This is a per-call-site correspondence, never a count or a floor (QUALITY-007).
 */
export function enumerateWriteCallSites(files) {
  /** This sweep's OWN names — never imported from the classifier. */
  const WRITE_NAMES = ['set', 'update', 'create', 'add'];
  const INDIRECTION_NAMES = ['call', 'apply', 'bind'];
  const PLAIN_CONTAINERS = [
    'Map', 'Set', 'WeakMap', 'WeakSet', 'URLSearchParams', 'Headers', 'FormData', 'URL', 'Array',
  ];
  const PLAIN_CONTAINER_TYPE =
    /^(readonly\s+)?(Map|Set|WeakMap|WeakSet|ReadonlyMap|ReadonlySet|URLSearchParams|Headers|FormData|URL|Record|Array|Partial)\s*(<|\[|\||$)/;
  const REFLECTIVE = {
    Object: ['getOwnPropertyDescriptor', 'getOwnPropertyDescriptors'],
    Reflect: ['get', 'getOwnPropertyDescriptor'],
  };
  const STRUCTURAL_DEPTH = 8;

  const unwrap = (value) => {
    let current = value;
    while (
      current &&
      (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current) ||
        ts.isSatisfiesExpression?.(current))
    ) current = current.expression;
    return current;
  };

  const sites = [];
  for (const facts of files) {
    const { source } = facts;

    /** The ONE local declaration an identifier has, or null when that is not unambiguous. */
    const soleInitializer = (name) => {
      const declared = (facts.varDecls.get(name) ?? []).filter((entry) => entry.initializer);
      return declared.length === 1 ? declared[0].initializer : null;
    };

    /** A function value pulled off an object by reflection carries no readable name. */
    const reflective = (expr, depth = 0) => {
      if (!expr || depth > STRUCTURAL_DEPTH) return false;
      const node = unwrap(expr);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const owner = unwrap(node.expression.expression);
        if (ts.isIdentifier(owner) && (REFLECTIVE[owner.text] ?? []).includes(node.expression.name.text)) {
          return true;
        }
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return reflective(node.expression, depth + 1);
      }
      if (ts.isIdentifier(node)) return reflective(soleInitializer(node.text), depth + 1);
      return false;
    };

    /** Positive evidence the receiver is an ordinary container, not a Firestore handle. */
    const plainReceiver = (expr, depth = 0) => {
      if (!expr || depth > STRUCTURAL_DEPTH) return null;
      const node = unwrap(expr);
      if (ts.isObjectLiteralExpression(node)) return 'an object literal';
      if (ts.isArrayLiteralExpression(node)) return 'an array literal';
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && PLAIN_CONTAINERS.includes(node.expression.text)) {
        return `new ${node.expression.text}()`;
      }
      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) {
            return `\`this\` in a class declared in this file`;
          }
        }
        return null;
      }
      if (ts.isIdentifier(node)) {
        const initializer = soleInitializer(node.text);
        if (initializer) return plainReceiver(initializer, depth + 1);
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (!ts.isFunctionLike(parent)) continue;
          const parameter = parent.parameters.find(
            (entry) => ts.isIdentifier(entry.name) && entry.name.text === node.text,
          );
          if (!parameter?.type) break;
          const declared = parameter.type.getText(source).trim();
          return PLAIN_CONTAINER_TYPE.test(declared) ? `a ${declared.slice(0, 40)} parameter` : null;
        }
      }
      return null;
    };

    /**
     * What the call invokes, structurally.
     *   { method }          a literal write-method name
     *   { method: null }    a name this sweep cannot read — treated as possibly a write
     *   null                provably not one of the write-method names
     */
    const invoked = (expr, args, depth = 0) => {
      if (!expr) return null;
      if (depth > STRUCTURAL_DEPTH) return { method: null, receiver: null };
      const node = unwrap(expr);
      if (ts.isPropertyAccessExpression(node)) {
        const name = node.name.text;
        if (WRITE_NAMES.includes(name)) return { method: name, receiver: node.expression };
        if (INDIRECTION_NAMES.includes(name)) {
          const inner = invoked(node.expression, args, depth + 1);
          if (inner) return { method: inner.method, receiver: args?.[0] ?? inner.receiver };
          // `Function.prototype.call.call(ref.set, ref, …)` — the bound value is itself an
          // indirection, so the function actually invoked is the first argument.
          const viaArgument = args?.length ? invoked(args[0], args.slice(1), depth + 1) : null;
          if (viaArgument) return { method: viaArgument.method, receiver: args[1] ?? viaArgument.receiver };
          return reflective(node.expression, depth + 1) ? { method: null, receiver: args?.[0] ?? null } : null;
        }
        return reflective(node, depth + 1) ? { method: null, receiver: args?.[0] ?? null } : null;
      }
      if (ts.isElementAccessExpression(node)) {
        const selector = node.argumentExpression ? unwrap(node.argumentExpression) : null;
        if (selector && ts.isStringLiteralLike(selector)) {
          return WRITE_NAMES.includes(selector.text) ? { method: selector.text, receiver: node.expression } : null;
        }
        return { method: null, receiver: node.expression };
      }
      if (ts.isIdentifier(node)) {
        const initializer = soleInitializer(node.text);
        return initializer ? invoked(initializer, args, depth + 1) : null;
      }
      return null;
    };

    const walk = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        const args = [...node.arguments];
        let found = null;
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(unwrap(callee.expression)) &&
          unwrap(callee.expression).text === 'Reflect' &&
          callee.name.text === 'apply' &&
          args.length
        ) {
          const target = invoked(args[0], args.slice(1), 0);
          if (target) found = { method: target.method, receiver: args[1] ?? target.receiver };
        } else {
          found = invoked(callee, args, 0);
        }
        // A literal write-method name is always inventoried: the classifier owns deciding
        // what it writes to. An UNREADABLE name is inventoried unless the receiver is
        // positively an ordinary container.
        if (found && (found.method !== null || !plainReceiver(found.receiver))) {
          sites.push({
            file: facts.relPath,
            pos: node.getStart(source),
            method: found.method ?? 'computed',
            at: `${facts.relPath}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
            snippet: facts.text.slice(node.getStart(source), node.getEnd()).split('\n')[0].trim().slice(0, 120),
          });
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  return sites;
}

// ---------------------------------------------------------------------------
// Violations + coverage
// ---------------------------------------------------------------------------

/** Which tree a repo-relative path belongs to. */
function treeOf(relPath, trees) {
  for (const tree of trees) if (relPath === tree || relPath.startsWith(`${tree}/`)) return tree;
  return 'other';
}

/**
 * Turn resolved writes into violations, applying the reviewed exception list.
 * Every exception is matched by file + kind + a write-site marker + the exact
 * field/detail, so it cannot silently absorb a different violation or relocated write.
 */
export function evaluate({
  writes,
  registry,
  exceptions = [],
  trees,
  notFirestore = [],
  unclassified = [],
  callSites = null,
  packageBuilderUses = [],
}) {
  const remaining = exceptions.map((entry) => ({ ...entry, used: 0 }));
  const applied = [];
  const violations = [];

  // The STRUCTURAL identity of a write site: its file, the named function or method that
  // owns it, and — where one function holds several textually identical writes — which of
  // them this is. A line number goes stale on the next unrelated edit above it; snippet text
  // alone is shared by two different writes that merely read the same.
  const ordinals = new Map();
  for (const write of writes) {
    const key = `${write.file} :: ${write.fn ?? '(module)'} :: ${write.snippet}`;
    const next = (ordinals.get(key) ?? 0) + 1;
    ordinals.set(key, next);
    write.snippetOrdinal = next;
  }

  // A package-builder assertion is consumed during analysis, not here; carry its usage over
  // so it is not reported stale while it is doing its job.
  for (const use of packageBuilderUses) {
    const entry = remaining.find(
      (candidate) =>
        candidate.kind === VIOLATION_KINDS.PACKAGE_BUILDER &&
        candidate.file === use.file &&
        candidate.callee === use.callee &&
        candidate.module === use.module &&
        (candidate.property ?? null) === (use.property ?? null) &&
        JSON.stringify(candidate.args ?? null) === JSON.stringify(use.args ?? null),
    );
    if (entry) {
      entry.used += 1;
      if (entry.used === 1) applied.push({ kind: entry.kind, at: `${entry.file} ${entry.callee}()`, why: entry.why });
    }
  }

  const excuse = (kind, write, detail) => {
    const entry = remaining.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.file === write.file &&
        candidate.used < (candidate.count ?? 1) &&
        // The STRUCTURAL site binding: the named function that owns the write, plus the
        // ordinal when that function holds identical snippets. Without it, two different
        // writes that merely READ the same shared one entry between them.
        typeof candidate.fn === 'string' &&
        candidate.fn === (write.fn ?? '(module)') &&
        (candidate.nth === undefined || candidate.nth === write.snippetOrdinal) &&
        typeof candidate.marker === 'string' &&
        write.snippet.includes(candidate.marker) &&
        (candidate.field !== undefined || candidate.detail !== undefined) &&
        (candidate.field === undefined || candidate.field === detail?.match(/^'([^']+)'/)?.[1]) &&
        (candidate.detail === undefined || candidate.detail === detail),
    );
    if (!entry) return false;
    entry.used += 1;
    applied.push({ kind, at: write.at, why: entry.why });
    return true;
  };

  const coverage = new Map();
  const bump = (tree, field) => {
    if (!coverage.has(tree)) {
      coverage.set(tree, {
        writes: 0,
        resolved: 0,
        payloadsParsed: 0,
        payloadsRead: 0,
        exceptions: 0,
        violations: 0,
      });
    }
    coverage.get(tree)[field] += 1;
  };

  for (const write of writes) {
    const tree = treeOf(write.file, trees);
    bump(tree, 'writes');
    const before = violations.length;
    const appliedBefore = applied.length;

    const branches = write.correlatedBranches ?? [{
      templates: write.templates,
      unresolvedReason: write.unresolvedReason,
      handBuilt: write.handBuilt,
      keys: write.keys,
      casts: write.casts,
      opaque: write.opaque,
      literals: write.literals,
    }];
    let branchDiffable = true;

    for (const branch of branches) {
      for (const cast of branch.casts) {
        if (!excuse(VIOLATION_KINDS.PAYLOAD_CAST, write, cast)) {
          violations.push({
            kind: VIOLATION_KINDS.PAYLOAD_CAST,
            at: write.at,
            detail: `write payload cast \`as ${cast}\``,
            snippet: write.snippet,
          });
        }
      }

      if (branch.handBuilt && !excuse(VIOLATION_KINDS.HAND_BUILT_PATH, write)) {
        violations.push({
          kind: VIOLATION_KINDS.HAND_BUILT_PATH,
          at: write.at,
          detail: 'document path assembled by hand — use PATH_BUILDERS',
          snippet: write.snippet,
        });
      }

      if (!branch.templates) {
        if (!excuse(VIOLATION_KINDS.UNRESOLVED_TARGET, write, branch.unresolvedReason)) {
          violations.push({
            kind: VIOLATION_KINDS.UNRESOLVED_TARGET,
            at: write.at,
            detail: branch.unresolvedReason ?? 'target document did not resolve',
            snippet: write.snippet,
          });
        }
      } else {
        if (branch.opaque) {
          if (!excuse(VIOLATION_KINDS.UNREADABLE_PAYLOAD, write, branch.opaque)) {
            violations.push({
              kind: VIOLATION_KINDS.UNREADABLE_PAYLOAD,
              at: write.at,
              detail: branch.opaque,
              snippet: write.snippet,
            });
          }
        }
        // A target and a payload chosen by one decision are paired only where the analysis PROVES
        // it: a same-carrier pair, or a core map entry both sides read, each split into one
        // branch per possibility before it reaches here. Two independent choices over the same
        // set of documents prove nothing, so every candidate template is diffed against every
        // key the payload can carry.
        const diffable = new Map();
        for (const template of branch.templates) {
          const narrowed = narrowedDeclaredKeys(registry.schemaFor(template), branch.literals);
          const declared = narrowed ?? registry.declaredFor(template);
          if (!declared || declared.open) {
            // An undiffable SOLE candidate leaves the payload checked against nothing at
            // all. That state may not be excused into silence: an exception can say a
            // known key is fine, never that an unknown set of them is.
            const soleCandidate = branch.templates.length === 1;
            const undiffableDetail =
              `'${template}' has no readable declared keys (a wrapper/record/open schema), ` +
              'so this payload was diffed against nothing';
            if (soleCandidate || !excuse(VIOLATION_KINDS.UNDIFFABLE_TEMPLATE, write, undiffableDetail)) {
              violations.push({
                kind: VIOLATION_KINDS.UNDIFFABLE_TEMPLATE,
                at: write.at,
                detail: undiffableDetail,
                templates: [template],
                snippet: write.snippet,
              });
            }
            continue;
          }
          diffable.set(template, declared);
        }
        branchDiffable = branchDiffable && diffable.size === branch.templates.length;

        for (const key of branch.keys) {
          const undeclaredIn = [];
          for (const [template, declared] of diffable) {
            if (!declared.keys.has(key)) undeclaredIn.push(template);
          }
          // An exception's marker matches the FULL detail, so it can name the exact field
          // it vouches for (`'hidden' is not declared`) instead of a bare substring that
          // would also absorb `hiddenAt` / `hiddenBy`.
          const detail = `'${key}' is not declared by ${undeclaredIn.join(' | ')}`;
          if (undeclaredIn.length && !excuse(VIOLATION_KINDS.UNDECLARED_FIELD, write, detail)) {
            violations.push({
              kind: VIOLATION_KINDS.UNDECLARED_FIELD,
              at: write.at,
              detail,
              field: key,
              templates: undeclaredIn,
              snippet: write.snippet,
            });
          }
        }
      }
    }
    if (branches.every((branch) => branch.templates)) bump(tree, 'resolved');
    // `payloadsParsed` is the honest syntax-level number: the payload was read. It is NOT a
    // coverage claim — only `payloadsRead`, which additionally requires every candidate
    // template to have READABLE declared keys, means the write was actually verified.
    if (branches.every((branch) => branch.templates && !branch.opaque)) bump(tree, 'payloadsParsed');
    if (branchDiffable && branches.every((branch) => branch.templates && !branch.opaque)) {
      bump(tree, 'payloadsRead');
    }
    if (violations.length > before) bump(tree, 'violations');
    if (applied.length > appliedBefore) bump(tree, 'exceptions');
  }

  // A runtime-selected write method on a receiver the classifier could not prove is
  // something else. It is reported HERE rather than dropped, so it ends in an outcome even
  // where the structural sweep is not run.
  for (const call of unclassified) {
    violations.push({
      kind: VIOLATION_KINDS.UNCLASSIFIED_CALL,
      at: call.at,
      detail: call.reason,
      snippet: call.snippet,
    });
    bump(treeOf(call.file, trees), 'violations');
  }

  // The independent structural cross-check. Every call site it finds must be accounted for —
  // classified as a write, positively classified as not-Firestore, or already reported above.
  if (callSites) {
    const accounted = new Set([
      ...writes.map((write) => `${write.file}@${write.pos}`),
      ...notFirestore.map((entry) => `${entry.file}@${entry.pos}`),
      ...unclassified.map((entry) => `${entry.file}@${entry.pos}`),
    ]);
    for (const site of callSites) {
      if (accounted.has(`${site.file}@${site.pos}`)) continue;
      violations.push({
        kind: VIOLATION_KINDS.UNCLASSIFIED_CALL,
        at: site.at,
        detail:
          `\`.${site.method}(\` reached no classification — the write classifier never saw it. ` +
          'Every candidate must end in a Firestore write form or positive not-Firestore evidence.',
        snippet: site.snippet,
      });
      bump(treeOf(site.file, trees), 'violations');
    }
  }

  // An entry's `count` is EXACT. A count larger than the sites it really covers leaves the
  // surplus standing as a wildcard over whatever appears in that file next, so an entry that
  // excused fewer writes than it claims is as stale as one that excused none.
  const staleExceptions = remaining
    .filter((entry) => entry.used !== (entry.count ?? 1))
    .map(
      (entry) =>
        `${entry.kind} ${entry.file}${entry.fn ? ` ${entry.fn}()` : ''}` +
        `${entry.marker ? ` (${entry.marker})` : ''}` +
        `${entry.field ? ` [field=${entry.field}]` : ''}${entry.detail ? ` [detail=${entry.detail}]` : ''}` +
        `${entry.callee ? ` (${entry.callee}(${(entry.args ?? []).join(', ')}))` : ''}` +
        ` — applied ${entry.used} of ${entry.count ?? 1}`,
    );

  return { violations, applied, coverage, staleExceptions };
}

// ---------------------------------------------------------------------------
// Top-level run
// ---------------------------------------------------------------------------

/** Analyze in-memory sources — the shape the fixtures use. */
export function runGuardOnSources({
  sources,
  librarySources = {},
  registry,
  profile,
  exceptions = [],
  packageDeclarations = null,
  trees = ['fixture'],
}) {
  const files = Object.entries(sources).map(([rel, text]) => parseFile(rel, text));
  const libraryFiles = Object.entries(librarySources).map(([rel, text]) => parseFile(rel, text, { library: true }));
  const { writes, notFirestore, unclassified, packageBuilderUses } = analyzeFiles({
    files,
    libraryFiles,
    registry,
    profile,
    exceptions,
    packageDeclarations,
  });
  return {
    ...evaluate({
      writes,
      registry,
      exceptions,
      trees,
      notFirestore,
      unclassified,
      packageBuilderUses,
      callSites: enumerateWriteCallSites(files),
    }),
    writes,
    notFirestore,
    unclassified,
    staleExclusions: [],
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function formatReport({ coverage, violations, applied, staleExceptions, staleExclusions = [] }) {
  const lines = [];
  lines.push('Firestore write guard — coverage');
  lines.push(
    '  tree                       writes  target resolved  payload parsed  payload VERIFIED  exceptions  violations',
  );
  for (const [tree, row] of [...coverage.entries()].sort()) {
    lines.push(
      `  ${tree.padEnd(26)} ${String(row.writes).padStart(5)} ${String(row.resolved).padStart(16)} ${String(row.payloadsParsed).padStart(15)} ${String(row.payloadsRead).padStart(17)} ${String(row.exceptions).padStart(11)} ${String(row.violations).padStart(11)}`,
    );
  }
  lines.push('  (payload VERIFIED = read AND diffed against a readable schema; parsed is syntax only)');
  lines.push('');
  const byKind = new Map();
  for (const violation of violations) {
    if (!byKind.has(violation.kind)) byKind.set(violation.kind, []);
    byKind.get(violation.kind).push(violation);
  }
  lines.push(`VIOLATIONS: ${violations.length}`);
  for (const [kind, rows] of [...byKind.entries()].sort()) {
    lines.push(`\n  ${kind} (${rows.length})`);
    for (const row of rows.sort((a, b) => a.at.localeCompare(b.at))) {
      lines.push(`    ${row.at}  ${row.detail}`);
    }
  }
  if (applied.length) {
    lines.push(`\nEXCEPTIONS APPLIED: ${applied.length}`);
    for (const entry of applied) lines.push(`    ${entry.at}  ${entry.kind} — ${entry.why}`);
  }
  if (staleExceptions.length) {
    lines.push(`\nSTALE EXCEPTIONS (matched nothing — delete them): ${staleExceptions.length}`);
    for (const entry of staleExceptions) lines.push(`    ${entry}`);
  }
  if (staleExclusions.length) {
    lines.push(`\nSTALE EXCLUSIONS (no such path — delete them): ${staleExclusions.length}`);
    for (const entry of staleExclusions) lines.push(`    ${entry}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Registry loading
// ---------------------------------------------------------------------------

/**
 * Build the registry from the app's core package. `sources` are the core's entry points as
 * loaders — `core` (PATH_BUILDERS, COLLECTION_REFS, the constant maps), `docSchemas`
 * (COLLECTION_SCHEMAS), and any further `subpaths` whose exports are canonical — and
 * `constantMapNames` the core's path-constant maps the guard resolves names through. Every entry
 * point and constant map must load: a missing one would silently drop its canonical schemas or
 * names and pass writes the guard can no longer judge, so it fails instead.
 */
export async function loadRegistry({ sources, constantMapNames }) {
  const core = await sources.core();
  const docSchemas = await sources.docSchemas();
  const { COLLECTION_SCHEMAS } = docSchemas;
  if (!COLLECTION_SCHEMAS) throw new Error('firestore-guards: the core\'s docSchemas entry exports no COLLECTION_SCHEMAS');
  const subpaths = {};
  for (const [specifier, load] of Object.entries(sources.subpaths ?? {})) {
    try {
      Object.assign(subpaths, await load());
    } catch (cause) {
      throw new Error(`firestore-guards: core entry point ${specifier} did not load`, { cause });
    }
  }
  const constantMaps = {};
  for (const name of constantMapNames) {
    if (!core[name]) throw new Error(`firestore-guards: the core no longer exports the constant map ${name}`);
    constantMaps[name] = core[name];
  }
  // Only actual exports enter this map. Source-local aliases never do.
  return buildRegistry({
    PATH_BUILDERS: core.PATH_BUILDERS,
    COLLECTION_SCHEMAS,
    constantMaps,
    COLLECTION_REFS: core.COLLECTION_REFS ?? {},
    canonicalSchemas: { ...core, ...subpaths, ...docSchemas },
    coreExports: { ...core, ...subpaths, ...docSchemas },
  });
}
