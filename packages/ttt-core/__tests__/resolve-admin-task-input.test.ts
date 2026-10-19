import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type {
  NormalReportInputSchema,
  ResolveAdminTaskInput,
  SafetyCaseInputSchema,
} from '../src/schemas/admin.js';

// `resolveAdminTask` parses an ordinary report or a CSAM / NCII safety case, chosen by `caseType`,
// so its declared input is exactly that either-or and a client can send both closes through it.
describe('resolveAdminTask input contract', () => {
  it('is the ordinary-report close or the safety-case close', () => {
    expectTypeOf<ResolveAdminTaskInput>().toEqualTypeOf<
      z.infer<typeof NormalReportInputSchema> | z.infer<typeof SafetyCaseInputSchema>
    >();
  });
});
