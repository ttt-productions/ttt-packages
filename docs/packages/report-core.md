# @ttt-productions/report-core

Generic reporting and admin-task queue package.

## Owns

- Generic report and report-group shapes
- Generic admin task, checkout, activity, status, and priority shapes
- Type-level generics for the consuming app's task-type union
- Report/admin task UI and server helpers

## Boundary

TTT owns the concrete `AdminTaskType` union and any TTT-specific task routing or copy. `report-core` does not import `ttt-core`.
