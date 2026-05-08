# @ttt-productions/ui-core

Shared UI component library built on shadcn/ui + Radix UI primitives. Provides the base component set used by both TTT Productions and Q-Sports.

## Version
0.2.28

## Dependencies
Runtime: Radix UI primitives (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, menubar, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, tooltip), class-variance-authority, clsx, lucide-react, tailwind-merge.
Peer: react, react-dom, react-hook-form, @hookform/resolvers.

## Entry Points

- `@ttt-productions/ui-core` — server-safe utilities only.
- `@ttt-productions/ui-core/react` — React components and hooks.

The package's `files` field still publishes the `src/` directory alongside `dist/`. This is intentional: it supports a dev-mode webpack alias in ttt-prod (`next.config.ts`) that redirects `@ttt-productions/ui-core` to source for hot-reload. The alias works against the on-disk path, not the `exports` field, so the boundary is now enforced for real package consumers (`import` statements) without breaking dev experience.

## What It Contains

### Server-safe entry point (`index.ts`)
- `cn()` — Tailwind class merging utility (clsx + tailwind-merge)

### React entry point (`react/index.ts`)
Components and hooks:
- Accordion, AlertDialog, Alert, Avatar, Badge, Button, Card, Checkbox, Collapsible, DatePicker, Dialog, DropdownMenu, Form, Input, Label, Menubar, Popover, Progress, RadioGroup, ScrollArea, SearchDropdown, Select, Separator, Sheet, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, Toaster, Tooltip.
- `ScreenAdaptiveView` — Responsive layout wrapper.
- `useToast` — Toast notification management.
- `useMediaQuery` — Responsive breakpoint detection.

## Key Design Decisions
- Components are unstyled shells that consume CSS variables from theme-core.
- All components use `cn()` for class merging, allowing consumer overrides.
- Form component integrates react-hook-form with Radix UI form elements.
- React components and hooks live on `/react`; `cn()` stays on main so non-React utilities can import it without pulling React.

## Files
```
src/
  index.ts
  lib/
    utils.ts                        — cn() utility
  react/
    index.ts
    hooks/use-toast.tsx, use-media-query.tsx
    components/
      button.tsx, card.tsx, dialog.tsx, ... (30+ component files)
      layout/screen-adaptive-view.tsx
```
