import ts from 'typescript';
import { unwrap as unwrapNode } from '../../support/ast.js';
import { moduleImports } from '../../support/imports.js';
import { dirnameOf, normalizePath } from '../../support/paths.js';
import { escapeRegExp } from '../../support/text.js';

const joinPosix = (...parts) => normalizePath(parts.filter(Boolean).join('/')).path || '.';

/**
 * @param {object} config
 * @param {string} config.corePackage
 * @param {string} [config.coreLibraryRoot]
 * @param {Record<string, string>} [config.importAliases]
 * @param {string[]} [config.transactionTypeNames]
 * @param {string[]} [config.handleModulePrefixes]
 * @param {Array<{ exportName: string, module: string, label: string }>} [config.removalOnlyTables]
 */
export function createGuardProfile({
  corePackage,
  coreLibraryRoot = null,
  importAliases = {},
  transactionTypeNames = [],
  removalOnlyTables = [],
  handleModulePrefixes = [],
}) {
  if (typeof corePackage !== 'string' || !corePackage)
    throw new Error('repo-guards: a profile needs its corePackage');
  const typeNames = ['Transaction', 'WriteBatch', 'BulkWriter', ...transactionTypeNames];
  for (const name of typeNames) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name))
      throw new Error(`repo-guards: ${name} is not a type name`);
  }
  return Object.freeze({
    corePackage,
    coreLibraryRoot: coreLibraryRoot ? joinPosix(coreLibraryRoot) : null,
    importAliases: Object.freeze({ ...importAliases }),
    transactionType: new RegExp(`\\b(${typeNames.join('|')})\\b`),
    removalOnlyTables: Object.freeze(removalOnlyTables.map((table) => Object.freeze({ ...table }))),
    handleModule: new RegExp(
      [
        'firebase',
        'firestore',
        ...handleModulePrefixes.map((prefix) => `^${escapeRegExp(prefix)}`),
      ].join('|'),
      'i',
    ),
  });
}

import { objectShape, unwrap, kindOf } from '../../zod-shape/zod-shape.js';

export const VIOLATION_KINDS = Object.freeze({
  UNDECLARED_FIELD: 'undeclared-field',
  UNRESOLVED_TARGET: 'unresolved-target',
  UNREADABLE_PAYLOAD: 'unreadable-payload',
  PAYLOAD_CAST: 'payload-cast',
  HAND_BUILT_PATH: 'hand-built-path',
  UNDIFFABLE_TEMPLATE: 'undiffable-template',
  UNCLASSIFIED_CALL: 'unclassified-write-call',
  PACKAGE_BUILDER: 'package-builder',
});

const WRITE_METHODS = new Set(['set', 'update', 'create', 'add']);

const INDIRECTION_METHODS = new Set(['bind', 'call', 'apply']);

const SELECTOR_DEPTH = 12;

const RESOLVED = (names) => ({ names: [...new Set(names)], resolved: true });
const UNRESOLVED = { names: [], resolved: false };

/**
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
      const literals = [
        ...parameter.type.getText(facts.source).matchAll(/['"`]([^'"`]+)['"`]/g),
      ].map((match) => match[1]);
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
      if (!initializer.properties.every((property) => ts.isPropertyAssignment(property)))
        return UNRESOLVED;
      return readAll(initializer.properties.map((property) => property.initializer));
    }
    if (ts.isArrayLiteralExpression(initializer)) return readAll([...initializer.elements]);
  }
  return UNRESOLVED;
}

/**
 * @returns {{ methods: string[], receiver: ts.Expression, resolved: boolean } | null}
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

const ROOT_NAME = /^(db|firestore|adminDb|adminFirestore|getFirestore|getAdminFirestore|getDb)$/i;

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

const ARRAY_ITERATORS = new Set([
  'map',
  'forEach',
  'filter',
  'flatMap',
  'find',
  'some',
  'every',
  'reduce',
]);

const PROMISE_PASSTHROUGH = new Set(['catch', 'finally']);

const ARRAY_PASSTHROUGH = new Set(['slice', 'filter', 'sort', 'reverse', 'concat', 'flat']);

const NOT_FIRESTORE_CONSTRUCTORS = new Set([
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'URLSearchParams',
  'Headers',
  'FormData',
  'URL',
  'Array',
  'AbortController',
  'DataTransfer',
  'EventTarget',
]);

const NOT_FIRESTORE_TYPE =
  /^(readonly\s+)?(Map|Set|WeakMap|WeakSet|ReadonlyMap|ReadonlySet|URLSearchParams|ReadonlyURLSearchParams|Headers|ReadonlyHeaders|FormData|URL|Storage|DOMTokenList|CookieStore|ResponseCookies|RequestCookies|HTMLElement|HTMLDivElement|Element|Node|Document|EventTarget|Response|Request|NextResponse|NextRequest)\s*(<|\||$)/;

const NOT_FIRESTORE_FACTORIES = new Set([
  'cookies',
  'headers',
  'draftMode',
  'createHash',
  'createHmac',
  'useRef',
  'createRef',
  'createDevicePreferenceStore',
]);

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

function entriesSource(expr) {
  let node = stripWrappers(expr);
  if (
    ts.isArrayLiteralExpression(node) &&
    node.elements.length === 1 &&
    ts.isSpreadElement(node.elements[0])
  ) {
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
  if (ts.isArrayLiteralExpression(value))
    return value.elements.every((element) => isPlainValue(element, depth + 1));
  return false;
}

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

function isRemovalPayload(expr) {
  const node = stripWrappers(expr);
  if (ts.isObjectLiteralExpression(node)) {
    return (
      node.properties.length > 0 &&
      node.properties.every(
        (property) => ts.isPropertyAssignment(property) && isFieldValueDelete(property.initializer),
      )
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
    if (
      !ts.isCallExpression(mapped) ||
      !ts.isPropertyAccessExpression(mapped.expression) ||
      mapped.expression.name.text !== 'map'
    ) {
      return false;
    }
    const callback = mapped.arguments[0];
    if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
      return false;
    const returns = callbackReturns(callback);
    return (
      returns.length > 0 &&
      returns.every((returned) => {
        const entry = stripWrappers(returned);
        return (
          ts.isArrayLiteralExpression(entry) &&
          entry.elements.length === 2 &&
          isFieldValueDelete(entry.elements[1])
        );
      })
    );
  }
  return false;
}

const HASH_FACTORIES = new Set(['createHash', 'createHmac']);

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

const DOCUMENT_TRIGGER_FACTORIES = new Set([
  'onDocumentCreated',
  'onDocumentUpdated',
  'onDocumentWritten',
  'onDocumentDeleted',
]);

const MAX_CANDIDATES = 16;

const RESOLVE_DEPTH = 32;
const CARRIER_DEPTH = 28;
const PAYLOAD_DEPTH = CARRIER_DEPTH;

const ARRAY_CARRIER_PROPERTIES = Object.freeze(['ref', 'target', 'docRef', 'data', 'patch']);

const MAX_QUEUE_ENTRIES = 96;
const MAX_CALLBACK_RETURNS = 8;

const MARKER = String.fromCharCode(0);

/**
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
  return null;
}

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
  if (
    kind === 'optional' ||
    kind === 'nullable' ||
    kind === 'default' ||
    kind === 'nonoptional' ||
    kind === 'readonly' ||
    kind === 'catch'
  ) {
    return closedCanonicalKeys(schema._def.innerType, branchSeen);
  }
  if (kind === 'object') {
    const shape = objectShape(schema);
    const catchall = schema._def.catchall;
    if (
      !shape ||
      schema._def.unknownKeys === 'passthrough' ||
      (catchall && kindOf(catchall) !== 'never')
    )
      return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'union' || kind === 'discriminatedunion' || kind === 'discriminated_union') {
    const options =
      schema._def.options instanceof Map
        ? [...schema._def.options.values()]
        : (schema._def.options ?? []);
    if (!options.length) return null;
    for (const option of options) if (!closedCanonicalKeys(option, branchSeen)) return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'intersection') {
    if (
      !closedCanonicalKeys(schema._def.left, branchSeen) ||
      !closedCanonicalKeys(schema._def.right, branchSeen)
    )
      return null;
    const keys = declaredKeys(schema);
    return keys && !keys.open ? keys : null;
  }
  if (kind === 'array') {
    const element =
      schema._def.element ?? (typeof schema._def.type === 'object' ? schema._def.type : null);
    return closedCanonicalKeys(element, branchSeen) ? { keys: new Set(), open: false } : null;
  }
  if (kind === 'tuple') {
    const items = schema._def.items ?? [];
    if (
      !Array.isArray(items) ||
      !items.length ||
      items.some((item) => !closedCanonicalKeys(item, branchSeen))
    )
      return null;
    return { keys: new Set(), open: false };
  }
  return new Set([
    'string',
    'number',
    'boolean',
    'bigint',
    'date',
    'literal',
    'enum',
    'nativeenum',
    'null',
    'undefined',
    'void',
    'never',
    'nan',
    'symbol',
  ]).has(kind)
    ? { keys: new Set(), open: false }
    : null;
}

const LIT = (value) => ({ t: 'lit', v: value });
const ANY = { t: 'any' };

const builderSegments = new Map();

const collectionRefSegments = new Map();

/**
 * @param {unknown} schema
 * @param {Map<string, Set<string>>} literals
 * @returns {{ keys: Set<string>, open: boolean } | null}
 */
export function narrowedDeclaredKeys(schema, literals) {
  if (!literals || !literals.size) return null;
  const s = unwrap(schema);
  const kind = kindOf(s);
  if (kind !== 'union' && kind !== 'discriminatedunion' && kind !== 'discriminated_union')
    return null;
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
    if (!shape) return true;
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

export function numericSentinelSegments(fn) {
  const arity = Math.max(fn.length, 6);
  try {
    const first = fn(...Array.from({ length: arity }, () => 1));
    const second = fn(...Array.from({ length: arity }, () => 2));
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length)
      return null;
    return first.map((segment, index) =>
      String(segment) === String(second[index]) ? segment : 'ID',
    );
  } catch {
    return null;
  }
}

/**
 * @param {object} deps
 * @param {Record<string, Function>} deps.PATH_BUILDERS
 * @param {Record<string, unknown>} deps.COLLECTION_SCHEMAS
 * @param {Record<string, Record<string, string>>} deps.constantMaps
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
  const templateSegments = new Map(templates.map((template) => [template, template.split('/')]));

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
    if (!best.length && !allowUnknownCollectionName) {
      const loose = matchSegments(segments, { allowUnknownCollectionName: true });
      const anchored = segments.some((segment) => segment.t === 'lit');
      return anchored ? loose : [];
    }
    return best;
  }

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
    builderSegments.set(name, built);
    try {
      const sentinels = Array.from(
        { length: Math.max(fn.length, 6) },
        (_, index) => `__GUARD_ARG_${index}__`,
      );
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
      continue;
    }
  }

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
      const sentinels = Array.from(
        { length: Math.max(fn.length, 6) },
        (_, index) => `__GUARD_ARG_${index}__`,
      );
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
      continue;
    }
  }

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

  const canonicalParseKeys = new Map();
  const canonicalParseSchema = new Map();
  const canonicalParseName = new Map();
  for (const [name, schema] of Object.entries(canonicalSchemas)) {
    const keys = closedCanonicalKeys(schema);
    if (keys && keys.keys.size) {
      canonicalParseKeys.set(name, keys);
      canonicalParseSchema.set(name, schema);
      if (!canonicalParseName.has(schema)) canonicalParseName.set(schema, name);
    }
  }

  function templatesForGroup(segment) {
    if (!segment || segment.t !== 'lit') return [];
    return templates.filter((template) => {
      const parts = templateSegments.get(template);
      return parts.length >= 2 && parts[parts.length - 2] === segment.v;
    });
  }

  const exportedValues = coreExports ?? canonicalSchemas;
  function coreConstMap(name) {
    const value = exportedValues?.[name];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value._def) return null;
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

const declarationCache = new WeakMap();
function packageDeclarationFiles(packageName, packageDeclarations) {
  if (typeof packageDeclarations !== 'function') return [];
  let cache = declarationCache.get(packageDeclarations);
  if (!cache) declarationCache.set(packageDeclarations, (cache = new Map()));
  if (cache.has(packageName)) return cache.get(packageName);
  const files = (packageDeclarations(packageName) ?? []).map(({ file, text, sourceFile }) => ({
    file,
    source: sourceFile ?? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
  }));
  cache.set(packageName, files);
  return files;
}

export function normalizedArgText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function packageBuilderArgsMatch(entryArgs, callArgs) {
  if (entryArgs === undefined) return true;
  if (!Array.isArray(entryArgs) || !Array.isArray(callArgs)) return false;
  return (
    entryArgs.length === callArgs.length &&
    entryArgs.every((arg, i) => normalizedArgText(arg) === normalizedArgText(callArgs[i]))
  );
}

export function packageNameOf(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('@/')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function packageBuilderReturnKeys({ packageName, callee, property, packageDeclarations }) {
  const files = packageDeclarationFiles(packageName, packageDeclarations);
  if (!files.length) return null;

  const findTypeDeclaration = (name) => {
    for (const candidate of files) {
      let found = null;
      const visit = (node) => {
        if (found) return;
        if (
          (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
          node.name?.text === name
        ) {
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
  // NullKeyword — reading only the bare form would leave every `X | null` return type unreadable.
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
    if (infer)
      return { inferOf: infer[1], via: 'type ' + name + ' = z.infer<typeof ' + infer[1] + '>' };
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
      else if (
        container &&
        ts.isTypeReferenceNode(container) &&
        ts.isIdentifier(container.typeName)
      ) {
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
    const shape = readShape(target, 0);
    if (shape) return shape;
  }
  return null;
}

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

function functionName(node) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name && ts.isIdentifier(node.name) ? node.name.text : null;
  }
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const parent = node.parent;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
      return parent.name.text;
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name))
      return parent.name.text;
  }
  return null;
}

function enclosingWriteFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isFunctionLike(current)) continue;
    const name = functionName(current);
    if (!name) continue;
    if (ts.isMethodDeclaration(current)) {
      const owner = current.parent;
      const ownerName =
        (ts.isClassDeclaration(owner) || ts.isClassExpression(owner)) && owner.name
          ? owner.name.text
          : null;
      return ownerName ? `${ownerName}.${name}` : name;
    }
    return name;
  }
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isFunctionLike(current)) continue;
    const owned = declaredOwnerName(current);
    if (owned) return owned;
  }
  return '(module)';
}

function declaredOwnerName(fn) {
  for (let current = fn.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current)) return null;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name))
      return current.name.text;
    if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) return current.name.text;
  }
  return null;
}

/**
 * @param {string} relPath
 * @param {string} text
 * @param {{ library?: boolean, sourceFile?: import('typescript').SourceFile | null }} [options]
 */
export function parseFile(relPath, text, { library = false, sourceFile = null } = {}) {
  const source = sourceFile ?? ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
  const facts = {
    relPath,
    source,
    text,
    varDecls: new Map(),
    moduleConsts: new Map(),
    stringConsts: new Map(),
    propAssigns: new Map(),
    pushCalls: new Map(),
    mapSetCalls: new Map(),
    classFields: new Map(),
    typeMembers: new Map(),
    typeMethodParams: new Map(),
    ambiguousTypeMethods: new Set(),
    imports: new Map(),
    reExports: new Map(),
    starExports: [],
    library,
    functions: new Map(),
    triggerEvents: [],
    calls: [],
    writes: [],
  };

  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  const indexObjectBinding = (pattern, source, pos, scope) => {
    for (const element of pattern.elements) {
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name) || element.dotDotDotToken)
        continue;
      const propertyName = element.propertyName
        ? ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName)
          ? element.propertyName.text
          : null
        : element.name.text;
      if (!propertyName) continue;
      push(
        facts.varDecls,
        element.name.text,
        source.bindingOf
          ? { pos, bindingOf: source.bindingOf, bindingProperty: propertyName, scope }
          : { pos, elementOf: source.elementOf, elementProperty: propertyName, scope },
      );
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
      if (inner !== node && ts.isFunctionLike(inner)) return;
      if (ts.isReturnStatement(inner) && inner.expression) returns.push(inner.expression);
      ts.forEachChild(inner, collectReturns);
    };
    if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) returns.push(node.body);
    else if (node.body) ts.forEachChild(node.body, collectReturns);
    facts.functions.set(name, { node, params, returns });
  };

  const index = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.initializer) {
        push(facts.varDecls, node.name.text, {
          pos: node.pos,
          initializer: node.initializer,
          scope: scopeOf(node),
        });
        const initializer = stripWrappers(node.initializer);
        if (ts.isStringLiteralLike(initializer))
          facts.stringConsts.set(node.name.text, initializer.text);
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
        const entry = tupleEntry(node.initializer, index);
        if (entry && ts.isObjectBindingPattern(element.name)) {
          indexObjectBinding(element.name, { bindingOf: entry }, node.pos, scopeOf(node));
        }
      });
    }
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
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      !node.initializer &&
      node.parent?.parent &&
      ts.isForOfStatement(node.parent.parent)
    ) {
      const loop = node.parent.parent;
      indexObjectBinding(
        node.name,
        { elementOf: loop.expression },
        node.pos,
        scopeOf(loop.statement) ?? scopeOf(loop),
      );
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      indexObjectBinding(node.name, { bindingOf: node.initializer }, node.pos, scopeOf(node));
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'push' &&
      ts.isIdentifier(node.expression.expression) &&
      node.arguments.length >= 1
    ) {
      for (const argument of node.arguments) {
        push(facts.pushCalls, node.expression.expression.text, {
          pos: node.pos,
          argument,
          call: node,
        });
      }
    }
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
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ARRAY_ITERATORS.has(node.expression.name.text) &&
      node.arguments.length >= 1
    ) {
      const callback = node.arguments[0];
      if (
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        callback.parameters.length
      ) {
        const first = callback.parameters[0];
        if (ts.isIdentifier(first.name)) {
          push(facts.varDecls, first.name.text, {
            pos: callback.pos,
            iterOf: node.expression.expression,
            scope: callback,
          });
        } else if (ts.isArrayBindingPattern(first.name) && node.expression.name.text !== 'reduce') {
          const collection = entriesSource(node.expression.expression);
          const value = first.name.elements[1];
          if (collection && value && ts.isBindingElement(value) && ts.isIdentifier(value.name)) {
            push(facts.varDecls, value.name.text, {
              pos: callback.pos,
              entryOf: collection,
              scope: callback,
            });
          }
        } else if (
          ts.isObjectBindingPattern(first.name) &&
          node.expression.name.text !== 'reduce'
        ) {
          indexObjectBinding(
            first.name,
            { elementOf: node.expression.expression },
            callback.pos,
            callback,
          );
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      DOCUMENT_TRIGGER_FACTORIES.has(node.expression.text)
    ) {
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
          if (documentProperty && ts.isPropertyAssignment(documentProperty))
            documentExpression = documentProperty.initializer;
        } else if (
          ts.isStringLiteralLike(stripWrappers(config)) ||
          ts.isTemplateExpression(stripWrappers(config))
        ) {
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
        push(facts.propAssigns, node.left.expression.text, {
          pos: node.pos,
          key: node.left.name.text,
        });
      }
      if (ts.isIdentifier(node.left)) {
        push(facts.varDecls, node.left.text, {
          pos: node.pos,
          initializer: node.right,
          scope: functionScopeOf(node),
          assigned: true,
        });
      }
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      indexFunction(node);
    }
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
          if (!ts.isMethodSignature(member) || !member.name || !ts.isIdentifier(member.name))
            continue;
          const byParam = new Map();
          for (const parameter of member.parameters) {
            if (ts.isIdentifier(parameter.name) && parameter.type) {
              byParam.set(parameter.name.text, parameter.type.getText(source));
            }
          }
          if (!byParam.size) continue;
          if (facts.typeMethodParams.has(member.name.text))
            facts.ambiguousTypeMethods.add(member.name.text);
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
  for (const site of moduleImports(source, ['import', 'export'])) {
    if (site.kind === 'import' && !site.sideEffect) {
      for (const { imported, local } of site.named)
        facts.imports.set(local, { module: site.spec, imported });
      if (site.defaultName)
        facts.imports.set(site.defaultName, { module: site.spec, imported: 'default' });
      if (site.namespace) facts.imports.set(site.namespace, { module: site.spec, imported: '*' });
    } else if (site.kind === 'export') {
      for (const { local } of site.named) facts.reExports.set(local, site.spec);
      if (site.star && !site.namespace && !site.typeOnly) facts.starExports.push(site.spec);
    }
  }

  return facts;
}

/**
 * @param {{ files: any[], libraryFiles?: any[], registry: any, profile: any, maxRounds?: number,
 *   exceptions?: any[], packageDeclarations?: ((packageName: string) => Array<{ file: string, text: string, sourceFile?: import('typescript').SourceFile }>) | null }} input
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
  if (!profile?.corePackage)
    throw new Error('repo-guards: analyzeFiles needs a guard profile (createGuardProfile)');
  const CORE_PACKAGE = profile.corePackage;
  const CORE_LIBRARY_ROOT = profile.coreLibraryRoot;
  const files = [...writerFiles, ...libraryFiles];
  const packageBuilderEntries = exceptions.filter(
    (entry) => entry.kind === VIOLATION_KINDS.PACKAGE_BUILDER,
  );
  const packageBuilderUses = [];
  const byPath = new Map(files.map((facts) => [facts.relPath, facts]));

  let returnTargets = new Map();
  let paramTargets = new Map();
  const paramPayloads = new Map();
  const paramCarrierProperties = new Map();
  const paramCollections = new Map();
  const paramCallbackPayloads = new Map();
  const paramArrayEntries = new Map();
  const paramNotFirestore = new Map();
  const paramValues = new Map();
  let returnCollections = new Map();
  let returnGroups = new Map();
  const paramGroups = new Map();
  let returnNonFirestore = new Map();
  let returnPassThrough = new Map();
  let returnCarrierProperties = new Map();
  let returnArrayProperties = new Map();

  const fnKey = (relPath, name) => `${relPath}#${name}`;
  const paramKey = (relPath, name, index) => `${relPath}#${name}@${index}`;

  function resolveImport(fromPath, specifier) {
    let base;
    if (specifier.startsWith('.')) {
      base = joinPosix(dirnameOf(fromPath), specifier);
    } else if (
      CORE_LIBRARY_ROOT &&
      (specifier === CORE_PACKAGE || specifier.startsWith(`${CORE_PACKAGE}/`))
    ) {
      base = joinPosix(CORE_LIBRARY_ROOT, specifier.slice(CORE_PACKAGE.length + 1) || 'index');
    } else {
      const alias = Object.keys(profile.importAliases).find((prefix) =>
        specifier.startsWith(prefix),
      );
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

  function computedKeyName(inner, facts, source) {
    const names = computedKeyNames(inner, facts, source);
    return names?.length === 1 ? names[0] : null;
  }

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

  function computedKeyNames(inner, facts, source, isUpdate = false) {
    if (ts.isStringLiteralLike(inner)) return [inner.text];
    if (ts.isIdentifier(inner)) {
      if (facts.stringConsts.has(inner.text)) return [facts.stringConsts.get(inner.text)];
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
      return resolverFor(facts).literalStringCandidates(inner);
    }
    if (ts.isPropertyAccessExpression(inner)) {
      const key = `${inner.expression.getText(source)}.${inner.name.text}`;
      const constant = registry.constantValue.get(key);
      if (constant) return [constant];
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
      // In `update()` a dotted path addresses the top-level field before the first dot; in set /
      // merge-set / create the same text is one field name containing a dot.
      const head = inner.head.text;
      return isUpdate && head.includes('.') ? [head.slice(0, head.indexOf('.'))] : null;
    }
    return null;
  }

  const narrowedEntries = new Map();

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
    if (selector !== null && Object.prototype.hasOwnProperty.call(map, selector))
      return [map[selector]];
    const values = Object.values(map);
    return values.length && values.length <= MAX_CANDIDATES ? values : null;
  }

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
    if (!bound) return null;

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
    if (!declared) return null;
    packageBuilderUses.push(entry);
    if (declared.inferOf) return declared.inferOf === entry.schema ? bound : null;
    return { keys: declared.keys, open: false };
  }

  function stripParens(node) {
    let current = node;
    while (current && (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current))) {
      current = current.expression;
    }
    return current;
  }

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

  function isCoreImport(facts, imported) {
    if (!imported) return false;
    if (imported.module === CORE_PACKAGE || imported.module.startsWith(`${CORE_PACKAGE}/`))
      return true;
    if (!facts.library || !imported.module.startsWith('.')) return false;
    return (
      Boolean(CORE_LIBRARY_ROOT) &&
      joinPosix(dirnameOf(facts.relPath), imported.module).startsWith(`${CORE_LIBRARY_ROOT}/`)
    );
  }

  function isCoreBuilders(facts, identifier) {
    const imported = facts.imports.get(identifier.text);
    return imported?.imported === 'PATH_BUILDERS' && isCoreImport(facts, imported);
  }

  let resolverCache = new Map();
  function resolverFor(facts) {
    if (!resolverCache.has(facts.relPath)) resolverCache.set(facts.relPath, makeResolver(facts));
    return resolverCache.get(facts.relPath);
  }

  function makeResolver(facts) {
    const { source } = facts;

    let hitCeiling = false;
    const ceiling = () => {
      hitCeiling = true;
      return null;
    };

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
        )
          return true;
      }
      return false;
    }

    const visibleDecls = (name, pos, node) =>
      (facts.varDecls.get(name) ?? [])
        .filter((decl) => decl.pos < pos && (!decl.scope || encloses(decl.scope, node)))
        .sort((a, b) => b.pos - a.pos);

    const nearestDecl = (name, pos, node) => visibleDecls(name, pos, node)[0] ?? null;

    const isPropertyBinding = (decl) =>
      Boolean(
        (decl?.bindingOf && decl.bindingProperty) ||
        (decl?.elementOf && decl.elementProperty) ||
        decl?.entryOf,
      );

    function boundValues(decl, depth = 0) {
      if (decl.bindingOf && decl.bindingProperty)
        return staticPropertyCandidates(decl.bindingOf, decl.bindingProperty, depth);
      if (decl.elementOf && decl.elementProperty)
        return propertyValuesFromArray(decl.elementOf, decl.elementProperty, depth);
      if (decl.entryOf)
        return mapEntryValues(decl.entryOf, depth) ?? arrayEntryExpressions(decl.entryOf, depth);
      return null;
    }

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

    function parameterValues(identifier) {
      const owner = enclosingFunction(identifier, identifier.text);
      if (!owner) return null;
      const params = facts.functions.get(owner.name)?.params ?? [];
      const index = params.findIndex((candidate) => candidate.name === identifier.text);
      if (index < 0) return null;
      const values = paramValues.get(paramKey(facts.relPath, owner.name, index));
      return values?.length && values.length <= MAX_CANDIDATES ? values : null;
    }

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
          const inner = resolverFor(candidate.facts).literalStringCandidates(
            candidate.node,
            depth + 1,
          );
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
        const values =
          selector !== null ? (properties.get(selector) ?? null) : [...properties.values()].flat();
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
                  const nested = resolverFor(value.facts).literalStringCandidates(
                    value.node,
                    depth + 1,
                  );
                  if (!nested) {
                    inner = null;
                    break;
                  }
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
        if (external)
          return resolverFor(external.facts).literalStringCandidates(external.node, depth + 1);
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
        if (external)
          return resolverFor(external.facts).literalStringList(external.node, depth + 1);
      }
      return null;
    }

    function segmentOf(expr) {
      const node = stripWrappers(expr);
      if (ts.isStringLiteralLike(node)) return LIT(node.text);
      if (ts.isPropertyAccessExpression(node)) {
        const key = `${node.expression.getText(source)}.${node.name.text}`;
        const value = registry.constantValue.get(key);
        if (value) return LIT(value);
        const base = constLookup(stripParens(node.expression), facts);
        if (ts.isElementAccessExpression(base)) {
          const entries = coreMapEntries(base, facts, source);
          const entry = entries?.length === 1 ? entries[0] : null;
          const segment =
            entry && typeof entry === 'object' && !Array.isArray(entry)
              ? entry[node.name.text]
              : null;
          if (typeof segment === 'string' && segment) return LIT(segment);
        }
      }
      if (ts.isIdentifier(node) && facts.stringConsts.has(node.text))
        return LIT(facts.stringConsts.get(node.text));
      return ANY;
    }

    function staticPropertyCandidates(baseExpr, propertyName, depth = 0) {
      if (!baseExpr || !propertyName) return null;
      if (depth > CARRIER_DEPTH) return ceiling();
      const node = stripWrappers(baseExpr);
      if (ts.isObjectLiteralExpression(node)) {
        if (node.properties.some((property) => ts.isSpreadAssignment(property))) {
          const properties = objectProperties(node, depth + 1);
          const values = properties?.get(propertyName);
          return values?.length && values.length <= MAX_CANDIDATES ? values : null;
        }
        const found = [];
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
            property.name.text === propertyName
          ) {
            found.push({ facts, node: property.initializer });
          }
          if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
            found.push({ facts, node: property.name });
          }
        }
        return found.length ? found : null;
      }
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
            const values = resolverFor(entry.facts).staticPropertyCandidates(
              entry.node,
              propertyName,
              depth + 1,
            );
            if (!values) return null;
            found.push(...values);
          }
          return found.length && found.length <= MAX_CANDIDATES ? found : null;
        }
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
        const left = isNullish(node.whenTrue)
          ? []
          : staticPropertyCandidates(node.whenTrue, propertyName, depth + 1);
        const right = isNullish(node.whenFalse)
          ? []
          : staticPropertyCandidates(node.whenFalse, propertyName, depth + 1);
        if (
          !left ||
          !right ||
          (!left.length && !right.length) ||
          left.length + right.length > MAX_CANDIDATES
        )
          return null;
        return [...left, ...right];
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer)
          return staticPropertyCandidates(decl.initializer, propertyName, depth + 1);
        if (isPropertyBinding(decl)) {
          const outer = boundValues(decl, depth + 1);
          if (!outer) return null;
          const nested = [];
          for (const value of outer) {
            const values = resolverFor(value.facts).staticPropertyCandidates(
              value.node,
              propertyName,
              depth + 1,
            );
            if (!values) return null;
            nested.push(...values);
          }
          return nested.length && nested.length <= MAX_CANDIDATES ? nested : null;
        }
        if (decl?.iterOf) return propertyValuesFromArray(decl.iterOf, propertyName, depth + 1);
        if (decl?.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? staticPropertyCandidates(entry, propertyName, depth + 1) : null;
        }
        const external = importedValue(facts, node.text);
        if (external)
          return resolverFor(external.facts).staticPropertyCandidates(
            external.node,
            propertyName,
            depth + 1,
          );
        const owner = enclosingFunction(node, node.text);
        if (!owner) return null;
        const params = facts.functions.get(owner.name)?.params ?? [];
        const index = params.findIndex((parameter) => parameter.name === node.text);
        const values =
          index < 0
            ? null
            : paramCarrierProperties.get(
                `${paramKey(facts.relPath, owner.name, index)}.${propertyName}`,
              );
        if (values?.length && values.length <= MAX_CANDIDATES) return values;
        const supplied = parameterValues(node);
        if (!supplied) return null;
        const found = [];
        for (const value of supplied) {
          const inner = resolverFor(value.facts).staticPropertyCandidates(
            value.node,
            propertyName,
            depth + 1,
          );
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
            if (owner.objectProperties(value.node, depth + 1)) continue;
            return null;
          }
          nested.push(...values);
        }
        return nested.length && nested.length <= MAX_CANDIDATES ? nested : null;
      }
      if (ts.isElementAccessExpression(node)) {
        const properties = objectProperties(node.expression, depth + 1);
        if (!properties) return propertyValuesFromArray(node.expression, propertyName, depth + 1);
        const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
        const literal = index ? computedKeyName(index, facts, source) : null;
        const entries = literal
          ? (properties.get(literal) ?? null)
          : [...properties.values()].flat();
        if (!entries?.length || entries.length > MAX_CANDIDATES) return null;
        const nested = [];
        for (const value of entries) {
          const owner = resolverFor(value.facts);
          const values = owner.staticPropertyCandidates(value.node, propertyName, depth + 1);
          if (!values) {
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

    function callbackFunctions(callExpr, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const callee = stripWrappers(callExpr.expression);
      if (!ts.isPropertyAccessExpression(callee)) return null;
      const candidates = staticPropertyCandidates(callee.expression, callee.name.text, depth + 1);
      if (!candidates?.length || candidates.length > MAX_CANDIDATES) return null;
      const functions = [];
      for (const candidate of candidates) {
        const node = stripWrappers(candidate.node);
        if (
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isMethodDeclaration(node)
        ) {
          functions.push({ facts: candidate.facts, node });
        } else return null;
      }
      return functions.length ? functions : null;
    }

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
      if (ts.isPropertyAccessExpression(node))
        return merged(staticPropertyCandidates(node.expression, node.name.text, depth + 1));
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
        .filter(
          (entry) => entry.pos > decl.pos && (!decl.scope || encloses(decl.scope, entry.call)),
        )
        .map((entry) => ({ facts, node: entry.value }));
    }

    function propertyValuesFromArray(expr, propertyName, depth = 0) {
      if (depth > CARRIER_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isArrayLiteralExpression(node)) {
        if (node.elements.length > MAX_CANDIDATES) return null;
        const values = [];
        for (const element of node.elements) {
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
        if (method === 'all' && node.arguments.length === 1) {
          return propertyValuesFromArray(node.arguments[0], propertyName, depth + 1);
        }
        if (method === 'values' && node.arguments.length === 0) {
          const entries = mapEntryValues(node.expression.expression, depth + 1);
          if (entries) {
            const values = [];
            for (const entry of entries) {
              const found = resolverFor(entry.facts).staticPropertyCandidates(
                entry.node,
                propertyName,
                depth + 1,
              );
              if (!found) return null;
              values.push(...found);
            }
            return values.length && values.length <= MAX_CANDIDATES ? values : null;
          }
        }
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
            return null;
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
            const found =
              method === 'flatMap'
                ? propertyValuesFromArray(returned, propertyName, depth + 1)
                : staticPropertyCandidates(returned, propertyName, depth + 1);
            if (!found) return null;
            values.push(...found);
          }
          return values.length && values.length <= MAX_CANDIDATES ? values : null;
        }
        if (ARRAY_PASSTHROUGH.has(method))
          return propertyValuesFromArray(node.expression.expression, propertyName, depth + 1);
      }
      if (ts.isConditionalExpression(node)) {
        const isEmpty = (value) => {
          const branch = stripWrappers(value);
          return ts.isArrayLiteralExpression(branch) && branch.elements.length === 0;
        };
        const left = isEmpty(node.whenTrue)
          ? []
          : propertyValuesFromArray(node.whenTrue, propertyName, depth + 1);
        const right = isEmpty(node.whenFalse)
          ? []
          : propertyValuesFromArray(node.whenFalse, propertyName, depth + 1);
        if (!left || !right || (!left.length && !right.length)) return null;
        const values = [...left, ...right];
        return values.length <= MAX_CANDIDATES ? values : null;
      }
      if (ts.isPropertyAccessExpression(node)) {
        const arrays = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (!arrays?.length) return null;
        const values = [];
        for (const array of arrays) {
          const found = resolverFor(array.facts).propertyValuesFromArray(
            array.node,
            propertyName,
            depth + 1,
          );
          if (!found) return null;
          values.push(...found);
        }
        return values.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      if (ts.isCallExpression(node)) {
        const key = calleeKey(node);
        const values = key ? returnArrayProperties.get(key)?.get(propertyName) : null;
        return values?.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      if (ts.isIdentifier(node)) {
        const entries = arrayEntryExpressions(node, depth + 1);
        if (entries?.length) {
          const values = [];
          for (const entry of entries) {
            const found = resolverFor(entry.facts).staticPropertyCandidates(
              entry.node,
              propertyName,
              depth + 1,
            );
            if (!found) return null;
            values.push(...found);
          }
          return values.length && values.length <= MAX_QUEUE_ENTRIES ? values : null;
        }
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl?.initializer)
          return propertyValuesFromArray(decl.initializer, propertyName, depth + 1);
        if (decl?.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? propertyValuesFromArray(entry, propertyName, depth + 1) : null;
        }
        const supplied = parameterValues(node);
        if (!supplied?.length) return null;
        const values = [];
        for (const value of supplied) {
          const inner = resolverFor(value.facts).propertyValuesFromArray(
            value.node,
            propertyName,
            depth + 1,
          );
          if (!inner) return null;
          values.push(...inner);
        }
        return values.length && values.length <= MAX_CANDIDATES ? values : null;
      }
      return null;
    }

    function objectProperties(baseExpr, depth = 0) {
      if (depth > CARRIER_DEPTH || !baseExpr) return null;
      const node = stripWrappers(baseExpr);
      if (ts.isObjectLiteralExpression(node)) {
        const properties = new Map();
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
          ) {
            properties.set(property.name.text, [{ facts, node: property.initializer }]);
          } else if (ts.isShorthandPropertyAssignment(property)) {
            properties.set(property.name.text, [{ facts, node: property.name }]);
          } else if (
            (ts.isMethodDeclaration(property) || ts.isFunctionExpression(property)) &&
            property.name &&
            (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
          ) {
            if (properties.has(property.name.text)) return null;
            properties.set(property.name.text, [{ facts, node: property }]);
          } else if (ts.isSpreadAssignment(property)) {
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
        const left = isNullish(node.whenTrue)
          ? new Map()
          : objectProperties(node.whenTrue, depth + 1);
        const right = isNullish(node.whenFalse)
          ? new Map()
          : objectProperties(node.whenFalse, depth + 1);
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
        return key ? (returnCarrierProperties.get(key) ?? null) : null;
      }
      return null;
    }

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
        if (decl?.initializer)
          return correlatedCarrierPairs(decl.initializer, leftName, rightName, depth + 1);
        if (decl?.iterOf)
          return correlatedPairsFromArray(decl.iterOf, leftName, rightName, depth + 1);
        const external = importedValue(facts, node.text);
        if (external) {
          return resolverFor(external.facts).correlatedCarrierPairs(
            external.node,
            leftName,
            rightName,
            depth + 1,
          );
        }
        if (facts.varDecls.get(node.text)?.length) return null;
        const supplied = parameterValues(node);
        if (!supplied?.length || supplied.length > MAX_CANDIDATES) return null;
        const pairs = [];
        for (const value of supplied) {
          const found = resolverFor(value.facts).correlatedCarrierPairs(
            value.node,
            leftName,
            rightName,
            depth + 1,
          );
          if (!found) return null;
          pairs.push(...found);
        }
        return pairs.length && pairs.length <= MAX_CANDIDATES ? pairs : null;
      }
      if (ts.isElementAccessExpression(node))
        return correlatedPairsFromArray(node.expression, leftName, rightName, depth + 1);
      return null;
    }

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
          return correlatedPairsFromArray(
            node.expression.expression,
            leftName,
            rightName,
            depth + 1,
          );
        }
        return null;
      }
      if (ts.isIdentifier(node)) {
        const entries = arrayEntryExpressions(node, depth + 1);
        if (!entries) return null;
        const pairs = [];
        for (const entry of entries) {
          const found = resolverFor(entry.facts).correlatedCarrierPairs(
            entry.node,
            leftName,
            rightName,
            depth + 1,
          );
          if (!found) return null;
          pairs.push(...found);
        }
        return pairs.length && pairs.length <= MAX_QUEUE_ENTRIES ? pairs : null;
      }
      return null;
    }

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
        if (ARRAY_PASSTHROUGH.has(method))
          return arrayEntryExpressions(node.expression.expression, depth + 1);
        if (method === 'values' && node.arguments.length === 0) {
          const values = mapEntryValues(node.expression.expression, depth + 1);
          return values?.length && values.length <= MAX_QUEUE_ENTRIES ? values : null;
        }
        if (method === 'map' || method === 'flatMap') {
          const callback = node.arguments[0];
          if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
            return null;
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
          const inner = resolverFor(candidate.facts).arrayEntryExpressions(
            candidate.node,
            depth + 1,
          );
          if (!inner) return null;
          entries.push(...inner);
        }
        return entries.length && entries.length <= MAX_QUEUE_ENTRIES ? entries : null;
      }
      if (!ts.isIdentifier(node)) return null;
      const decl = nearestDecl(node.text, node.pos, node);
      const entries = [];
      if (decl?.initializer) {
        const initializer = stripWrappers(decl.initializer);
        if (!(ts.isArrayLiteralExpression(initializer) && initializer.elements.length === 0)) {
          const inner = arrayEntryExpressions(initializer, depth + 1);
          if (!inner) return null;
          entries.push(...inner);
        }
      } else if (isPropertyBinding(decl)) {
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
        if (nearestDecl(node.text, pushed.call.pos, pushed.call) !== decl) continue;
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

    function parameterArrayEntries(identifier) {
      const owner = enclosingFunction(identifier, identifier.text);
      if (!owner) return null;
      const params = facts.functions.get(owner.name)?.params ?? [];
      const index = params.findIndex((parameter) => parameter.name === identifier.text);
      if (index < 0) return null;
      return paramArrayEntries.get(paramKey(facts.relPath, owner.name, index)) ?? null;
    }

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
      if (
        !templates.size &&
        segments.length > 1 &&
        segments.every(
          (candidate) =>
            !registry.matchSegments(candidate).length &&
            registry.matchSegments([...candidate, ANY]).length,
        )
      ) {
        return {
          collections: segments.map((candidate) => ({ segments: candidate, canonical: false })),
        };
      }
      for (const candidate of segments) {
        const matched = registry.matchSegments(candidate);
        if (!matched.length) return null;
        for (const template of matched) templates.add(template);
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    function builderNames(expr, depth = 0) {
      if (depth > CARRIER_DEPTH || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        if (isCoreBuilders(facts, node.expression) && builderSegments.has(node.name.text))
          return new Set([node.name.text]);
      }
      if (ts.isPropertyAccessExpression(node)) {
        const candidates = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
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
        const candidates = literal
          ? (properties.get(literal) ?? null)
          : [...properties.values()].flat();
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

    function segmentsForBuilderCall(name, args) {
      const pattern = registry.builderPatterns.get(name);
      if (!pattern) return builderSegments.get(name) ?? null;
      return pattern.map((segment) =>
        segment.t === 'arg'
          ? args[segment.index]
            ? segmentOf(args[segment.index])
            : ANY
          : segment,
      );
    }

    function coreMapBuilderCall(node, state) {
      const callee = stripWrappers(node.expression);
      if (!ts.isPropertyAccessExpression(callee)) return null;
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

    function isCollectionRefsBase(expr) {
      const node = stripWrappers(expr);
      if (!ts.isIdentifier(node)) return false;
      const imported = facts.imports.get(node.text);
      return Boolean(imported?.imported === 'COLLECTION_REFS' && isCoreImport(facts, imported));
    }

    function segmentsForCollectionRefCall(name, args) {
      const pattern = registry.collectionRefPatterns.get(name);
      if (!pattern) return registry.collectionRefSegments.get(name) ?? null;
      return pattern.map((segment) =>
        segment.t === 'arg'
          ? args[segment.index]
            ? segmentOf(args[segment.index])
            : ANY
          : segment,
      );
    }

    function collectionArgumentSegments(expr, state, depth) {
      const node = stripWrappers(expr);
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'toPath'
      ) {
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
        if (decl?.initializer)
          return collectionArgumentSegments(decl.initializer, state, depth + 1);
      }
      return null;
    }

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
      if (!pattern.includes('/') && expressions.length === 0) return null;
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

    function resolveTriggerRef(node) {
      const candidate = stripWrappers(node);
      if (
        !ts.isPropertyAccessExpression(candidate) ||
        candidate.name.text !== 'data' ||
        !ts.isIdentifier(candidate.expression)
      )
        return null;
      const trigger = facts.triggerEvents.find(
        (entry) => entry.name === candidate.expression.text && encloses(entry.scope, candidate),
      );
      if (!trigger) return null;
      const segments = segmentsFromLiteralPath(stripWrappers(trigger.documentExpression));
      return segments ? { segments } : null;
    }

    function suppliedCandidates(candidates) {
      if (!candidates?.length) return candidates;
      const out = [];
      for (const candidate of candidates) {
        const node = stripWrappers(candidate.node);
        const owner = resolverFor(candidate.facts);
        const supplied =
          ts.isIdentifier(node) && !owner.nearestDecl(node.text, node.pos, node)
            ? owner.parameterValues(node)
            : null;
        if (supplied) out.push(...supplied);
        else out.push(candidate);
      }
      return out;
    }

    function moduleFunctionDeclaration(ownerFacts, owner, identifier) {
      if (owner.nearestDecl(identifier.text, identifier.pos, identifier)) return null;
      const declared = ownerFacts.functions.get(identifier.text)?.node;
      return declared && ts.isFunctionDeclaration(declared) && ts.isSourceFile(declared.parent)
        ? declared
        : null;
    }

    /**
     * @returns {{ segments?: Array, templates?: Set<string>, handBuilt?: boolean,
     *            usedBuilder?: boolean, reason?: string } | null}
     */
    function resolve(expr, state, depth = 0) {
      if (!expr) return null;
      if (depth > RESOLVE_DEPTH) return ceiling();
      const node = stripWrappers(expr);

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'toPath'
      ) {
        const segments = segmentsFromArray(node.arguments[0], state, depth);
        if (segments) return { segments };
        const inner = resolve(node.arguments[0], state, depth + 1);
        return inner?.templates || inner?.collections ? inner : null;
      }

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

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const fromCoreMap = coreMapBuilderCall(node, state);
        if (fromCoreMap) return fromCoreMap;
      }

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

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'doc' || method === 'collection') {
          const base = node.expression.expression;
          let baseSegments = null;
          const resolvedBase = resolve(base, state, depth + 1);
          if (resolvedBase && resolvedBase.segments) baseSegments = resolvedBase.segments;
          else if (resolvedBase && resolvedBase.collections) {
            if (method === 'collection') return null;
            if (node.arguments.length === 0) state.autoId = true;
            const tail =
              node.arguments.length === 0 ? ANY : segmentOf(stripWrappers(node.arguments[0]));
            if (resolvedBase.collections.every((candidate) => candidate.canonical))
              state.usedBuilder = true;
            const templates = new Set();
            for (const collection of resolvedBase.collections) {
              for (const template of registry.matchSegments([...collection.segments, tail]))
                templates.add(template);
            }
            return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
          } else if (resolvedBase && resolvedBase.templates) return null;
          else if (isFirestoreRoot(base)) baseSegments = [];
          if (!baseSegments) return null;

          if (method === 'collection') {
            const canonical = collectionArgumentSegments(node.arguments[0], state, depth);
            if (canonical?.length) return { segments: [...baseSegments, ...canonical] };
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

      if (ts.isPropertyAccessExpression(node) && node.name.text === 'ref') {
        return (
          resolveTriggerRef(node.expression) ??
          resolveSnapshot(node.expression, state, depth + 1) ??
          resolveForeignCandidates(
            staticPropertyCandidates(node.expression, 'ref'),
            state,
            depth + 1,
          ) ??
          resolve(node.expression, state, depth + 1)
        );
      }

      if (ts.isPropertyAccessExpression(node)) {
        const values = staticPropertyCandidates(node.expression, node.name.text);
        if (values) return resolveForeignCandidates(values, state, depth + 1);
      }

      if (ts.isTemplateExpression(node) || ts.isStringLiteralLike(node)) {
        const segments = segmentsFromLiteralPath(node);
        if (!segments) return null;
        state.literalPath = true;
        return { segments };
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

      if (ts.isElementAccessExpression(node)) {
        return resolveArrayElement(node.expression, state, depth + 1);
      }

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

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        QUERY_PASSTHROUGH.has(node.expression.name.text)
      ) {
        return resolve(node.expression.expression, state, depth + 1);
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'collectionGroup'
      ) {
        return { group: segmentOf(node.arguments[0]) };
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(stripWrappers(node.expression))
      ) {
        const callee = stripWrappers(node.expression);
        const candidates = suppliedCandidates(
          staticPropertyCandidates(callee.expression, callee.name.text, depth + 1),
        );
        if (candidates?.length && candidates.length <= MAX_CANDIDATES) {
          const templates = new Set();
          let ok = true;
          for (const candidate of candidates) {
            const owner = resolverFor(candidate.facts);
            let fn = stripWrappers(candidate.node);
            for (let hop = 0; hop < 6 && ts.isIdentifier(fn); hop++) {
              const inner = owner.nearestDecl(fn.text, fn.pos, fn);
              if (!inner?.initializer) break;
              fn = stripWrappers(inner.initializer);
            }
            if (ts.isIdentifier(fn))
              fn = moduleFunctionDeclaration(candidate.facts, owner, fn) ?? fn;
            const alwaysThrows =
              (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
              ts.isBlock(fn.body) &&
              fn.body.statements.length === 1 &&
              ts.isThrowStatement(fn.body.statements[0]);
            if (alwaysThrows) continue;
            if (
              ts.isArrowFunction(fn) ||
              ts.isFunctionExpression(fn) ||
              ts.isMethodDeclaration(fn) ||
              ts.isFunctionDeclaration(fn)
            ) {
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

      if (ts.isCallExpression(node)) {
        const target = calleeKey(node);
        const passThrough = target ? returnPassThrough.get(target) : undefined;
        if (passThrough !== undefined && node.arguments[passThrough]) {
          return resolve(node.arguments[passThrough], state, depth + 1);
        }
        if (target && returnTargets.has(target)) {
          const templates = returnTargets.get(target);
          if (templates?.size && templates.size <= MAX_CANDIDATES)
            return { templates: new Set(templates) };
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
            const collections = paramCollections.get(key);
            if (collections && collections.size && collections.size <= MAX_CANDIDATES) {
              const parsed = [...collections].map((value) => JSON.parse(value));
              if (parsed.every((candidate) => candidate.canonical)) state.usedBuilder = true;
              return { collections: parsed };
            }
            const groups = paramGroups.get(key);
            if (groups && groups.size === 1) return { group: LIT([...groups][0]) };
            return {
              reason: `parameter '${node.text}' of ${owner.name}() — no call site resolved it`,
            };
          }
        }
        return null;
      }

      return null;
    }

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
        if (decl?.initializer)
          return resolveIndexedElement(decl.initializer, index, state, depth + 1);
      }
      return null;
    }

    function resolveSnapshot(expr, state, depth) {
      if (depth > RESOLVE_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'get') {
          if (node.arguments.length === 1 && mapEntryValues(node.expression.expression, depth + 1))
            return null;
          if (node.arguments.length === 1) return resolve(node.arguments[0], state, depth + 1);
          return resolve(node.expression.expression, state, depth + 1);
        }
        if (PROMISE_PASSTHROUGH.has(method))
          return resolveSnapshot(node.expression.expression, state, depth + 1);
        if (method === 'getAll') return null;
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer) return resolveSnapshot(decl.initializer, state, depth + 1);
        if (decl && decl.iterOf) return resolveDocElement(decl.iterOf, state, depth + 1);
        if (decl && decl.indexOf !== undefined) {
          const entry = tupleEntry(decl.indexOf, decl.bindingIndex);
          return entry ? resolveSnapshot(entry, state, depth + 1) : null;
        }
        if (isPropertyBinding(decl)) {
          const values = boundValues(decl, depth + 1);
          if (!values?.length) return null;
          return mergeDocCandidates(values, (value) =>
            resolverFor(value.facts).resolveSnapshot(value.node, state, depth + 1),
          );
        }
        if (!decl) {
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
      if (
        ts.isPropertyAccessExpression(node) &&
        (node.name.text === 'after' || node.name.text === 'before')
      ) {
        return resolveSnapshot(node.expression, state, depth + 1);
      }
      return null;
    }

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
        if (ARRAY_PASSTHROUGH.has(method))
          return resolveArrayElement(node.expression.expression, state, depth + 1);
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'docs') {
        return resolveDocElement(node, state, depth + 1);
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer)
          return resolveArrayElement(decl.initializer, state, depth + 1);
      }
      return resolveDocElement(node, state, depth + 1);
    }

    function resolveDocElement(expr, state, depth) {
      if (depth > RESOLVE_DEPTH) return null;
      const node = stripWrappers(expr);
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'docs') {
        const collection = resolve(node.expression, state, depth + 1);
        if (collection && collection.segments) return { segments: [...collection.segments, ANY] };
        if (collection && collection.group) return { group: collection.group, document: true };
        if (collection && collection.collections)
          return templatesFromCollections(collection.collections);
        if (collection && collection.templates) return { templates: collection.templates };
        const snapshot = resolveSnapshot(node.expression, state, depth + 1);
        if (snapshot && snapshot.segments) return { segments: [...snapshot.segments, ANY] };
        if (snapshot && snapshot.group) return { group: snapshot.group, document: true };
        if (snapshot && snapshot.collections) return templatesFromCollections(snapshot.collections);
        if (snapshot && snapshot.templates) return snapshot;
        return null;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'getAll'
      ) {
        const templates = new Set();
        for (const argument of node.arguments) {
          const resolved = ts.isSpreadElement(argument)
            ? resolveArrayElement(argument.expression, state, depth + 1)
            : resolve(argument, state, depth + 1);
          if (!resolved) return null;
          if (resolved.templates)
            for (const template of resolved.templates) templates.add(template);
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
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ARRAY_PASSTHROUGH.has(node.expression.name.text)
      ) {
        return resolveDocElement(node.expression.expression, state, depth + 1);
      }
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
        if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
          return null;
        const returns = callbackReturns(callback);
        if (returns.length !== 1) return null;
        return (
          resolveSnapshot(returns[0], state, depth + 1) ?? resolve(returns[0], state, depth + 1)
        );
      }
      if (ts.isElementAccessExpression(node))
        return resolveDocElement(node.expression, state, depth + 1);
      if (ts.isArrayLiteralExpression(node)) {
        if (node.elements.some((element) => ts.isObjectLiteralExpression(stripWrappers(element))))
          return null;
        return mergeDocCandidates(
          node.elements.map((element) => ({ facts, node: element })),
          (value) => {
            if (ts.isSpreadElement(value.node)) {
              return resolverFor(value.facts).resolveDocElement(
                value.node.expression,
                state,
                depth + 1,
              );
            }
            const resolved = resolverFor(value.facts).resolve(value.node, state, depth + 1);
            return resolved?.collections ? null : resolved;
          },
        );
      }
      if (ts.isPropertyAccessExpression(node)) {
        const values = staticPropertyCandidates(node.expression, node.name.text, depth + 1);
        if (values?.length) {
          return mergeDocCandidates(values, (value) =>
            resolverFor(value.facts).resolveDocElement(value.node, state, depth + 1),
          );
        }
      }
      if (ts.isIdentifier(node)) {
        const decl = nearestDecl(node.text, node.pos, node);
        if (decl && decl.initializer) return resolveDocElement(decl.initializer, state, depth + 1);
        if (decl && decl.iterOf) return resolveDocElement(decl.iterOf, state, depth + 1);
        if (!decl) {
          const supplied = parameterValues(node);
          if (supplied?.length) {
            const templates = new Set();
            for (const value of supplied) {
              const inner = resolverFor(value.facts).resolveDocElement(
                value.node,
                state,
                depth + 1,
              );
              if (!inner) return null;
              if (inner.templates) for (const template of inner.templates) templates.add(template);
              else if (inner.segments) {
                const matched = registry.matchSegments(inner.segments);
                if (!matched.length) return null;
                for (const template of matched) templates.add(template);
              } else if (inner.group) {
                for (const template of registry.templatesForGroup(inner.group))
                  templates.add(template);
              } else return null;
            }
            return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
          }
        }
      }
      const snapshot = resolveSnapshot(node, state, depth + 1);
      if (snapshot?.segments) return { segments: [...snapshot.segments, ANY] };
      if (snapshot?.group) return { group: snapshot.group, document: true };
      if (snapshot?.collections) return templatesFromCollections(snapshot.collections);
      if (snapshot?.templates) return snapshot;
      return null;
    }

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
          for (const template of registry.templatesForGroup(resolved.group))
            templates.add(template);
        } else if (resolved.collections) {
          const fromCollections = templatesFromCollections(resolved.collections);
          if (!fromCollections) return null;
          for (const template of fromCollections.templates) templates.add(template);
        } else return null;
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    function templatesFromCollections(collections) {
      const templates = new Set();
      for (const collection of collections) {
        for (const template of registry.matchSegments([...collection.segments, ANY]))
          templates.add(template);
      }
      return templates.size && templates.size <= MAX_CANDIDATES ? { templates } : null;
    }

    function isFirestoreRoot(expr) {
      const node = stripWrappers(expr);
      if (ts.isIdentifier(node)) return ROOT_NAME.test(node.text);
      if (ts.isPropertyAccessExpression(node)) return ROOT_NAME.test(node.name.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
        return ROOT_NAME.test(node.expression.text);
      return false;
    }

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
      if (!result)
        return {
          templates: null,
          handBuilt,
          capped,
          reason: `target '${shown()}' did not resolve${capped ? ' (analysis ceiling reached)' : ''}`,
        };
      if (result.templates) return { templates: result.templates, handBuilt, capped, reason: null };
      if (result.collections) {
        return {
          templates: null,
          handBuilt,
          reason: `target '${shown()}' is a COLLECTION reference, not a document`,
        };
      }
      if (result.group) {
        const matched = registry.templatesForGroup(result.group);
        if (!matched.length) {
          return {
            templates: null,
            handBuilt,
            reason: 'collection group matches no registered template',
          };
        }
        return { templates: new Set(matched), handBuilt, reason: null };
      }
      if (result.segments) {
        const matched = registry.matchSegments(result.segments);
        if (!matched.length) {
          const shown = result.segments
            .map((segment) => (segment.t === 'lit' ? segment.v : '*'))
            .join('/');
          return {
            templates: null,
            handBuilt,
            reason: `path '${shown}' matches no registered template`,
          };
        }
        return { templates: new Set(matched), handBuilt, reason: null };
      }
      return {
        templates: null,
        handBuilt,
        reason: result.reason ?? 'target expression did not resolve',
      };
    }

    function nonFirestoreValue(expr, depth = 0) {
      if (depth > 8 || !expr) return null;
      const node = stripWrappers(expr);
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        if (NOT_FIRESTORE_CONSTRUCTORS.has(node.expression.text))
          return `new ${node.expression.text}()`;
        // Nothing in the Firestore SDKs is constructed with `new` in app code.
        const imported = facts.imports.get(node.expression.text);
        if (imported && !profile.handleModule.test(imported.module)) {
          return `new ${node.expression.text}() from ${imported.module}`;
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const namespace = stripWrappers(node.expression.expression);
        if (ts.isIdentifier(namespace)) {
          const imported = facts.imports.get(namespace.text);
          if (imported && !profile.handleModule.test(imported.module)) {
            return `${namespace.text}.${node.expression.name.text}() from ${imported.module}`;
          }
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(stripWrappers(node.expression))) {
        const key = calleeKey(node);
        const known = key ? returnNonFirestore.get(key) : null;
        if (known) return known;
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
      if (ts.isObjectLiteralExpression(node) && isPlainValueTable(node))
        return 'a table of plain values';
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'get' || method === 'getAll') {
          const container = nonFirestoreValue(node.expression.expression, depth + 1);
          if (container) return `a .${method}() lookup on ${container}`;
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        NOT_FIRESTORE_FACTORIES.has(node.expression.text)
      ) {
        return `${node.expression.text}()`;
      }
      // A Hash's `.update` returns the same Hash.
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'update' &&
        isHashChain(node.expression.expression)
      ) {
        return 'a Hash';
      }
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
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
      if (
        ts.isPropertyAccessExpression(node) &&
        stripWrappers(node.expression).kind === ts.SyntaxKind.ThisKeyword &&
        facts.classFields.has(node.name.text)
      ) {
        return nonFirestoreValue(facts.classFields.get(node.name.text), depth + 1);
      }
      if (ts.isPropertyAccessExpression(node)) {
        const base = nonFirestoreValue(node.expression, depth + 1);
        if (base) return `the .${node.name.text} of ${base}`;
      }
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
        const external = importedValue(facts, node.text);
        if (external)
          return resolverFor(external.facts).nonFirestoreValue(external.node, depth + 1);
        const owner = enclosingFunction(node, node.text) ?? enclosingFunction(node);
        if (!owner) return null;
        const params = facts.functions.get(owner.name)?.params ?? [];
        const parameter = params.find((candidate) => candidate.name === node.text);
        if (parameter && NOT_FIRESTORE_TYPE.test(parameter.typeText.trim()))
          return parameter.typeText.trim();
        if (parameter && !parameter.typeText && !facts.ambiguousTypeMethods.has(owner.name)) {
          const declared = facts.typeMethodParams.get(owner.name)?.get(node.text)?.trim();
          if (declared && NOT_FIRESTORE_TYPE.test(declared)) return declared;
        }
        for (const candidate of params) {
          if (candidate.name) continue;
          const declared = candidate.typeText?.trim() ?? '';
          const inline = new RegExp(`\\b${node.text}\\s*:\\s*([A-Za-z_$][\\w$]*)`).exec(declared);
          const named = facts.typeMembers.get(declared)?.get(node.text);
          const typeName = named ? /^([A-Za-z_$][\w$]*)/.exec(named)?.[1] : inline?.[1];
          const imported = typeName ? facts.imports.get(typeName) : null;
          if (imported && !profile.handleModule.test(imported.module)) {
            return `a ${typeName} from ${imported.module}`;
          }
        }
        const index = params.findIndex((candidate) => candidate.name === node.text);
        return index >= 0
          ? (paramNotFirestore.get(paramKey(facts.relPath, owner.name, index)) ?? null)
          : null;
      }
      return null;
    }

    function resolveCollectionSegments(expr) {
      const state = {};
      const result = resolve(expr, state, 0);
      if (!result?.segments || !result.segments.length) return null;
      if (result.segments.length % 2 === 0) return null;
      if (registry.matchSegments(result.segments).length) return null;
      if (!registry.matchSegments([...result.segments, ANY]).length) return null;
      return { segments: result.segments, canonical: Boolean(state.usedBuilder) };
    }

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

  function payloadKeys(hostFacts, hostResolver, expr, isUpdate) {
    const keys = new Set();
    const casts = [];
    const literals = new Map();
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
      const entries = resolver.arrayEntryExpressions(node);
      if (entries?.length) {
        for (const entry of entries)
          readValue(entry.node, depth + 1, entry.facts, resolverFor(entry.facts));
        return;
      }
      opaque ??= 'payload array element is not statically readable';
    };

    const fromEntriesKeys = (argument, facts, resolver, isUpdate) => {
      const mapped = stripWrappers(argument);
      if (
        !ts.isCallExpression(mapped) ||
        !ts.isPropertyAccessExpression(mapped.expression) ||
        mapped.expression.name.text !== 'map'
      )
        return null;
      const callback = mapped.arguments[0];
      if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
        return null;
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
            const inner = computedKeyNames(
              stripWrappers(value.node),
              value.facts,
              value.facts.source,
              isUpdate,
            );
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
      for (let i = 0; i < 8 && node; i++) {
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
          const typeText = node.type.getText(source);
          const inner = stripParens(node.expression);
          if (
            /Record\s*<\s*string\s*,\s*(unknown|any)\s*>/.test(typeText) ||
            /\bany\b/.test(typeText)
          ) {
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
      // Writing `null` or `undefined` throws, so that candidate stores nothing.
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
        const properties = resolver.objectProperties(node.expression);
        if (properties) {
          const index = node.argumentExpression ? stripWrappers(node.argumentExpression) : null;
          const selector = index ? computedKeyName(index, facts, source) : null;
          const entries =
            selector !== null
              ? (properties.get(selector) ?? null)
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
          if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'safeParse')
            return null;
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
              )
                return null;
              picked.push(property.name.text);
            }
            schema = stripWrappers(schema.expression.expression);
          }
          if (picked === null && ts.isPropertyAccessExpression(schema)) {
            const base = constLookup(stripParens(schema.expression), facts);
            const entries = ts.isElementAccessExpression(base)
              ? coreMapEntries(base, facts, source)
              : null;
            const names = entries?.map((entry) =>
              entry && typeof entry === 'object' && !Array.isArray(entry)
                ? registry.canonicalParseName.get(entry[schema.name.text])
                : undefined,
            );
            if (!names?.length || !names.every(Boolean)) return null;
            const keys = new Set();
            for (const name of names)
              for (const key of registry.canonicalParseKeys.get(name).keys) keys.add(key);
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
        const canonicalNestedKeys = (property) => {
          const container = stripWrappers(property.expression);
          let parseCall = container;
          if (ts.isIdentifier(container)) {
            const decl = resolver.nearestDecl(container.text, container.pos, container);
            if (!decl?.initializer) return null;
            parseCall = stripWrappers(decl.initializer);
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
          )
            return null;
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
        const visible = resolver.visibleDecls(node.text, node.pos, node);
        const assignments = visible.filter((candidate) => candidate.initializer);
        if (assignments.length) {
          for (const decl of assignments) readValue(decl.initializer, depth + 1, facts, resolver);
          const earliest = Math.min(...assignments.map((candidate) => candidate.pos));
          for (const assignment of facts.propAssigns.get(node.text) ?? []) {
            if (assignment.pos > earliest)
              keys.add(isUpdate ? assignment.key.split('.')[0] : assignment.key);
          }
          return;
        }
        const decl = resolver.nearestDecl(node.text, node.pos, node);
        if (resolver.isPropertyBinding(decl)) {
          const bound = decl.bindingOf ? stripWrappers(decl.bindingOf) : null;
          if (bound && ts.isCallExpression(bound)) {
            const assertedFromBinding = packageBuilderKeys(facts, bound, decl.bindingProperty);
            if (assertedFromBinding) {
              for (const key of assertedFromBinding.keys)
                keys.add(isUpdate ? key.split('.')[0] : key);
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
            opaque ??=
              "payload parameter '" +
              node.text +
              "' of " +
              owner.name +
              '() — no call site resolved it';
            return;
          }
        }
        opaque ??= "payload variable '" + node.text + "' has no readable declaration";
        return;
      }
      if (ts.isCallExpression(node)) {
        const callee = stripWrappers(node.expression);
        const label = ts.isIdentifier(callee) ? callee.text : callee.getText(source).slice(0, 40);
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'parse' &&
          node.arguments.length === 1
        ) {
          const schema = stripWrappers(callee.expression);
          if (ts.isIdentifier(schema)) {
            const imported = facts.imports.get(schema.text);
            const canonical =
              isCoreImport(facts, imported) && registry.canonicalParseKeys.get(imported.imported);
            if (canonical) {
              for (const key of canonical.keys) keys.add(isUpdate ? key.split('.')[0] : key);
              return;
            }
          }
          if (ts.isPropertyAccessExpression(schema)) {
            const base = constLookup(stripParens(schema.expression), facts);
            const entries = ts.isElementAccessExpression(base)
              ? coreMapEntries(base, facts, source)
              : null;
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
        if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
          const returns = callbackReturns(callee);
          if (returns.length) {
            for (const returned of returns) readValue(returned, depth + 1, facts, resolver);
            return;
          }
        }
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
        const key = resolver.calleeKey(node);
        const builders = key ? payloadBuilders.get(key) : null;
        const builder = builders ? (isUpdate ? builders.update : builders.set) : null;
        if (builder) {
          for (const found of builder.keys) keys.add(isUpdate ? found.split('.')[0] : found);
          if (builder.opaque) opaque ??= 'payload built by ' + label + '(): ' + builder.opaque;
          return;
        }
        if (ts.isIdentifier(callee)) {
          const owner = resolver.enclosingFunction(node, callee.text);
          if (owner) {
            const params = facts.functions.get(owner.name)?.params ?? [];
            const index = params.findIndex((parameter) => parameter.name === callee.text);
            if (index >= 0) {
              const known = paramCallbackPayloads.get(paramKey(facts.relPath, owner.name, index));
              if (known && (known.keys.size || known.opaque)) {
                for (const found of known.keys) keys.add(isUpdate ? found.split('.')[0] : found);
                if (known.opaque)
                  opaque ??= "payload callback '" + callee.text + "': " + known.opaque;
                return;
              }
              opaque ??=
                "payload callback '" +
                callee.text +
                "' of " +
                owner.name +
                '() — no call site resolved it';
              return;
            }
          }
        }
        const asserted = packageBuilderKeys(facts, node, null);
        if (asserted) {
          for (const found of asserted.keys) keys.add(isUpdate ? found.split('.')[0] : found);
          return;
        }
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

  function payloadKeysOfCallback(value, isUpdate) {
    const node = stripWrappers(value.node);
    if (
      !ts.isArrowFunction(node) &&
      !ts.isFunctionExpression(node) &&
      !ts.isMethodDeclaration(node)
    )
      return null;
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

  const payloadBuilders = new Map();

  function sweep({ collectKnowledge }) {
    const writes = [];
    const notFirestore = [];
    const unclassified = [];
    const pendingParamArgs = new Map();
    const pendingReturns = new Map();
    const pendingParamPayloads = new Map();
    const pendingParamCarrierProperties = new Map();
    const pendingReturnCarrierProperties = new Map();
    const pendingParamCollections = new Map();
    const pendingParamCallbackPayloads = new Map();
    const pendingParamArrayEntries = new Map();
    const pendingParamNotFirestore = new Map();
    const pendingParamValues = new Map();
    const pendingParamGroups = new Map();
    const pendingReturnCollections = new Map();
    const pendingReturnGroups = new Map();
    const pendingReturnArrayProperties = new Map();
    const pendingPassThrough = new Map();
    const pendingNonFirestoreReturns = new Map();
    resolverCache = new Map();

    for (const facts of files) {
      const resolver = resolverFor(facts);
      const { source } = facts;
      const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

      if (collectKnowledge) {
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length) continue;
          const found = new Set();
          let ok = true;
          for (const returnExpr of fn.returns) {
            const returned = stripWrappers(returnExpr);
            if (
              returned.kind === ts.SyntaxKind.NullKeyword ||
              returned.kind === ts.SyntaxKind.UndefinedKeyword ||
              (ts.isIdentifier(returned) && returned.text === 'undefined')
            )
              continue;
            const resolved = resolver.resolveTarget(returnExpr);
            if (!resolved.templates) {
              ok = false;
              break;
            }
            for (const template of resolved.templates) found.add(template);
          }
          if (ok && found.size && found.size <= MAX_CANDIDATES)
            pendingReturns.set(fnKey(facts.relPath, name), found);
        }
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
              )
                continue;
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
          if (passThroughIndex !== null)
            pendingPassThrough.set(fnKey(facts.relPath, name), passThroughIndex);
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
            if (allNonFirestore && reason)
              pendingNonFirestoreReturns.set(fnKey(facts.relPath, name), reason);
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
            )
              continue;
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
            const snapshot = resolver.resolveSnapshot(returnExpr, {}, 0);
            if (snapshot?.group?.t === 'lit') {
              groups.add(snapshot.group.v);
              continue;
            }
            if (snapshot?.segments?.length && snapshot.segments.length % 2 === 1) {
              collections.add(JSON.stringify({ segments: snapshot.segments, canonical: false }));
              continue;
            }
            if (snapshot?.templates?.size) {
              const existing = pendingReturns.get(fnKey(facts.relPath, name)) ?? new Set();
              for (const template of snapshot.templates) existing.add(template);
              if (existing.size <= MAX_CANDIDATES)
                pendingReturns.set(fnKey(facts.relPath, name), existing);
              continue;
            }
            ok = false;
            break;
          }
          if (!ok) continue;
          if (collections.size)
            pendingReturnCollections.set(fnKey(facts.relPath, name), collections);
          if (groups.size) pendingReturnGroups.set(fnKey(facts.relPath, name), groups);
        }
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
            const resolved = resolver.resolveTarget(argument);
            if (resolved.templates) {
              if (!pendingParamArgs.has(target)) pendingParamArgs.set(target, new Set());
              for (const template of resolved.templates) pendingParamArgs.get(target).add(template);
            }
            const shape = stripWrappers(argument);
            if (
              ts.isObjectLiteralExpression(shape) ||
              ts.isIdentifier(shape) ||
              ts.isConditionalExpression(shape) ||
              ts.isCallExpression(shape) ||
              ts.isPropertyAccessExpression(shape)
            ) {
              const read = payloadKeys(facts, resolver, argument, false);
              if (read.keys.size || !read.opaque) {
                const existing = pendingParamPayloads.get(target) ?? {
                  keys: new Set(),
                  opaque: null,
                };
                for (const key of read.keys) existing.keys.add(key);
                existing.opaque ??= read.opaque;
                pendingParamPayloads.set(target, existing);
              }
            }
            const collection = resolver.resolveCollectionSegments(argument);
            if (collection) {
              if (!pendingParamCollections.has(target))
                pendingParamCollections.set(target, new Set());
              pendingParamCollections.get(target).add(JSON.stringify(collection));
            }
            const group = resolver.resolveCollectionGroup(argument);
            if (group) {
              if (!pendingParamGroups.has(target)) pendingParamGroups.set(target, new Set());
              pendingParamGroups.get(target).add(group);
            }
            const suppliedValues = pendingParamValues.get(target) ?? [];
            if (
              !suppliedValues.some(
                (candidate) => candidate.facts === facts && candidate.node === argument,
              )
            ) {
              suppliedValues.push({ facts, node: argument });
            }
            if (suppliedValues.length <= MAX_CANDIDATES)
              pendingParamValues.set(target, suppliedValues);
            if (ts.isArrowFunction(shape) || ts.isFunctionExpression(shape)) {
              const returns = [];
              if (!ts.isBlock(shape.body)) returns.push(shape.body);
              else {
                const collect = (inner) => {
                  if (inner !== shape && ts.isFunctionLike(inner)) return;
                  if (ts.isReturnStatement(inner) && inner.expression)
                    returns.push(inner.expression);
                  ts.forEachChild(inner, collect);
                };
                ts.forEachChild(shape.body, collect);
              }
              if (returns.length && returns.length <= MAX_CALLBACK_RETURNS) {
                const existing = pendingParamCallbackPayloads.get(target) ?? {
                  keys: new Set(),
                  opaque: null,
                };
                for (const returned of returns) {
                  const read = payloadKeys(facts, resolver, returned, false);
                  for (const key of read.keys) existing.keys.add(key);
                  existing.opaque ??= read.opaque;
                }
                pendingParamCallbackPayloads.set(target, existing);
              }
            }
            // A self-recursive pass-through adds no information; counting it as unknown deadlocks the fixed
            // point.
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
            {
              const entries = resolver.arrayEntryExpressions(shape);
              if (entries?.length && entries.length <= MAX_QUEUE_ENTRIES) {
                const existing = pendingParamArrayEntries.get(target) ?? [];
                existing.push(...entries);
                if (existing.length <= MAX_QUEUE_ENTRIES)
                  pendingParamArrayEntries.set(target, existing);
              }
            }
            const properties = resolver.objectProperties(argument);
            if (properties && properties.size <= MAX_CANDIDATES) {
              for (const [property, values] of properties) {
                if (!values.length || values.length > MAX_CANDIDATES) continue;
                const carrierKey = `${target}.${property}`;
                const existing = pendingParamCarrierProperties.get(carrierKey) ?? [];
                existing.push(...values);
                if (existing.length <= MAX_CANDIDATES)
                  pendingParamCarrierProperties.set(carrierKey, existing);
              }
            }
          });
        }
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length || fn.returns.length > 8) continue;
          const readings = {
            set: { keys: new Set(), opaque: null },
            update: { keys: new Set(), opaque: null },
          };
          let payloadShaped = false;
          for (const returnExpr of fn.returns) {
            const returned = stripWrappers(returnExpr);
            if (
              !ts.isObjectLiteralExpression(returned) &&
              !ts.isIdentifier(returned) &&
              !ts.isConditionalExpression(returned) &&
              !ts.isCallExpression(returned) &&
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
            )
              continue;
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
        for (const [name, fn] of facts.functions) {
          if (!fn.returns.length || fn.returns.length > MAX_CALLBACK_RETURNS) continue;
          const collected = new Map();
          for (const property of ARRAY_CARRIER_PROPERTIES) {
            const values = [];
            let ok = true;
            for (const returnExpr of fn.returns) {
              const found = resolver.propertyValuesFromArray(returnExpr, property);
              if (!found) {
                ok = false;
                break;
              }
              values.push(...found);
            }
            if (ok && values.length && values.length <= MAX_CANDIDATES)
              collected.set(property, values);
          }
          if (collected.size)
            pendingReturnArrayProperties.set(fnKey(facts.relPath, name), collected);
        }
        continue;
      }

      if (facts.library) continue;
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

      const recordUnresolvedSelector = (node, receiver) => {
        const evidence = notFirestoreEvidence(
          facts,
          resolver,
          stripWrappers(receiver),
          [],
          node.arguments,
        );
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
          snippet: facts.text
            .slice(node.getStart(source), node.getEnd())
            .split('\n')[0]
            .trim()
            .slice(0, 120),
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
            record(
              node,
              direct.methods,
              classifyWrite(facts, resolver, direct.receiver, direct.methods, node),
            );
          } else {
            const indirect = resolveIndirectWrite(facts, resolver, callee, node);
            if (indirect && !indirect.resolved) {
              recordUnresolvedSelector(node, indirect.receiver);
            } else if (indirect) {
              record(
                node,
                indirect.methods,
                classifyWrite(facts, resolver, indirect.receiver, indirect.methods, node, {
                  indirect: indirect.form,
                }),
              );
            } else if (
              ts.isPropertyAccessExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              callee.expression.text === 'Reflect' &&
              callee.name.text === 'apply' &&
              node.arguments.length >= 3
            ) {
              const reflected = writeMethodAccess(stripWrappers(node.arguments[0]), facts);
              const list = stripWrappers(node.arguments[2]);
              const dataExpr = ts.isArrayLiteralExpression(list)
                ? (list.elements[0] ?? null)
                : null;
              if (reflected && !reflected.resolved) {
                recordUnresolvedSelector(node, node.arguments[1] ?? reflected.receiver);
              } else if (reflected) {
                const receiver = node.arguments[1] ?? reflected.receiver;
                record(
                  node,
                  reflected.methods,
                  classifyWrite(facts, resolver, receiver, reflected.methods, node, {
                    indirect: { refExpr: receiver, dataExpr, extraArgs: [] },
                  }),
                );
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

  function resolveIndirectWrite(facts, resolver, callee, call) {
    if (!ts.isPropertyAccessExpression(callee) || !INDIRECTION_METHODS.has(callee.name.text))
      return null;
    const bound = stripWrappers(callee.expression);
    let access = writeMethodAccess(bound, facts);
    if (!access && ts.isIdentifier(bound)) {
      const decl = resolver.nearestDecl(bound.text, bound.pos, bound);
      if (decl?.bindingOf && decl.bindingProperty && WRITE_METHODS.has(decl.bindingProperty)) {
        access = { methods: [decl.bindingProperty], receiver: decl.bindingOf, resolved: true };
      } else if (decl?.initializer) {
        access = writeMethodAccess(stripWrappers(decl.initializer), facts);
      }
    }
    if (
      !access &&
      ts.isPropertyAccessExpression(bound) &&
      INDIRECTION_METHODS.has(bound.name.text) &&
      call.arguments[0]
    ) {
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
    if (!access && reflectiveMethodSource(facts, resolver, bound)) {
      return { methods: [], receiver: call.arguments[0] ?? bound, resolved: false };
    }
    if (!access) return null;
    const kind = callee.name.text;
    const args = call.arguments;
    const receiver = args[0] ?? access.receiver;
    if (!access.resolved) return { methods: [], receiver, resolved: false };
    if (kind === 'call') {
      return {
        methods: access.methods,
        receiver,
        resolved: true,
        form: { refExpr: receiver, dataExpr: args[1] ?? null, extraArgs: args.slice(2) },
      };
    }
    if (kind === 'apply') {
      const list = args[1] ? stripWrappers(args[1]) : null;
      const first =
        list && ts.isArrayLiteralExpression(list) && !ts.isSpreadElement(list.elements[0] ?? {})
          ? list.elements[0]
          : null;
      return {
        methods: access.methods,
        receiver,
        resolved: true,
        form: { refExpr: receiver, dataExpr: first ?? null, extraArgs: [] },
      };
    }
    return {
      methods: access.methods,
      receiver,
      resolved: true,
      form: { refExpr: receiver, dataExpr: null, extraArgs: [] },
    };
  }

  function reflectiveMethodSource(facts, resolver, node, depth = 0) {
    if (!node || depth > 4) return false;
    const current = stripWrappers(node);
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const owner = stripWrappers(current.expression.expression);
      const method = current.expression.name.text;
      if (
        ts.isIdentifier(owner) &&
        ((owner.text === 'Object' &&
          (method === 'getOwnPropertyDescriptor' || method === 'getOwnPropertyDescriptors')) ||
          (owner.text === 'Reflect' && (method === 'get' || method === 'getOwnPropertyDescriptor')))
      )
        return true;
    }
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      return reflectiveMethodSource(facts, resolver, current.expression, depth + 1);
    }
    if (ts.isIdentifier(current)) {
      const decl = resolver.nearestDecl(current.text, current.pos, current);
      if (decl?.initializer)
        return reflectiveMethodSource(facts, resolver, decl.initializer, depth + 1);
    }
    return false;
  }

  /**
   * @returns {{ refExpr, dataExpr, extraArgs? , fieldPathArgs? } | { notFirestore: string }}
   */
  function classifyWrite(facts, resolver, receiver, methods, call, options = {}) {
    const receiverNode = stripWrappers(receiver);
    const args = call.arguments;

    const txHandle = () => {
      if (!ts.isIdentifier(receiverNode)) return false;
      const decl = resolver.nearestDecl(receiverNode.text, receiverNode.pos, receiverNode);
      if (decl?.initializer) {
        const initializer = stripWrappers(decl.initializer);
        return (
          ts.isCallExpression(initializer) &&
          ts.isPropertyAccessExpression(initializer.expression) &&
          (initializer.expression.name.text === 'batch' ||
            initializer.expression.name.text === 'bulkWriter')
        );
      }
      if (decl) return false;
      const owner = resolver.enclosingFunction(receiverNode, receiverNode.text);
      if (owner) {
        const parameter = (facts.functions.get(owner.name)?.params ?? []).find(
          (p) => p.name === receiverNode.text,
        );
        if (parameter && profile.transactionType.test(parameter.typeText)) return true;
      }
      return resolver.isTransactionCallbackParam(receiverNode);
    };

    if (options.indirect) return options.indirect;

    if (txHandle()) {
      if (methods.every((entry) => entry === 'add')) {
        return { notFirestore: 'a resolved Transaction/WriteBatch handle has no add()' };
      }
      if (args.length >= 2)
        return { refExpr: args[0], dataExpr: args[1], extraArgs: args.slice(2) };
      return { refExpr: receiver, dataExpr: args[0] ?? null, extraArgs: [] };
    }

    // Only `update()` has the variadic field-path form (`ref.update('a.b', v, …)`).
    if (
      methods.length === 1 &&
      methods[0] === 'update' &&
      args.length >= 2 &&
      ts.isStringLiteralLike(stripWrappers(args[0]))
    ) {
      return { refExpr: receiver, dataExpr: null, fieldPathArgs: args };
    }

    const resolvedReceiver = resolver.resolveTarget(receiver);
    if (!resolvedReceiver.templates) {
      const evidence = resolvedReceiver.capped
        ? null
        : notFirestoreEvidence(facts, resolver, receiverNode, methods, args);
      if (evidence) return { notFirestore: evidence };
      if (args.length >= 2 && resolver.resolveTarget(args[0]).templates) {
        return { refExpr: args[0], dataExpr: args[1], extraArgs: args.slice(2) };
      }
    }

    if (args.length === 0) {
      return { notFirestore: `${methods.join('|')}() with no arguments carries no payload` };
    }
    return { refExpr: receiver, dataExpr: args[0], extraArgs: args.slice(1) };
  }

  function notFirestoreEvidence(facts, resolver, receiverNode, methods, args) {
    const value = resolver.nonFirestoreValue(receiverNode);
    if (value) return `receiver is ${value}`;

    const own = ownMemberDispatch(facts, resolver, receiverNode, methods);
    if (own) return own;

    if (
      ts.isCallExpression(receiverNode) &&
      ts.isPropertyAccessExpression(receiverNode.expression)
    ) {
      const readMethod = receiverNode.expression.name.text;
      if (readMethod === 'get' || readMethod === 'getAll') {
        const container = resolver.nonFirestoreValue(receiverNode.expression.expression);
        if (container) return `receiver is a .${readMethod}() lookup on ${container}`;
      }
    }
    if (ts.isConditionalExpression(receiverNode)) {
      const left = notFirestoreEvidence(
        facts,
        resolver,
        stripWrappers(receiverNode.whenTrue),
        methods,
        args,
      );
      const right = notFirestoreEvidence(
        facts,
        resolver,
        stripWrappers(receiverNode.whenFalse),
        methods,
        args,
      );
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
        const index = params.findIndex((candidate) => candidate.name === receiverNode.text);
        const known =
          index >= 0 ? paramNotFirestore.get(paramKey(facts.relPath, owner.name, index)) : null;
        if (known)
          return `receiver is a parameter every call site fills with a non-Firestore value (${known})`;
      }
    }

    return null;
  }

  /**
   * @returns {string | null}
   */
  function ownMemberDispatch(facts, resolver, receiverNode, methods) {
    const declares = (names) => !methods.length || methods.every((method) => names.has(method));

    if (receiverNode.kind === ts.SyntaxKind.ThisKeyword) {
      for (let parent = receiverNode.parent; parent; parent = parent.parent) {
        if (!ts.isClassDeclaration(parent) && !ts.isClassExpression(parent)) continue;
        const names = new Set();
        for (const member of parent.members) {
          if (
            member.name &&
            (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name))
          ) {
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
      if (
        property.name &&
        (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
      ) {
        names.add(property.name.text);
      }
    }
    return declares(names)
      ? 'receiver is an object literal whose own properties supply the dispatched method'
      : null;
  }

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
          if (
            ts.isElementAccessExpression(initializer) &&
            coreMapEntries(initializer, facts, facts.source)
          ) {
            found.add(initializer);
            return;
          }
          visit(initializer, depth + 1);
          return;
        }
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
    if (
      ts.isCallExpression(refNode) &&
      ts.isPropertyAccessExpression(refNode.expression) &&
      refNode.expression.name.text === 'doc' &&
      refNode.arguments.length === 1 &&
      resolver.isFirestoreRoot(refNode.expression.expression)
    ) {
      const path = stripWrappers(refNode.arguments[0]);
      const paired = ts.isPropertyAccessExpression(path)
        ? carrierPairing(facts, resolver, path, dataNode)
        : null;
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
    if (!ts.isPropertyAccessExpression(callee) || callee.expression.getText(source) !== carrierText)
      return null;
    return {
      carrier: refNode.expression,
      refProperty: refNode.name.text,
      dataProperty: callee.name.text,
      invoke: true,
    };
  }

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
    const declaredIn = imported
      ? declaringFile(resolveImport(facts.relPath, imported.module), imported.imported)
      : facts.relPath;
    return declaredIn === table.module ? { table, entry: node.name.text } : null;
  }

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
    )
      return null;
    const documentId = stripWrappers(node.arguments[0]);
    const collectionName = stripWrappers(collection.arguments[0]);
    if (
      !ts.isPropertyAccessExpression(documentId) ||
      !ts.isPropertyAccessExpression(collectionName) ||
      documentId.name.text !== 'documentId' ||
      collectionName.name.text !== 'collection'
    )
      return null;
    const entry = v1SourceEntry(facts, resolver, documentId.expression);
    const sibling = v1SourceEntry(facts, resolver, collectionName.expression);
    return entry && sibling && entry.table === sibling.table && entry.entry === sibling.entry
      ? entry
      : null;
  }

  function buildWrite(facts, resolver, call, methods, classified, line) {
    const { source } = facts;

    const readAs = (method) => {
      const isUpdate = method === 'update';
      const collectionAdd = method === 'add';

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

      const refNode = stripWrappers(classified.refExpr);
      const dataNode = classified.dataExpr ? stripWrappers(classified.dataExpr) : null;

      const entryBinding = classified.fieldPathArgs
        ? null
        : sharedMapEntryBinding(facts, resolver, refNode, dataNode);
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

      const pairing = classified.fieldPathArgs
        ? null
        : carrierPairing(facts, resolver, refNode, dataNode);
      if (pairing) {
        const pairs = resolver.correlatedCarrierPairs(
          pairing.carrier,
          pairing.refProperty,
          pairing.dataProperty,
        );
        const correlated = [];
        let readable = Boolean(pairs?.length) && pairs.length <= MAX_CANDIDATES;
        for (const pair of readable ? pairs : []) {
          if (!pairing.invoke && stripWrappers(pair.right.node).kind === ts.SyntaxKind.NullKeyword)
            continue;
          // Resolve each pair in its own file: a foreign node's offset read against this file's source
          // names unrelated text.
          const target = resolverFor(pair.left.facts).resolveTarget(pair.left.node, {
            collectionAdd,
          });
          const read = pairing.invoke
            ? payloadKeysOfCallback(pair.right, isUpdate)
            : payloadKeys(
                pair.right.facts,
                resolverFor(pair.right.facts),
                pair.right.node,
                isUpdate,
              );
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
        if (
          !existing.some(
            (candidate) => candidate.facts === value.facts && candidate.node === value.node,
          )
        ) {
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
        if (
          !existing.some(
            (candidate) => candidate.facts === entry.facts && candidate.node === entry.node,
          )
        ) {
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
        if (
          !existing.some(
            (candidate) => candidate.facts === value.facts && candidate.node === value.node,
          )
        ) {
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
          if (
            !known.some(
              (candidate) => candidate.facts === value.facts && candidate.node === value.node,
            )
          ) {
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
          if (
            !known.some(
              (candidate) => candidate.facts === value.facts && candidate.node === value.node,
            )
          ) {
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

export function enumerateWriteCallSites(files) {
  const WRITE_NAMES = ['set', 'update', 'create', 'add'];
  const INDIRECTION_NAMES = ['call', 'apply', 'bind'];
  const PLAIN_CONTAINERS = [
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'URLSearchParams',
    'Headers',
    'FormData',
    'URL',
    'Array',
  ];
  const PLAIN_CONTAINER_TYPE =
    /^(readonly\s+)?(Map|Set|WeakMap|WeakSet|ReadonlyMap|ReadonlySet|URLSearchParams|Headers|FormData|URL|Record|Array|Partial)\s*(<|\[|\||$)/;
  const REFLECTIVE = {
    Object: ['getOwnPropertyDescriptor', 'getOwnPropertyDescriptors'],
    Reflect: ['get', 'getOwnPropertyDescriptor'],
  };
  const STRUCTURAL_DEPTH = 8;

  const sites = [];
  for (const facts of files) {
    const { source } = facts;

    const soleInitializer = (name) => {
      const declared = (facts.varDecls.get(name) ?? []).filter((entry) => entry.initializer);
      return declared.length === 1 ? declared[0].initializer : null;
    };

    const reflective = (expr, depth = 0) => {
      if (!expr || depth > STRUCTURAL_DEPTH) return false;
      const node = unwrapNode(expr);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const owner = unwrapNode(node.expression.expression);
        if (
          ts.isIdentifier(owner) &&
          (REFLECTIVE[owner.text] ?? []).includes(node.expression.name.text)
        ) {
          return true;
        }
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return reflective(node.expression, depth + 1);
      }
      if (ts.isIdentifier(node)) return reflective(soleInitializer(node.text), depth + 1);
      return false;
    };

    const plainReceiver = (expr, depth = 0) => {
      if (!expr || depth > STRUCTURAL_DEPTH) return null;
      const node = unwrapNode(expr);
      if (ts.isObjectLiteralExpression(node)) return 'an object literal';
      if (ts.isArrayLiteralExpression(node)) return 'an array literal';
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        PLAIN_CONTAINERS.includes(node.expression.text)
      ) {
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
          return PLAIN_CONTAINER_TYPE.test(declared)
            ? `a ${declared.slice(0, 40)} parameter`
            : null;
        }
      }
      return null;
    };

    const invoked = (expr, args, depth = 0) => {
      if (!expr) return null;
      if (depth > STRUCTURAL_DEPTH) return { method: null, receiver: null };
      const node = unwrapNode(expr);
      if (ts.isPropertyAccessExpression(node)) {
        const name = node.name.text;
        if (WRITE_NAMES.includes(name)) return { method: name, receiver: node.expression };
        if (INDIRECTION_NAMES.includes(name)) {
          const inner = invoked(node.expression, args, depth + 1);
          if (inner) return { method: inner.method, receiver: args?.[0] ?? inner.receiver };
          const viaArgument = args?.length ? invoked(args[0], args.slice(1), depth + 1) : null;
          if (viaArgument)
            return { method: viaArgument.method, receiver: args[1] ?? viaArgument.receiver };
          return reflective(node.expression, depth + 1)
            ? { method: null, receiver: args?.[0] ?? null }
            : null;
        }
        return reflective(node, depth + 1) ? { method: null, receiver: args?.[0] ?? null } : null;
      }
      if (ts.isElementAccessExpression(node)) {
        const selector = node.argumentExpression ? unwrapNode(node.argumentExpression) : null;
        if (selector && ts.isStringLiteralLike(selector)) {
          return WRITE_NAMES.includes(selector.text)
            ? { method: selector.text, receiver: node.expression }
            : null;
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
        const callee = unwrapNode(node.expression);
        const args = [...node.arguments];
        let found = null;
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(unwrapNode(callee.expression)) &&
          unwrapNode(callee.expression).text === 'Reflect' &&
          callee.name.text === 'apply' &&
          args.length
        ) {
          const target = invoked(args[0], args.slice(1), 0);
          if (target) found = { method: target.method, receiver: args[1] ?? target.receiver };
        } else {
          found = invoked(callee, args, 0);
        }
        if (found && (found.method !== null || !plainReceiver(found.receiver))) {
          sites.push({
            file: facts.relPath,
            pos: node.getStart(source),
            method: found.method ?? 'computed',
            at: `${facts.relPath}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
            snippet: facts.text
              .slice(node.getStart(source), node.getEnd())
              .split('\n')[0]
              .trim()
              .slice(0, 120),
          });
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  return sites;
}

function treeOf(relPath, trees) {
  for (const tree of trees) if (relPath === tree || relPath.startsWith(`${tree}/`)) return tree;
  return 'other';
}

/**
 * @param {{ writes: any[], registry: any, exceptions?: any[], trees: string[], notFirestore?: any[],
 *   unclassified?: any[], callSites?: any[] | null, packageBuilderUses?: any[] }} input
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

  const ordinals = new Map();
  for (const write of writes) {
    const key = `${write.file} :: ${write.fn ?? '(module)'} :: ${write.snippet}`;
    const next = (ordinals.get(key) ?? 0) + 1;
    ordinals.set(key, next);
    write.snippetOrdinal = next;
  }

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
      if (entry.used === 1)
        applied.push({ kind: entry.kind, at: `${entry.file} ${entry.callee}()`, why: entry.why });
    }
  }

  const excuse = (kind, write, detail) => {
    const entry = remaining.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.file === write.file &&
        candidate.used < (candidate.count ?? 1) &&
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

    const branches = write.correlatedBranches ?? [
      {
        templates: write.templates,
        unresolvedReason: write.unresolvedReason,
        handBuilt: write.handBuilt,
        keys: write.keys,
        casts: write.casts,
        opaque: write.opaque,
        literals: write.literals,
      },
    ];
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
        const diffable = new Map();
        for (const template of branch.templates) {
          const narrowed = narrowedDeclaredKeys(registry.schemaFor(template), branch.literals);
          const declared = narrowed ?? registry.declaredFor(template);
          if (!declared || declared.open) {
            const soleCandidate = branch.templates.length === 1;
            const undiffableDetail =
              `'${template}' has no readable declared keys (a wrapper/record/open schema), ` +
              'so this payload was diffed against nothing';
            if (
              soleCandidate ||
              !excuse(VIOLATION_KINDS.UNDIFFABLE_TEMPLATE, write, undiffableDetail)
            ) {
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
    if (branches.every((branch) => branch.templates && !branch.opaque))
      bump(tree, 'payloadsParsed');
    if (branchDiffable && branches.every((branch) => branch.templates && !branch.opaque)) {
      bump(tree, 'payloadsRead');
    }
    if (violations.length > before) bump(tree, 'violations');
    if (applied.length > appliedBefore) bump(tree, 'exceptions');
  }

  for (const call of unclassified) {
    violations.push({
      kind: VIOLATION_KINDS.UNCLASSIFIED_CALL,
      at: call.at,
      detail: call.reason,
      snippet: call.snippet,
    });
    bump(treeOf(call.file, trees), 'violations');
  }

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
  const libraryFiles = Object.entries(librarySources).map(([rel, text]) =>
    parseFile(rel, text, { library: true }),
  );
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

/**
 * @param {{ coverage: Map<string, any>, violations: any[], applied: any[], staleExceptions: string[], staleExclusions?: string[] }} result
 */
export function formatReport({
  coverage,
  violations,
  applied,
  staleExceptions,
  staleExclusions = [],
}) {
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
  lines.push(
    '  (payload VERIFIED = read AND diffed against a readable schema; parsed is syntax only)',
  );
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

export async function loadRegistry({ sources, constantMapNames }) {
  const core = await sources.core();
  const docSchemas = await sources.docSchemas();
  const { COLLECTION_SCHEMAS } = docSchemas;
  if (!COLLECTION_SCHEMAS)
    throw new Error("repo-guards: the core's docSchemas entry exports no COLLECTION_SCHEMAS");
  const subpaths = {};
  for (const [specifier, load] of Object.entries(sources.subpaths ?? {})) {
    try {
      Object.assign(subpaths, await load());
    } catch (cause) {
      throw new Error(`repo-guards: core entry point ${specifier} did not load`, { cause });
    }
  }
  const constantMaps = {};
  for (const name of constantMapNames) {
    if (!core[name])
      throw new Error(`repo-guards: the core no longer exports the constant map ${name}`);
    constantMaps[name] = core[name];
  }
  return buildRegistry({
    PATH_BUILDERS: core.PATH_BUILDERS,
    COLLECTION_SCHEMAS,
    constantMaps,
    COLLECTION_REFS: core.COLLECTION_REFS ?? {},
    canonicalSchemas: { ...core, ...subpaths, ...docSchemas },
    coreExports: { ...core, ...subpaths, ...docSchemas },
  });
}
