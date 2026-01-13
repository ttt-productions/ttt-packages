# TTT Packages

Shared packages for TTT Productions and Q-Sports projects.

## Packages

- `@ttt/ui-core` - Shared UI components (shadcn-based)

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Clean build artifacts
npm run clean

# Type check
npm run typecheck
```

## Publishing

Packages are automatically published to npm when you push a version tag:

```bash
# Update package version(s)
cd packages/ui-core
npm version patch  # or minor, major

# Commit and tag
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

## Usage in TTT Productions

```bash
npm install @ttt/ui-core
```

```tsx
import { Button } from '@ttt/ui-core';

export default function MyComponent() {
  return <Button>Click me</Button>;
}
```
