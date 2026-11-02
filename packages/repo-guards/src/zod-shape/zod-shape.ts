export interface ZodDef {
  readonly typeName?: unknown;
  readonly type?: unknown;
  readonly innerType?: unknown;
  readonly schema?: unknown;
  readonly in?: unknown;
  readonly shape?: unknown;
  readonly element?: unknown;
  readonly options?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly valueType?: unknown;
  readonly items?: unknown;
  readonly rest?: unknown;
  readonly catchall?: unknown;
  readonly unknownKeys?: unknown;
  readonly values?: unknown;
  readonly value?: unknown;
}

export function defOf(s: unknown): ZodDef | null {
  if (!s || (typeof s !== 'object' && typeof s !== 'function')) return null;
  const def: unknown = (s as { _def?: unknown })._def;
  // Zod keeps a schema's definition on `_def`, outside its typed public API.
  return def && typeof def === 'object' ? (def as ZodDef) : null;
}

export function kindOf(s: unknown): string | null {
  const def = defOf(s);
  if (!def) return null;
  if (typeof def.typeName === 'string') return def.typeName.replace(/^Zod/, '').toLowerCase();
  if (typeof def.type === 'string') return def.type;
  return null;
}

// A Zod 4 pipe is followed into its input: a preprocess rewrites the value before the output
// shape applies, so that shape's keys are never the stored keys.
export function unwrap(s: unknown): unknown {
  for (let i = 0; i < 12 && s && defOf(s); i++) {
    const def = defOf(s)!;
    const t = kindOf(s);
    if (
      t === 'optional' ||
      t === 'nullable' ||
      t === 'default' ||
      t === 'nonoptional' ||
      t === 'readonly' ||
      t === 'catch'
    )
      s = def.innerType;
    else if (t === 'effects') s = def.schema;
    else if (t === 'pipe') s = def.in;
    else break;
  }
  return s;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const isList = (value: unknown): value is unknown[] => Array.isArray(value);

export function objectShape(schema: unknown): Record<string, unknown> | null {
  const s = unwrap(schema);
  if (kindOf(s) !== 'object') return null;
  try {
    const def = defOf(s)!;
    const raw: unknown =
      typeof def.shape === 'function' ? Reflect.apply(def.shape, def, []) : def.shape;
    if (isRecord(raw)) return raw;
    const own = (s as { shape?: unknown }).shape;
    return isRecord(own) ? own : null;
  } catch {
    return null;
  }
}

export function arrayElement(schema: unknown): unknown {
  const s = unwrap(schema);
  if (kindOf(s) !== 'array') return null;
  const def = defOf(s)!;
  // Zod 4 keeps the element on `def.element`; Zod 3 kept it on `def.type`, which in Zod 4
  // holds the tag string instead — so only accept `def.type` when it is a schema object.
  if (def.element) return def.element;
  return def.type && typeof def.type === 'object' ? def.type : null;
}

// Zod 3 keeps a discriminated union's options in a `Map`.
export function compositeMembers(schema: unknown): unknown[] | null {
  const s = unwrap(schema);
  const kind = kindOf(s);
  const def = defOf(s);
  if (!def) return null;
  if (kind === 'union' || kind === 'discriminatedunion' || kind === 'discriminated_union') {
    const options: unknown = def.options instanceof Map ? [...def.options.values()] : def.options;
    return isList(options) ? options : null;
  }
  if (kind === 'intersection') return [def.left, def.right].filter(Boolean);
  if (kind === 'record') return def.valueType ? [def.valueType] : null;
  if (kind === 'tuple')
    return [...(isList(def.items) ? def.items : []), ...(def.rest ? [def.rest] : [])];
  return null;
}

export function knownKeys(schema: unknown): Set<string> | null {
  const shape = objectShape(schema);
  return shape ? new Set(Object.keys(shape)) : null;
}

export type ObjectMode = 'plain' | 'strict' | 'loose' | 'catchall';

// Zod 3 keeps the unknown-key policy on `unknownKeys` beside a catchall that defaults to `never`;
// Zod 4 keeps only the catchall, absent on a plain object.
export function objectMode(schema: unknown): ObjectMode | null {
  if (kindOf(schema) !== 'object') return null;
  const def = defOf(schema)!;
  const catchall = def.catchall ? kindOf(def.catchall) : null;
  if (typeof def.unknownKeys === 'string') {
    if (catchall && catchall !== 'never') return 'catchall';
    if (def.unknownKeys === 'strict') return 'strict';
    return def.unknownKeys === 'passthrough' ? 'loose' : 'plain';
  }
  if (!catchall) return 'plain';
  if (catchall === 'never') return 'strict';
  return catchall === 'unknown' || catchall === 'any' ? 'loose' : 'catchall';
}

export interface ReachedObject {
  readonly schema: unknown;
  readonly path: string;
  readonly mode: ObjectMode;
}

// Every schema a schema reaches, each once, at the first path it is reached by: object fields
// (`.field`), array and set elements (`[]`), record and map values (`.*`), union and intersection
// members and tuple items (`|n`), both sides of a pipe, and a lazy schema's target.
function walkSchema(
  schema: unknown,
  path: string,
  onSchema: (reached: unknown, at: string) => void,
): void {
  const seen = new Set<unknown>();
  const visit = (s: unknown, at: string) => {
    if (!defOf(s) || seen.has(s)) return;
    seen.add(s);
    onSchema(s, at);
    const def = defOf(s)!;
    const kind = kindOf(s);
    const mode = objectMode(s);
    if (mode) {
      for (const [key, field] of Object.entries(objectShape(s) ?? {})) visit(field, `${at}.${key}`);
      if (mode !== 'strict' && mode !== 'plain') visit(def.catchall, `${at}.*`);
      return;
    }
    if (kind === 'array' || kind === 'set') {
      visit(kind === 'array' ? arrayElement(s) : def.valueType, `${at}[]`);
      return;
    }
    if (kind === 'record' || kind === 'map') {
      visit(def.valueType, `${at}.*`);
      return;
    }
    if (kind === 'lazy') {
      const getter = (def as { getter?: unknown }).getter;
      if (typeof getter === 'function') visit(Reflect.apply(getter, def, []), at);
      return;
    }
    if (kind === 'pipe') {
      visit(def.in, at);
      visit((def as { out?: unknown }).out, at);
      return;
    }
    if (kind === 'effects') {
      visit(def.schema, at);
      return;
    }
    if (def.innerType) {
      visit(def.innerType, at);
      return;
    }
    compositeMembers(s)?.forEach((member, index) => visit(member, `${at}|${index}`));
  };
  visit(schema, path);
}

export function reachedObjects(schema: unknown, path = ''): ReachedObject[] {
  const reached: ReachedObject[] = [];
  walkSchema(schema, path, (s, at) => {
    const mode = objectMode(s);
    if (mode) reached.push({ schema: s, path: at, mode });
  });
  return reached;
}

// Zod 4 builds a discriminated union as a union that carries its discriminator; Zod 3 gives it a
// kind of its own.
function isDiscriminatedUnion(schema: unknown): boolean {
  const kind = kindOf(schema);
  if (kind === 'discriminatedunion' || kind === 'discriminated_union') return true;
  return typeof (defOf(schema) as { discriminator?: unknown } | null)?.discriminator === 'string';
}

function holdsObjectShape(schema: unknown): boolean {
  if (objectShape(schema)) return true;
  const kind = kindOf(unwrap(schema));
  if (kind !== 'union' && kind !== 'intersection' && !isDiscriminatedUnion(unwrap(schema)))
    return false;
  return (compositeMembers(schema) ?? []).some(holdsObjectShape);
}

export interface GuessingUnion {
  readonly schema: unknown;
  readonly path: string;
}

// Every union a schema reaches that holds two or more object shapes and no discriminator: a value
// is read as the first member it happens to parse as, so a valid value of a larger shape can be read
// as a smaller one listed before it, and a damaged value as another shape.
export function guessingUnions(schema: unknown, path = ''): GuessingUnion[] {
  const found: GuessingUnion[] = [];
  walkSchema(schema, path, (s, at) => {
    if (kindOf(s) !== 'union' || isDiscriminatedUnion(s)) return;
    if ((compositeMembers(s) ?? []).filter(holdsObjectShape).length >= 2)
      found.push({ schema: s, path: at });
  });
  return found;
}

// The fields a stored value holds that its schema does not name, at every depth the schema
// declares: a plain schema drops them on read, so a drift check finds them here. A union value is
// matched to the member the schema itself parses it as.
export function unknownFieldPaths(schema: unknown, value: unknown, path = ''): string[] {
  const found: string[] = [];
  const visit = (s: unknown, v: unknown, at: string) => {
    if (v === null || v === undefined || !defOf(s)) return;
    const inner = unwrap(s);
    const kind = kindOf(inner);
    const shape = objectShape(inner);
    if (shape) {
      if (!isRecord(v) || isList(v)) return;
      for (const [key, field] of Object.entries(v)) {
        if (key in shape) visit(shape[key], field, `${at}.${key}`);
        else found.push(`${at}.${key}`);
      }
      return;
    }
    if (kind === 'array' && isList(v)) {
      const element = arrayElement(inner);
      v.forEach((item, index) => visit(element, item, `${at}[${index}]`));
      return;
    }
    if (kind === 'record' && isRecord(v)) {
      const valueType = defOf(inner)!.valueType;
      for (const [key, item] of Object.entries(v)) visit(valueType, item, `${at}.${key}`);
      return;
    }
    const members = compositeMembers(inner);
    if (members && (kind === 'union' || kind === 'discriminatedunion')) {
      const match = members.find(
        (member) =>
          (member as { safeParse?: (x: unknown) => { success: boolean } }).safeParse?.(v)?.success,
      );
      if (match) visit(match, v, at);
    }
  };
  visit(schema, value, path);
  return found;
}
