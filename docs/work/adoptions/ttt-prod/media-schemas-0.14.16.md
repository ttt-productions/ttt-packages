# Adopt @ttt-productions/media-schemas 0.14.16

**What:** Every pending-media shape is plain, the client claim and client context included; a callable input takes their strict copy.
**Severity:** medium

- **Package and version:** `@ttt-productions/media-schemas` 0.14.16 (0.14.15 made the factory's
  shapes plain; 0.14.16 makes the two client shapes plain too).
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`.
- **What changed:**
  - `createPendingMediaSchemas` builds every pending-media state, its result, the archived states
    and the quarantined archive row as plain objects (RULE-STD-BACKEND-115): an undeclared field is
    dropped on read instead of refused.
  - `ClientMediaClaimSchema` and `ClientContextSchema` are plain, and the factory's stored
    `clientMediaClaim` and `clientContext` use them directly. A callable input or upload-variables
    schema that takes one takes its `.strict()` copy (RULE-STD-BACKEND-002), so the shape stays
    declared once and the input still refuses an undeclared field.
- **What the app must change (packages-first: the ttt-core part is a ttt-packages change and its
  release, then this adoption):**
  1. **ttt-core's inputs take the strict copies** — today they take the schemas as they are, which
     are now plain:
     - `src/media/start-upload.ts`: `clientContext: ClientContextSchema.strict()` and
       `clientMediaClaim: ClientMediaClaimSchema.strict().optional()`.
     - The `claim` field of every upload-variables schema in `src/upload-variables/`
       (`ClientMediaClaimSchema.strict().optional()`): `apply-to-commission`,
       `create-admin-audition`, `create-audition-entry`, `create-commission`,
       `create-work-project-audition`, `square-streetz-post`, `update-chapter-media`,
       `update-episode-media`, `update-tale-cover-photo`, `update-television-cover-photo`,
       `update-track-media`, `update-tune-cover-photo`, `update-work-realm-cover`,
       `upload-conversation-file`, `upload-craft-skill`, `upload-profile-picture`,
       `upload-system-content`, `upload-work-file` (each `*-variables.ts`). A search for
       `ClientMediaClaimSchema` / `ClientContextSchema` in ttt-core finds every site; none is left
       without `.strict()`.
     - ttt-core tests: an input carrying an undeclared field inside the claim or the context is
       refused. ttt-core's own `__tests__/media-pending-media.test.ts` already expects a stored one
       dropped.
  2. **Install** in ttt-prod. Its `pendingMedia` and `pendingMediaArchive` reads become plain; a
     ttt-prod test that expects one of them to refuse an extra field now expects the field dropped.
  3. The archive's union with no discriminator is its own item, in `repo-guards-0.1.43.md`.
- **Done when:** every ttt-core input above takes the strict copy, ttt-core is released and
  installed, the lockfiles name `@ttt-productions/media-schemas` 0.14.16 or later, and the tests
  pass.
