import type { DocumentData } from 'firebase/firestore';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const DOCUMENTS_SEGMENT = '/documents/';

export function documentPathOfName(name: string): string {
  const at = name.indexOf(DOCUMENTS_SEGMENT);
  return at === -1 ? name : name.slice(at + DOCUMENTS_SEGMENT.length);
}

function timestampOfIso(iso: string): { seconds: number; nanos: number } {
  const match = /\.(\d+)Z$/.exec(iso);
  const fraction = match ? match[1] : '';
  const seconds = Math.floor(Date.parse(iso.replace(/\.\d+Z$/, 'Z')) / 1000);
  return { seconds, nanos: fraction ? Number(fraction.padEnd(9, '0').slice(0, 9)) : 0 };
}

function numberOf(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  throw new Error(`client-values: ${String(value)} is not a Firestore number`);
}

export function fromSdkValue(value: unknown): ComparableValue {
  if (!isRecord(value)) throw new Error('client-values: a query value is not a Firestore value');
  if ('nullValue' in value) return { t: 'null' };
  if ('booleanValue' in value) return { t: 'bool', v: value.booleanValue === true };
  if ('integerValue' in value) return { t: 'num', v: numberOf(value.integerValue) };
  if ('doubleValue' in value) return { t: 'num', v: numberOf(value.doubleValue) };
  if ('timestampValue' in value) {
    const ts = value.timestampValue;
    if (typeof ts === 'string') return { t: 'ts', ...timestampOfIso(ts) };
    if (isRecord(ts))
      return { t: 'ts', seconds: numberOf(ts.seconds ?? 0), nanos: numberOf(ts.nanos ?? 0) };
  }
  if ('stringValue' in value && typeof value.stringValue === 'string')
    return { t: 'str', v: value.stringValue };
  if ('bytesValue' in value) return { t: 'bytes', v: String(value.bytesValue) };
  if ('referenceValue' in value && typeof value.referenceValue === 'string')
    return { t: 'ref', v: documentPathOfName(value.referenceValue) };
  if ('geoPointValue' in value && isRecord(value.geoPointValue))
    return {
      t: 'geo',
      lat: numberOf(value.geoPointValue.latitude ?? 0),
      lng: numberOf(value.geoPointValue.longitude ?? 0),
    };
  if ('arrayValue' in value && isRecord(value.arrayValue)) {
    const values = value.arrayValue.values;
    return { t: 'arr', v: Array.isArray(values) ? values.map(fromSdkValue) : [] };
  }
  if ('mapValue' in value && isRecord(value.mapValue)) {
    const fields = isRecord(value.mapValue.fields) ? value.mapValue.fields : {};
    return {
      t: 'map',
      v: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromSdkValue(v)])),
    };
  }
  throw new Error(
    `client-values: the query value ${JSON.stringify(value)} is not part of this double`,
  );
}

function isTimestampLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    typeof value.toMillis === 'function'
  );
}

function isReferenceLike(value: Record<string, unknown>): boolean {
  return value.type === 'document' && typeof value.path === 'string' && 'firestore' in value;
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
  if (Array.isArray(value)) return { t: 'arr', v: value.map(fromStoredValue) };
  if (isRecord(value)) {
    if (isTimestampLike(value))
      return { t: 'ts', seconds: numberOf(value.seconds), nanos: numberOf(value.nanoseconds) };
    if (isReferenceLike(value)) return { t: 'ref', v: String(value.path) };
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
  throw new Error(`client-values: a stored ${typeof value} is not a Firestore value`);
}

export function compareValues(a: ComparableValue, b: ComparableValue): number {
  const byType = TYPE_ORDER[a.t] - TYPE_ORDER[b.t];
  if (byType !== 0) return byType;
  if (a.t === 'null' && b.t === 'null') return 0;
  if (a.t === 'bool' && b.t === 'bool') return Number(a.v) - Number(b.v);
  if (a.t === 'num' && b.t === 'num') {
    if (Number.isNaN(a.v)) return Number.isNaN(b.v) ? 0 : -1;
    if (Number.isNaN(b.v)) return 1;
    return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  }
  if (a.t === 'ts' && b.t === 'ts') return a.seconds - b.seconds || a.nanos - b.nanos;
  if ((a.t === 'str' && b.t === 'str') || (a.t === 'bytes' && b.t === 'bytes'))
    return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  if (a.t === 'ref' && b.t === 'ref') {
    const left = a.v.split('/');
    const right = b.v.split('/');
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    }
    return left.length - right.length;
  }
  if (a.t === 'geo' && b.t === 'geo') return a.lat - b.lat || a.lng - b.lng;
  if (a.t === 'arr' && b.t === 'arr') {
    for (let i = 0; i < Math.min(a.v.length, b.v.length); i++) {
      const c = compareValues(a.v[i], b.v[i]);
      if (c !== 0) return c;
    }
    return a.v.length - b.v.length;
  }
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

export function fieldOf(data: DocumentData, field: string): unknown {
  let current: unknown = data;
  for (const segment of field.split('.')) {
    if (!isRecord(current) || Array.isArray(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isoOf(seconds: number, nanos: number): string {
  const base = new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, '');
  return `${base}.${String(nanos).padStart(9, '0')}Z`;
}

export function toBundleValue(value: unknown, documentsRoot: string): Record<string, unknown> {
  const plain = fromStoredValue(value);
  return bundleValueOf(plain, documentsRoot);
}

function bundleValueOf(value: ComparableValue, documentsRoot: string): Record<string, unknown> {
  switch (value.t) {
    case 'null':
      return { nullValue: null };
    case 'bool':
      return { booleanValue: value.v };
    case 'num':
      return Number.isInteger(value.v)
        ? { integerValue: String(value.v) }
        : { doubleValue: value.v };
    case 'ts':
      return { timestampValue: isoOf(value.seconds, value.nanos) };
    case 'str':
      return { stringValue: value.v };
    case 'bytes':
      return { bytesValue: value.v };
    case 'ref':
      return { referenceValue: `${documentsRoot}/${value.v}` };
    case 'geo':
      return { geoPointValue: { latitude: value.lat, longitude: value.lng } };
    case 'arr':
      return { arrayValue: { values: value.v.map((v) => bundleValueOf(v, documentsRoot)) } };
    case 'map':
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(value.v).map(([k, v]) => [k, bundleValueOf(v, documentsRoot)]),
          ),
        },
      };
  }
}
