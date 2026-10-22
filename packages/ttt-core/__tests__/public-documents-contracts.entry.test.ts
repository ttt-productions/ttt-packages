import { describe, it, expect } from 'vitest';
import {
  REGISTERED_MEMBER_CLAIM,
  PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT,
} from '../src/constants/public-documents.js';
import * as constants from '../src/constants/index.js';
import { ShownPublicDocumentVersionsSchema } from '../src/schemas/public-documents.js';
import {
  RegisterUserInputSchema,
  RegisterUserResultSchema,
  SquareStreetzAgreementsAcceptedAuditPayloadSchema,
} from '../src/schemas/users.js';
import { PublicDocumentVersionOrNoneSchema } from '../src/doc-schemas/public-documents.js';
import * as docSchemasBarrel from '../src/doc-schemas/index.js';
import * as schemasBarrel from '../src/schemas/index.js';

describe('public document identity', () => {
  it('exports the registered-member claim from the server-safe constants entry', () => {
    expect(constants.REGISTERED_MEMBER_CLAIM).toBe(REGISTERED_MEMBER_CLAIM);
  });

  it("exports the re-acceptance prompt's agreement line from the server-safe constants entry", () => {
    expect(constants.PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT).toBe(
      PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT,
    );
  });
});

describe('callable inputs', () => {
  it('ships no direct page-update schemas — every change is a release', () => {
    for (const name of [
      'UpdateTermsPageInputSchema',
      'UpdatePrivacyPageInputSchema',
      'UpdateRulesAndAgreementsInputSchema',
      'UpdateFuturePlansInputSchema',
      'UpdateTakeItDownPageCopyInputSchema',
    ]) {
      expect(name in schemasBarrel, name).toBe(false);
    }
  });
});

describe('registration carries the versions the signup page showed', () => {
  it('both callables are importable from the one schemas subpath', () => {
    expect(schemasBarrel.RegisterUserInputSchema).toBe(RegisterUserInputSchema);
    expect(schemasBarrel.RegisterUserResultSchema).toBe(RegisterUserResultSchema);
    expect(schemasBarrel.ShownPublicDocumentVersionsSchema).toBe(ShownPublicDocumentVersionsSchema);
  });
});

describe('audit payloads', () => {
  it('the Square agreements payload is importable from the one schemas subpath', () => {
    expect(schemasBarrel.SquareStreetzAgreementsAcceptedAuditPayloadSchema).toBe(
      SquareStreetzAgreementsAcceptedAuditPayloadSchema,
    );
    expect(docSchemasBarrel.PublicDocumentVersionOrNoneSchema).toBe(
      PublicDocumentVersionOrNoneSchema,
    );
  });
});
