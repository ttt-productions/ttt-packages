import { describe, it, expect } from 'vitest';
import {
  REGISTERED_MEMBER_CLAIM,
  PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT,
} from '../src/constants/public-documents';
import * as constants from '../src/constants/index';
import { AcceptPublicDocumentsInputSchema } from '../src/schemas/public-documents';
import {
  RegisterUserInputSchema,
  RegisterUserResultSchema,
  SquareStreetzAgreementsAcceptedAuditPayloadSchema,
} from '../src/schemas/users';
import { PublicDocumentVersionOrNoneSchema } from '../src/doc-schemas/public-documents';
import * as docSchemasBarrel from '../src/doc-schemas';
import * as schemasBarrel from '../src/schemas';

describe('public document identity', () => {
  it('exports the registered-member claim from the server-safe constants entry', () => {
    expect(constants.REGISTERED_MEMBER_CLAIM).toBe(REGISTERED_MEMBER_CLAIM);
  });

  it("exports the re-acceptance prompt's agreement line from the server-safe constants entry", () => {
    expect(constants.PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT).toBe(PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT);
  });
});

describe('callable inputs', () => {
  it('the old direct page-update schemas are gone — every change is a release', () => {
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
    expect(schemasBarrel.ShownPublicDocumentVersionsSchema).toBe(AcceptPublicDocumentsInputSchema.shape.documents);
  });
});

describe('audit payloads', () => {
  it('the Square agreements payload is importable from the one schemas subpath', () => {
    expect(schemasBarrel.SquareStreetzAgreementsAcceptedAuditPayloadSchema).toBe(
      SquareStreetzAgreementsAcceptedAuditPayloadSchema,
    );
    expect(docSchemasBarrel.PublicDocumentVersionOrNoneSchema).toBe(PublicDocumentVersionOrNoneSchema);
  });
});
