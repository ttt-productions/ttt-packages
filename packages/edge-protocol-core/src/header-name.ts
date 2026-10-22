const HEADER_NAME = /^[a-z0-9-]+$/;
const HEADER_VALUE = /^[!-~]+$/;

export function assertHeaderName(field: string, name: unknown): asserts name is string {
  if (typeof name !== 'string' || !HEADER_NAME.test(name)) {
    throw new TypeError(`${field} must be a lowercase header name of [a-z0-9-]`);
  }
}

export function assertHeaderValue(field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !HEADER_VALUE.test(value)) {
    throw new TypeError(`${field} must be a non-empty visible-ASCII header value`);
  }
}

export function assertDistinctNames(names: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new TypeError(`header name ${name} is used twice`);
    seen.add(name);
  }
}
