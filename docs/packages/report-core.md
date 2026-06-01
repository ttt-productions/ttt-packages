# @ttt-productions/report-core

Generic reporting and admin-task queue package.

## Owns

- Generic report and report-group shapes
- Generic admin task, checkout, activity, status, and priority shapes
- Type-level generics for the consuming app's task-type union
- Report/admin task UI and server helpers

## Entry points

- `.` — broad barrel: types, config, constants (server-safe; kept as a
  compatibility surface).
- `./contracts` — pure, dependency-light surface: `AdminTask`, `Report`, report
  status/admin-task-type constants, and the pure Zod wire schemas. No React, no
  server, no Admin SDK reachable from it. **Pure consumers (`ttt-core`, Cloud
  Functions) should import from `./contracts`** instead of the broad root.
- `./react` — admin/report React UI.
- `./server` — server helpers.
- `./schemas` — wire-format Zod schemas.
- `./styles` — admin/report CSS.

## Boundary

TTT owns the concrete `AdminTaskType` union and any TTT-specific task routing or copy. `report-core` does not import `ttt-core`.
