// What a guard is: a named check over the files the reader hands it. Generic guards and an app's
// business guards are the same thing to the suite.

import type { RulesService } from './node/layout.js';
import type { RepoReader, Scope } from './node/reader.js';
import type { FileView } from './reader/view.js';

/** One place a guard failed. */
export interface Finding {
  /** Repo-relative path, or the config entry the finding is about. */
  file: string;
  line?: number;
  detail: string;
}

/**
 * What a guard run reads through. Every scope a guard reads is counted on its own, so a run whose
 * scope reached no file fails as vacuous even when it also read a named file.
 */
export interface GuardContext {
  readonly reader: RepoReader;
  files(scope: Scope): FileView[];
  file(relPath: string): FileView;
  /** Every rules file the layout lists, or those written for one service: a scope like any other. */
  rulesFiles(service?: RulesService): FileView[];
}

/** A must-fail or must-pass input for a guard's matcher. A bare string is the text of `sample.ts`. */
export type Sample = string | { path: string; text: string };

export interface Guard {
  /** The behavior the guard proves, in words; it names the guard's test. */
  readonly title: string;
  /** What the check requires and how a failure is fixed, in words. Printed with every failure. */
  readonly description: string;
  /** Loads what the guard needs before its samples or its run (an app's declared values). */
  prepare?(): Promise<void>;
  run(context: GuardContext): Finding[] | Promise<Finding[]>;
  /**
   * The guard's own proof that it still catches what it exists to catch: every `flags` sample must
   * produce a hit and every `passes` sample none. Generic guards prove themselves in the package's
   * own tests; a business guard carries its samples here.
   */
  readonly samples?: {
    flags: readonly Sample[];
    passes: readonly Sample[];
    probe(sample: FileView): readonly unknown[];
  };
  /** A whole-repository sweep can take longer than a unit test's default. */
  readonly timeoutMs?: number;
  /**
   * Why this guard cannot run here, or null when it can. Only a guard whose input lies outside the
   * checkout (a sibling repository CI never checks out) has one; the suite shows the guard SKIPPED
   * with this reason, never passed.
   */
  skipReason?(reader: RepoReader): string | null;
}

/** A printable failure report for one guard. */
export function formatFindings(
  guard: Pick<Guard, 'title' | 'description'>,
  findings: readonly Finding[],
): string {
  const lines = [`${guard.title}: ${findings.length} finding(s)`, '', guard.description, ''];
  for (const f of findings) lines.push(`  ${f.file}${f.line ? `:${f.line}` : ''} — ${f.detail}`);
  return lines.join('\n');
}
