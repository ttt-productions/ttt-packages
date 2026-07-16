import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

describe('boundary: release-multiple dependency order', () => {
  it('releases critical dependencies before their dependents', () => {
    const script = readFileSync(join(REPO_ROOT, 'scripts', 'release-multiple.sh'), 'utf8');
    const orderBlock = script.slice(
      script.indexOf('RELEASE_ORDER=('),
      script.indexOf('\n)', script.indexOf('RELEASE_ORDER=(')),
    );
    const position = (name: string) => orderBlock.indexOf(`\n  ${name}\n`);
    const before = (dependency: string, dependent: string) => {
      expect(position(dependency), `${dependency} missing from RELEASE_ORDER`).toBeGreaterThan(-1);
      expect(position(dependent), `${dependent} missing from RELEASE_ORDER`).toBeGreaterThan(-1);
      expect(position(dependency), `${dependency} must release before ${dependent}`).toBeLessThan(
        position(dependent),
      );
    };

    before('report-core', 'ttt-core');
    before('audit-core', 'ttt-core');
    before('notification-core', 'ttt-core');
    before('media-viewer', 'file-input');
    before('file-input', 'upload-ui');
    before('upload-ui', 'chat-react');
    before('chat-core', 'chat-react');
  });
});
