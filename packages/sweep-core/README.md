# @ttt-productions/sweep-core

Generic scheduled sweeps: the saved position of a sweep, the Auth full scan, and the walks over a
source with and without a retry list.

- `.` — pure: the saved-position schema (`SweepStateSchema`, with its cursor, retry-row and Auth-lap
  parts) and the three numbers.
- `./server` — the reader and writer of the saved position, the Auth full scan, the sources
  (Firestore by id, Firestore by a value and then id, a Storage listing), and the walks.

The app supplies its sweep names, the path of each saved position, its queries, and what a row step
does.
