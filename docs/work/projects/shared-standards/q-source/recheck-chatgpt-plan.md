# Recheck a ChatGPT plan

**AI:** Claude Code
**Jobs:** Decide findings
**Use it when:** ChatGPT has written approved plans in `docs/work/waiting-to-be-implemented/` and DJ wants Claude to confirm, before anything is built, that each problem is real and each solution is the best one.
**Kickoff:** `Run the Q-Sports development workflow claude/recheck-chatgpt-plan: docs/work/waiting-to-be-implemented/. I authorize read-only access to C:\DjDev\ttt-master-app.`
**Reads from / writes to:** reads the plan items in `docs/work/waiting-to-be-implemented/` and what they link, Q-Sports, ttt-prod (on DJ's grant), and ttt-packages; writes ONLY those plan items.

## What it checks

The behavior each plan delivers is DJ's decision and is not re-opened. Every task in a plan gets two
answers, each from the source, never from ChatGPT's summary of it:

1. **Is the problem real?** The claim is traced through the actual code — the caller, the owner, the
   failure path, the consumers.
2. **Is the solution the best?** ttt-prod's version is opened first and named by file. The fix is
   ttt-prod's mechanism adapted (ARCH-006), extends the existing owner rather than adding a parallel
   one (ENG-003), follows the routed rules, and carries everything the change needs — the data
   migration for a persisted shape (ENG-011), the regression test (QUALITY-001), the docs (ENG-007),
   and a packages-first package change.

## What it does with each plan

- **Correct:** say so in the plan.
- **Incomplete or poorly written:** add what is missing, or rewrite the task better, in the plan
  item — keeping the behavior DJ approved.
- **Problem not real, or the right fix changes approved behavior:** bring it to DJ, one at a time, in
  plain language — what the plan says, what the source shows, the recommended change — and write his
  answer into the plan.

Nothing is built, code is never edited, and nothing is run: no tests, builds, scripts, emulators,
hosted access, or git.

## Startup

1. The normal preflight, plus the routed rules and `docs/design/*.md` for every plan's area.
2. Read each plan item in full, with everything it links.
3. Many plans: propose to DJ the number of agents and each one's plans, by area; nothing spawns
   without DJ's yes. Each agent is `HIGH` tier (`docs/model-tiers.md`), works only its own plans, and
   brings anything for DJ back to this session. Every spawned prompt carries its plans, DJ's ttt-prod
   grant in his words, its reading list as explicit read-before-acting paths — the routed rule files,
   the `docs/design/*.md`, and the ttt-prod files for its area (ENG-010) — the never-run rule above, a
   ban on spawning agents, and a stop clause: anything unexpected comes back to this session.

## Finishing

Every plan is marked correct, improved, or settled with DJ. A plan ready to build goes to
`claude/fan-out-implementation` (or `implement-an-approved-plan` for a small one); nothing here
starts it.
