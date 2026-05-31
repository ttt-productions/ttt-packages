# @ttt-productions/ui-core

Shared UI package for TTT Productions projects.

## Installation

```bash
npm install @ttt-productions/ui-core
```

## Import Guide

- `@ttt-productions/ui-core/react` for React hooks/components.
- `@ttt-productions/ui-core` for root utilities and shared types exported from the package root.

### React Components

```tsx
import { Button } from '@ttt-productions/ui-core/react';

export default function MyComponent() {
  return <Button>Click me</Button>;
}
```

### Root Utilities

```ts
import { cn, formatLargeNumber } from '@ttt-productions/ui-core';
```
