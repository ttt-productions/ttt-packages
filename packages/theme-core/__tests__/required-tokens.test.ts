import { describe, it, expect } from 'vitest';
import { REQUIRED_TOKENS } from '../src/required-tokens';

// These three tokens are the brand contract between `@ttt-productions/theme-core`
// and every consuming app. Apps that import this package must define them in
// their global stylesheet, or `ThemeProvider`'s dev-mode warner fires.
// Renaming or removing any of them is a breaking change.
describe('REQUIRED_TOKENS brand contract', () => {
    it('includes --brand-primary', () => {
        expect(REQUIRED_TOKENS).toContain('--brand-primary');
    });

    it('includes --brand-secondary', () => {
        expect(REQUIRED_TOKENS).toContain('--brand-secondary');
    });

    it('includes --brand-accent', () => {
        expect(REQUIRED_TOKENS).toContain('--brand-accent');
    });
});
