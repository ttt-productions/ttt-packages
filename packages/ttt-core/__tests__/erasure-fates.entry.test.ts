import { describe, it, expect } from 'vitest';
import {
  ERASURE_FATES_BY_COLLECTION_PATH,
  adminDispatchErasureFate,
} from '../src/doc-schemas/erasure-fates';
import * as docSchemasBarrel from '../src/doc-schemas';

describe('erasure fate declaration', () => {
  it('is exported from the doc-schemas entry point', () => {
    expect(docSchemasBarrel.ERASURE_FATES_BY_COLLECTION_PATH).toBe(ERASURE_FATES_BY_COLLECTION_PATH);
    expect(docSchemasBarrel.adminDispatchErasureFate).toBe(adminDispatchErasureFate);
  });
});
