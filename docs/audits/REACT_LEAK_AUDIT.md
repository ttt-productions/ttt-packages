# React Leak Audit — Main-Entry React Safety

Audited 2026-05-03. Gold standard: `auth-core` — server-safe `.` export, React code isolated to `./react` subpath only.

---

## 1. Summary

| Package | Version | Has React code? | Main is server-safe? | `/react` subpath exists? | Action needed |
|---|---|---|---|---|---|
| auth-core | 0.3.2 | yes | yes | yes | none |
| chat-core | 0.4.9 | yes | no | no | full split |
| file-input | 0.2.3 | yes | no | no | full split |
| firebase-helpers | 0.2.19 | no | yes | no | none — no React code |
| media-contracts | 0.2.29 | no | yes | no | none — no React code |
| media-processing-core | 0.0.3 | no | yes | no | none — no React code |
| media-viewer | 0.2.11 | yes | no | no | full split |
| mobile-core | 0.2.9 | yes | no | no | full split |
| monitoring-core | 0.2.15 | no | yes | no | none — no React code |
| notification-core | 0.2.2 | yes | no | no | full split |
| query-core | 0.4.3 | yes | no | no | full split |
| report-core | 0.5.3 | yes | no | no | full split |
| theme-core | 0.2.13 | yes | no | no | full split |
| ttt-core | 0.2.13 | no | yes | no | none — no React code |
| ui-core | 0.2.27 | yes | no | no | full split |
| upload-core | 0.1.1 | yes | no | yes | clean up mixed re-export |

---

## 2. Violator Details

### chat-core

Offending lines in `src/index.ts` (lines 1–2 are server-safe; lines 4 and 6–13 violate rules 1, 2, and 4):

    4:  export * from "./context/ChatNameResolverContext.js";
    6:  export * from "./hooks/useChatMessages.js";
    7:  export * from "./hooks/useChatThreadAccess.js";
    9:  export * from "./ui/ChatShell.js";
    10: export * from "./ui/MessageList.js";
    11: export * from "./ui/Composer.js";
    12: export * from "./ui/MessageItemDefault.js";
    13: export * from "./ui/menus.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./styles": "./src/styles/chat.css"
    }

`src/react/` does not exist and needs to be created.

---

### file-input

Offending lines in `src/index.ts` (line 1 and line 10 are server-safe; lines 3–9 violate rules 1, 2, and 4):

    3:  export * from "./components/file-input.js";
    4:  export * from "./components/image-input.js";
    5:  export * from "./components/video-input.js";
    6:  export * from "./components/audio-input.js";
    7:  export * from "./components/media-input.js";
    8:  export * from "./components/photo-capture-modal.js";
    9:  export * from "./components/record-dialog.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }

`src/react/` does not exist and needs to be created.

---

### media-viewer

Offending lines in `src/index.ts` (lines 7–16 are `export type` only and are server-safe; lines 1–5 violate rules 1 and 2):

    1: export { MediaViewer, MediaPreview } from "./media-viewer.js";
    2: export { ImageViewer } from "./image-viewer.js";
    3: export { VideoViewer } from "./video-viewer.js";
    4: export { AudioViewer } from "./audio-viewer.js";
    5: export { MediaFallbackLink, shouldShowFallback, EmptyFallback, ErrorFallback } from "./fallback.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./styles": "./src/styles/media-viewer.css"
    }

`src/react/` does not exist and needs to be created.

---

### mobile-core

Offending lines in `src/index.ts` (lines 1–2 are server-safe; lines 4–5, 7–10, 12–13, 15, 17–18, 20–21 violate rules 1, 2, and 4):

    4:  export * from "./viewport/useVisualViewport.js";
    5:  export * from "./viewport/useViewportHeightVars.js";
    7:  export * from "./keyboard/useKeyboard.js";
    8:  export * from "./keyboard/useKeepFocusedInputVisible.js";
    9:  export * from "./keyboard/useInputNavigation.js";
    10: export * from "./keyboard/KeyboardAvoidingView.js";
    12: export * from "./safe-area/useSafeAreaInsets.js";
    13: export * from "./safe-area/SafeArea.js";
    15: export * from "./scroll/useScrollLock.js";
    17: export * from "./ios/useIosSafariFixes.js";
    18: export * from "./ios/useNoRubberBand.js";
    20: export * from "./pull-to-refresh/usePullToRefresh.js";
    21: export * from "./pull-to-refresh/PullToRefreshContainer.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }

`src/react/` does not exist and needs to be created.

---

### notification-core

Offending lines in `src/index.ts` (lines 1–23 are `export type` only and are server-safe; lines 26–32 and 35–40 violate rules 1, 2, and 4):

    26: export {
    27:   useActiveNotifications,
    28:   useUnreadCount,
    29:   useArchiveNotification,
    30:   useArchiveAllNotifications,
    31:   useNotificationHistory,
    32: } from './hooks/index.js';
    35: export {
    36:   NotificationList,
    37:   NotificationEmptyState,
    38:   NotificationHistoryList,
    39:   NotificationUnreadBadge,
    40: } from './components/index.js';

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./server": {
        "types": "./dist/server/index.d.ts",
        "default": "./dist/server/index.js"
      },
      "./styles": "./src/styles/notifications.css"
    }

`src/react/` does not exist and needs to be created.

---

### query-core

Offending lines in `src/index.ts` (lines 2–10 may be server-safe; lines 13 and 17–37 and 60–63 violate rules 1, 2, and 4):

    13: export { TTTQueryProvider } from './provider.js';
    17: export {
    18:   FirestoreProvider,
    19:   useFirestoreDb,
    20:   useFirestoreDoc,
    21:   useFirestoreCollection,
    22:   useFirestoreInfinite,
    23:   useFirestorePaginated,
    24:   useFirestoreSet,
    25:   useFirestoreUpdate,
    26:   useFirestoreDelete,
    27:   useFirestoreBatch,
    28:   flattenInfiniteData,
    29:   getInfiniteDataCount,
    30:   docWithId,
    31:   useBatchFirestoreDocs,
    32: } from './firestore/index.js';
    60: export {
    61:   useFirestoreSearch,
    62:   SEARCH_CONFIGS,
    63: } from './search/index.js';

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }

`src/react/` does not exist and needs to be created.

---

### report-core

Offending lines in `src/index.ts` (lines 4–38 are server-safe types and config; lines 43–46, 56–64, and 69–75 violate rules 1, 2, and 4):

    43: export {
    44:   ReportCoreProvider,
    45:   useReportCoreContext,
    46: } from './context/ReportCoreProvider.js';
    56: export { useReportSubmit } from './hooks/useReportSubmit.js';
    57: export { useCheckedOutTasks } from './hooks/useCheckedOutTasks.js';
    58: export { useCheckoutTask } from './hooks/useCheckoutTask.js';
    59: export { useCheckinTask } from './hooks/useCheckinTask.js';
    60: export { useReleaseTask } from './hooks/useReleaseTask.js';
    61: export { useWorkLater } from './hooks/useWorkLater.js';
    62: export { useTaskQueue } from './hooks/useTaskQueue.js';
    63: export { useIndividualReports } from './hooks/useIndividualReports.js';
    64: export { useCheckoutNextImportantTask } from './hooks/useCheckoutNextImportantTask.js';
    69: export { ReportButton, useReportButton } from './components/ReportButton.js';
    70: export { ReportDialog } from './components/ReportDialog.js';
    71: export { CheckedOutTaskList } from './components/CheckedOutTaskList.js';
    72: export { TaskQueueBrowser } from './components/TaskQueueBrowser.js';
    73: export { CountdownTimer } from './components/CountdownTimer.js';
    74: export { PriorityBadge } from './components/PriorityBadge.js';
    75: export { TaskActionBar } from './components/TaskActionBar.js';

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./server": {
        "types": "./dist/server/index.d.ts",
        "default": "./dist/server/index.js"
      },
      "./styles": "./src/styles/report.css"
    }

`src/react/` does not exist and needs to be created.

---

### theme-core

Offending lines in `src/index.ts` (lines 2–3 are likely server-safe constants; line 1 violates rules 1 and 2):

    1: export * from "./theme-provider.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./styles.css": "./dist/styles/index.css",
      "./components.css": "./dist/styles/components.css"
    }

`src/react/` does not exist and needs to be created.

---

### ui-core

Offending lines in `src/index.ts` (line 44 `./lib/utils.js` is server-safe; lines 2–35, 38, and 41 violate rules 1, 2, and 4):

    2:  export * from "./components/button.js";
    3:  export * from "./components/card.js";
    4:  export * from "./components/label.js";
    5:  export * from "./components/textarea.js";
    6:  export * from "./components/skeleton.js";
    7:  export * from "./components/dialog.js";
    8:  export * from "./components/popover.js";
    9:  export * from "./components/dropdown-menu.js";
    10: export * from "./components/menubar.js";
    11: export * from "./components/alert-dialog.js";
    12: export * from "./components/alert.js";
    13: export * from "./components/toast.js";
    14: export * from "./components/toaster.js";
    15: export * from "./hooks/use-toast.js";
    16: export * from "./components/input.js";
    17: export * from "./components/select.js";
    18: export * from "./components/tabs.js";
    19: export * from "./components/tooltip.js";
    20: export * from "./components/form.js";
    21: export * from "./components/checkbox.js";
    22: export * from "./components/switch.js";
    23: export * from "./components/badge.js";
    24: export * from "./components/avatar.js";
    25: export * from "./components/separator.js";
    26: export * from "./components/accordion.js";
    27: export * from "./components/radio-group.js";
    28: export * from "./components/progress.js";
    29: export * from "./components/slider.js";
    30: export * from "./components/date-picker.js";
    31: export * from "./components/scroll-area.js";
    32: export * from "./components/table.js";
    33: export * from "./components/sheet.js";
    34: export * from "./components/collapsible.js";
    35: export * from "./components/search-dropdown.js";
    38: export * from "./components/layout/screen-adaptive-view.js";
    41: export * from "./hooks/use-media-query.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js",
        "default": "./dist/index.js"
      },
      "./src/*": "./src/*"
    }

`src/react/` does not exist and needs to be created.

---

### upload-core

Offending lines in `src/index.ts` (lines 1–12 are server-safe; line 14 violates rule 4):

    14: export * from "./react/index.js";

Current `package.json` `exports` field:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./react": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react/index.js"
      }
    }

`src/react/` already exists; no directory creation needed.

---

## 3. Refactor Order Recommendation

Only packages requiring action are listed. Lower-level packages (fewer inter-package dependencies on other violators) appear first.

1. **upload-core** — `clean up mixed re-export`; sole inter-package dependency is `firebase-helpers` (compliant, no action)
2. **theme-core** — `full split`; no inter-package dependencies; external dependency only (`next-themes`)
3. **ui-core** — `full split`; no inter-package dependencies; all dependencies are external (`@radix-ui/*`)
4. **mobile-core** — `full split`; no inter-package dependencies at all
5. **query-core** — `full split`; no inter-package dependencies requiring action; external peer deps only (`@tanstack/react-query`, `firebase`)
6. **media-viewer** — `full split`; depends on `media-contracts` (compliant) and `ui-core` (complete step 3 first)
7. **file-input** — `full split`; depends on `ui-core` (complete step 3 first) and `media-contracts` (compliant)
8. **notification-core** — `full split`; depends on `query-core` (complete step 5 first) and `ui-core` (complete step 3 first)
9. **report-core** — `full split`; depends on `query-core` (complete step 5 first), `ui-core` (complete step 3 first), and `ttt-core` (compliant)
10. **chat-core** — `full split`; depends on `ui-core`, `mobile-core`, `file-input`, `upload-core`, and `media-viewer` (complete steps 1–7 first)
