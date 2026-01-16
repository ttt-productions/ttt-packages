export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
export const isIOS = isBrowser && /iP(ad|hone|od)/.test(navigator.userAgent);
export const isSafari = isBrowser && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const hasVisualViewport = isBrowser && !!window.visualViewport;
