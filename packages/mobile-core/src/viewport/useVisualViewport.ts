import { useEffect, useState } from "react";
import { hasVisualViewport, isBrowser } from "../env";

export function useVisualViewport() {
  const vv = isBrowser && hasVisualViewport ? window.visualViewport! : null;

  const [state, setState] = useState(() => ({
    width: vv?.width ?? 0,
    height: vv?.height ?? 0,
    scale: vv?.scale ?? 1,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
    pageTop: vv?.pageTop ?? 0,
    pageLeft: vv?.pageLeft ?? 0,
  }));

  useEffect(() => {
    if (!vv) return;

    const onChange = () =>
      setState({
        width: vv.width,
        height: vv.height,
        scale: vv.scale,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft,
        pageTop: vv.pageTop,
        pageLeft: vv.pageLeft,
      });

    onChange();
    vv.addEventListener("resize", onChange, { passive: true });
    vv.addEventListener("scroll", onChange, { passive: true });

    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, [vv]);

  return { visualViewport: vv, ...state };
}
