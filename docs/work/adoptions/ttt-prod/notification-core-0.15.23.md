# Adopt @ttt-productions/notification-core 0.15.23

**What:** A dead-letter replay's audit hook receives the state the replay replaced.
**Severity:** low
**Came from:** the Q-Sports 2.0 migration (4d Awards and notifications) package session

- **Package and version:** `@ttt-productions/notification-core` 0.15.23.
- **Release:** `./scripts/release-multiple.sh notification-core patch`.
- **What changed:** `DeliveryLedger.replay(deliveryId, { auditWrite })` calls
  `auditWrite(txn, replaced)`, where `replaced` (the new exported `ReplacedDelivery`) is the row's
  stored `attemptCount` and `deadLetteredAt` as the replay transaction read them. A hook that takes
  only the transaction keeps working.
- **What the app must change:** Install. RULE-STD-BACKEND-212 has a repair record the state it
  replaced: `adminReplayDeadLetter`'s owner-replay lane (`notificationDeliveries`) can now put
  `previous: { status: replaced.state, attemptCount: replaced.attemptCount, deadLetteredAt:
  replaced.deadLetteredAt }` in its `system.manualIntervention` payload, as Q-Sports does; the
  generic lanes can record the same from the row their transaction reads. That change is a ttt-prod
  item handed over separately.
- **Done when:** The lockfiles name 0.15.23 or later.
