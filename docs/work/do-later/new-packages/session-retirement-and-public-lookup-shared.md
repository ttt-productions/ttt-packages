# Session retirement and the public lookup move into the packages

**What:** The session retirement owner and the public user lookup, which each app keeps its own copy of, move into shared packages; each app supplies only what is its own.
**Severity:** low
**Trigger:** DJ pulls it in when he has the time.

This is a write-up of the item as it is known now, not a finished design.

## As it is today (checked in the code)

- **Session retirement.** Each app has its own `src/lib/session-retirement.ts`, the one owner that
  retires a session's listeners, reads and query cache when the session ends. The two files do the
  same job and have drifted apart.
- **The public lookup.** Each app has its own `src/hooks/use-public-lookup.ts`, the read-once lookup
  of public user data (display names, badges, profile pictures) that pages share. The two files have
  drifted further apart than the session owner has.

## The move

Each mechanism goes into the package that owns its domain, and both apps' copies go. Each app
supplies only what is its own: its paths, its shapes, and its wording. Which package takes each one
is decided when this is pulled in.

## Done when

Neither app holds its own session retirement owner or its own public lookup, the packages' tests
prove what each app's tests prove today, and both apps' gates are green.
