# Adopt @ttt-productions/ttt-core 0.79.114

**What:** A media upload carries the agreement version the member ticked.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (follow-up batch 2, found during adoption)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.114.
- **Release:** `./scripts/release-multiple.sh ttt-core patch`.
- **What changed:** `EntryPublicationArgsSchema` (the `entry` mode of `AuditionMediaPublicationArgsSchema`) and `CommissionProposalMediaPublicationArgsSchema` require `agreementVersion`. The stored agreement version is one atom, `storedAgreementVersionSchema` (`./schemas`), used by the Proposal, the Entry, and both publication args.
- **What the app must change:** Install `@ttt-productions/ttt-core@latest` wherever it is declared. The audition entry and commission proposal processors put the version from the upload's target info into their publication args, and the adapters pass it to the core that stores it on the Entry and the Proposal.
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.114 or later, a media entry and a media proposal store the version the member ticked, and the gate is green.
