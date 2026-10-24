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
