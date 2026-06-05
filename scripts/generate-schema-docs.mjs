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
  pledgePaymentId: 'recentPledgePayments', adminDispatchId: 'pendingAdminDispatches',
};

function unwrap(schema) {
  let s = schema, optional = false, nullable = false;
  for (let i = 0; i < 12 && s && s._def; i++) {
    const tn = s._def.typeName;
    if (tn === 'ZodOptional') { optional = true; s = s._def.innerType; }
    else if (tn === 'ZodNullable') { nullable = true; s = s._def.innerType; }
    else if (tn === 'ZodDefault') { s = s._def.innerType; }
    else if (tn === 'ZodEffects') { s = s._def.schema; }
    else break;
  }
  return { s, optional, nullable };
}

function typeStr(schema) {
  if (!schema || !schema._def) return 'unknown';
  const def = schema._def;
  switch (def.typeName) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodUnknown': return 'unknown';
    case 'ZodAny': return 'any';
    case 'ZodNull': return 'null';
    case 'ZodLiteral': return JSON.stringify(def.value);
    case 'ZodEnum': return (def.values || []).map((v) => `'${v}'`).join(' | ');
    case 'ZodNativeEnum': return 'enum';
    case 'ZodArray': return `${typeStr(def.type)}[]`;
    case 'ZodObject': return `{ ${Object.keys(shapeOf(schema) || {}).join(', ')} }`;
    case 'ZodRecord': return `Record<string, ${typeStr(def.valueType)}>`;
    case 'ZodUnion': return (def.options || []).map(typeStr).join(' | ');
    case 'ZodDiscriminatedUnion': return [...(def.options || [])].map(typeStr).join(' | ');
    case 'ZodOptional': return typeStr(def.innerType);
    case 'ZodNullable': return `${typeStr(def.innerType)} | null`;
    case 'ZodDefault': return typeStr(def.innerType);
    case 'ZodEffects': return typeStr(def.schema);
    default: return (def.typeName || 'unknown').replace(/^Zod/, '').toLowerCase();
  }
}

function shapeOf(schema) {
  if (!schema || !schema._def || schema._def.typeName !== 'ZodObject') return null;
  try { return schema._def.shape(); } catch { /* fallthrough */ }
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
