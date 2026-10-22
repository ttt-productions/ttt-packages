import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type {
  NormalReportInputSchema,
  ResolveAdminTaskInput,
  SafetyCaseInputSchema,
} from '../src/schemas/admin.js';

describe('resolveAdminTask input contract', () => {
  it('is the ordinary-report close or the safety-case close', () => {
    expectTypeOf<ResolveAdminTaskInput>().toEqualTypeOf<
      z.infer<typeof NormalReportInputSchema> | z.infer<typeof SafetyCaseInputSchema>
    >();
  });
});
