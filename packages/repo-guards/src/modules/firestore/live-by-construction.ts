export interface LiveByConstruction {
  entry: string;
  export: string;
}

export const LIVE_BY_CONSTRUCTION: readonly LiveByConstruction[] = Object.freeze([
  { entry: '@ttt-productions/beacon-core/react', export: 'useBeaconObserver' },
  { entry: '@ttt-productions/chat-react', export: 'ChatShell' },
  { entry: '@ttt-productions/chat-react', export: 'useChatMessages' },
  { entry: '@ttt-productions/notification-core/react', export: 'NotificationList' },
  { entry: '@ttt-productions/notification-core/react', export: 'useActiveNotifications' },
  { entry: '@ttt-productions/query-core/react', export: 'createAppConfig' },
  { entry: '@ttt-productions/query-core/react', export: 'useFirestoreLiveInfinite' },
  { entry: '@ttt-productions/report-core/react', export: 'useCheckedOutTasks' },
  { entry: '@ttt-productions/upload-ui/react/tray', export: 'InFlightUploadsProvider' },
]);
