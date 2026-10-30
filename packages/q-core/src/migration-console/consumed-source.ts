import type { MigrationActionRun } from '../doc-schemas/migration-console.js';
import type { MigrationActionId } from './action-ids.js';
import { MIGRATION_CUTOVER_MANIFEST } from './manifest.js';

// Any real run of a delete consumes, whatever it wrote: a later run replaces the record's `run`, so
// only a real run's presence stays true once the source started going. A preview never consumes.
export function sourceConsumedBy(
  actionId: MigrationActionId,
  runs: ReadonlyMap<MigrationActionId, MigrationActionRun>,
): MigrationActionId[] {
  return MIGRATION_CUTOVER_MANIFEST.filter(
    (step) =>
      step.kind === 'executable' &&
      step.destructive &&
      step.consumes.includes(actionId) &&
      runs.get(step.id)?.run?.dryRun === false,
  ).map((step) => step.id);
}
