import { formatFindings, type Finding, type Guard, type GuardContext } from '../../guard.js';
import { UnreadablePathError, type RepoReader, type Scope } from '../reader.js';
import { sampleHits } from '../../shapes/shapes.js';

const describeScope = (scope: Scope) =>
  `${scope.kinds.join('/')} files under ${scope.roots.join(', ')}${scope.tests === 'only' ? ' (tests only)' : scope.tests ? '' : ' (tests left out)'}`;

function contextFor(reader: RepoReader) {
  const emptyScopes = new Set<string>();
  let scopes = 0;
  let named = 0;
  const counted = <T>(files: T[], label: string): T[] => {
    scopes += 1;
    if (!files.length) emptyScopes.add(label);
    return files;
  };
  const context: GuardContext = {
    reader,
    files: (scope) => counted(reader.files(scope), describeScope(scope)),
    file(relPath) {
      named += 1;
      return reader.file(relPath);
    },
    rulesFiles: (service) =>
      counted(reader.rulesFiles(service), `the layout's ${service ?? 'listed'} rules files`),
  };
  const vacuity = (): string | null => {
    if (emptyScopes.size)
      return `its scope reached no file, so it checked nothing there: ${[...emptyScopes].join('; ')}`;
    if (!scopes && !named) return 'the guard read no file, so it checked nothing';
    return null;
  };
  return { context, vacuity };
}

export async function runGuard(guard: Guard, reader: RepoReader) {
  const { context, vacuity } = contextFor(reader);
  let findings: Finding[];
  try {
    findings = await guard.run(context);
  } catch (err) {
    if (!(err instanceof UnreadablePathError)) throw err;
    throw new Error(
      formatFindings(guard, [
        { file: err.path, detail: `could not be read while the guard ran (${err.code})` },
      ]),
      { cause: err },
    );
  }
  const vacuous = vacuity();
  if (vacuous) throw new Error(`${guard.title}: ${vacuous}`);
  if (findings.length) throw new Error(formatFindings(guard, findings));
}

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
