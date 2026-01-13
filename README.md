# TTT Packages

Shared packages for TTT Productions and Q-Sports applications.

## 📦 Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@ttt/ui-core](./packages/ui-core) | - | Shared UI components (shadcn/ui) |
| @ttt/auth-core | - | Authentication system with custom claims |
| @ttt/theme-core | - | Theme provider and CSS tokens |
| @ttt/firebase-helpers | - | Firestore and Storage utilities |
| @ttt/mobile-core | - | Mobile optimizations (iOS keyboard, viewport) |
| @ttt/monitoring-core | - | Sentry error tracking wrapper |
| @ttt/chat-core | - | Chat system with React Query |

## 🚀 Installation
```bash
npm install @ttt/ui-core
npm install @ttt/auth-core
npm install @ttt/theme-core
```

## 📖 Usage
```typescript
import { Button, Dialog, Input } from '@ttt/ui-core';
import { useAuth } from '@ttt/auth-core';
import { ThemeProvider } from '@ttt/theme-core';

function App() {
  const { user } = useAuth();
  
  return (
    <ThemeProvider>
      <Button>Click me</Button>
    </ThemeProvider>
  );
}
```

## 🛠️ Development
```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Type check
npm run typecheck
```

## 📝 Publishing

Packages are automatically published to npm when tags are pushed:
```bash
# Bump version and publish
cd packages/ui-core
npm version patch  # or minor, major
git push --tags
```

## 📄 License

MIT © TTT Productions