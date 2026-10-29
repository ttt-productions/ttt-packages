import { compareDeployedFunctions, type LiveFunction } from './deployed-functions.js';

export const DEPLOY_PASS_ATTEMPTS = 3;
export const DEPLOY_PASS_PAUSE_MS = 60_000;

export type FunctionsManifest = Readonly<Record<string, readonly string[]>>;

export interface FunctionsDeployPlan {
  passes: string[];
  problems: string[];
}

// The deploy CLI groups a live function by name only across the codebases one deploy targets, so a
// function moving between codebases is updated in place only when its new codebase deploys first;
// deploying the old codebase first deletes it.
export function planFunctionsDeployPasses({
  targets,
  manifest,
  live,
}: {
  targets: readonly string[];
  manifest: FunctionsManifest;
  live: readonly LiveFunction[];
}): FunctionsDeployPlan {
  const problems: string[] = [];
  const owner = new Map<string, string>();
  for (const [codebase, names] of Object.entries(manifest))
    for (const name of names) owner.set(name, codebase);

  const before = new Map<string, Set<string>>(targets.map((cb) => [cb, new Set<string>()]));
  const moves: { name: string; from: string; to: string }[] = [];
  for (const fn of live) {
    const wanted = owner.get(fn.name);
    if (wanted === undefined) {
      if (fn.codebase === null || !(fn.codebase in manifest))
        problems.push(
          `${fn.name} is live under ${fn.codebase ?? 'no codebase'}, which no codebase deploys, so no pass would delete it`,
        );
      continue;
    }
    if (fn.codebase === null || fn.codebase === wanted) continue;
    if (!targets.includes(wanted)) {
      problems.push(
        `${fn.name} moves from ${fn.codebase} to ${wanted}, but this release does not deploy ${wanted}`,
      );
      continue;
    }
    if (!targets.includes(fn.codebase)) continue;
    before.get(fn.codebase)!.add(wanted);
    moves.push({ name: fn.name, from: fn.codebase, to: wanted });
  }

  const passes: string[] = [];
  const placed = new Set<string>();
  while (passes.length < targets.length) {
    const next = targets.find(
      (cb) => !placed.has(cb) && [...before.get(cb)!].every((dep) => placed.has(dep)),
    );
    if (next === undefined) {
      const stuck = targets.filter((cb) => !placed.has(cb));
      const swapped = moves
        .filter((move) => stuck.includes(move.from) && stuck.includes(move.to))
        .map((move) => `${move.name} ${move.from} -> ${move.to}`);
      problems.push(
        `functions move both ways between ${stuck.join(', ')} (${swapped.join(', ')}); move them in two releases`,
      );
      break;
    }
    passes.push(next);
    placed.add(next);
  }
  return { passes, problems };
}

export interface DeployPassEffects {
  listLive: () => LiveFunction[];
  deploy: (only: string) => boolean;
  pause: (ms: number) => void;
  log: (line: string) => void;
  error: (line: string) => void;
}

export function runFunctionsDeployPasses(
  {
    targets,
    manifest,
    nonFunctionTargets,
  }: {
    targets: readonly string[];
    manifest: FunctionsManifest;
    nonFunctionTargets: readonly string[];
  },
  effects: DeployPassEffects,
): boolean {
  const plan = planFunctionsDeployPasses({ targets, manifest, live: effects.listLive() });
  if (plan.problems.length > 0) {
    for (const problem of plan.problems) effects.error(`[deploy-functions] ${problem}`);
    effects.error('[deploy-functions] Nothing was deployed.');
    return false;
  }

  const attempt = (label: string, run: () => boolean): boolean => {
    for (let n = 1; n <= DEPLOY_PASS_ATTEMPTS; n += 1) {
      if (run()) return true;
      if (n < DEPLOY_PASS_ATTEMPTS) {
        effects.log(`[deploy-functions] ${label}: attempt ${n} failed; retrying.`);
        effects.pause(DEPLOY_PASS_PAUSE_MS);
      }
    }
    effects.error(
      `[deploy-functions] ${label} failed ${DEPLOY_PASS_ATTEMPTS} attempts; later passes did not run.`,
    );
    return false;
  };

  if (nonFunctionTargets.length > 0) {
    const only = nonFunctionTargets.join(',');
    if (!attempt(only, () => effects.deploy(only))) return false;
  }

  effects.log(`[deploy-functions] passes: ${plan.passes.join(' -> ') || '(none)'}`);
  for (const [index, codebase] of plan.passes.entries()) {
    const ok = attempt(`functions:${codebase}`, () => {
      if (!effects.deploy(`functions:${codebase}`)) return false;
      const { missing, leftover, notActive } = compareDeployedFunctions(
        [{ codebase, names: manifest[codebase] ?? [] }],
        effects.listLive(),
      );
      for (const fn of missing)
        effects.error(`[deploy-functions] ${fn} is expected but not deployed.`);
      for (const fn of leftover)
        effects.error(`[deploy-functions] ${fn} is still deployed but no longer expected.`);
      for (const fn of notActive) effects.error(`[deploy-functions] ${fn} is not ACTIVE.`);
      return missing.length + leftover.length + notActive.length === 0;
    });
    if (!ok) return false;
    if (index < plan.passes.length - 1) effects.pause(DEPLOY_PASS_PAUSE_MS);
  }
  return true;
}
