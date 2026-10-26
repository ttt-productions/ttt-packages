export type CallableAnswer =
  { data: unknown } | { error: { status: string; message: string; httpStatus: number } } | 'hang';

export interface CallableRequest {
  url: string;
  data: unknown;
  appCheckToken: string | null;
}

function bodyData(body: RequestInit['body']): unknown {
  if (typeof body !== 'string') return undefined;
  const parsed: unknown = JSON.parse(body);
  return typeof parsed === 'object' && parsed !== null && 'data' in parsed
    ? parsed.data
    : undefined;
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

export function callableServer() {
  const requests: CallableRequest[] = [];
  const answers: CallableAnswer[] = [];

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({
      url,
      data: bodyData(init?.body),
      appCheckToken: headerOf(init, 'X-Firebase-AppCheck'),
    });
    const answer = answers.shift() ?? { data: { ok: true } };
    if (answer === 'hang') return new Promise<Response>(() => {});
    if ('error' in answer)
      return Response.json(
        { error: { status: answer.error.status, message: answer.error.message } },
        { status: answer.error.httpStatus },
      );
    return Response.json({ result: answer.data });
  };

  return {
    fetch,
    requests,
    answer(...queued: CallableAnswer[]) {
      answers.push(...queued);
    },
    reset() {
      requests.length = 0;
      answers.length = 0;
    },
  };
}
