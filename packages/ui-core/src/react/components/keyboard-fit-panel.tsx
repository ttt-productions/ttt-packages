'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { useKeyboardViewportFit } from '@ttt-productions/mobile-core/react';

type KeyboardFitPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactElement;
};

// Rendered as a portal child, so it mounts only while its overlay is open and a closed one holds no
// keyboard or viewport listeners.
export const KeyboardFitPanel = React.forwardRef<HTMLDivElement, KeyboardFitPanelProps>(
  ({ style, ...props }, forwardedRef) => {
    const panel = React.useRef<HTMLDivElement | null>(null);
    const keyboardFit = useKeyboardViewportFit(panel);
    const ref = React.useCallback(
      (node: HTMLDivElement | null) => {
        panel.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );
    return <Slot ref={ref} style={keyboardFit ? { ...style, ...keyboardFit } : style} {...props} />;
  },
);
KeyboardFitPanel.displayName = 'KeyboardFitPanel';
