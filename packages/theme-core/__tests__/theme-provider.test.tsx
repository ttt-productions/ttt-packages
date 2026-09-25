import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useThemeStorageKey } from '../src/react/theme-provider';
import { REQUIRED_TOKENS } from '../src/required-tokens';
import { THEME_NAMES } from '../src/themes';

// `theme-provider.tsx` wraps `next-themes`. Mock it so the test does not
// depend on next-themes runtime behavior — only on the props theme-core hands it.
const nextThemes = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('next-themes', () => ({
    ThemeProvider: (props: { children: React.ReactNode }) => {
        nextThemes.props = props;
        return <>{props.children}</>;
    },
}));

function StorageKeyProbe() {
    return <span data-testid="storage-key">{String(useThemeStorageKey())}</span>;
}

describe('ThemeProvider theme set and storage key', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('hands next-themes the declared theme set', () => {
        render(<ThemeProvider>child</ThemeProvider>);
        expect(nextThemes.props?.themes).toEqual([...THEME_NAMES]);
    });

    it('publishes next-themes\' default storage key when the app passes none', () => {
        render(<ThemeProvider><StorageKeyProbe /></ThemeProvider>);
        expect(screen.getByTestId('storage-key')).toHaveTextContent('theme');
    });

    it('publishes and forwards the app\'s storage key', () => {
        render(<ThemeProvider storageKey="app-theme"><StorageKeyProbe /></ThemeProvider>);
        expect(screen.getByTestId('storage-key')).toHaveTextContent('app-theme');
        expect(nextThemes.props?.storageKey).toBe('app-theme');
    });

    it('publishes nothing outside a ThemeProvider', () => {
        render(<StorageKeyProbe />);
        expect(screen.getByTestId('storage-key')).toHaveTextContent('null');
    });
});

function setTokens(values: Partial<Record<(typeof REQUIRED_TOKENS)[number], string>>) {
    for (const token of REQUIRED_TOKENS) {
        const value = values[token];
        if (value === undefined) {
            document.documentElement.style.removeProperty(token);
        } else {
            document.documentElement.style.setProperty(token, value);
        }
    }
}

function clearTokens() {
    for (const token of REQUIRED_TOKENS) {
        document.documentElement.style.removeProperty(token);
    }
}

describe('ThemeProvider dev-mode token warner', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Default to development so the warner runs.
        vi.stubEnv('NODE_ENV', 'development');
        clearTokens();
    });

    afterEach(() => {
        warnSpy.mockRestore();
        vi.unstubAllEnvs();
        clearTokens();
    });

    it('warns when a required token has no value defined on :root', async () => {
        // Only --brand-primary is set; --brand-secondary and --brand-accent are missing.
        setTokens({ '--brand-primary': 'hsl(220 50% 50%)' });

        render(<ThemeProvider>child</ThemeProvider>);

        await waitFor(() => expect(warnSpy).toHaveBeenCalled());
        const message = String(warnSpy.mock.calls[0][0]);
        expect(message).toContain('--brand-secondary');
        expect(message).toContain('--brand-accent');
        // The token that IS defined should not appear in the Missing list.
        // (It may appear elsewhere in the message; what matters is it is not
        //  named in a "Missing:" line.)
        const missingSection = message.match(/Missing: ([^\n]+)/)?.[1] ?? '';
        expect(missingSection).not.toContain('--brand-primary');
    });

    it('warns when a required token is set to the loud fallback value 999 100% 50%', async () => {
        setTokens({
            '--brand-primary': '999 100% 50%',
            '--brand-secondary': 'hsl(180 50% 50%)',
            '--brand-accent': 'hsl(40 90% 60%)',
        });

        render(<ThemeProvider>child</ThemeProvider>);

        await waitFor(() => expect(warnSpy).toHaveBeenCalled());
        const message = String(warnSpy.mock.calls[0][0]);
        expect(message).toContain('--brand-primary');
        expect(message).toMatch(/loud|999 100% 50%/i);
    });

    it('does NOT warn when every required token has a non-fallback value', async () => {
        setTokens({
            '--brand-primary': 'hsl(220 50% 50%)',
            '--brand-secondary': 'hsl(180 50% 50%)',
            '--brand-accent': 'hsl(40 90% 60%)',
        });

        render(<ThemeProvider>child</ThemeProvider>);

        // Wait one tick to let the useEffect run; then assert no warn happened.
        await new Promise((r) => setTimeout(r, 0));
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does NOT warn when NODE_ENV is production, even if tokens are missing', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        // Everything missing; warner would normally fire.
        clearTokens();

        render(<ThemeProvider>child</ThemeProvider>);

        await new Promise((r) => setTimeout(r, 0));
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
