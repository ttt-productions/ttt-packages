// The one owner of Zod schema introspection for the guards and an app's audit tooling. Handles both
// Zod 3 (`_def.typeName` 'ZodObject', `_def.shape()`) and Zod 4 (`_def.type` 'object',
// `_def.shape` as a plain object) internals, so a Zod major bump is a one-file change
// instead of a hunt through every auditor.

/** Lowercase type tag of a Zod schema ('object', 'optional', 'array', …), or null. */
export function kindOf(s) {
  const def = s?._def;
  if (!def) return null;
  if (typeof def.typeName === 'string') return def.typeName.replace(/^Zod/, '').toLowerCase();
  if (typeof def.type === 'string') return def.type;
  return null;
}

/** Strip optional/nullable/default/effects/pipe wrappers down to the inner schema. A Zod 4 pipe is
 * followed into its INPUT, so a preprocess stops at its transform: the value a preprocess admits
 * is rewritten before the shape applies, so that shape's keys are never read as the stored keys. */
export function unwrap(s) {
  for (let i = 0; i < 12 && s && s._def; i++) {
    const t = kindOf(s);
    if (
      t === 'optional' ||
      t === 'nullable' ||
      t === 'default' ||
      t === 'nonoptional' ||
      t === 'readonly' ||
      t === 'catch'
    )
      s = s._def.innerType;
    else if (t === 'effects') s = s._def.schema;
    else if (t === 'pipe') s = s._def.in;
    else break;
  }
  return s;
}

/** The raw `{ key: schema }` shape of a (possibly wrapped) Zod object; null for non-objects. */
export function objectShape(schema) {
  const s = unwrap(schema);
  if (kindOf(s) !== 'object') return null;
  try {
    const raw = typeof s._def.shape === 'function' ? s._def.shape() : s._def.shape;
    if (raw && typeof raw === 'object') return raw;
    return s.shape && typeof s.shape === 'object' ? s.shape : null;
  } catch {
    return null;
  }
}

/** Element schema of a (possibly wrapped) Zod array, or null. */
export function arrayElement(schema) {
  const s = unwrap(schema);
  if (kindOf(s) !== 'array') return null;
  const def = s._def;
  // Zod 4 keeps the element on `def.element`; Zod 3 kept it on `def.type`, which in Zod 4
  // holds the tag string instead — so only accept `def.type` when it is a schema object.
  if (def.element) return def.element;
  return def.type && typeof def.type === 'object' ? def.type : null;
}

/**
 * The member schemas of a (possibly wrapped) composite that is neither an object nor an array: every
 * union or discriminated-union option (Zod 3 keeps a discriminated union's options in a `Map`), an
 * intersection's two sides, a record's value schema, and every tuple item plus its rest element.
 * Null for any other schema.
 */
export function compositeMembers(schema) {
  const s = unwrap(schema);
  const kind = kindOf(s);
  const def = s?._def;
  if (!def) return null;
  if (kind === 'union' || kind === 'discriminatedunion' || kind === 'discriminated_union') {
    const options = def.options instanceof Map ? [...def.options.values()] : def.options;
    return Array.isArray(options) ? options : null;
  }
  if (kind === 'intersection') return [def.left, def.right].filter(Boolean);
  if (kind === 'record') return def.valueType ? [def.valueType] : null;
  if (kind === 'tuple')
    return [...(Array.isArray(def.items) ? def.items : []), ...(def.rest ? [def.rest] : [])];
  return null;
}

/** Known top-level keys of a (possibly wrapped) Zod object. Null for non-objects (unions
 * etc.), which callers skip rather than diff. */
export function knownKeys(schema) {
  const shape = objectShape(schema);
  return shape ? new Set(Object.keys(shape)) : null;
}
