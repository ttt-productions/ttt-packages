# @ttt-productions/notification-core

Shared notification system for TTT Productions apps with Firestore integration.

## Installation

```bash
npm install @ttt-productions/notification-core
```

## Features

- 🔔 Real-time notification updates via Firestore listeners
- 📊 Unread count tracking
- ✅ Mark as read functionality (single or batch)
- 🎯 Type-safe notification system with TypeScript
- 🔥 Built on `@ttt-productions/query-core` for optimal caching

## Usage

### Fetch Notifications

```tsx
import { useNotifications } from '@ttt-productions/notification-core';

function NotificationList() {
  const { data: notifications, isLoading } = useNotifications({
    userId: currentUser.uid,
    subscribe: true, // Real-time updates
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
import { useUnreadCount } from '@ttt-productions/notification-core';

function NotificationBadge() {
  const { data: unreadCount } = useUnreadCount({
    userId: currentUser.uid,
    subscribe: true,
  });

  return <span className="badge">{unreadCount}</span>;
}
```

### Mark as Read

```tsx
import { useMarkAsRead } from '@ttt-productions/notification-core';

function NotificationItem({ notification }) {
  const markAsRead = useMarkAsRead({ userId: currentUser.uid });

  const handleClick = () => {
    markAsRead.mutate({ notificationId: notification.id });
    // Navigate to target
  };

  return <div onClick={handleClick}>{notification.message}</div>;
}
```

### Mark All as Read

```tsx
import { useMarkAllAsRead, useNotifications } from '@ttt-productions/notification-core';

function NotificationPanel() {
  const { data: notifications } = useNotifications({
    userId: currentUser.uid,
    unreadOnly: true,
  });

  const markAllAsRead = useMarkAllAsRead({ userId: currentUser.uid });

  const handleMarkAllRead = () => {
    const unreadIds = notifications
      ?.filter((n) => !n.isRead)
      .map((n) => n.id) ?? [];
    
    if (unreadIds.length > 0) {
      markAllAsRead.mutate({ notificationIds: unreadIds });
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
