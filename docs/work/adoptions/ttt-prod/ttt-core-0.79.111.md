# Adopt @ttt-productions/ttt-core 0.79.111

**What:** BREAKING: IP stewardship wording in every member agreement (versions bumped); new required Audition entry and Commission proposal agreements; the Guild invite notice moves into ttt-core.
**Severity:** high
**Came from:** the ttt-packages session for ttt-prod's IP stewardship protections

- **Package and version:** `@ttt-productions/ttt-core` 0.79.111.
- **Release:** `./scripts/release-multiple.sh ttt-core patch`.
- **What changed:**
  - Wording changed, version bumped:
    - `ARTISAN_CREATOR_AGREEMENTS_VERSION` 2: a new `ownershipAndStewardship` box right after `uploadRights`.
    - `WORK_REALM_FOUNDING_AGREEMENT_VERSION` 2.
    - `SQUARE_STREETZ_AGREEMENTS_VERSION` 2: the `ownership` box.
    - `HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION` 2.
    - `PUBLISH_ATTESTATIONS_VERSION` 2: `PUBLISH_STEWARDSHIP_ATTESTATION`.
    - `CRAFT_SKILL_STATEMENT_VERSION` 3: `original` and `mimicOnTtt`.
  - Added, with their version constants:
    - `AUDITION_ENTRY_AGREEMENT` / `AUDITION_ENTRY_AGREEMENT_VERSION`
    - `COMMISSION_PROPOSAL_AGREEMENT` / `COMMISSION_PROPOSAL_AGREEMENT_VERSION`
    - `GUILD_INVITE_BINDING_NOTICE_TITLE` / `GUILD_INVITE_BINDING_NOTICE_PARAGRAPHS`
  - Breaking, the required `agreementVersion` literal:
    - `AuditionEntryTargetInfoSchema`, `CreateAuditionEntryVariablesSchema`
    - `CommissionProposalTargetInfoSchema`, `ApplyToCommissionVariablesSchema`
    - `CreateCommissionProposalTextInputSchema`
  - Stored shapes:
    - `CommissionProposalSchema` requires `agreementVersion`.
    - `AuditionEntrySchema` carries an optional `agreementVersion`, which a curated creator option has none of.
- **What the app must change:**
  - Install `@ttt-productions/ttt-core@latest` wherever it is declared.
  - The Audition entry dialog shows the entry agreement as a required checkbox and sends `agreementVersion`. The upload adapter carries it into the entry target info, and the entry processor stores it on the Entry.
  - The Commission proposal form does the same for both the file and the text-only paths. The text-only callable and the proposal processor store it on the Proposal.
  - Delete the entry dialog's hardcoded caption.
  - The Guild invite notice renders from the new constants.
  - Fixtures, seeds, and tests use the bumped versions and the new box.
  - The full plan is ttt-prod's `docs/work/waiting-to-be-implemented/ip-stewardship-protections.md`.
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.111 or later, the work above is done, and the gate is green.
