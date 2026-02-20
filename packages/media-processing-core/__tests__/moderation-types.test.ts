import { describe, it, expect, vi } from 'vitest';
import type { ModerationInput, ModerationOutput, ModerationAdapter } from '../src/moderation/types';

describe('ModerationInput interface', () => {
  it('can create a valid ModerationInput object', () => {
    const input: ModerationInput = {
      spec: { kind: 'image', outputs: [] } as any,
      kind: 'image',
      localPath: '/tmp/upload.jpg',
      mime: 'image/jpeg',
    };
    expect(input.kind).toBe('image');
    expect(input.localPath).toBe('/tmp/upload.jpg');
    expect(input.mime).toBe('image/jpeg');
  });

  it('mime is optional', () => {
    const input: ModerationInput = {
      spec: { kind: 'video', outputs: [] } as any,
      kind: 'video',
      localPath: '/tmp/video.mp4',
    };
    expect(input.mime).toBeUndefined();
  });

  it('accepts all valid kind values', () => {
    const kinds: ModerationInput['kind'][] = ['image', 'video', 'audio', 'generic'];
    for (const kind of kinds) {
      const input: ModerationInput = {
        spec: { kind, outputs: [] } as any,
        kind,
        localPath: `/tmp/${kind}`,
      };
      expect(input.kind).toBe(kind);
    }
  });
});

describe('ModerationOutput interface', () => {
  it('can create a valid ModerationOutput object', () => {
    const output: ModerationOutput = {
      spec: { kind: 'image', outputs: [] } as any,
      kind: 'image',
      outputs: [
        { key: 'thumbnail', localPath: '/tmp/thumb.jpg', mime: 'image/jpeg' },
      ],
    };
    expect(output.outputs).toHaveLength(1);
    expect(output.outputs[0].key).toBe('thumbnail');
  });

  it('outputs array can be empty', () => {
    const output: ModerationOutput = {
      spec: { kind: 'audio', outputs: [] } as any,
      kind: 'audio',
      outputs: [],
    };
    expect(output.outputs).toHaveLength(0);
  });
});

describe('ModerationAdapter interface', () => {
  it('can create a valid adapter with provider', () => {
    const adapter: ModerationAdapter = {
      provider: 'my-provider',
    };
    expect(adapter.provider).toBe('my-provider');
  });

  it('moderateInput is optional', () => {
    const adapter: ModerationAdapter = { provider: 'test' };
    expect(adapter.moderateInput).toBeUndefined();
  });

  it('moderateOutput is optional', () => {
    const adapter: ModerationAdapter = { provider: 'test' };
    expect(adapter.moderateOutput).toBeUndefined();
  });

  it('supports both moderateInput and moderateOutput', () => {
    const adapter: ModerationAdapter = {
      provider: 'full-adapter',
      moderateInput: vi.fn().mockResolvedValue(null),
      moderateOutput: vi.fn().mockResolvedValue(null),
    };
    expect(typeof adapter.moderateInput).toBe('function');
    expect(typeof adapter.moderateOutput).toBe('function');
  });

  it('moderateInput returns a promise', async () => {
    const adapter: ModerationAdapter = {
      provider: 'test',
      moderateInput: vi.fn().mockResolvedValue({ safe: true }),
    };
    const input: ModerationInput = {
      spec: { kind: 'image', outputs: [] } as any,
      kind: 'image',
      localPath: '/tmp/img.jpg',
    };
    const result = await adapter.moderateInput!(input);
    expect(result).toEqual({ safe: true });
  });
});
