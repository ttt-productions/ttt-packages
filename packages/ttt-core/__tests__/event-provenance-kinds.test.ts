import { describe, it, expect } from 'vitest';
import {
  EventProvenanceKindSchema,
  EVENT_PROVENANCE_ROUTINE_TTL_DAYS,
} from '../src/doc-schemas/safety/provenance';

describe('event provenance kinds', () => {
  it('records the source events that are written: uploads, messages, and reports', () => {
    expect([...EventProvenanceKindSchema.options].sort()).toEqual(
      ['messageSend', 'reportSubmit', 'uploadFinalize', 'uploadInit'].sort(),
    );
  });

  it('has no login kind — the permanent sign-in audit record is the one record of a sign-in', () => {
    expect(EventProvenanceKindSchema.safeParse('login').success).toBe(false);
    expect(Object.keys(EVENT_PROVENANCE_ROUTINE_TTL_DAYS)).not.toContain('login');
  });

  it('gives every routine kind a time to live and keeps report provenance with its case', () => {
    const routineKinds = EventProvenanceKindSchema.options.filter((kind) => kind !== 'reportSubmit');
    expect(Object.keys(EVENT_PROVENANCE_ROUTINE_TTL_DAYS).sort()).toEqual([...routineKinds].sort());
  });
});
