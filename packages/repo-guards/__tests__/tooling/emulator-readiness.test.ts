import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { functionsEmulatorReady } from '../../src/node/tooling/emulator-readiness.js';

describe('functionsEmulatorReady', () => {
  let server: http.Server;
  let port: number;
  let answer: { status: number; body: string };

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      if (request.url !== '/backends') {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(answer.status, { 'content-type': 'application/json' }).end(answer.body);
    });
    port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
    });
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const backends = (...codebases: string[][]): string =>
    JSON.stringify({
      backends: codebases.map((names) => ({
        directory: 'functions/build/x',
        functionTriggers: names.map((name) => ({ name, id: `us-east1-${name}`, entryPoint: name })),
      })),
    });

  it('is ready once every expected function is loaded across the codebases', async () => {
    answer = { status: 200, body: backends(['a', 'b'], ['c']) };
    expect(await functionsEmulatorReady({ port, functions: ['a', 'b', 'c'] })()).toBeNull();
  });

  it('names what is missing while a codebase has not loaded its triggers', async () => {
    answer = { status: 200, body: backends(['a'], []) };
    expect(await functionsEmulatorReady({ port, functions: ['a', 'b', 'c'] })()).toBe(
      '2 of 3 functions not loaded (b, c)',
    );
  });

  it('shows the first five missing functions and marks the rest', async () => {
    answer = { status: 200, body: backends([]) };
    const functions = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];
    expect(await functionsEmulatorReady({ port, functions })()).toBe(
      '7 of 7 functions not loaded (f1, f2, f3, f4, f5, …)',
    );
  });

  it('is not ready while the emulator answers an error', async () => {
    answer = { status: 503, body: '{}' };
    expect(await functionsEmulatorReady({ port, functions: ['a'] })()).toBe(
      'GET /backends answered 503',
    );
  });

  it('is not ready when nothing answers on the port', async () => {
    const closed = http.createServer();
    const closedPort = await new Promise<number>((resolve) => {
      closed.listen(0, '127.0.0.1', () => resolve((closed.address() as AddressInfo).port));
    });
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    expect(await functionsEmulatorReady({ port: closedPort, functions: ['a'] })()).toBe(
      'GET /backends did not answer',
    );
  });
});
