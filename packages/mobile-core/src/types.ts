export type Insets = { top: number; right: number; bottom: number; left: number };

export type KeyboardState = {
  isOpen: boolean;
  height: number; // px
  // best-effort: iOS visualViewport + focus heuristics
  source: "visualViewport" | "fallback";
};
