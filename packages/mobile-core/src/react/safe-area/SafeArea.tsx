import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
};

export function SafeArea({ top, bottom, left, right, style, ...rest }: Props) {
  return (
    <div
      {...rest}
      style={{
        ...style,
        paddingTop: top ? "env(safe-area-inset-top)" : (style as any)?.paddingTop,
        paddingBottom: bottom ? "env(safe-area-inset-bottom)" : (style as any)?.paddingBottom,
        paddingLeft: left ? "env(safe-area-inset-left)" : (style as any)?.paddingLeft,
        paddingRight: right ? "env(safe-area-inset-right)" : (style as any)?.paddingRight,
      }}
    />
  );
}
