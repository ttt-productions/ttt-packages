export type ComparableValue =
  | { t: 'null' }
  | { t: 'bool'; v: boolean }
  | { t: 'num'; v: number }
  | { t: 'ts'; seconds: number; nanos: number }
  | { t: 'str'; v: string }
  | { t: 'bytes'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'geo'; lat: number; lng: number }
  | { t: 'arr'; v: ComparableValue[] }
  | { t: 'map'; v: Record<string, ComparableValue> };

export interface ComparableOrder {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ComparableBound {
  position: ComparableValue[];
  inclusive: boolean;
}

export const DOCUMENT_ID_FIELD = '__name__';

const TYPE_ORDER: Record<ComparableValue['t'], number> = {
  null: 0,
  bool: 1,
  num: 2,
  ts: 3,
  str: 4,
  bytes: 5,
  ref: 6,
  geo: 7,
  arr: 8,
  map: 9,
};

const INEQUALITY_OPERATORS = ['<', '<=', '>', '>=', '!=', 'not-in'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function numberOf(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  throw new Error(`stored-values: ${String(value)} is not a Firestore number`);
}

export function base64OfBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesOfBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isTimestampLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    typeof value.toMillis === 'function'
  );
}

// The client SDK's reference carries `type: 'document'`; the Admin SDK's carries `collection()`.
function isDocumentReferenceLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.path === 'string' &&
    'firestore' in value &&
    (value.type === 'document' || typeof value.collection === 'function')
  );
}

function isGeoPointLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.isEqual === 'function'
  );
}

function isBytesLike(value: Record<string, unknown>): boolean {
  return typeof value.toBase64 === 'function' && typeof value.toUint8Array === 'function';
}

export function fromStoredValue(value: unknown): ComparableValue {
  if (value === null) return { t: 'null' };
  if (typeof value === 'boolean') return { t: 'bool', v: value };
  if (typeof value === 'number') return { t: 'num', v: value };
  if (typeof value === 'string') return { t: 'str', v: value };
  if (value instanceof Date) {
    const ms = value.getTime();
    return { t: 'ts', seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
  }
  if (value instanceof Uint8Array) return { t: 'bytes', v: base64OfBytes(value) };
  if (Array.isArray(value)) return { t: 'arr', v: value.map(fromStoredValue) };
  if (isRecord(value)) {
    if (isTimestampLike(value))
      return { t: 'ts', seconds: numberOf(value.seconds), nanos: numberOf(value.nanoseconds) };
    if (isDocumentReferenceLike(value)) return { t: 'ref', v: String(value.path) };
    if (isGeoPointLike(value))
      return { t: 'geo', lat: numberOf(value.latitude), lng: numberOf(value.longitude) };
    if (isBytesLike(value)) {
      const toBase64: unknown = Reflect.get(value, 'toBase64');
      const base64: unknown =
        typeof toBase64 === 'function' ? Reflect.apply(toBase64, value, []) : '';
      return { t: 'bytes', v: String(base64) };
    }
    return {
      t: 'map',
      v: Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, fromStoredValue(v)]),
      ),
    };
  }
  throw new Error(`stored-values: a stored ${typeof value} is not a Firestore value`);
}

function compareSequences<T>(
  left: ArrayLike<T>,
  right: ArrayLike<T>,
  compare: (a: T, b: T) => number,
) {
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const c = compare(left[i], right[i]);
    if (c !== 0) return c;
  }
  return left.length - right.length;
}

const compareOrdered = <T extends string | number>(a: T, b: T): number =>
  a < b ? -1 : a > b ? 1 : 0;

export function compareValues(a: ComparableValue, b: ComparableValue): number {
  const byType = TYPE_ORDER[a.t] - TYPE_ORDER[b.t];
  if (byType !== 0) return byType;
  if (a.t === 'null' && b.t === 'null') return 0;
  if (a.t === 'bool' && b.t === 'bool') return Number(a.v) - Number(b.v);
  if (a.t === 'num' && b.t === 'num') {
    if (Number.isNaN(a.v)) return Number.isNaN(b.v) ? 0 : -1;
    if (Number.isNaN(b.v)) return 1;
    return compareOrdered(a.v, b.v);
  }
  if (a.t === 'ts' && b.t === 'ts') return a.seconds - b.seconds || a.nanos - b.nanos;
  if (a.t === 'str' && b.t === 'str') return compareOrdered(a.v, b.v);
  if (a.t === 'bytes' && b.t === 'bytes')
    return compareSequences(bytesOfBase64(a.v), bytesOfBase64(b.v), compareOrdered);
  if (a.t === 'ref' && b.t === 'ref')
    return compareSequences(a.v.split('/'), b.v.split('/'), compareOrdered);
  if (a.t === 'geo' && b.t === 'geo') return a.lat - b.lat || a.lng - b.lng;
  if (a.t === 'arr' && b.t === 'arr') return compareSequences(a.v, b.v, compareValues);
  if (a.t === 'map' && b.t === 'map') {
    const left = Object.keys(a.v).sort();
    const right = Object.keys(b.v).sort();
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
      const c = compareValues(a.v[left[i]], b.v[right[i]]);
      if (c !== 0) return c;
    }
    return left.length - right.length;
  }
  return 0;
}

export const sameValue = (a: ComparableValue, b: ComparableValue): boolean =>
  compareValues(a, b) === 0;

// The SDK's canonical field path backtick-quotes a segment that is not a plain identifier and escapes
// a backslash or backtick inside it with a backslash.
export function fieldSegments(field: string): string[] {
  const segments: string[] = [];
  let segment = '';
  let quoted = false;
  for (let i = 0; i < field.length; i++) {
    const char = field[i];
    if (char === '\\' && i + 1 < field.length) segment += field[++i];
    else if (char === '`') quoted = !quoted;
    else if (char === '.' && !quoted) {
      segments.push(segment);
      segment = '';
    } else segment += char;
  }
  segments.push(segment);
  return segments;
}

export function fieldOf(data: Record<string, unknown>, field: string): unknown {
  let current: unknown = data;
  for (const segment of fieldSegments(field)) {
    if (!isRecord(current) || Array.isArray(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function valueAt(
  path: string,
  data: Record<string, unknown>,
  field: string,
): ComparableValue | undefined {
  if (field === DOCUMENT_ID_FIELD) return { t: 'ref', v: path };
  const raw = fieldOf(data, field);
  return raw === undefined ? undefined : fromStoredValue(raw);
}

export function matchesField(
  value: ComparableValue | undefined,
  op: string,
  operand: ComparableValue,
): boolean {
  if (value === undefined) return false;
  const operands = operand.t === 'arr' ? operand.v : [];
  switch (op) {
    case '==':
      return sameValue(value, operand);
    case '!=':
      return value.t !== 'null' && !sameValue(value, operand);
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (value.t !== operand.t) return false;
      const c = compareValues(value, operand);
      return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
    }
    case 'in':
      return operands.some((candidate) => sameValue(value, candidate));
    case 'not-in':
      return value.t !== 'null' && !operands.some((candidate) => sameValue(value, candidate));
    case 'array-contains':
      return value.t === 'arr' && value.v.some((item) => sameValue(item, operand));
    case 'array-contains-any':
      return (
        value.t === 'arr' &&
        value.v.some((item) => operands.some((candidate) => sameValue(item, candidate)))
      );
    default:
      throw new Error(`stored-values: the operator ${op} is not part of the test kits`);
  }
}

export const isInequality = (op: string): boolean => INEQUALITY_OPERATORS.includes(op);

// Firestore orders a query by its explicit orders, then by each inequality field not already
// ordered, then by document name, each added one in the direction of the last explicit order.
export function normalizedOrders(
  explicit: readonly ComparableOrder[],
  inequalityFields: Iterable<string>,
): ComparableOrder[] {
  const orders = [...explicit];
  const ordered = new Set(orders.map((order) => order.field));
  const last = orders.at(-1)?.direction ?? 'asc';
  for (const field of [...new Set(inequalityFields)].sort())
    if (!ordered.has(field) && field !== DOCUMENT_ID_FIELD) orders.push({ field, direction: last });
  if (!orders.some((order) => order.field === DOCUMENT_ID_FIELD))
    orders.push({ field: DOCUMENT_ID_FIELD, direction: last });
  return orders;
}

export function compareTuples(
  left: readonly ComparableValue[],
  right: readonly ComparableValue[],
  orders: readonly ComparableOrder[],
): number {
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const c = compareValues(left[i], right[i]);
    if (c !== 0) return orders[i]?.direction === 'desc' ? -c : c;
  }
  return 0;
}

export function withinBound(
  tuple: readonly ComparableValue[],
  bound: ComparableBound | null,
  orders: readonly ComparableOrder[],
  side: 'start' | 'end',
): boolean {
  if (!bound) return true;
  const c = compareTuples(tuple, bound.position, orders);
  if (side === 'start') return bound.inclusive ? c >= 0 : c > 0;
  return bound.inclusive ? c <= 0 : c < 0;
}
