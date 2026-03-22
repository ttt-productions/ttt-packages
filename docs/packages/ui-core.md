# @ttt-productions/ui-core

Shared UI component library built on shadcn/ui + Radix UI primitives. Provides the base component set used by both TTT Productions and Q-Sports.

## Version
0.2.22

## Dependencies
Runtime: Radix UI primitives (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, menubar, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, tooltip), class-variance-authority, clsx, lucide-react, tailwind-merge.
Peer: react, react-dom, react-hook-form, @hookform/resolvers.

## What It Contains

### Components (shadcn/ui based)
Accordion, AlertDialog, Alert, Avatar, Badge, Button, Card, Checkbox, Collapsible, DatePicker, Dialog, DropdownMenu, Form (react-hook-form integration), Input, Label, Menubar, Popover, Progress, RadioGroup, ScrollArea, SearchDropdown, Select, Separator, Sheet, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, Toaster, Tooltip.

### Layout Components
- `ScreenAdaptiveView` — Responsive layout wrapper

### Hooks
- `useToast` — Toast notification management
- `useMediaQuery` — Responsive breakpoint detection

### Utilities
- `cn()` — Tailwind class merging utility (clsx + tailwind-merge)

## Key Design Decisions
- Components are unstyled shells that consume CSS variables from theme-core.
- All components use `cn()` for class merging, allowing consumer overrides.
- Form component integrates react-hook-form with Radix UI form elements.

## Files
```
src/
  index.ts
  lib/utils.ts                        — cn() utility
  hooks/use-toast.tsx, use-media-query.tsx
  components/
    button.tsx, card.tsx, dialog.tsx, ... (30+ component files)
    layout/screen-adaptive-view.tsx
```
