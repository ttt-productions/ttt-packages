// Running one guard and proving one guard's samples — what each registered test does.

import { formatFindings, type Guard, type GuardContext } from '../guard.js';
import type { RepoReader } from '../reader/reader.js';
import { sampleHits } from '../shapes/shapes.js';

/** A context that counts what a guard reads: a guard that reads nothing proves nothing. */
function contextFor(reader: RepoReader) {
  let read = 0;
  const context: GuardContext = {
    reader,
    files(scope) {
      const files = reader.files(scope);
      read += files.length;
      return files;
    },
    file(relPath) {
      read += 1;
      return reader.file(relPath);
    },
  };
  return { context, readCount: () => read };
}

/** Runs one guard; a vacuous run or any finding throws the guard's report. */
export async function runGuard(guard: Guard, reader: RepoReader) {
  const { context, readCount } = contextFor(reader);
  const findings = await guard.run(context);
  if (readCount() === 0) throw new Error(`${guard.title}: the guard read no file, so it checked nothing (its scope reaches nothing)`);
  if (findings.length) throw new Error(formatFindings(guard, findings));
}

/** Every must-fail sample must hit and every must-pass sample must not, or this throws. */
export function checkSamples(guard: Guard) {
  if (!guard.samples) return;
  const missed = guard.samples.flags.filter((s) => sampleHits(guard, s) === 0);
  const wrong = guard.samples.passes.filter((s) => sampleHits(guard, s) > 0);
  if (missed.length || wrong.length) {
    const show = (s: unknown) => `    ${typeof s === 'string' ? s : JSON.stringify(s)}`;
    throw new Error(
      [
        `${guard.title}: the matcher no longer proves itself`,
        ...(missed.length ? ['  must-fail samples it did not flag:', ...missed.map(show)] : []),
        ...(wrong.length ? ['  must-pass samples it flagged:', ...wrong.map(show)] : []),
      ].join('\n'),
    );
  }
}

