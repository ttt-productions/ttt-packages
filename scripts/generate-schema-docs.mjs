#!/usr/bin/env node
// Generates Firestore schema documentation — per-collection field/type tables and a Mermaid
// ER diagram — from the COLLECTION_SCHEMAS registry in @ttt-productions/ttt-core/doc-schemas.
// The output is GENERATED and must never be hand-edited; it cannot drift from the schemas
// because it is derived from them.
//
//   node scripts/generate-schema-docs.mjs           # write docs/generated/firestore-schema.{md,mmd}
//   node scripts/generate-schema-docs.mjs --check    # exit 1 if the committed output is stale (CI guard)
//
// Requires @ttt-productions/ttt-core to be built first (imports its dist).

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COLLECTION_SCHEMAS, PENDING_COLLECTIONS } from '@ttt-productions/ttt-core/doc-schemas';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', 'docs', 'generated');
const MD_PATH = join(OUT_DIR, 'firestore-schema.md');
const MMD_PATH = join(OUT_DIR, 'firestore-schema.mmd');
const MD_BANNER = '<!-- GENERATED FILE — DO NOT EDIT. Run `npm run schema:docs` in ttt-packages. Source: @ttt-productions/ttt-core COLLECTION_SCHEMAS. -->';
const MMD_BANNER = '%% GENERATED FILE — DO NOT EDIT. Run `npm run schema:docs` in ttt-packages.';

// Field-name -> referenced collection, for ER edges (identity + container FKs).
const FK = {
  uid: 'userProfiles', userId: 'userProfiles', authorId: 'userProfiles', followerUid: 'userProfiles',
  workStewardUid: 'userProfiles', foundingArtisanUid: 'userProfiles', actorUid: 'userProfiles',
  actorId: 'userProfiles', senderId: 'userProfiles', initiatorUserId: 'userProfiles',
  reporterUserId: 'userProfiles', reportedUserId: 'userProfiles', adminUserId: 'userProfiles',
  targetUserId: 'userProfiles', reviewedBy: 'userProfiles', resolvedBy: 'userProfiles', closedBy: 'userProfiles',
  workProjectId: 'allWorkProjects', workRealmId: 'workRealms', foundingWorkProjectId: 'allWorkProjects',
  commissionListingId: 'commissionListings', commissionProposalId: 'commissionListings',
  auditionId: 'auditionBoard', auditionEntryId: 'auditionBoard', guildInviteId: 'guildInviteConversations',
  hallItemId: 'hallItems', thresholdItemId: 'thresholdItems', violationId: 'contentViolations',
  pledgePaymentId: 'pledgePayments', adminDispatchId: 'pendingAdminDispatches',
};

// Normalized schema kind. Zod 3 used `_def.typeName` ('ZodObject'); Zod 4 uses `_def.type`
// ('object'). Normalize both to the lowercase Zod 4 names so the walkers below work on either.
function kindOf(schema) {
  const def = schema?._def;
  if (!def) return null;
  if (typeof def.typeName === 'string') return def.typeName.replace(/^Zod/, '').toLowerCase();
  if (typeof def.type === 'string') return def.type;
  return null;
}

function unwrap(schema) {
  let s = schema, optional = false, nullable = false;
  for (let i = 0; i < 12 && s && s._def; i++) {
    const kind = kindOf(s);
    if (kind === 'optional') { optional = true; s = s._def.innerType; }
    else if (kind === 'nullable') { nullable = true; s = s._def.innerType; }
    else if (kind === 'default' || kind === 'nonoptional' || kind === 'readonly' || kind === 'catch') { s = s._def.innerType; }
    else if (kind === 'effects') { s = s._def.schema; } // Zod 3 .refine/.transform
    else if (kind === 'pipe') { s = s._def.in; } // Zod 4 .transform/.pipe
    else break;
  }
  return { s, optional, nullable };
}

function enumValues(def) {
  // Zod 3: def.values is an array; Zod 4: def.entries is a name->value record.
  if (Array.isArray(def.values)) return def.values;
  if (def.entries && typeof def.entries === 'object') return Object.values(def.entries);
  return [];
}

function typeStr(schema) {
  if (!schema || !schema._def) return 'unknown';
  const def = schema._def;
  switch (kindOf(schema)) {
    case 'string': return 'string';
    case 'number': case 'int': case 'bigint': return 'number';
    case 'boolean': return 'boolean';
    case 'unknown': return 'unknown';
    case 'any': return 'any';
    case 'null': return 'null';
    // Zod 3: def.value (single); Zod 4: def.values (array — literals can hold several).
    case 'literal': return (Array.isArray(def.values) ? def.values : [def.value]).map((v) => JSON.stringify(v)).join(' | ');
    case 'enum': case 'nativeenum': return enumValues(def).map((v) => `'${v}'`).join(' | ') || 'enum';
    // Zod 3: def.type is the element schema; Zod 4: def.element.
    case 'array': return `${typeStr(def.element ?? def.type)}[]`;
    case 'object': return `{ ${Object.keys(shapeOf(schema) || {}).join(', ')} }`;
    case 'record': return `Record<string, ${typeStr(def.valueType)}>`;
    case 'union': case 'discriminatedunion': return [...(def.options || [])].map(typeStr).join(' | ');
    case 'optional': return typeStr(def.innerType);
    case 'nullable': return `${typeStr(def.innerType)} | null`;
    case 'default': return typeStr(def.innerType);
    case 'effects': return typeStr(def.schema);
    case 'pipe': return typeStr(def.in);
    default: return kindOf(schema) || 'unknown';
  }
}

function shapeOf(schema) {
  if (kindOf(schema) !== 'object') return null;
  const def = schema._def;
  // Zod 3: def.shape is a function; Zod 4: def.shape is the plain shape object.
  try {
    const raw = typeof def.shape === 'function' ? def.shape() : def.shape;
    if (raw && typeof raw === 'object') return raw;
  } catch { /* fallthrough */ }
  try { return schema.shape; } catch { return null; }
}

function leaf(path) {
  const segs = path.split('/').filter((s) => !s.startsWith('{'));
  return segs[segs.length - 1];
}

function fieldRows(schema) {
  const { s } = unwrap(schema);
  const shape = shapeOf(s);
  if (!shape) {
    return { rows: [['(document)', typeStr(s), '']], fields: [] };
  }
  const rows = [];
  const fields = [];
  for (const [name, field] of Object.entries(shape)) {
    const { s: inner, optional, nullable } = unwrap(field);
    let t = typeStr(inner);
    if (nullable) t += ' | null';
    rows.push([name, t, optional ? 'yes' : '']);
    fields.push(name);
  }
  return { rows, fields };
}

function buildMarkdown() {
  const lines = [MD_BANNER, '', '# Firestore Schema (generated)', ''];
  lines.push(`Source of truth: \`COLLECTION_SCHEMAS\` in \`@ttt-productions/ttt-core/doc-schemas\`. ${Object.keys(COLLECTION_SCHEMAS).length} collections bound. Regenerated by \`scripts/generate-schema-docs.mjs\`.`);
  lines.push('');
  lines.push('See `firestore-schema.mmd` for the relationship (ER) diagram.');
  lines.push('');
  for (const path of Object.keys(COLLECTION_SCHEMAS).sort()) {
    const { rows } = fieldRows(COLLECTION_SCHEMAS[path]);
    lines.push(`## \`${path}\``);
    lines.push('');
    lines.push('| Field | Type | Optional |');
    lines.push('| --- | --- | --- |');
    for (const [f, t, o] of rows) {
      const fCell = f === '(document)' ? '_(document)_' : `\`${f}\``;
      const tCell = '`' + String(t).replace(/\|/g, '\\|') + '`';
      lines.push(`| ${fCell} | ${tCell} | ${o} |`);
    }
    lines.push('');
  }
  lines.push('## Collections pending a schema');
  lines.push('');
  lines.push('Bound in a future pass (shape needs reverse-engineering from the backend write site, or removal per the terminology doc). Listed so coverage is explicit:');
  lines.push('');
  for (const c of PENDING_COLLECTIONS) lines.push(`- \`${c}\``);
  lines.push('');
  return lines.join('\n');
}

function buildMermaid() {
  const entities = new Map();
  const edges = new Set();
  for (const path of Object.keys(COLLECTION_SCHEMAS)) {
    const name = leaf(path);
    const { fields } = fieldRows(COLLECTION_SCHEMAS[path]);
    if (!entities.has(name)) entities.set(name, fields);
    for (const f of fields) {
      const target = FK[f];
      if (target && target !== name) edges.add(`${target} ||--o{ ${name} : "${f}"`);
    }
  }
  const lines = [MMD_BANNER, 'erDiagram'];
  for (const [name, fields] of [...entities.entries()].sort()) {
    lines.push(`  ${name} {`);
    for (const f of fields.slice(0, 12)) lines.push(`    field ${f}`);
    lines.push('  }');
  }
  for (const e of [...edges].sort()) lines.push(`  ${e}`);
  return lines.join('\n');
}

// Sanity guard: if introspection breaks wholesale (e.g. a Zod major changes internals again),
// every collection degrades to a fieldless "(document) unknown" row and --check would happily
// pass against equally-degenerate committed output. Refuse to produce that.
{
  const fieldless = Object.keys(COLLECTION_SCHEMAS).filter(
    (path) => fieldRows(COLLECTION_SCHEMAS[path]).fields.length === 0,
  );
  if (fieldless.length === Object.keys(COLLECTION_SCHEMAS).length) {
    console.error('FATAL: schema introspection produced zero fields for every collection — the generator no longer understands this Zod version. Refusing to write/check degenerate docs.');
    process.exit(1);
  }
}

const md = buildMarkdown();
const mmd = buildMermaid();

if (process.argv.includes('--check')) {
  let stale = false;
  for (const [p, content] of [[MD_PATH, md], [MMD_PATH, mmd]]) {
    const current = existsSync(p) ? readFileSync(p, 'utf8') : '';
    if (current !== content) { stale = true; console.error(`STALE: ${p} is out of date — run \`npm run schema:docs\`.`); }
  }
  if (stale) process.exit(1);
  console.log('schema docs are up to date.');
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MD_PATH, md);
  writeFileSync(MMD_PATH, mmd);
  console.log(`Wrote ${MD_PATH}\nWrote ${MMD_PATH}`);
}
