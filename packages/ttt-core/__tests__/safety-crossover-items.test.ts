import { describe, it, expect } from 'vitest';
import {
  ChildSafetyCaseV1Schema,
  ChildSafetyCrossoverItemV1Schema,
  isCrossoverItemRegistrationDone,
  rollupCrossoverLegStatus,
} from '../src/doc-schemas/safety/case';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { collectionPathsWithErasureFate } from '../src/doc-schemas/erasure-fates';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections';

const ITEM_PATH = 'childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}';

const pendingItem = {
  schemaVersion: 1,
  caseId: 'case-1',
  mediaAssetId: 'asset-1',
  servingDeny: 'pending',
  photoDna: 'pending',
  createdAt: 10,
  updatedAt: 10,
} as const;

describe('ChildSafetyCrossoverItemV1Schema', () => {
  it('accepts a freshly registered item with both legs pending', () => {
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(pendingItem).success).toBe(true);
  });

  it('accepts an item with no PhotoDNA leg, since an asset without lineage has nothing to scan', () => {
    const { photoDna: _photoDna, ...noScan } = pendingItem;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(noScan).success).toBe(true);
  });

  it('requires the deny leg on every item', () => {
    const { servingDeny: _deny, ...noDeny } = pendingItem;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(noDeny).success).toBe(false);
  });

  it('carries a completion stamp exactly when the leg is done', () => {
    const done = { ...pendingItem, servingDeny: 'done', servingDeniedAt: 20 } as const;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(done).success).toBe(true);
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...done, servingDeniedAt: undefined }).success).toBe(false);
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...pendingItem, servingDeniedAt: 20 }).success).toBe(false);
  });

  it('carries a failure stamp whenever the leg failed, and an error only beside it', () => {
    const failed = { ...pendingItem, photoDna: 'failed', photoDnaFailedAt: 20, photoDnaLastError: 'Error' } as const;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(failed).success).toBe(true);
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...failed, photoDnaFailedAt: undefined }).success).toBe(false);
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...pendingItem, servingDenyLastError: 'Error' }).success).toBe(false);
  });

  it('keeps the failure stamp after a later success', () => {
    const recovered = {
      ...pendingItem,
      servingDeny: 'done',
      servingDeniedAt: 30,
      servingDenyFailedAt: 20,
      servingDenyLastError: 'Error',
    } as const;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse(recovered).success).toBe(true);
  });

  it('refuses PhotoDNA fields on an item whose PhotoDNA leg never applied', () => {
    const { photoDna: _photoDna, ...noScan } = pendingItem;
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...noScan, photoDnaScannedAt: 20 }).success).toBe(false);
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...noScan, photoDnaFailedAt: 20 }).success).toBe(false);
  });

  it('is strict', () => {
    expect(ChildSafetyCrossoverItemV1Schema.safeParse({ ...pendingItem, unknownField: 1 }).success).toBe(false);
  });
});

const registered = { state: 'done', lapStartedAt: 5, lapCompletedAt: 9 } as const;
const registering = { state: 'inLap', afterKey: 'asset-9', lapStartedAt: 5 } as const;

describe('rollupCrossoverLegStatus once every item is registered', () => {
  it('is failed when any item failed, whatever the others are', () => {
    expect(rollupCrossoverLegStatus(['done', 'failed', 'pending'], registered)).toBe('failed');
  });

  it('is pending when none failed and any is still pending', () => {
    expect(rollupCrossoverLegStatus(['done', 'pending', undefined], registered)).toBe('pending');
  });

  it('is done only when every item that has the leg is done', () => {
    expect(rollupCrossoverLegStatus(['done', 'done', undefined], registered)).toBe('done');
  });

  it('is absent when no item has the leg', () => {
    expect(rollupCrossoverLegStatus([], registered)).toBeUndefined();
    expect(rollupCrossoverLegStatus([undefined, undefined], registered)).toBeUndefined();
  });
});

describe('rollupCrossoverLegStatus while items are still being registered', () => {
  it('stays pending when every registered item is done, because the unregistered items still owe the leg', () => {
    expect(rollupCrossoverLegStatus(['done', 'done'], registering)).toBe('pending');
  });

  it('stays pending before the first item is registered', () => {
    expect(rollupCrossoverLegStatus([], undefined)).toBe('pending');
    expect(rollupCrossoverLegStatus([], registering)).toBe('pending');
  });

  it('still reports a failure first, so the failed item is re-driven', () => {
    expect(rollupCrossoverLegStatus(['done', 'failed'], registering)).toBe('failed');
  });
});

describe('isCrossoverItemRegistrationDone', () => {
  it('is true only once the registration lap reached the end of the case items', () => {
    expect(isCrossoverItemRegistrationDone(registered)).toBe(true);
    expect(isCrossoverItemRegistrationDone(registering)).toBe(false);
    expect(isCrossoverItemRegistrationDone(undefined)).toBe(false);
  });
});

describe('the case root crossover rollup', () => {
  const root = {
    schemaVersion: 1,
    caseId: 'case-1',
    evidenceManifestId: 'm1',
    currentReasonInternal: 'reason',
  } as const;

  it('holds only the case-level statuses and the registration cursor', () => {
    const withLegs = {
      ...root,
      crossoverLegs: { servingDeny: 'pending', photoDna: 'failed', itemsCursor: registering },
    };
    expect(ChildSafetyCaseV1Schema.safeParse(withLegs).success).toBe(true);
  });

  it('leaves per-asset timestamps and errors to the item rows', () => {
    const withDetail = { ...root, crossoverLegs: { servingDeny: 'done', servingDeniedAt: 20, itemsCursor: registered } };
    expect(ChildSafetyCaseV1Schema.safeParse(withDetail).success).toBe(false);
  });

  it('refuses a done or absent leg while items are still being registered, so the case stays findable', () => {
    const doneWhileRegistering = { ...root, crossoverLegs: { servingDeny: 'done', photoDna: 'pending', itemsCursor: registering } };
    const absentWhileRegistering = { ...root, crossoverLegs: { servingDeny: 'pending', itemsCursor: registering } };
    const doneBeforeRegistration = { ...root, crossoverLegs: { servingDeny: 'done', photoDna: 'done' } };
    expect(ChildSafetyCaseV1Schema.safeParse(doneWhileRegistering).success).toBe(false);
    expect(ChildSafetyCaseV1Schema.safeParse(absentWhileRegistering).success).toBe(false);
    expect(ChildSafetyCaseV1Schema.safeParse(doneBeforeRegistration).success).toBe(false);
  });

  it('accepts a done or absent leg once every item is registered', () => {
    const finished = { ...root, crossoverLegs: { servingDeny: 'done', itemsCursor: registered } };
    const nothingToAct = { ...root, crossoverLegs: { itemsCursor: registered } };
    expect(ChildSafetyCaseV1Schema.safeParse(finished).success).toBe(true);
    expect(ChildSafetyCaseV1Schema.safeParse(nothingToAct).success).toBe(true);
  });
});

describe('crossover item wiring', () => {
  it('lives under its case, keyed by the asset id', () => {
    expect(PATH_BUILDERS.childSafetyCaseCrossoverItem('c1', 'a1')).toEqual([
      COLLECTIONS.CHILD_SAFETY_CASES,
      'c1',
      NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_CROSSOVER_ITEMS,
      'a1',
    ]);
    expect(PATH_BUILDERS.childSafetyCaseCrossoverItems('c1')).toEqual([
      COLLECTIONS.CHILD_SAFETY_CASES,
      'c1',
      NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_CROSSOVER_ITEMS,
    ]);
  });

  it('is a registered document, so a stored row is held to its schema', () => {
    expect(COLLECTION_SCHEMAS[ITEM_PATH as keyof typeof COLLECTION_SCHEMAS]).toBe(ChildSafetyCrossoverItemV1Schema);
  });

  it('is retained by an erasure like the rest of the case', () => {
    expect(collectionPathsWithErasureFate('retain')).toContain(ITEM_PATH);
  });
});
