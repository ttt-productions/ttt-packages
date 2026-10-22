import { describe, it, expect } from 'vitest';
import * as reactEntry from '../src/react/index.js';

describe('media-viewer react entry', () => {
  it('exports the router component under one name only', () => {
    expect(reactEntry.MediaPreview).toBeTypeOf('function');
    expect('MediaViewer' in reactEntry).toBe(false);
  });
});
