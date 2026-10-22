# Postmortem template

**Trigger** — any incident that reached users, lost or corrupted data, or required an emergency
change: a safety or legal-reporting incident, a payment or refund fault, a privacy breach, a failed
release, an outage. Write it while the incident is fresh; a postmortem is the closure artifact, not
optional paperwork.

**Where completed postmortems live** — the app's own `docs/postmortems/YYYY-MM-DD-<short-slug>.md`,
one file per incident, named for the day the incident STARTED. Nothing is ever deleted from that
folder; it is the one place in `docs/` that keeps history.

**Done when** — every heading below is filled in, the regression test exists and is merged, and the
alert (if one was missing) is actually configured. A postmortem with an unwritten test is not
finished.

Copy everything below this line into the new file.

---

# <Incident name> — YYYY-MM-DD

**Severity:** <what was at stake> · **Owner:** <the one person accountable for the follow-ups>

## Impact

Who or what was affected, how many, and for how long. Money moved, data exposed, content
mis-served, safety obligation missed — state it plainly. If the blast radius is still unknown, say
so and name the query that will answer it.

## Timeline

| Time (UTC) | Event |
|---|---|
| | First bad effect (may predate detection) |
| | Detected — and by what: alert, user report, manual check |
| | Cause stopped |
| | Repair complete |

## Root cause

The actual defect, in the code or the operation. Not "a bad deploy" — what made the deploy bad, and
why nothing caught it. Distinguish the cause from the trigger.

## Fix

What was changed to stop it, with the file paths or console actions. Separate the emergency stop
from the durable repair if they were different.

## Regression test

The test that now fails without the fix, by path. Required — a defect fix ships a test that
reproduces it (RULE-STD-ENG-007, RULE-STD-QUALITY-001). If the fix was operational rather than code,
say what mechanically prevents the repeat instead.

## Detection gap and the alert now configured

How this was detected versus how it should have been. If detection was a human noticing, name the
alert that now exists, where it is configured, and who it pages. If no alert was added, state why
detection is adequate without one.

## Prevention

The change that makes this class of failure impossible or loud — a guard test, a rule, a schema
constraint, a pipeline gate. A second sighting of the same defect class means killing the class
system-wide, not patching the instance again.

## Follow-ups

| Item | Owner | Where it is tracked |
|---|---|---|

Anything not done by the time the postmortem is written goes in this table with a real home
(`docs/work/`, a project's `docs/work/projects/<project>/PLAN.md`, or the owning design doc). "We
should eventually" with no home is not a follow-up.
