# Model tiers

The ONE place a model name appears in the docs of every product and of ttt-packages. Every doc,
plan, run type, and agent prompt names a tier, never a model; DJ changes a model by editing one cell
here. An entry in this table IS DJ naming the model for that tier. Tiers pin the model only; effort
follows the session unless a doc names one.

| Tier | Claude Code | ChatGPT / Codex |
|---|---|---|
| LOW | `sonnet` | not set — DJ fills before a Codex role uses it |
| MEDIUM | `opus` | not set — DJ fills before a Codex role uses it |
| HIGH | `opus` | GPT-6.1 Sol |
| TOP | `fable` | not set — DJ fills before a Codex role uses it |

- A role whose tier cell is "not set" for the session's host is a question for DJ, never a guess.
- Add a tier by adding a row; a doc may then name it.
- **An app overrides a cell only explicitly**, in its `CLAUDE.md`: "Overrides shared
  `model-tiers.md` § <tier> / <host>: <model>". An unstated difference is drift; a cell with no
  override is this table's.
- **Implementation agents** (every spawned fixer or builder) run on Claude Code `opus`, whatever tier
  their task names — except a **mechanical-only** implementer, which runs at LOW. A mechanical-only
  task applies a fixed set of written patterns to many files; its prompt names every pattern and
  makes anything outside them a stop that returns to the HIGH session that spawned it. That session
  and its reviewer stay HIGH.
- **The session runs on the model DJ picks when he starts it.** Every SPAWNED
  agent's tier is binding.
