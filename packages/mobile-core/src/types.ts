export type Insets = { top: number; right: number; bottom: number; left: number };

export type KeyboardState = {
  isOpen: boolean;
  height: number;
  source: 'visualViewport' | 'fallback';
};
