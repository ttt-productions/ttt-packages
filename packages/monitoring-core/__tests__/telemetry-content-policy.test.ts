// A content policy keeps diagnostics and drops request content: no request, no breadcrumbs, the
// user as an account id, and — in tags, extras, and contexts — numbers and flags under any key,
// text only under a diagnostic key and only as a whitespace-free token. The key lists here are a
// test app's; the package ships the mechanism and no app's keys.

import { describe, it, expect } from 'vitest';
import {
  createTelemetryContentPolicy,
  DEFAULT_SDK_CONTEXTS,
  type TelemetryContentPolicyOptions,
} from '../src/telemetry-content-policy';
import * as root from '../src/index';

const options: TelemetryContentPolicyOptions = {
  diagnosticKeys: ['uid', 'operation', 'reason', 'code', 'issues', 'remaining', 'type', 'extra', 'safe_code'],
  diagnosticKeySuffixes: ['Id', 'Ids', 'Hash', 'Origin'],
  codeNameContexts: ['function'],
};
const { keepAllowlistedTelemetry, isDiagnosticKey } = createTelemetryContentPolicy(options);

describe('createTelemetryContentPolicy', () => {
  it('drops the request and the breadcrumbs entirely', () => {
    const event = keepAllowlistedTelemetry({
      request: { data: { requestId: 'r1' }, headers: { Authorization: 'Bearer x' }, cookies: { session: 's' } },
      breadcrumbs: [{ message: 'console line' }],
    });
    expect(event).not.toHaveProperty('request');
    expect(event).not.toHaveProperty('breadcrumbs');
  });

  it('keeps the user as its account id only', () => {
    expect(keepAllowlistedTelemetry({ user: { id: 'uid_1', email: 'a@b.c', ip_address: '203.0.113.7' } }).user).toEqual({
      id: 'uid_1',
    });
    expect(keepAllowlistedTelemetry({ user: { email: 'a@b.c' } })).not.toHaveProperty('user');
    expect(keepAllowlistedTelemetry({ user: { id: 'two words' } })).not.toHaveProperty('user');
  });

  it.each([
    ['caseId', true],
    ['workProjectIds', true],
    ['targetKeyHash', true],
    ['fileOrigin', true],
    ['operation', true],
    ['safe_code', true],
    ['Id', false],
    ['CaseId', false],
    ['title', false],
    ['fileName', false],
    ['displayName', false],
  ])('%s is a diagnostic key: %s', (key, expected) => {
    expect(isDiagnosticKey(key)).toBe(expected);
  });

  it('matches a suffix only at the end of a lowercase-led key, so a suffix list never admits every key', () => {
    const none = createTelemetryContentPolicy({ diagnosticKeys: [], diagnosticKeySuffixes: [] });
    expect(none.isDiagnosticKey('caseId')).toBe(false);
    expect(none.isDiagnosticKey('anything')).toBe(false);
    const special = createTelemetryContentPolicy({ diagnosticKeys: [], diagnosticKeySuffixes: ['.Id'] });
    expect(special.isDiagnosticKey('caseXId')).toBe(false);
    expect(special.isDiagnosticKey('case.Id')).toBe(true);
  });

  it('keeps identifier and code text under a diagnostic key, and drops prose and non-finite numbers', () => {
    const event = keepAllowlistedTelemetry({
      extra: { hallItemId: 'hall_1', reason: 'not-found', operation: 'publish item for a member', waitedMs: Number.POSITIVE_INFINITY },
    });
    expect(event.extra).toEqual({ hallItemId: 'hall_1', reason: 'not-found' });
  });

  it('keeps numbers, flags, and null under any key — they cannot carry text — but never text under such a key', () => {
    const event = keepAllowlistedTelemetry({
      extra: { totalCleaned: 4, foreign: false, cleared: null, dueAt: 1_700_000_000_000, workTitle: 'Moonrise' },
    });
    expect(event.extra).toEqual({ totalCleaned: 4, foreign: false, cleared: null, dueAt: 1_700_000_000_000 });
  });

  it('checks the keys inside a nested container and inside lists', () => {
    const event = keepAllowlistedTelemetry({
      extra: {
        extra: { caseId: 'case_1', afterData: { title: 'A Title' } },
        issues: [{ path: ['title'], code: 'too_big', message: 'String must contain at most 150 characters' }],
      },
    });
    expect(event.extra).toEqual({ extra: { caseId: 'case_1' }, issues: [{ path: ['title'], code: 'too_big' }] });
  });

  it('keeps a validation issue path (a list of field names) but never a string path', () => {
    const event = keepAllowlistedTelemetry({ extra: { path: 'uploads/u1/holiday photo.jpg', issues: [{ path: ['a', 0] }] } });
    expect(event.extra).toEqual({ issues: [{ path: ['a', 0] }] });
  });

  it('bounds how deep and how long a kept value can be', () => {
    // A container four levels below the field is not read; a token at the fourth level still is.
    const kept = { caseId: { caseId: { caseId: { caseId: { caseId: 'four-down' } } } } };
    expect(keepAllowlistedTelemetry({ extra: kept }).extra).toEqual(kept);
    const deep = { caseId: { caseId: { caseId: { caseId: { caseId: { caseId: 'too-deep' } } } } } };
    expect(keepAllowlistedTelemetry({ extra: deep }).extra).toEqual({});
    const ids = Array.from({ length: 30 }, (_, i) => `id-${i}`);
    expect((keepAllowlistedTelemetry({ extra: { caseIds: ids } }).extra as { caseIds: string[] }).caseIds).toHaveLength(20);
    expect(keepAllowlistedTelemetry({ extra: { caseId: 'x'.repeat(201) } }).extra).toEqual({});
  });

  it('keeps tags whose values are tokens under a diagnostic key, and numbers and flags under any tag key', () => {
    const event = keepAllowlistedTelemetry({
      tags: { operation: 'checkinTask', note: 'two words', fileName: 'holiday.jpg', mediaDocId: 'media_1', isSafe: false, attempt: 3 },
    });
    expect(event.tags).toEqual({ operation: 'checkinTask', mediaDocId: 'media_1', isSafe: false, attempt: 3 });
  });

  it("keeps the SDK's runtime contexts whole, a code-name context's name, and only the diagnostic part of any other context", () => {
    const event = keepAllowlistedTelemetry({
      contexts: {
        runtime: { name: 'node', version: 'v24' },
        function: { name: 'checkinTask', taskId: 'task_1', note: 'free text' },
        erasure: { remaining: ['chatAnonymization'], dueAt: 5 },
        trademark: { workTitle: 'A Title' },
        moderation: { type: 'video', source: 'gs://bucket/uploads/uid_1/clip.mp4' },
        payload: { name: 'Alex' },
      },
    });
    expect(event.contexts).toEqual({
      runtime: { name: 'node', version: 'v24' },
      function: { name: 'checkinTask', taskId: 'task_1' },
      erasure: { remaining: ['chatAnonymization'], dueAt: 5 },
      moderation: { type: 'video' },
    });
  });

  it("keeps a context's name only where the app says it is a code name", () => {
    const plain = createTelemetryContentPolicy({ diagnosticKeys: options.diagnosticKeys, diagnosticKeySuffixes: [] });
    expect(plain.keepAllowlistedTelemetry({ contexts: { function: { name: 'checkinTask' } } }).contexts).toEqual({});
  });

  it('keeps the SDK contexts the app names in place of the defaults', () => {
    expect(DEFAULT_SDK_CONTEXTS).toEqual(['trace', 'runtime', 'os', 'app', 'device', 'culture', 'cloud_resource']);
    const withResponse = createTelemetryContentPolicy({ ...options, sdkContexts: ['response'] });
    expect(
      withResponse.keepAllowlistedTelemetry({ contexts: { response: { status_code: 500, body: 'x y' }, runtime: { name: 'node' } } })
        .contexts,
    ).toEqual({ response: { status_code: 500, body: 'x y' } });
  });

  it('leaves the error itself — its message and exception — for the scrubber', () => {
    const event = keepAllowlistedTelemetry({
      message: 'Hall publish failed',
      exception: { values: [{ type: 'Error', value: 'transaction aborted' }] },
    });
    expect(event.message).toBe('Hall publish failed');
    expect(event.exception).toEqual({ values: [{ type: 'Error', value: 'transaction aborted' }] });
  });

  it('rewrites the event in place and returns it, so it composes with the scrubber as one hook', () => {
    const event = { extra: { caseId: 'c1' } };
    expect(keepAllowlistedTelemetry(event)).toBe(event);
  });

  it('is exported from the server-safe root', () => {
    expect(root.createTelemetryContentPolicy).toBe(createTelemetryContentPolicy);
    expect(root.DEFAULT_SDK_CONTEXTS).toBe(DEFAULT_SDK_CONTEXTS);
  });
});
