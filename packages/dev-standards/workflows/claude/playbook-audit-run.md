---
name: claude-playbook-audit-run
description: Claude Code workflow (Find problems). Use when DJ wants one of the audit playbooks run against the current code.
---

# Playbook audit run

**AI:** Claude Code
**Jobs:** Find problems
**Use it when:** DJ wants one of the audit playbooks — a shared one in `<DEV_STANDARDS>/playbooks/` (with the app's additions) or one of the app's own in `docs/playbooks/` — run against the current code.
**Kickoff:** `Run the <APP_NAME> development workflow claude/playbook-audit-run: <playbook name>.`
**Reads from / writes to:** reads the named playbook and the code it audits; writes ONLY `docs/work/raw-findings/playbook-runs/<playbook-name>-run.md` — one report per run, newer than the playbook it reports on, deleted once its findings are worked.

## Method

1. The normal preflight, then the playbook in full — a shared playbook together with the app's
   additions at its same-named `docs/playbooks/` file — its README conventions
   (`<DEV_STANDARDS>/playbooks/README.md`), and every rule ID and design doc its steps cite.
2. Run the steps in order, inside the playbook's own audit boundary. A hosted source needs DJ's
   explicit authorization in this conversation; without it that step is `BLOCKED`.
3. Each step gets exactly one status — `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED` — with what the check
   actually printed. A skipped or blocked step is never counted as a pass.

## The report

Two kinds of finding, kept separate:

- **Playbook defects** — a step's Expected does not match what its check actually prints; the audit
  itself needs fixing.
- **Code findings** — real rule violations: evidence (path + line), the violated rule ID,
  impact/severity (Critical/High/Medium/Low), and a recommended correction.

End with the run verdict: `PASS`, `PASS WITH EXCEPTIONS`, or `FAIL`. No report edits a playbook, and
nothing is fixed during the run. Bring DJ the verdict and the report path; deciding the findings is
the `go-through-findings` workflow, or DJ directly.
