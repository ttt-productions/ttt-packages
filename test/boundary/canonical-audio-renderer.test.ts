import { describe, expect, it } from 'vitest';
import { packageSource } from './workspace';

describe('boundary: canonical audio renderer', () => {
  it('allows a raw audio element only inside AudioViewer', () => {
    const allowed = 'packages/media-viewer/src/react/audio-viewer.tsx';
    const violations = packageSource(['code'])
      .filter((file) => file.path.endsWith('.tsx') && /<audio(?:\s|>)/i.test(file.code))
      .map((file) => file.path)
      .filter((file) => file !== allowed);

    expect(
      violations,
      `Raw <audio> elements bypass the canonical AudioViewer:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });
});
