#!/usr/bin/env node
// Rewrites old engineering-rule IDs and moved doc paths to the shared-standards forms, from the
// conversion tables beside this script.
//
//   node convert-rule-refs.mjs --repo ttt-packages|ttt-prod --root <repo> [--write]
//        [--shared-rules <dev-standards rules folder>] [--skip <skip-list.json>] [--report <out.md>]
//        [--only <path> ...]
//
// Without --write it is a dry run: every rewrite is classified by form and printed (or written to
// --report). --skip names a JSON list of { "file": ..., "line": ..., "text": ... } occurrences that
// are fixture data whose purpose is the old text; those are left as they are. A second run over a
// rewritten tree changes nothing, because every new ID starts `RULE-` and no old-ID pattern matches
// inside one.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFIXES = ['ENG', 'ARCH', 'BACKEND', 'FRONTEND', 'MEDIA', 'QUALITY', 'COMMENT'];
const PREFIX_ALT = PREFIXES.join('|');

function parseArgs(argv) {
  const args = { write: false, only: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') args.write = true;
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--root') args.root = resolve(argv[++i]);
    else if (a === '--shared-rules') args.sharedRules = resolve(argv[++i]);
    else if (a === '--skip') args.skip = resolve(argv[++i]);
    else if (a === '--report') args.report = resolve(argv[++i]);
    else if (a === '--only') args.only.push(argv[++i]);
    else throw new Error(`unknown argument ${a}`);
  }
  if (!['ttt-packages', 'ttt-prod'].includes(args.repo)) throw new Error('--repo ttt-packages|ttt-prod');
  if (!args.root) throw new Error('--root <repo> is required');
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const loadTable = (name) => parseCsv(readFileSync(join(HERE, 'tables', name), 'utf8'));

function ruleMap(rows) {
  const map = new Map();
  for (const r of rows) if (r.old_id && r.old_id !== '(new)') map.set(r.old_id, r);
  return map;
}

function sharedHeadings(rulesRoot) {
  const out = new Map();
  if (!rulesRoot || !existsSync(rulesRoot)) return out;
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '.'], { cwd: rulesRoot, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.md'));
  for (const f of files) {
    const text = readFileSync(join(rulesRoot, f), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^###\s+(RULE-[A-Z]+-[A-Z]+-\d{3})\s+—\s+(.*?)\s*$/.exec(line);
      if (m) out.set(m[1], line.replace(/^###\s+/, '').trim());
    }
  }
  return out;
}

// GitHub's heading anchor: lowercase, drop every character that is not a letter, digit, space,
// hyphen, or underscore, then each space becomes a hyphen.
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');

const SHARED = '@ttt-productions/dev-standards/';

function repoPathOf(repo, tablePath) {
  if (!tablePath.startsWith(SHARED)) return tablePath;
  const rest = tablePath.slice(SHARED.length);
  return repo === 'ttt-packages' ? `packages/dev-standards/${rest}` : `node_modules/@ttt-productions/dev-standards/${rest}`;
}

export function buildContext(args) {
  const prodRules = ruleMap(loadTable('ttt-prod-rule-ids.csv'));
  const pkgRules = ruleMap(loadTable('ttt-packages-rule-ids.csv'));
  const pathsTable = loadTable(args.repo === 'ttt-packages' ? 'ttt-packages-paths.csv' : 'ttt-prod-paths.csv');
  const rewritingKinds = new Set(['moved', 'deleted; whole-file references go to the area entry']);
  // ttt-packages' shared playbooks moved whole: no additions file stays at the old path.
  if (args.repo === 'ttt-packages') rewritingKinds.add('shared; app additions stay at the old path');
  const pathMap = new Map();
  for (const r of pathsTable) {
    if (!rewritingKinds.has(r.kind)) continue;
    pathMap.set(r.old_path, repoPathOf(args.repo, r.new_path));
  }
  // A folder mention follows its files only where the folder is unambiguous: in ttt-packages a
  // `docs/playbooks/` or `docs/engineering-rules/` mention usually names an app's own folder.
  const folderMap =
    args.repo === 'ttt-packages'
      ? new Map()
      : new Map([['docs/development-workflows/', 'node_modules/@ttt-productions/dev-standards/workflows/']]);
  // A drive-qualified path is rewritten only when it points into this repo's own checkout.
  const checkoutName = args.repo === 'ttt-packages' ? 'ttt-packages' : 'ttt-master-app';
  const rulesRoot =
    args.sharedRules ??
    (args.repo === 'ttt-packages'
      ? join(args.root, 'packages/dev-standards/rules')
      : join(args.root, 'node_modules/@ttt-productions/dev-standards/rules'));
  return { repo: args.repo, checkoutName, prodRules, pkgRules, pathMap, folderMap, headings: sharedHeadings(rulesRoot) };
}

function tableFor(ctx, file) {
  if (ctx.repo === 'ttt-prod') return ctx.prodRules;
  return file.startsWith('packages/ttt-core/') || file === 'docs/packages/ttt-core.md' ? ctx.prodRules : ctx.pkgRules;
}

function headingOf(ctx, row) {
  if (ctx.headings.has(row.new_id)) return ctx.headings.get(row.new_id);
  return `${row.new_id} — ${row.title}`;
}

// One citation group: an ID, then any members joined by "/", " / ", "–", or "..", each either a
// bare number (same prefix) or a full ID of any prefix.
const MEMBER = `(?:${PREFIX_ALT})-\\d{3}|\\d{3}`;
const GROUP_RE = new RegExp(
  `(?<qual>ttt-packages'?\\s+)?(?<![A-Za-z0-9_-])(?<first>(?:${PREFIX_ALT})-\\d{3})(?<rest>(?:\\s*(?:/|–|\\.\\.)\\s*(?:${MEMBER})(?![A-Za-z0-9_]))*)`,
  'g',
);
const SEP_RE = new RegExp(`\\s*(/|–|\\.\\.)\\s*(${MEMBER})`, 'g');

function convertGroup(ctx, table, m, forms) {
  const qualified = Boolean(m.groups.qual);
  const useTable = qualified ? ctx.pkgRules : table;
  const first = m.groups.first;
  const prefix = first.split('-')[0];
  const members = [{ sep: null, id: first }];
  for (const s of (m.groups.rest ?? '').matchAll(SEP_RE)) {
    const id = /^\d{3}$/.test(s[2]) ? `${members[members.length - 1].id.split('-')[0]}-${s[2]}` : s[2];
    members.push({ sep: s[1], id, bare: /^\d{3}$/.test(s[2]), raw: s[0] });
  }
  // A range expands to every number it spans that the table knows; a band (an unknown range end)
  // keeps its numbers.
  if (members.length === 2 && members[1].sep !== '/') {
    const [a, b] = [Number(first.slice(-3)), Number(members[1].id.slice(-3))];
    const span = [];
    for (let n = a; n <= b; n++) span.push(`${prefix}-${String(n).padStart(3, '0')}`);
    const known = span.filter((id) => useTable.has(id));
    const ends = useTable.has(first) && useTable.has(members[1].id);
    if (!ends) {
      forms.push('band');
      const newPrefix = known.length ? useTable.get(known[0]).new_id.replace(/-\d{3}$/, '') : `RULE-STD-${prefix}`;
      return `${newPrefix}-${first.slice(-3)}${members[1].sep}${members[1].id.slice(-3)}`;
    }
    const mapped = known.map((id) => useTable.get(id).new_id);
    const samePrefix = mapped.every((id) => id.replace(/-\d{3}$/, '') === mapped[0].replace(/-\d{3}$/, ''));
    const sameNumbers = known.every((id, i) => mapped[i].slice(-3) === id.slice(-3));
    forms.push('range');
    if (samePrefix && sameNumbers) return `${useTable.get(first).new_id}${members[1].sep}${members[1].id.slice(-3)}`;
    return mapped.join(', ');
  }
  const mapped = members.map((x) => (useTable.has(x.id) ? useTable.get(x.id).new_id : null));
  if (mapped.some((x) => x === null)) {
    forms.push('unclassified');
    return null;
  }
  forms.push(members.length > 1 ? 'grouped' : qualified ? 'qualified' : 'bare');
  if (members.length === 1) {
    const out = mapped[0];
    return qualified && !out.startsWith('RULE-STD-') ? m.groups.qual + out : out;
  }
  const newPrefix = (id) => id.replace(/-\d{3}$/, '');
  const compact =
    mapped.every((id) => newPrefix(id) === newPrefix(mapped[0])) &&
    members.every((x, i) => mapped[i].slice(-3) === x.id.slice(-3)) &&
    members.slice(1).every((x) => x.bare);
  if (compact) return mapped[0] + members.slice(1).map((x) => x.raw.replace(/\d{3}$/, x.id.slice(-3))).join('');
  return mapped.map((id, i) => (i === 0 ? id : members[i].raw.replace(/(?:[A-Z]+-)?\d{3}$/, id))).join('');
}

// Chains: "ttt-packages QUALITY-102 and ARCH-201" — an ID joined to a qualified one by ", " or
// " and " resolves through the same table.
const CHAIN_RE = new RegExp(`(ttt-packages'?\\s+)((?:${PREFIX_ALT})-\\d{3})((?:(?:,\\s*|\\s+and\\s+|,\\s+and\\s+)(?:${PREFIX_ALT})-\\d{3})+)`, 'g');

function qualifyChains(line) {
  return line.replace(CHAIN_RE, (all, qual, first, rest) =>
    qual + first + rest.replace(new RegExp(`(,\\s*|\\s+and\\s+|,\\s+and\\s+)((?:${PREFIX_ALT})-\\d{3})`, 'g'), `$1${qual}$2`),
  );
}

const ANCHOR_RE = new RegExp(`^(${PREFIX_ALT.toLowerCase()})-(\\d{3})(?:-|$)`);

function convertLinkTarget(ctx, table, file, target, forms) {
  const [pathPart, anchor] = target.split('#');
  const fromDir = posix.dirname(file);
  const absOld = pathPart ? posix.normalize(posix.join(fromDir, pathPart)) : file;
  let ruleRow = null;
  if (anchor) {
    const am = ANCHOR_RE.exec(anchor);
    if (am) ruleRow = table.get(`${am[1].toUpperCase()}-${am[2]}`) ?? null;
  }
  if (ruleRow) {
    const dest = ruleRow.new_id.startsWith('RULE-STD-') ? repoPathOf(ctx.repo, ruleRow.new_file) : ruleRow.new_file;
    forms.push('rule-link');
    return `${posix.relative(fromDir, dest) || posix.basename(dest)}#${slug(headingOf(ctx, ruleRow))}`;
  }
  const mapped = ctx.pathMap.get(absOld);
  if (mapped) {
    forms.push('path-link');
    return posix.relative(fromDir, mapped) + (anchor ? `#${anchor}` : '');
  }
  return null;
}

const LINK_RE = /\]\(([^)\s]+)\)/g;

function convertPaths(ctx, line, forms) {
  let out = line;
  // Longest first, so a file path wins over its folder.
  const entries = [...ctx.pathMap.entries(), ...ctx.folderMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [oldPath, newPath] of entries) {
    const pattern = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]');
    const re = new RegExp(`(?<![A-Za-z0-9_./\\\\-])(?:[A-Za-z]:[\\\\/][^\\s\`'"()]*?[\\\\/])?${pattern}(?![A-Za-z0-9_-])`, 'g');
    out = out.replace(re, (hit) => {
      if (hit.includes('node_modules')) return hit;
      const drive = hit.slice(0, hit.length - oldPath.length);
      if (drive && !drive.replace(/\\/g, '/').includes(`/${ctx.checkoutName}/`)) return hit;
      forms.push(hit.includes('\\') ? 'windows-path' : 'path');
      const back = hit.includes('\\');
      const target = back ? newPath.replace(/\//g, '\\') : newPath;
      return drive + target;
    });
  }
  return out;
}

export function convertText(ctx, file, text, skip = new Set()) {
  const table = tableFor(ctx, file);
  // The shared package is written in the new forms; its paths name an app's layout, so only its
  // rule IDs are checked.
  const pathsToo = !file.startsWith('packages/dev-standards/');
  const lines = text.split('\n');
  const rewrites = [];
  const unclassified = [];
  lines.forEach((line, i) => {
    if (skip.has(`${file}:${i + 1}`)) return;
    const forms = [];
    let next = line.replace(LINK_RE, (all, target) => {
      if (/^[a-z]+:\/\//i.test(target)) return all;
      const t = convertLinkTarget(ctx, table, file, target, forms);
      return t ? `](${t})` : all;
    });
    next = qualifyChains(next);
    next = next.replace(GROUP_RE, (...a) => {
      const m = { groups: a[a.length - 1], 0: a[0] };
      const out = convertGroup(ctx, table, m, forms);
      if (out === null) {
        unclassified.push({ file, line: i + 1, text: a[0] });
        return a[0];
      }
      return out;
    });
    // "an ARCH-201 violation" reads "a RULE-STD-ARCH-201 violation" once the ID is rewritten.
    if (next !== line) next = next.replace(/\b([Aa])n (RULE-)/g, '$1 $2');
    if (pathsToo) next = convertPaths(ctx, next, forms);
    if (next !== line) rewrites.push({ file, line: i + 1, before: line, after: next, forms });
    lines[i] = next;
  });
  return { text: lines.join('\n'), rewrites, unclassified };
}

const EXCLUDE = {
  'ttt-packages': [
    /^packages\/q-core\//,
    /^docs\/packages\/q-core\.md$/,
    /^docs\/work\/projects\/shared-standards\//,
    /^docs\/generated\//,
  ],
  'ttt-prod': [
    /^next-env\.d\.ts$/,
    /^\.next\//,
    /^functions\/(lib|build)\//,
    /^test-results\//,
    /^docs\/work\/projects\/shared-standards-run\//,
  ],
};
const ALWAYS_EXCLUDE = [/(^|\/)node_modules\//, /(^|\/)dist\//, /package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|svg|pdf|mp4|mp3|wav|woff2?|ttf|zip|gz|tgz)$/i];

function fileSet(args) {
  if (args.only.length) return args.only;
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
  return listed.filter(
    (f) =>
      !ALWAYS_EXCLUDE.some((re) => re.test(f)) &&
      !EXCLUDE[args.repo].some((re) => re.test(f)) &&
      existsSync(join(args.root, f)) &&
      statSync(join(args.root, f)).isFile(),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = buildContext(args);
  const skipList = args.skip ? JSON.parse(readFileSync(args.skip, 'utf8')) : [];
  const skip = new Set(skipList.map((s) => `${s.file}:${s.line}`));
  const all = [];
  const unclassified = [];
  let changedFiles = 0;
  for (const file of fileSet(args)) {
    const abs = join(args.root, file);
    const raw = readFileSync(abs);
    if (raw.includes(0)) continue;
    const text = raw.toString('utf8');
    const res = convertText(ctx, file, text, skip);
    all.push(...res.rewrites);
    unclassified.push(...res.unclassified);
    if (res.rewrites.length) {
      changedFiles++;
      if (args.write) writeFileSync(abs, res.text);
    }
  }
  const byForm = {};
  for (const r of all) for (const f of new Set(r.forms)) byForm[f] = (byForm[f] ?? 0) + 1;
  const lines = [
    `# convert-rule-refs — ${args.repo} — ${args.write ? 'written' : 'dry run'}`,
    '',
    `${all.length} lines rewritten in ${changedFiles} files; ${unclassified.length} unclassified.`,
    '',
    '## By form',
    '',
    ...Object.entries(byForm).map(([f, n]) => `- ${f}: ${n}`),
    '',
    '## Unclassified (left as written)',
    '',
    ...unclassified.map((u) => `- ${u.file}:${u.line} — \`${u.text}\``),
    '',
    '## Rewrites',
    '',
    ...all.flatMap((r) => [`### ${r.file}:${r.line} — ${[...new Set(r.forms)].join(', ')}`, '', '```', `- ${r.before.trim()}`, `+ ${r.after.trim()}`, '```', '']),
  ];
  if (args.report) writeFileSync(args.report, lines.join('\n'));
  console.log(lines.slice(0, 8 + Object.keys(byForm).length + 2 + unclassified.length).join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
