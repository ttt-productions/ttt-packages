# @ttt-productions/notification-core

Shared notification system for TTT Productions apps with Firestore integration.

## Installation

```bash
npm install @ttt-productions/notification-core
```

## Entrypoints

- `@ttt-productions/notification-core`: root-exported shared types.
- `@ttt-productions/notification-core/react`: React hooks/components.
- `@ttt-productions/notification-core/server`: backend helper utilities.

Backend/Functions code should avoid React subpaths such as `/react`.

## Features

- 🔔 Real-time notification updates via Firestore listeners
- 📊 Unread count tracking
- ✅ Mark as read functionality (single or batch)
- 🎯 Type-safe notification system with TypeScript
- 🔥 Built on `@ttt-productions/query-core` for optimal caching

## Usage

### Fetch Notifications

```tsx
import { useActiveNotifications } from '@ttt-productions/notification-core/react';

function NotificationList() {
  const { data: notifications, isLoading } = useActiveNotifications({
    config: TTT_NOTIFICATION_CONFIG,
    userId: currentUser.uid,
    category: 'user',
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {notifications?.map((notification) => (
        <li key={notification.id}>
          {notification.title} - {notification.message}
        </li>
      ))}
    </ul>
  );
}
```

### Unread Count Badge

```tsx
import { useUnreadCount } from '@ttt-productions/notification-core/react';

function NotificationBadge() {
  const { count, isLoading } = useUnreadCount({
    config: TTT_NOTIFICATION_CONFIG,
    userId: currentUser.uid,
    category: 'user',
  });

  if (isLoading) return null;
  return <span className="badge">{count}</span>;
}
```

### Archive Notification

```tsx
import { useArchiveNotification } from '@ttt-productions/notification-core/react';

function NotificationItem({ notification }) {
  const archiveNotification = useArchiveNotification({
    config: TTT_NOTIFICATION_CONFIG,
    userId: currentUser.uid,
    category: 'user',
  });

  const handleClick = () => {
    archiveNotification.mutate({
      notificationId: notification.id,
      archivalInfo: {
        archivedBy: currentUser.uid,
        archivedAt: Date.now(),
        device: 'web',
      },
    });
    // Navigate to target
  };

  return <div onClick={handleClick}>{notification.message}</div>;
}
```

### Archive All Active Notifications

```tsx
import {
  useActiveNotifications,
  useArchiveAllNotifications,
} from '@ttt-productions/notification-core/react';

function NotificationPanel() {
  const { data: notifications } = useActiveNotifications({
    config: TTT_NOTIFICATION_CONFIG,
    userId: currentUser.uid,
    category: 'user',
  });

  const archiveAll = useArchiveAllNotifications({
    config: TTT_NOTIFICATION_CONFIG,
    userId: currentUser.uid,
    category: 'user',
  });

  const handleMarkAllRead = () => {
    if ((notifications?.length ?? 0) > 0) {
      archiveAll.mutate({
        archivalInfo: {
          archivedBy: currentUser.uid,
          archivedAt: Date.now(),
          device: 'web',
        },
      });
    }
  };

  return <button onClick={handleMarkAllRead}>Mark All Read</button>;
}
```

## Data Structure

Notifications are stored in Firestore at:
```
userData/{userId}/metadata/notifications/{notificationId}
```

Each notification document has:
```typescript
interface Notification {
  id: string;
  type: string;                    // App-specific type
  title: string;
  message: string;
  targetPath: string;              // Navigation target
  targetParams?: Record<string, any>;
  isRead: boolean;
  createdAt: Timestamp;
  metadata?: Record<string, any>;  // Type-specific data
}
```

## Backend Integration

Apps should implement a callable Cloud Function to create notifications:

```typescript
// In your app's functions/src/notifications.ts
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const createNotification = onCall(async (request) => {
  const { userId, type, title, message, targetPath, targetParams, metadata } = request.data;
  
  await getFirestore()
    .collection('userData')
    .doc(userId)
    .collection('metadata')
    .doc('notifications')
    .collection('notifications')
    .add({
      type,
      title,
      message,
      targetPath,
      targetParams,
      isRead: false,
      createdAt: Timestamp.now(),
      metadata,
    });
});
```
