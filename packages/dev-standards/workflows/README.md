# Development workflows — the conversation types DJ starts

A development workflow is one named kind of conversation — a review sweep, an inline fix session, an
error investigation — written for ONE AI. Each AI has its own folder, and the two never share a
prompt: `claude/` holds Claude Code workflows, `chatgpt/` holds ChatGPT/Codex workflows. DJ uses
whichever AI is good at a job at the time; a job either AI can do gets its own version in each
folder, and the two need not match.

These workflows are shared by every product. A workflow only one app has lives in that app's own
`<APP_WORKFLOWS>`, in the same `claude/` / `chatgpt/` layout and format, and the menu offers it beside
the shared ones.

Hosted end-to-end runs are NOT development workflows. "I want to do a hosted end-to-end" goes to
`<HOSTED_E2E_DOC>`, which offers its own run types.

## The menu — two levels

Any ask about the workflows — "I want to do a workflow", "what are my workflow options", "show me
the workflow menu", "talk to me about the workflow list" — gets the menu. It has two levels, and the
folders are what fills the second one; this README never lists the docs.

**Level 1 — the jobs.** Shown with the one-liners below, nothing more:

- **Find problems** — a read-only sweep of the code, a walk through the live site as a user, or an
  audit playbook run. Produces raw findings, decides nothing.
- **Investigate an error** — a Sentry issue, failing test, or bug report traced to its root cause
  and written up. No code changes.
- **Decide findings** — go through raw findings with DJ one at a time and turn the approved ones
  into work.
- **Build or fix** — fix known errors inline, implement an approved plan, work a project step, or
  fan out a big build.
- **Recheck fixes** — each landed fix checked against the current source: fixed, partly fixed, or
  still open.
- **Hosted end-to-end** — run the deployed-dev suite. Not a workflow: it lives at
  `<HOSTED_E2E_DOC>`, and its own run types are its level 2.

**Level 2 — the ways to do that job.** When DJ picks a job (or names one straight away — "give me
the workflow options for fixing an error" skips level 1), the session reads both AI folders — here
and in `<APP_WORKFLOWS>` — and shows every doc whose **Jobs** line names that job: the doc's name,
its AI, and its **Use it when** line, this AI's own docs first and the other AI's labelled. DJ picks
one and gets its **Kickoff** line; a doc for the other AI is handed over as that kickoff line to
paste there, never run here. For hosted end-to-end, level 2 is the run types in `<HOSTED_E2E_DOC>`.

A doc can name one job or several. A doc whose **Jobs** line is `none` is a building block another
workflow calls and never appears on the menu.

- **Naming one directly** — "claude fix known errors inline" or the doc's kickoff line. The session
  matches it to the doc and starts.

Every session starts in `C:\DjDev`; the workspace router (`C:\DjDev\CLAUDE.md`) says which product is
in scope.

## Every workflow doc

Is written in skill format — frontmatter, then the body — though no workflow is switched on as a
Claude Code or Codex skill. The frontmatter carries `name` (the AI folder and the file name joined
by a hyphen, e.g. `claude-fix-known-errors-inline`) and `description` (what the workflow is and when
to use it). The body opens with the same header, then its own sections:

```
# <Name>

**AI:** Claude Code | ChatGPT/Codex
**Jobs:** <one or more level-1 jobs this doc is offered under, or `none`>
**Use it when:** <one line — what DJ wants done>
**Kickoff:** `<the line DJ pastes into a fresh conversation>`
**Reads from / writes to:** <the docs/work/ folders it reads and the only places it may write>
```

A kickoff line names the product as `<APP_NAME>`, so the line handed to DJ carries the product in
scope.

The session reads the doc in full before acting, on top of its normal startup reading
(`CLAUDE.md` / `AGENTS.md` and the rulebook preflight: the shared rulebook and the app's own). A
workflow's instructions are its procedure; the hard rules in `CLAUDE.md` / `AGENTS.md` and DJ's
in-conversation instructions still apply on top of it. Models are named by tier only
(`<DEV_STANDARDS>/model-tiers.md`).

Add a shared workflow by adding a doc to the right folder here; add an app-only one in
`<APP_WORKFLOWS>`. Delete one by deleting its doc.
