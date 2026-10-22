import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROCESSORS = [
  'video/video-processor.ts',
  'audio/audio-processor.ts',
  'image/image-processor.ts',
];

describe('processor output keys', () => {
  it.each(PROCESSORS)('%s names no output key with a string literal', (file) => {
    const source = readFileSync(join(__dirname, '..', 'src', file), 'utf8');
    expect(source).not.toMatch(/\bkey:\s*["'`]/);
    expect(source).not.toMatch(/outputPathFor\([^,]+,\s*["'`]/);
  });
});
