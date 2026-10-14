// `countSchema` is the one count atom (ENG-002): a tally a document or a callable result holds is
// that atom, never a private unbounded whole non-negative number beside it. The pins prove the
// schemas that hold counts use it; the scan fails the next private copy anywhere in the package.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASKETBALL_PLAYER_STAT_KEYS } from '../src';
import {
  BasketballPlayerTotalsSchema,
  GallerySummarySchema,
  HistoricalStatsSchema,
  MembershipRosterSyncCursorSchema,
  MembershipRosterSyncSchema,
  SportLeagueSchema,
  appliedRevisionSchema,
  countSchema,
  playoffCutoffCountSchema,
  revisionSchema,
} from '../src/doc-schemas';
import * as callableSchemas from '../src/schemas';
import { AdminStatsSchema } from '../src/schemas/admin-stats';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

// Where the count atom is declared, beside the other atoms built the same way.
const ATOMS_FILE = 'doc-schemas/atoms.ts';

/**
 * Inline unbounded whole non-negative numbers the atom does not stand for today, keyed
 * `file#binding` so an entry covers that one declaration and no other in its file, each with why,
 * and what would take it off the list.
 */
const OUTSIDE_THE_ATOM: Readonly<Record<string, string>> = {};

// A number schema's constructor — `z.number(…)` or zod 4's `z.int(…)` — with or without arguments.
const NUMBER_CONSTRUCTOR = /\bz\s*\.\s*(number|int)\s*\(/g;
// The next link of a chain: `.name(`, after any whitespace or comments.
const CHAIN_LINK = /(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\.\s*(\w+)\s*\(/y;
const LOWER_BOUNDS = new Set(['min', 'gte']);
const UPPER_BOUNDS = new Set(['max', 'lte', 'lt']);

/**
 * The index just past the parenthesis that closes the one opened at `open`, stepping over string
 * literals and comments, so an argument holding a parenthesis — a message, a callback — is read
 * whole. -1 when it never closes.
 */
function closingParenthesis(source: string, open: number): number {
  let depth = 0;
  for (let at = open; at < source.length; at += 1) {
    const character = source[at];
    if (character === "'" || character === '"' || character === '`') {
      for (at += 1; at < source.length && source[at] !== character; at += 1) {
        if (source[at] === '\\') at += 1;
      }
    } else if (source.startsWith('//', at)) {
      at = source.indexOf('\n', at);
      if (at < 0) return -1;
    } else if (source.startsWith('/*', at)) {
      at = source.indexOf('*/', at);
      if (at < 0) return -1;
      at += 1;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) return at + 1;
    }
  }
  return -1;
}

interface ChainedCall {
  readonly name: string;
  /** The call's first argument as written — a bound's value, ahead of any message. */
  readonly firstArgument: string;
}

/** The calls chained onto the constructor that closes at `from`, in order. */
function chainedCalls(source: string, from: number): ChainedCall[] {
  const calls: ChainedCall[] = [];
  let at = from;
  for (;;) {
    CHAIN_LINK.lastIndex = at;
    const link = CHAIN_LINK.exec(source);
    if (!link) return calls;
    const open = CHAIN_LINK.lastIndex - 1;
    const close = closingParenthesis(source, open);
    if (close < 0) return calls;
    const argumentsWritten = source.slice(open + 1, close - 1);
    calls.push({ name: link[1] as string, firstArgument: (argumentsWritten.split(',')[0] ?? '').trim() });
    at = close;
  }
}

/** Whole, at or above zero, with no upper bound — in any order the refinements are chained. */
function isInlineCount(constructor: string, calls: readonly ChainedCall[]): boolean {
  const whole = constructor === 'int' || calls.some((call) => call.name === 'int');
  const nonNegative = calls.some(
    (call) => call.name === 'nonnegative' || (LOWER_BOUNDS.has(call.name) && call.firstArgument === '0'),
  );
  const bounded = calls.some((call) => UPPER_BOUNDS.has(call.name));
  return whole && nonNegative && !bounded;
}

/** The binding each inline count in `source` is declared under — its field or its constant. */
function inlineCounts(source: string): string[] {
  const bindings: string[] = [];
  for (const match of source.matchAll(NUMBER_CONSTRUCTOR)) {
    const start = match.index ?? 0;
    const constructorClose = closingParenthesis(source, start + match[0].length - 1);
    if (constructorClose < 0) continue;
    if (!isInlineCount(match[1] as string, chainedCalls(source, constructorClose))) continue;
    bindings.push(/(\w+)\s*[:=]\s*$/.exec(source.slice(0, start))?.[1] ?? '(unnamed)');
  }
  return bindings;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [path.relative(SRC, full).split(path.sep).join('/')] : [];
  });
}

const files = sourceFiles(SRC);
const inlineCountSites = files
  .filter((file) => file !== ATOMS_FILE)
  .flatMap((file) => inlineCounts(readFileSync(path.join(SRC, file), 'utf8')).map((binding) => `${file}#${binding}`));

describe('countSchema is the one count atom', () => {
  it('scanned the package source', () => {
    expect(files).toContain(ATOMS_FILE);
    expect(files.length).toBeGreaterThan(20);
  });

  it('no schema declares its own count beside the atom', () => {
    expect(inlineCountSites.filter((site) => !(site in OUTSIDE_THE_ATOM))).toEqual([]);
  });

  it('lists only declarations that still hold an inline whole number', () => {
    expect(Object.keys(OUTSIDE_THE_ATOM).filter((site) => !inlineCountSites.includes(site))).toEqual([]);
  });

  it.each([
    'z.number().int().nonnegative()',
    'z.number().nonnegative().int()',
    'z.number().int().min(0)',
    'z.number().min(0).int()',
    'z.number().int().gte(0)',
    'z.number().gte(0).int()',
    'z.int().nonnegative()',
    'z.int().min(0)',
    'z.int().gte(0)',
    'z.int().nonnegative().optional()',
    'z\n    .number()\n    .int()\n    .nonnegative()',
    "z\n    .number() // a player's tally\n    .int()\n    /* whole */ .nonnegative()",
    'z.number({ error: BULK_ENTRY_COUNT_MESSAGE }).int(BULK_ENTRY_COUNT_MESSAGE).min(0, BULK_ENTRY_COUNT_MESSAGE)',
    "z.number().int().min(0, 'Must be zero or more')",
    "z.number().int().gte(0, { message: 'At least zero (0)' })",
    'z.int({ error: () => COUNT_MESSAGE }).nonnegative(COUNT_MESSAGE)',
  ])('flags %s as a private count', (spelling) => {
    expect(inlineCounts(`  total: ${spelling},`)).toEqual(['total']);
  });

  it.each([
    'z.number().int().min(0).max(8)',
    'z.number().max(8).int().min(0)',
    'z.int().nonnegative().lte(8)',
    'z.number().nonnegative()',
    'z.number().int().positive()',
    'z.number().int().min(1)',
    "z.number().int().min(1, 'Must be at least 0 (zero)')",
    'z.number({ error: MESSAGE }).int(MESSAGE).min(0, MESSAGE).max(MAX_POINTS, OTHER_MESSAGE).nullable()',
    'countSchema',
  ])('passes %s, which is bounded, fractional, positive, or the atom', (spelling) => {
    expect(inlineCounts(`  total: ${spelling},`)).toEqual([]);
  });

  it('names each count by its binding, so an allowed declaration covers no other in its file', () => {
    const source = [
      'export const firstSchema = z.number().int().nonnegative();',
      'export const Doc = z.object({',
      '  reconciledRosterRevision: z.number().int().nonnegative(),',
      '  retryCount: z.int().min(0),',
      '});',
    ].join('\n');
    const sites = inlineCounts(source).map((binding) => `doc-schemas/membership-roster-sync.ts#${binding}`);
    expect(sites).toEqual([
      'doc-schemas/membership-roster-sync.ts#firstSchema',
      'doc-schemas/membership-roster-sync.ts#reconciledRosterRevision',
      'doc-schemas/membership-roster-sync.ts#retryCount',
    ]);
    const allowed: Readonly<Record<string, string>> = { 'doc-schemas/membership-roster-sync.ts#reconciledRosterRevision': 'why' };
    expect(sites.filter((site) => !(site in allowed))).toEqual([
      'doc-schemas/membership-roster-sync.ts#firstSchema',
      'doc-schemas/membership-roster-sync.ts#retryCount',
    ]);
  });

  it('a revision and the revision a reconciler applied are their atoms, not counts', () => {
    expect(MembershipRosterSyncSchema.shape.rosterRevision).toBe(revisionSchema);
    expect(MembershipRosterSyncSchema.shape.reconciledRosterRevision).toBe(appliedRevisionSchema);
    expect(MembershipRosterSyncCursorSchema.shape.rosterRevision).toBe(revisionSchema);
    // The first change writes 1; nothing is applied before it.
    expect(revisionSchema.safeParse(0).success).toBe(false);
    expect(appliedRevisionSchema.safeParse(0).success).toBe(true);
  });

  it('the callable schemas re-export the document atom rather than declaring a second one', () => {
    expect(callableSchemas.countSchema).toBe(countSchema);
  });

  it('the dashboard counts, a gallery’s count, and a league’s playoff cutoffs are the atom', () => {
    for (const field of ['totalUsers', 'totalTeams', 'totalLeagues', 'activeLeagues', 'upcomingLeagues'] as const) {
      expect(AdminStatsSchema.shape[field]).toBe(countSchema);
    }
    expect(AdminStatsSchema.shape.totalGamesPlayed).toBe(countSchema);
    expect(AdminStatsSchema.shape.activeFreeAgents).toBe(countSchema);
    expect(GallerySummarySchema.shape.count).toBe(countSchema);
    expect(playoffCutoffCountSchema).toBe(countSchema);
    for (const field of ['playoffCutoff', 'playoffCutoffComp', 'playoffCutoffRec'] as const) {
      expect(SportLeagueSchema.shape[field]).toBe(countSchema);
    }
  });

  it('the counts callables return are the atom', () => {
    const results = callableSchemas.UpdateAdminListResultSchema.shape;
    expect(results.adminsGranted).toBe(countSchema);
    expect(results.adminsRevoked).toBe(countSchema);
    expect(results.refereesGranted).toBe(countSchema);
    expect(results.refereesRevoked).toBe(countSchema);
    expect(callableSchemas.AdminRetryLeagueTeamRosterSyncResultSchema.shape.retried).toBe(countSchema);
    expect(callableSchemas.AdminRetryLeagueTeamRosterSyncResultSchema.shape.reconciled).toBe(countSchema);
  });
});

describe('HistoricalStatsSchema is the basketball totals line without FP', () => {
  const TOTALS = { gamesPlayed: 12, points: 140, rebounds: 60, assists: 25 };

  it('holds games played and the basketball player counters, each the count atom', () => {
    expect(Object.keys(HistoricalStatsSchema.shape).sort()).toEqual(
      ['gamesPlayed', ...BASKETBALL_PLAYER_STAT_KEYS].sort(),
    );
    for (const field of Object.keys(HistoricalStatsSchema.shape) as (keyof typeof HistoricalStatsSchema.shape)[]) {
      expect(HistoricalStatsSchema.shape[field]).toBe(BasketballPlayerTotalsSchema.shape[field]);
      expect(HistoricalStatsSchema.shape[field]).toBe(countSchema);
    }
  });

  it('accepts a baseline as production holds one', () => {
    expect(HistoricalStatsSchema.safeParse(TOTALS).success).toBe(true);
  });

  it('refuses FP, which a rebuild derives when it folds the baseline in', () => {
    expect(HistoricalStatsSchema.safeParse({ ...TOTALS, fantasyPoints: 262 }).success).toBe(false);
  });

  it('refuses a total that is not a whole non-negative count, and a missing one', () => {
    expect(HistoricalStatsSchema.safeParse({ ...TOTALS, points: 140.5 }).success).toBe(false);
    expect(HistoricalStatsSchema.safeParse({ ...TOTALS, rebounds: -1 }).success).toBe(false);
    const { assists: _assists, ...withoutAssists } = TOTALS;
    expect(HistoricalStatsSchema.safeParse(withoutAssists).success).toBe(false);
  });
});
