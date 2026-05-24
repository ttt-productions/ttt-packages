import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '../src/react/components/button';

// ---------------------------------------------------------------------------
// Variant + size class contract (table-driven, no render)
//
// `buttonVariants` is the public contract: it maps (variant, size) → class
// string. Asserting on the resolved class string is the cheapest way to lock
// the contract without depending on render output or design-token internals.
// Each row picks one or two SIGNATURE classes for that variant/size — the
// ones a regression would most likely break. We don't snapshot the full
// class string because that's brittle to ordering/whitespace.
// ---------------------------------------------------------------------------

describe('buttonVariants — variant class contract', () => {
    const cases: Array<{
        variant: NonNullable<Parameters<typeof buttonVariants>[0]>['variant'];
        signatureClasses: string[];
    }> = [
        { variant: 'default', signatureClasses: ['bg-primary', 'text-primary-foreground'] },
        { variant: 'destructive', signatureClasses: ['bg-destructive', 'text-destructive-foreground'] },
        { variant: 'success', signatureClasses: ['bg-green-500', 'text-primary-foreground'] },
        { variant: 'outline', signatureClasses: ['border-2', 'border-border', 'bg-background'] },
        { variant: 'secondary', signatureClasses: ['bg-secondary', 'text-secondary-foreground'] },
        { variant: 'ghost', signatureClasses: ['hover:bg-accent', 'hover:text-accent-foreground'] },
        { variant: 'link', signatureClasses: ['text-primary', 'underline-offset-4'] },
        { variant: 'inverted', signatureClasses: ['bg-[hsl(var(--inverted-background))]'] },
    ];

    for (const { variant, signatureClasses } of cases) {
        it(`variant="${variant}" includes its signature classes`, () => {
            const classes = buttonVariants({ variant });
            for (const c of signatureClasses) {
                expect(classes).toContain(c);
            }
        });
    }
});

describe('buttonVariants — size class contract', () => {
    const cases: Array<{
        size: NonNullable<Parameters<typeof buttonVariants>[0]>['size'];
        signatureClasses: string[];
    }> = [
        { size: 'default', signatureClasses: ['h-10', 'px-4'] },
        { size: 'sm', signatureClasses: ['h-9', 'px-3'] },
        { size: 'lg', signatureClasses: ['h-11', 'px-8'] },
        { size: 'icon', signatureClasses: ['h-9', 'w-9'] },
    ];

    for (const { size, signatureClasses } of cases) {
        it(`size="${size}" includes its signature classes`, () => {
            const classes = buttonVariants({ size });
            for (const c of signatureClasses) {
                expect(classes).toContain(c);
            }
        });
    }
});

describe('buttonVariants — base styling applies regardless of variant/size', () => {
    it('always includes the base flex + focus-visible ring classes', () => {
        const classes = buttonVariants({});
        // These are part of the always-on base string in the cva call.
        expect(classes).toContain('inline-flex');
        expect(classes).toContain('focus-visible:ring-2');
        expect(classes).toContain('disabled:pointer-events-none');
        expect(classes).toContain('disabled:opacity-50');
    });

    it('default variant + default size are applied when no args given', () => {
        const classes = buttonVariants({});
        // default variant signature
        expect(classes).toContain('bg-primary');
        // default size signature
        expect(classes).toContain('h-10');
    });

    it('caller-provided className passes through', () => {
        const classes = buttonVariants({ className: 'my-extra-class' });
        expect(classes).toContain('my-extra-class');
    });
});

// ---------------------------------------------------------------------------
// Render-level behavior — anything not purely class-string driven
// ---------------------------------------------------------------------------

describe('<Button> — render contract', () => {
    it('renders the children passed in', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders a real <button> element by default (not a Slot wrapper)', () => {
        const { container } = render(<Button>Save</Button>);
        const node = container.firstChild as HTMLElement;
        expect(node.tagName).toBe('BUTTON');
    });

    it('applies the resolved buttonVariants class string to the rendered element', () => {
        const { container } = render(<Button variant="outline" size="lg">X</Button>);
        const node = container.firstChild as HTMLElement;
        const expected = buttonVariants({ variant: 'outline', size: 'lg' });
        // Every signature token in the expected string should appear on the element.
        for (const cls of ['border-2', 'border-border', 'h-11', 'px-8']) {
            expect(node).toHaveClass(cls);
            expect(expected).toContain(cls);
        }
    });

    it('caller className merges with variant classes on the rendered element', () => {
        render(<Button className="my-btn">Test</Button>);
        const btn = screen.getByRole('button');
        expect(btn).toHaveClass('my-btn');
        // And the variant class is still there.
        expect(btn).toHaveClass('bg-primary');
    });
});

describe('<Button> — disabled behavior', () => {
    it('forwards `disabled` to the DOM button', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('does not invoke onClick when disabled', () => {
        const onClick = vi.fn();
        render(
            <Button disabled onClick={onClick}>
                Disabled
            </Button>
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('invokes onClick when enabled', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Enabled</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

describe('<Button asChild> — Slot delegation', () => {
    it('renders the child element (not a wrapping button) when asChild is true', () => {
        render(
            <Button asChild>
                <a href="/path">Link Button</a>
            </Button>
        );
        // The rendered element is an <a>, not a <button>.
        expect(screen.getByRole('link')).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('applies variant classes to the asChild child element', () => {
        render(
            <Button asChild variant="outline" size="sm">
                <a href="/p">Link</a>
            </Button>
        );
        const link = screen.getByRole('link');
        expect(link).toHaveClass('border-2');
        expect(link).toHaveClass('h-9');
    });
});

describe('<Button> — ref forwarding', () => {
    it('attaches forwarded ref to the rendered <button> element', () => {
        const ref = React.createRef<HTMLButtonElement>();
        render(<Button ref={ref}>With ref</Button>);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.tagName).toBe('BUTTON');
    });
});

describe('<Button> — HTML attribute passthrough', () => {
    it('passes through `type`', () => {
        render(<Button type="submit">Submit</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('passes through `aria-label`', () => {
        render(<Button aria-label="Close dialog">X</Button>);
        // Querying by accessible name proves the attribute is wired correctly.
        expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    });

    it('passes through `data-*` attributes', () => {
        render(<Button data-testid="custom-button">Tagged</Button>);
        expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
});
