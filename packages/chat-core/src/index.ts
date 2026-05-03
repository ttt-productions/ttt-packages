export * from "./types.js";
export * from "./constants.js";

export * from "./context/ChatNameResolverContext.js";

export * from "./hooks/useChatMessages.js";
export * from "./hooks/useChatThreadAccess.js";

export * from "./ui/ChatShell.js";
export * from "./ui/MessageList.js";
export * from "./ui/Composer.js";
export * from "./ui/MessageItemDefault.js";
export * from "./ui/menus.js";

// Templates removed in v0.3.0 — use ChatShell directly with render slots.
// CSS: import "@ttt-productions/chat-core/styles" in your app layout.
