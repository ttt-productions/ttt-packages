export function requestOf(input: Parameters<typeof fetch>[0]): Request {
  if (input instanceof Request) return input;
  throw new Error('expected fetch to be called with a Request');
}
