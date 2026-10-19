import { describe, it, expect } from 'vitest';
import { ListRetainedChildSafetyCasesInputSchema } from '../src/schemas/safety.js';
import { SafetyCaseLaneSchema } from '../src/doc-schemas/safety/case.js';
import * as schemasBarrel from '../src/schemas/index.js';
import * as docSchemasBarrel from '../src/doc-schemas/index.js';

describe('retained child-safety case list', () => {
  it('is exported from the schemas entry point', () => {
    expect(schemasBarrel.ListRetainedChildSafetyCasesInputSchema).toBe(
      ListRetainedChildSafetyCasesInputSchema,
    );
  });
});

describe('the safety-case lane', () => {
  it('is exported from the doc-schemas entry, never the schemas entry', () => {
    expect(docSchemasBarrel.SafetyCaseLaneSchema).toBe(SafetyCaseLaneSchema);
    expect('SafetyCaseLaneSchema' in schemasBarrel).toBe(false);
  });
});
