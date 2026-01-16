export async function validateMediaDuration(file: File, maxDurationSec: number): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
      el.preload = "metadata";
  
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        resolve(el.duration <= maxDurationSec);
      };
  
      el.onerror = () => {
        // Fail open on client (backend can enforce again).
        try {
          URL.revokeObjectURL(el.src);
        } catch {}
        resolve(true);
      };
  
      el.src = URL.createObjectURL(file);
    });
  }
  