export function log(...args: unknown[]) {
    console.log("[media-processing]", ...args);
  }
  
  export function warn(...args: unknown[]) {
    console.warn("[media-processing]", ...args);
  }
  
  export function error(...args: unknown[]) {
    console.error("[media-processing]", ...args);
  }
  