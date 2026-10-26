import { base64OfBytes, fromStoredValue, type ComparableValue } from './stored-values.js';

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
  if ('bytesValue' in value) {
    const bytes = value.bytesValue;
    if (typeof bytes === 'string') return { t: 'bytes', v: bytes };
    if (bytes instanceof Uint8Array) return { t: 'bytes', v: base64OfBytes(bytes) };
  }
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
