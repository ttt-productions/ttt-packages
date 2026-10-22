# Codex instructions — shared base

Every repo's `AGENTS.md` is a pointer to this file and to its values. The placeholder values
(`<APP_NAME>`, `<DEV_STANDARDS>`, …) that this file and every shared doc use are declared once, in
the values block at the top of the repo's `CLAUDE.md`; read each placeholder as its value there.

Read this repository's `CLAUDE.md` before reviewing, planning, editing, or running commands, and
everything it names as required reading. Codex does not follow `CLAUDE.md`'s `@` import line, so it
also reads the shared base that line imports, `<DEV_STANDARDS>/claude/CLAUDE.base.md`, directly —
with it, `<DEV_STANDARDS>/development-preferences.md` (how an AI works with DJ), the shared rulebook
(`<DEV_STANDARDS>/rules/`), and the app's own rulebook (`<APP_RULES>`). All of it applies to Codex
exactly as written, except the parts addressed to a Claude Code session only; nothing is restated
here.

Codex-specific: operating the hosted E2E suite — run types, kickoff line, and the Codex launch
transport and supervision rules — is `<HOSTED_E2E_DOC>` (§ Commands → ChatGPT / Codex). A repo whose
`<HOSTED_E2E_DOC>` is none has no hosted suite.
