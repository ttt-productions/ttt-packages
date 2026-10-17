// What an upload row shows besides its title: the file's size, its kind, and when it was accepted.
// The mechanics are shared; every word, the relative-time cutoff and the locale are the app's.

import { getSimplifiedMediaType } from "@ttt-productions/media-schemas";

/** A byte count as a short size: `850 B`, `24 KB`, `1.2 MB`, `3 GB`. `null` for no usable count. */
export function formatFileSize(bytes: number | undefined): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

/** The app's words for an upload row's time and file kind. */
export interface UploadDisplayCopy {
  /** Under a minute old. */
  justNow: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  /** Accepted on the previous calendar day, given the local clock time. */
  yesterdayAt: (time: string) => string;
  /** Accepted before yesterday, given the short local date and clock time. */
  dateAt: (date: string, time: string) => string;
  /** The file's kind, by its simplified media type; `other` for anything else. */
  fileType: { image: string; video: string; audio: string; other: string };
}

export interface UploadDisplayConfig {
  copy: UploadDisplayCopy;
  /** How long a row's time reads as relative before it reads as a clock time. */
  relativeTimeCutoffMs: number;
  /** Locale for the clock time and date; the runtime's own when omitted. */
  locale?: Intl.LocalesArgument;
}

export interface UploadDisplayFormatters {
  /**
   * An upload's accept time. Within the cutoff of now: just now, minutes ago, or hours ago. Older:
   * the clock time for today, yesterday and the clock time, or the short date and the clock time —
   * by local calendar day.
   */
  formatUploadTimestamp: (createdAtMs: number, nowMs: number) => string;
  /** The file's kind from its stored content type; `null` when it has none. */
  getFileTypeLabel: (contentType: string | undefined) => string | null;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function createUploadDisplayFormatters(config: UploadDisplayConfig): UploadDisplayFormatters {
  const { copy, relativeTimeCutoffMs, locale } = config;

  const formatUploadTimestamp = (createdAtMs: number, nowMs: number): string => {
    const diffMs = Math.max(0, nowMs - createdAtMs);
    if (diffMs < relativeTimeCutoffMs) {
      if (diffMs < 60_000) return copy.justNow;
      const minutes = Math.floor(diffMs / 60_000);
      if (minutes < 60) return copy.minutesAgo(minutes);
      return copy.hoursAgo(Math.floor(diffMs / 3_600_000));
    }

    const created = new Date(createdAtMs);
    const now = new Date(nowMs);
    const time = created.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    if (sameCalendarDay(created, now)) return time;

    // The previous calendar day, found by stepping the date rather than subtracting 24 hours: a
    // day that crosses a daylight-saving change is 23 or 25 hours long.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (sameCalendarDay(created, yesterday)) return copy.yesterdayAt(time);

    return copy.dateAt(created.toLocaleDateString(locale, { month: "short", day: "numeric" }), time);
  };

  const getFileTypeLabel = (contentType: string | undefined): string | null => {
    if (!contentType) return null;
    switch (getSimplifiedMediaType(contentType)) {
      case "image":
        return copy.fileType.image;
      case "video":
        return copy.fileType.video;
      case "audio":
        return copy.fileType.audio;
      default:
        return copy.fileType.other;
    }
  };

  return { formatUploadTimestamp, getFileTypeLabel };
}
