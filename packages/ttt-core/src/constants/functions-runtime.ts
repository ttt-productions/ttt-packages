// Cloud Run counts the wait for a cold instance inside this timeout, so it stays above the client's
// callable deadline.
export const FUNCTIONS_REQUEST_TIMEOUT_SECONDS = 240;
