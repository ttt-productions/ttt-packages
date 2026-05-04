# @ttt-productions/theme-core

Theme provider and CSS token contract for TTT Productions apps. Wraps next-themes with a required token validation system.

## Version
0.2.14

## Dependencies
Runtime: next-themes.
Peer: react, react-dom.

## Entry Points

- `@ttt-productions/theme-core` — server-safe token contract and breakpoint constants.
- `@ttt-productions/theme-core/react` — ThemeProvider React surface.
- `@ttt-productions/theme-core/styles.css` — Base theme tokens.
- `@ttt-productions/theme-core/components.css` — Shared component utility classes.

## What It Contains

### Server-safe entry point (`index.ts`)
- Required token definitions from `required-tokens.ts`
- Breakpoint constants from `breakpoints.ts`

### React entry point (`react/index.ts`)
- `ThemeProvider` — Wraps `next-themes` ThemeProvider with TTT-specific defaults. Handles light/dark/high-contrast mode switching.

### Required Tokens (`required-tokens.ts`)
Defines the CSS variable contract that consuming apps must implement. Ensures design consistency across apps while allowing brand-specific colors.

## How It Works
1. Consumer app imports theme-core's `styles.css` (base tokens) and `components.css` (shared component classes)
2. Consumer app provides its own `brand.css` that overrides the CSS variables with brand colors
3. All colors use `hsl(var(--token-name))` pattern
4. Both light and dark mode must be supported for all tokens

## CSS Architecture
- Semantic CSS classes over inline Tailwind utilities
- Centralized in `components.css` with project-specific prefixes (`q-` for Q-Sports)
- CSS variables use semantic names (e.g., `--q-success`, `--q-error-color`) not color-specific names
- TTT Productions brand: purple primary, teal secondary, green accent

## Files
```
src/
  index.ts
  breakpoints.ts
  required-tokens.ts
  react/
    index.ts
    theme-provider.tsx
  styles/
    base.css, components.css, contract.css, hooks.css, index.css, tokens.css
```
