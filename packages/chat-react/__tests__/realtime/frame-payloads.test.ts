import { describe, it, expect } from 'vitest';
import {
  ChatHistoryPayloadSchema,
  ChatReadAckPayloadSchema,
  ChatResumePayloadSchema,
  ChatSendPayloadSchema,
  CLIENT_KINDS,
} from '@ttt-productions/chat-schemas';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { createFakeClock, createMockSocketHarness } from './mock-socket.js';

// The Worker parses each of these frames with its chat-schemas payload schema. Every payload this
// client puts on the socket must parse with that schema unchanged — no field the Worker drops, none
// it lacks.
const SCHEMA_BY_FRAME = {
  [CLIENT_KINDS.SEND]: ChatSendPayloadSchema,
  [CLIENT_KINDS.READ_ACK]: ChatReadAckPayloadSchema,
  [CLIENT_KINDS.HISTORY]: ChatHistoryPayloadSchema,
  [CLIENT_KINDS.RESUME]: ChatResumePayloadSchema,
} as const;

describe('ChannelClient frames match the chat-schemas payloads the Worker parses', () => {
  it('sends resume, send, read-ack, and history payloads that parse unchanged', async () => {
    const harness = createMockSocketHarness();
    const client = new ChannelClient({
      endpoint: 'wss://chat.example',
      threadId: 'wp1:ch1',
      currentUserId: 'u-me',
      grantProvider: () => Promise.resolve('grant'),
      socketFactory: harness.factory,
      timers: createFakeClock(),
      reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('message', { message: { seq: 10, senderUid: 'u-a', clientMessageId: 'srv-10', text: 'ten', createdAt: 1010, epoch: 1 } });
    client.send({ clientMessageId: 'c-1', text: 'hello' });
    client.readAck(10, false);
    client.fetchOlder();

    const checked = sock.sent.filter((frame) => frame.type in SCHEMA_BY_FRAME);
    expect(checked.map((frame) => frame.type).sort()).toEqual(['history', 'read-ack', 'resume', 'send']);
    for (const frame of checked) {
      const schema = SCHEMA_BY_FRAME[frame.type as keyof typeof SCHEMA_BY_FRAME];
      expect(schema.parse(frame.payload), frame.type).toEqual(frame.payload);
    }
  });
});
