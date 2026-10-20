// The test time budgets. Every test runs on the runner's default limit; a test that does real heavy
// work — spawning a media encoder — names one of these instead of writing a number, and so do the
// hooks and library waits inside it. The suites run while the machine is in other use, so a budget
// is sized for a loaded machine, not an idle one. A test that is only waiting on a real timer moves
// to the fake clock instead of taking a budget.

/** Real heavy work: a few seconds on an idle machine, several times that under load. */
export const SLOW_TEST_TIMEOUT_MS = 15_000;
