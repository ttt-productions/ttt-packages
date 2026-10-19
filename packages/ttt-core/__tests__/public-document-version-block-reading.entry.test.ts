import { describe, it, expect } from 'vitest';
import { readPublicDocumentVersionBlock } from '../src/utils/app-config.js';
import { requiredPublicDocumentAcceptanceLevelOfReading } from '../src/utils/public-documents.js';
import * as utils from '../src/utils/index.js';

describe('readPublicDocumentVersionBlock — the one reader of the release-owned version block', () => {
  it('is exported from the utils entry', () => {
    expect(utils.readPublicDocumentVersionBlock).toBe(readPublicDocumentVersionBlock);
  });
});

describe('requiredPublicDocumentAcceptanceLevelOfReading — the level each reading states', () => {
  it('is exported from the utils entry', () => {
    expect(utils.requiredPublicDocumentAcceptanceLevelOfReading).toBe(
      requiredPublicDocumentAcceptanceLevelOfReading,
    );
  });
});
