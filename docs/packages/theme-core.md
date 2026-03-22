# @ttt-productions/theme-core

Theme provider and CSS token contract for TTT Productions apps. Wraps next-themes with a required token validation system.

## Version
0.2.10

## Dependencies
Runtime: next-themes.
Peer: react, react-dom.

## What It Contains

### ThemeProvider (`theme-provider.tsx`)
Wraps `next-themes` ThemeProvider with TTT-specific defaults. Handles light/dark/high-contrast mode switching.

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
  theme-provider.tsx
  required-tokens.ts
```
