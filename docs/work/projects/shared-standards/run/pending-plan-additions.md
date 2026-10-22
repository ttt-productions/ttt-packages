# Plan additions DJ handed in during the run

# Addition 1 — automated accessibility checks

Decided: folded into this run — PLAN.md groups 1N and 3U and the Phase 4 Q-Sports parity step.

---

# Addition 2 — local snapshot-backup script

Decided: NOT part of this run. When the run ends, offer DJ a separate session started from his
prompt as written. It lives in `C:\DjDev` or its own private repo, never ttt-packages (public).

Raised in the same conversation as the accessibility checks above. Not a command: content to talk
through with DJ and place.

## The content

Goal: a backup of what is on disk right now across the three repos (ttt-master-app, q-sports-league,
ttt-packages) — "give me back my folders as they were", not git history. Run every couple of weeks or
whenever DJ wants. DJ authorizes that tool to read all three repos.

- One command makes a dated zip (`djdev-backup-<date>.zip`) with the three repos as top-level
  folders — or one zip per repo, whatever fits Google Drive (DJ uploads it himself).
- Include everything on disk, committed or not, including each repo's `.git`.
- Exclude rebuildable output: node_modules, .next, dist, build, functions/lib, .firebase, emulator
  data, test/playwright output, browser profiles, logs, .tsbuildinfo, old zips.
- Exclude secrets, never put a secret value in the zip: .env / .env.* (keep .env.example and other
  templates), service-account or credential JSON, private keys, tokens.
- Instead, write `SECRETS-TO-RECREATE.md` into the zip: per skipped file, its repo-relative path; for
  env-style files the variable NAMES only (`NAME=`); for JSON/key files what kind it is and where to
  get it again; for unknown formats path and size only. Never any contents.
- `RESTORE.md` in the zip: unzip → npm install in each repo → recreate secrets from the list → build.
- Before writing the script: scan all three repos and show DJ the secret files found (paths +
  variable names only) to confirm the exclusion list.
- The script only reads the repos — never modifies, deletes, or commits. At the end it prints the
  zip path and size and how many secret files were listed.
- After it is built: verify the zip holds no secret values (grep the extracted zip for known values
  and key patterns) and show DJ the result.
