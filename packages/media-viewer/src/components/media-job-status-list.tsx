"use client";

import type { MediaJobStatusPayload } from "@ttt-productions/media-contracts";
import { Badge, Card, Progress, cn } from "@ttt-productions/ui-core";
import { AlertCircle, CheckCircle2, Clock3, Loader2, UploadCloud, XCircle } from "lucide-react";

export interface MediaJobStatusListProps {
  items: MediaJobStatusPayload[];
  className?: string;

  /** default: 24 */
  recentHours?: number;

  /** default: true */
  showOnlyRecent?: boolean;

  /** default: 50 */
  maxItems?: number;
}

function getUpdatedAtMs(x: MediaJobStatusPayload): number {
  const v = x.updatedAt;
  if (!v) return Date.now();
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : Date.now();
}

function statusMeta(status: MediaJobStatusPayload["status"]) {
  switch (status) {
    case "uploading":
      return { label: "Uploading", icon: UploadCloud, badge: "secondary" as const };
    case "queued":
      return { label: "Queued", icon: Clock3, badge: "secondary" as const };
    case "processing":
      return { label: "AI Processing", icon: Loader2, badge: "secondary" as const };
    case "ready":
      return { label: "Ready", icon: CheckCircle2, badge: "default" as const };
    case "rejected":
      return { label: "Rejected", icon: XCircle, badge: "destructive" as const };
    case "failed":
      return { label: "Failed", icon: AlertCircle, badge: "destructive" as const };
    case "selecting":
      return { label: "Selecting", icon: Clock3, badge: "secondary" as const };
    default:
      return { label: String(status), icon: Clock3, badge: "secondary" as const };
  }
}

export function MediaJobStatusList(props: MediaJobStatusListProps) {
  const {
    items,
    className,
    recentHours = 24,
    showOnlyRecent = true,
    maxItems = 50,
  } = props;

  const now = Date.now();
  const cutoff = now - recentHours * 60 * 60 * 1000;

  const list = items
    .slice()
    .sort((a, b) => getUpdatedAtMs(b) - getUpdatedAtMs(a))
    .filter((x) => (showOnlyRecent ? getUpdatedAtMs(x) >= cutoff : true))
    .slice(0, maxItems);

  if (!list.length) return null;

  return (
    <Card className={cn("p-3 space-y-2", className)}>
      <div className="text-sm font-medium">Uploads</div>

      <div className="space-y-2">
        {list.map((it, idx) => {
          const meta = statusMeta(it.status);
          const Icon = meta.icon;

          const progress =
            it.status === "uploading"
              ? Math.max(0, Math.min(100, Math.round((it.progress ?? 0) * 100)))
              : it.status === "ready"
                ? 100
                : undefined;

          const updatedAt = new Date(getUpdatedAtMs(it)).toLocaleString();

          return (
            <div key={`${it.mediaDocId ?? "item"}-${idx}`} className="rounded-lg border p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("h-4 w-4", it.status === "processing" ? "animate-spin" : "")} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      {it.mediaDocId ? (
                        <span className="text-xs text-muted-foreground truncate">
                          {it.mediaDocId}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{updatedAt}</div>
                  </div>
                </div>

                {it.reasonCode ? (
                  <span className="text-xs text-muted-foreground">{it.reasonCode}</span>
                ) : null}
              </div>

              {typeof progress === "number" ? (
                <div className="mt-2 space-y-1">
                  <Progress value={progress} />
                  <div className="text-xs text-muted-foreground">{progress}%</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
