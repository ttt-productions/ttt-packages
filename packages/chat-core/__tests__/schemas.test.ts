import { describe, it, expect } from 'vitest';
import {
  ChatAttachmentSchema,
  ReplyToSchema,
} from '../src/schemas/index.js';

describe('ChatAttachmentSchema', () => {
  const valid = {
    id: 'att_1',
    name: 'photo.jpg',
    type: 'image' as const,
    size: 12345,
    url: 'https://example.com/photo.jpg',
    storagePath: 'uploads/att_1/photo.jpg',
  };

  it('accepts a valid image attachment', () => {
    expect(() => ChatAttachmentSchema.parse(valid)).not.toThrow();
  });

  it('accepts video, audio, text types', () => {
    for (const type of ['video', 'audio', 'text'] as const) {
      expect(() => ChatAttachmentSchema.parse({ ...valid, type })).not.toThrow();
    }
  });

  it('rejects unknown type enum', () => {
    expect(() => ChatAttachmentSchema.parse({ ...valid, type: 'pdf' })).toThrow();
  });

  it('rejects empty id', () => {
    expect(() => ChatAttachmentSchema.parse({ ...valid, id: '' })).toThrow();
  });

  it('rejects empty storagePath', () => {
    expect(() => ChatAttachmentSchema.parse({ ...valid, storagePath: '' })).toThrow();
  });

  it('rejects extra unknown fields', () => {
    expect(() => ChatAttachmentSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });

  it('rejects missing size', () => {
    const { size, ...rest } = valid;
    expect(() => ChatAttachmentSchema.parse(rest)).toThrow();
  });
});

describe('ReplyToSchema', () => {
  const valid = {
    messageId: 'm_1',
    senderId: 'u_1',
    messagePreview: 'Hello there',
  };

  it('accepts valid reply', () => {
    expect(() => ReplyToSchema.parse(valid)).not.toThrow();
  });

  it('accepts empty messagePreview', () => {
    expect(() => ReplyToSchema.parse({ ...valid, messagePreview: '' })).not.toThrow();
  });

  it('rejects empty messageId', () => {
    expect(() => ReplyToSchema.parse({ ...valid, messageId: '' })).toThrow();
  });

  it('rejects empty senderId', () => {
    expect(() => ReplyToSchema.parse({ ...valid, senderId: '' })).toThrow();
  });

  it('rejects extra fields', () => {
    expect(() => ReplyToSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });
});
