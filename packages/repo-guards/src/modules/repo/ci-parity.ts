// The local gate mirrors what the release workflow verifies: every command a verify job runs is
// mapped to the local gate stage that runs the same check, or to the reason it stays CI-only, and
// every mapped command is one the workflow still runs. A new CI check cannot go unmirrored, and a
// mirror of a check CI dropped cannot linger. Audit commands are mirrored by the gate itself.

import { parse as parseYaml } from 'yaml';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';

type ParityEntry = { stage: string; partial?: string } | { ciOnly: string };

export interface CiParityFacts {
  /** The release workflow, repo-relative (`.github/workflows/deploy.yml`). */
  workflow: string;
  /** A regular-expression source matching the names of the jobs that verify before a deploy. */
  verifyJobPattern: string;
  /** Commands the local gate mirrors on its own (the audits), as a regular-expression source. */
  selfMirrored: string;
  /** The app's parity map, keyed `<dir> :: <command>`, loaded from where its gate reads it. */
  parity: () => Readonly<Record<string, ParityEntry>> | Promise<Readonly<Record<string, ParityEntry>>>;
}

/** One line per command, so a multi-line `run:` compares as the same string everywhere. */
const normalizeRun = (run: string) =>
  run
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ; ');

/** Every `run:` step of every verify job, keyed `<dir> :: <command>` (dir `.` is the repository root). */
export function verifyCommands(workflowText: string, verifyJob: RegExp): string[] {
  const jobs = ((parseYaml(workflowText) ?? {}) as { jobs?: Record<string, { steps?: Array<Record<string, unknown>> }> }).jobs ?? {};
  const out: string[] = [];
  for (const [job, def] of Object.entries(jobs)) {
    if (!verifyJob.test(job)) continue;
    for (const step of def?.steps ?? []) {
      if (typeof step.run !== 'string') continue;
      const dir = typeof step['working-directory'] === 'string' ? step['working-directory'] : '.';
      out.push(`${dir} :: ${normalizeRun(step.run)}`);
    }
  }
  return out;
}

export const ciParityGuard: GenericGuardDefinition<CiParityFacts> = {
  id: 'ciParity',
  absentWhen: 'the app has no release workflow that verifies before it deploys',
  factProblems(facts) {
    const problems: string[] = [];
    if (!facts?.workflow?.trim()) problems.push('workflow is missing');
    for (const key of ['verifyJobPattern', 'selfMirrored'] as const) {
      try {
        new RegExp(facts?.[key] ?? '');
        if (!facts?.[key]) problems.push(`${key} is missing`);
      } catch {
        problems.push(`${key} is not a regular expression`);
      }
    }
    if (typeof facts?.parity !== 'function') problems.push('parity needs a loader of the app parity map');
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the local gate mirrors every check the release workflow runs before it deploys',
        description:
          `Every command a verify job in ${facts.workflow} runs is mapped to the local gate stage that runs the same check, or ` +
          'to why it stays CI-only; every mapped command is one the workflow still runs. Map a new CI command, or drop the ' +
          'entry for one CI no longer runs.',
        async run(context) {
          const map = await facts.parity();
          const commands = verifyCommands(context.file(facts.workflow).text, new RegExp(facts.verifyJobPattern));
          const self = new RegExp(facts.selfMirrored);
          const findings: Finding[] = [];
          if (!commands.length) findings.push({ file: facts.workflow, detail: 'no verify job runs a command, so the guard checks nothing' });
          const run = new Set(commands);
          for (const key of commands) {
            if (self.test(key.slice(key.indexOf(' :: ') + 4))) continue;
            if (!Object.hasOwn(map, key)) findings.push({ file: facts.workflow, detail: `unmirrored CI command: ${key}` });
          }
          for (const [key, entry] of Object.entries(map)) {
            if (!run.has(key)) findings.push({ file: '(parity map)', detail: `stale entry: CI no longer runs ${key}` });
            const reason = 'stage' in entry ? entry.stage : entry.ciOnly;
            if (typeof reason !== 'string' || !reason.trim()) findings.push({ file: '(parity map)', detail: `${key} names no stage and no CI-only reason` });
          }
          return findings;
        },
      },
    ];
  },
};
