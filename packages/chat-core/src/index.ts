export * from "./types";

export * from "./hooks/useChatMessages";
export * from "./hooks/useChatThreadAccess";

export * from "./ui/ChatShell";
export * from "./ui/MessageList";
export * from "./ui/Composer";
export * from "./ui/MessageItemDefault";
export * from "./ui/menus";

// Templates removed in v0.3.0 — use ChatShell directly with render slots.
// CSS: import "@ttt-productions/chat-core/styles" in your app layout.
