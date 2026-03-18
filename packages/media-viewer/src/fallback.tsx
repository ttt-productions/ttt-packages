import type { FallbackMode } from "./types";

export function MediaFallbackLink(props: {
  url: string;
  filename?: string;
  className?: string;
  label?: string;
}) {
  const { url, filename, className, label } = props;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename || undefined}
      className={className}
    >
      {label ?? "Download"}
    </a>
  );
}

export function shouldShowFallback(mode: FallbackMode | undefined): boolean {
  return mode !== "none";
}

/** Empty state: no URL provided */
export function EmptyFallback(props: { isCircular?: boolean; className?: string }) {
  const { isCircular, className } = props;
  if (isCircular) {
    return (
      <div className={className ?? "mv-avatar-fallback"}>?</div>
    );
  }
  return (
    <div className={className ?? "mv-empty-fallback"}>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    </div>
  );
}

/** Error state: failed to load */
export function ErrorFallback(props: { isCircular?: boolean; className?: string }) {
  const { isCircular, className } = props;
  return (
    <div
      className={className ?? "mv-error-fallback"}
      style={isCircular ? { borderRadius: "50%" } : undefined}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <line x1="9" x2="15" y1="15" y2="9" />
      </svg>
    </div>
  );
}
