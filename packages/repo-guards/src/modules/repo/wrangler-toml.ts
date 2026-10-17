// A reader for the flat shape a Worker's wrangler.toml takes: `key = "value"`, `[section]` and
// `[[array.of.tables]]`. Only string values and single-line arrays are kept — the checks read bucket
// names, namespace ids and migration keys. Inside a migration table nothing is skipped: a line this
// reader cannot classify throws, because "unreadable" and "absent" give the same answer to a
// destructive-key check and only one of them is true.

/** One section: its header with brackets stripped and every key unquoted (`env.dev.r2_buckets`). */
export interface Table {
  header: string;
  values: Record<string, string>;
  /** Single-line array values as written, e.g. `["A", "B"]`. */
  arrays: Record<string, string>;
}

/**
 * Decodes a TOML basic-string body, or null when it is not one. Stripping the quotes is not
 * decoding: `"deleted_classes"` names `deleted_classes`, as wrangler reads it.
 */
function decodeBasicString(body: string): string | null {
  let out = '';
  const simple: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== '\\') {
      out += char;
      continue;
    }
    const escape = body[index + 1];
    index += 1;
    if (escape in simple) {
      out += simple[escape];
      continue;
    }
    if (escape === 'u' || escape === 'U') {
      const width = escape === 'u' ? 4 : 8;
      const digits = body.slice(index + 1, index + 1 + width);
      if (digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null;
      const point = Number.parseInt(digits, 16);
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null;
      out += String.fromCodePoint(point);
      index += width;
      continue;
    }
    return null;
  }
  return out;
}

/** A key — bare, basic-quoted, or literal-quoted — as the name TOML gives it, or null. */
function unquoteKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return decodeBasicString(trimmed.slice(1, -1));
  return null;
}

/** Bare, basic-quoted, or literal-quoted key, as a pattern; an escaped quote never closes the key. */
const KEY_PATTERN = String.raw`(?:[A-Za-z_][\w-]*|"(?:[^"\\]|\\.)*"|'[^']*')`;

/**
 * A header path split on its top-level dots, each segment unquoted; null when it cannot be
 * normalised. A segment holding a dot (written or escaped) is refused: segments are rejoined with
 * dots, so `env."a.b".migrations` could not be told from `env.a.b.migrations`.
 */
function headerSegments(raw: string): string[] | null {
  const segments: string[] = [];
  let buffer = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote === '"' && char === '\\') {
      buffer += char + (raw[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (quote === null && (char === '"' || char === "'")) {
      quote = char;
      buffer += char;
      continue;
    }
    if (quote !== null && char === quote) {
      quote = null;
      buffer += char;
      continue;
    }
    if (quote === null && char === '.') {
      segments.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (quote !== null) return null;
  segments.push(buffer);
  const normalised = segments.map(unquoteKey);
  if (normalised.some((segment) => segment === null || segment === '' || segment.includes('.'))) return null;
  return normalised as string[];
}

/** True for `[[migrations]]` and `[[env.<name>.migrations]]`. */
export const isMigrationTable = (header: string) => header === 'migrations' || /^env\.[^.]+\.migrations$/.test(header);

/** Every section of a wrangler.toml. Throws, naming the line, on anything it cannot read safely. */
export function readTables(text: string): Table[] {
  const tables: Table[] = [];
  let current: Table | null = null;
  const pairPattern = new RegExp(String.raw`^\s*(${KEY_PATTERN})\s*=\s*"([^"]*)"`);
  const arrayPattern = new RegExp(String.raw`^\s*(${KEY_PATTERN})\s*=\s*(\[.*\])\s*(?:#.*)?$`);
  const openedPattern = new RegExp(String.raw`^\s*(${KEY_PATTERN})\s*=\s*\[[^\]]*$`);

  for (const line of text.split(/\r?\n/)) {
    // A trailing comment on a header is valid TOML; refusing it would file every key beneath it
    // under the previous section.
    const header = /^\s*\[\[?([^[\]]+)\]\]?\s*(?:#.*)?$/.exec(line);
    if (header) {
      const segments = headerSegments(header[1]);
      if (!segments) throw new Error(`section header ${line.trim()} uses key syntax this reader cannot normalise`);
      current = { header: segments.join('.'), values: {}, arrays: {} };
      tables.push(current);
      continue;
    }
    if (/^\s*\[/.test(line)) throw new Error(`unrecognised section header syntax: ${line.trim()}`);
    const pair = pairPattern.exec(line);
    if (pair && current) {
      const key = unquoteKey(pair[1]);
      if (key) {
        current.values[key] = pair[2];
        continue;
      }
    }
    const array = arrayPattern.exec(line);
    if (array && current) {
      const key = unquoteKey(array[1]);
      if (key) {
        current.arrays[key] = array[2].trim();
        continue;
      }
    }
    const opened = openedPattern.exec(line);
    if (opened && current && isMigrationTable(current.header)) {
      throw new Error(`migration key '${unquoteKey(opened[1]) ?? opened[1]}' uses a multi-line array, which this reader cannot read; put it on one line`);
    }
    if (current && isMigrationTable(current.header) && line.trim() !== '' && !line.trim().startsWith('#')) {
      throw new Error(`line ${line.trim()} inside [[${current.header}]] is in a form this reader cannot read; write it as a single-line key = value`);
    }
  }
  return tables;
}

/** Migration keys that destroy or rewrite existing Durable Object storage. */
const DESTRUCTIVE_MIGRATION_KEYS = ['deleted_classes', 'renamed_classes'] as const;

export interface MigrationEntry {
  tag: string;
  /** Destructive keys present on this tag, mapped to their contents as written. */
  destructive: Record<string, string>;
}

function toMigrationEntry(table: Table): MigrationEntry {
  const destructive: Record<string, string> = {};
  for (const key of DESTRUCTIVE_MIGRATION_KEYS) if (table.arrays[key] !== undefined) destructive[key] = table.arrays[key];
  return { tag: table.values.tag ?? '(untagged)', destructive };
}

export interface MigrationLists {
  topLevel: MigrationEntry[];
  byEnv: Map<string, MigrationEntry[]>;
}

export function migrationLists(tables: readonly Table[]): MigrationLists {
  const topLevel: MigrationEntry[] = [];
  const byEnv = new Map<string, MigrationEntry[]>();
  for (const table of tables) {
    if (table.header === 'migrations') {
      topLevel.push(toMigrationEntry(table));
      continue;
    }
    const env = /^env\.([^.]+)\.migrations$/.exec(table.header);
    if (!env) continue;
    byEnv.set(env[1], [...(byEnv.get(env[1]) ?? []), toMigrationEntry(table)]);
  }
  return { topLevel, byEnv };
}

/**
 * The migration list an environment deploys with. Migrations, unlike bindings, are inherited: an
 * environment with no list of its own deploys the top-level one.
 */
export const effectiveMigrations = (lists: MigrationLists, env: string) => lists.byEnv.get(env) ?? lists.topLevel;

/** Storage identifiers (bucket names, namespace ids) each named environment binds. */
export function environmentResources(tables: readonly Table[]): Map<string, string[]> {
  const byEnv = new Map<string, string[]>();
  for (const table of tables) {
    const match = /^env\.([^.]+)\.(r2_buckets|kv_namespaces)$/.exec(table.header);
    const id = match && (table.values.bucket_name ?? table.values.id);
    if (match && id) byEnv.set(match[1], [...(byEnv.get(match[1]) ?? []), id]);
  }
  return byEnv;
}

/** Storage identifiers bound at the top level, which only the local runtime reads. */
export function topLevelResources(tables: readonly Table[]): string[] {
  return tables
    .filter((table) => table.header === 'r2_buckets' || table.header === 'kv_namespaces')
    .map((table) => table.values.bucket_name ?? table.values.id)
    .filter((id): id is string => Boolean(id));
}
