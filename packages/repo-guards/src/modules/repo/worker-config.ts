// Each Worker's wrangler.toml keeps its environments apart. Named environments do not inherit
// top-level bindings, so a config carries a top-level binding set only the local runtime reads plus
// one real set per environment, and two silent failures follow from that shape: a top-level binding
// naming a real environment's storage (a bare `wrangler deploy` then publishes a Worker wired to it),
// and two environments naming the same storage. Migrations ARE inherited, so a destructive migration
// at the top level reaches production, and an environment with its own list stops receiving
// top-level migrations it does not repeat.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import { effectiveMigrations, environmentResources, migrationLists, readTables, topLevelResources, type Table } from './wrangler-toml.js';

export interface WorkerConfigFacts {
  /** Every Worker's wrangler.toml, repo-relative. */
  configFiles: readonly string[];
  /** The environment name production deploys with. */
  productionEnvironment: string;
  /**
   * Destructive migrations allowed in the production list, keyed to the exact contents so editing
   * the tag's class list voids the approval. Each carries its why; an entry nothing matches is stale.
   */
  productionDestructiveMigrations: ReadonlyArray<{ configFile: string; tag: string; key: string; contents: string; why: string }>;
}

/** Every finding the checks make over one parsed config. */
export function workerConfigFindings(
  configFile: string,
  tables: readonly Table[],
  productionEnvironment: string,
  approved: WorkerConfigFacts['productionDestructiveMigrations'],
): { findings: Finding[]; approvedUsed: Set<number> } {
  const findings: Finding[] = [];
  const approvedUsed = new Set<number>();
  const at = (detail: string) => findings.push({ file: configFile, detail });

  if (!tables.length) at('produced no sections, so nothing in it is checked');
  if (!tables.some((table) => table.header.startsWith('env.'))) at('declares no [env.*] section');

  const byEnv = environmentResources(tables);
  const owner = new Map<string, string>();
  for (const [env, ids] of byEnv) {
    for (const id of ids) {
      const previous = owner.get(id);
      if (previous !== undefined) {
        at(`binds '${id}' in both [env.${previous}] and [env.${env}]: one environment would read and write the other's storage`);
      }
      owner.set(id, env);
    }
  }
  const deployed = new Set([...byEnv.values()].flat());
  for (const id of topLevelResources(tables)) {
    if (deployed.has(id)) {
      at(`binds '${id}' at the top level, where only the local runtime reads it, while a named environment binds the same storage: a deploy with no --env would publish a Worker wired to it`);
    }
  }

  const lists = migrationLists(tables);
  for (const entry of [...lists.topLevel, ...[...lists.byEnv.values()].flat()]) {
    if (entry.tag === '(untagged)') at('declares a migration with no tag');
  }
  const topLevelTags = lists.topLevel.map((entry) => entry.tag);
  for (const [env, entries] of lists.byEnv) {
    const envTags = new Set(entries.map((entry) => entry.tag));
    for (const tag of topLevelTags) {
      if (!envTags.has(tag)) at(`[env.${env}] declares its own migrations but not top-level tag '${tag}': that migration never reaches it`);
    }
  }
  for (const entry of effectiveMigrations(lists, productionEnvironment)) {
    for (const [key, contents] of Object.entries(entry.destructive)) {
      const match = approved.findIndex(
        (a) => a.configFile === configFile && a.tag === entry.tag && a.key === key && a.contents === contents,
      );
      if (match === -1) {
        at(
          `migration tag '${entry.tag}' carries ${key} = ${contents} in the list [env.${productionEnvironment}] deploys with: ` +
            'that destroys or rewrites production Durable Object storage',
        );
      } else approvedUsed.add(match);
    }
  }
  return { findings, approvedUsed };
}

export const workerConfigGuard: GenericGuardDefinition<WorkerConfigFacts> = {
  id: 'workerConfigIsolation',
  absentWhen: 'the app deploys no Cloudflare Worker',
  absentOnlyWithoutRoot: 'workers',
  factProblems(facts) {
    const problems: string[] = [];
    if (!facts || typeof facts !== 'object') return ['the facts are missing'];
    if (!Array.isArray(facts.configFiles) || !facts.configFiles.length) problems.push('configFiles names no wrangler.toml');
    else if (new Set(facts.configFiles).size !== facts.configFiles.length) problems.push('a config file is listed twice');
    if (typeof facts.productionEnvironment !== 'string' || !facts.productionEnvironment.trim()) problems.push('productionEnvironment is empty');
    if (!Array.isArray(facts.productionDestructiveMigrations)) {
      problems.push('productionDestructiveMigrations is missing (an app with none declares [])');
    } else {
      for (const entry of facts.productionDestructiveMigrations) {
        if (!entry?.configFile || !entry.tag || !entry.key || !entry.contents) problems.push('a production destructive migration entry is incomplete');
        else if (!facts.configFiles?.includes(entry.configFile)) problems.push(`production destructive migration ${entry.tag} names ${entry.configFile}, which is not a config file`);
        if (entry && !entry.why?.trim()) problems.push(`production destructive migration ${entry.tag} carries no why`);
      }
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: "each Worker's environments keep their bindings and migrations apart",
        description:
          'In every Worker wrangler.toml: no storage is bound by two environments, no top-level binding names storage an ' +
          'environment binds, every migration has a tag, an environment with its own migration list repeats every ' +
          `top-level tag, and no destructive migration (deleted_classes, renamed_classes) is in the list [env.${facts.productionEnvironment}] ` +
          'deploys with unless reviewed. Scope a dev-only migration to that environment, rename the top-level binding to ' +
          'storage no environment uses, or give the environment its own resource.',
        run(context) {
          const findings: Finding[] = [];
          const used = new Set<number>();
          for (const configFile of facts.configFiles) {
            if (!context.reader.exists(configFile)) {
              findings.push({ file: configFile, detail: 'the config file does not exist' });
              continue;
            }
            let tables: Table[];
            try {
              tables = readTables(context.file(configFile).text);
            } catch (err) {
              findings.push({ file: configFile, detail: `cannot be read safely: ${(err as Error).message}` });
              continue;
            }
            const result = workerConfigFindings(configFile, tables, facts.productionEnvironment, facts.productionDestructiveMigrations);
            findings.push(...result.findings);
            for (const index of result.approvedUsed) used.add(index);
          }
          facts.productionDestructiveMigrations.forEach((entry, index) => {
            if (!used.has(index)) {
              findings.push({ file: entry.configFile, detail: `stale reviewed migration: tag '${entry.tag}' ${entry.key} = ${entry.contents} is no longer in the production list` });
            }
          });
          return findings;
        },
      },
    ];
  },
};
