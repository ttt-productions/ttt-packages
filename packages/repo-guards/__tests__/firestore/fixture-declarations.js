// The installed-package type declarations the package-builder fixtures read: an illustrative media
// package's shipped `.d.ts`, served the way the `./node` reader serves a real one.

const MEDIA_DECLARATIONS = `
declare const STATUS: {
    readonly pending: "pending";
    readonly processing: "processing";
    readonly completed: "completed";
    readonly failed: "failed";
    readonly rejected: "rejected";
};
export type PendingMediaTerminalStatus = typeof STATUS.completed | typeof STATUS.failed | typeof STATUS.rejected;
/** The terminal field set a \`completed\` transition writes. */
export type PendingMediaCompletedTerminalFields = {
    status: typeof STATUS.completed;
    completedAt: number;
    terminalAt: number;
    updatedAt: number;
};
/** The terminal field set a \`failed\` transition writes. */
export type PendingMediaFailedTerminalFields = {
    status: typeof STATUS.failed;
    failedAt: number;
    terminalAt: number;
    updatedAt: number;
};
/** The terminal field set a \`rejected\` transition writes. */
export type PendingMediaRejectedTerminalFields = {
    status: typeof STATUS.rejected;
    rejectedAt: number;
    terminalAt: number;
    updatedAt: number;
};
export type PendingMediaTerminalFields<S extends PendingMediaTerminalStatus = PendingMediaTerminalStatus> = S extends typeof STATUS.completed ? PendingMediaCompletedTerminalFields : S extends typeof STATUS.failed ? PendingMediaFailedTerminalFields : PendingMediaRejectedTerminalFields;
export declare function buildPendingMediaTerminalFields(status: typeof STATUS.completed, extraFields: Record<string, never>, now: number): PendingMediaCompletedTerminalFields;
export declare function buildPendingMediaTerminalFields(status: typeof STATUS.failed, extraFields: Record<string, never>, now: number): PendingMediaFailedTerminalFields;
export declare function buildPendingMediaTerminalFields(status: typeof STATUS.rejected, extraFields: Record<string, never>, now: number): PendingMediaRejectedTerminalFields;
export declare function buildPendingMediaTerminalFields<S extends PendingMediaTerminalStatus, E extends Record<string, unknown>>(status: S, extraFields: E, now: number): PendingMediaTerminalFields<S> & E;
export {};
`;

/** The package fixtures import; its declarations are the ones above. */
export const FIXTURE_MEDIA_PACKAGE = '@fixture/media';

/** The `packageDeclarations` reader the fixtures hand the analyzer. */
export const fixturePackageDeclarations = (packageName) =>
  packageName === FIXTURE_MEDIA_PACKAGE
    ? [
        {
          file: 'node_modules/@fixture/media/dist/pending-media-lifecycle.d.ts',
          text: MEDIA_DECLARATIONS,
        },
      ]
    : [];
