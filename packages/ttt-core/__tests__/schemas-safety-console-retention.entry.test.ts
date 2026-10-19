import { describe, it, expect } from 'vitest';
import { ListRetainedChildSafetyCasesInputSchema } from '../src/schemas/safety';
import { SafetyCaseLaneSchema } from '../src/doc-schemas/safety/case';
import * as schemasBarrel from '../src/schemas';
import * as docSchemasBarrel from '../src/doc-schemas';

describe('retained child-safety case list', () => {
  it('is exported from the schemas entry point', () => {
    expect(schemasBarrel.ListRetainedChildSafetyCasesInputSchema).toBe(ListRetainedChildSafetyCasesInputSchema);
  });
});

describe('the safety-case lane', () => {
  it('is exported from the doc-schemas entry, never the schemas entry', () => {
    expect(docSchemasBarrel.SafetyCaseLaneSchema).toBe(SafetyCaseLaneSchema);
    expect('SafetyCaseLaneSchema' in schemasBarrel).toBe(false);
  });
});
