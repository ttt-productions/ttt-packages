'use client';

/**
 * Global upload activity tray.
 *
 * Renders a fixed bottom-left floating action button when there is any
 * active or non-cleared terminal upload. Opens a popover listing each
 * item with backend status. Terminal items (completed / failed / rejected)
 * get a Clear (×) button that calls the consumer-supplied clear mutation.
 *
 * Framework-agnostic via render props:
 *  - `renderViewAllLink` lets the consumer plug in their app's Link
 *    component (Next.js Link, React Router Link, anchor, etc.) routed at
 *    their canonical "view all uploads" destination.
 *  - `renderFooter` lets the consumer fully replace the footer slot.
 *  - Both omitted — footer is not rendered.
 */

import { useMemo, type ReactNode } from 'react';
import {
  fileOriginRowLabel,
  formatUploadTimestamp,
  formatFileSize,
  getFileTypeLabel,
} from '@ttt-productions/ttt-core';
import { Cloud, Loader2, CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  Separator,
} from '@ttt-productions/ui-core/react';
import { cn } from '@ttt-productions/ui-core';
import {
  isTerminalUpload,
  useUploadActivityState,
  type InFlightUpload,
} from './in-flight-uploads-provider.js';

interface RowMeta {
  statusLabel: string;
  errorDetail?: string;
  originLabel: string;
  fileTypeLabel: string | null;
  fileSizeLabel: string | null;
  timestampLabel: string;
  icon: ReactNode;
  iconClassName: string;
}

function getRowMeta<TFileOrigin extends string>(
  item: InFlightUpload<TFileOrigin>,
  nowMs: number,
): RowMeta {
  let statusLabel: string;
  let icon: ReactNode;
  let iconClassName: string;
  let errorDetail: string | undefined;

  switch (item.status) {
    case 'pending':
      statusLabel = 'Waiting to process…';
      icon = <Loader2 className="icon-sm animate-spin" />;
      iconClassName = 'text-muted-foreground';
      break;
    case 'processing':
      statusLabel = 'Processing…';
      icon = <Loader2 className="icon-sm animate-spin" />;
      iconClassName = 'text-primary';
      break;
    case 'completed':
      statusLabel = 'Completed';
      icon = <CheckCircle2 className="icon-sm" />;
      iconClassName = 'text-green-600 dark:text-green-500';
      break;
    case 'failed':
      statusLabel = 'Failed';
      errorDetail = item.errorMessage;
      icon = <AlertCircle className="icon-sm" />;
      iconClassName = 'text-destructive';
      break;
    case 'rejected':
      statusLabel = 'Rejected';
      errorDetail = item.errorMessage;
      icon = <XCircle className="icon-sm" />;
      iconClassName = 'text-destructive';
      break;
  }

  const originLabel =
    (fileOriginRowLabel as Record<string, string | undefined>)[item.fileOrigin] ?? item.fileOrigin;

  return {
    statusLabel,
    errorDetail,
    originLabel,
    fileTypeLabel: getFileTypeLabel(item.originalContentType),
    fileSizeLabel: formatFileSize(item.originalSize),
    timestampLabel: formatUploadTimestamp(item.createdAt, nowMs),
    icon,
    iconClassName,
  };
}

interface UploadActivityTrayRowProps<TFileOrigin extends string> {
  item: InFlightUpload<TFileOrigin>;
  nowMs: number;
  onClear: (() => void) | undefined;
  isClearPending: boolean;
}

function UploadActivityTrayRow<TFileOrigin extends string>({
  item,
  nowMs,
  onClear,
  isClearPending,
}: UploadActivityTrayRowProps<TFileOrigin>) {
  const meta = getRowMeta(item, nowMs);
  const subline = [meta.originLabel, meta.fileTypeLabel, meta.fileSizeLabel]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex items-start gap-3 p-3">
      <div className={cn('mt-0.5 shrink-0', meta.iconClassName)}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{meta.statusLabel}</p>
        <p className="text-xs text-muted-foreground truncate">{subline}</p>
        {meta.errorDetail && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{meta.errorDetail}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{meta.timestampLabel}</p>
      </div>
      {onClear && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onClear}
          disabled={isClearPending}
          aria-label={`Clear ${meta.statusLabel.toLowerCase()} upload`}
        >
          <X className="icon-sm" />
        </Button>
      )}
    </div>
  );
}

export interface ViewAllLinkRenderArgs {
  /** The href the consumer's link should navigate to (passed through verbatim). */
  href: string;
  /** Children for the link element (i.e. the label text + arrow). */
  children: ReactNode;
}

export interface UploadActivityTrayProps {
  /**
   * Mutation hook result from `useClearUploadActivity({ clearFn })`. The tray
   * uses `.mutate(item.id)`, `.isPending`, and `.variables`. The consumer
   * owns the underlying network call.
   */
  clearMutation: {
    mutate: (pendingMediaId: string) => void;
    isPending: boolean;
    variables: string | undefined;
  };
  /**
   * Optional view-all destination href. When omitted, no footer is rendered
   * unless `renderFooter` is also supplied.
   */
  viewAllHref?: string;
  /**
   * Render-prop for the view-all link. Receives the href and label children
   * the consumer should attach. Omit to drop the link.
   */
  renderViewAllLink?: (args: ViewAllLinkRenderArgs) => ReactNode;
  /**
   * Fully custom footer slot. Replaces the default footer entirely. If both
   * `renderFooter` and `viewAllHref + renderViewAllLink` are supplied,
   * `renderFooter` wins.
   */
  renderFooter?: () => ReactNode;
  /** Visible label for the view-all link. Default: "View all uploads →". */
  viewAllLabel?: ReactNode;
}

export function UploadActivityTray<TFileOrigin extends string = string>(
  props: UploadActivityTrayProps,
) {
  const {
    clearMutation,
    viewAllHref,
    renderViewAllLink,
    renderFooter,
    viewAllLabel = 'View all uploads →',
  } = props;
  const items = useUploadActivityState<TFileOrigin>();
  const nowMs = Date.now();

  const activeCount = useMemo(
    () =>
      items.filter((item) => item.status === 'pending' || item.status === 'processing').length,
    [items],
  );

  const footerContent: ReactNode = (() => {
    if (renderFooter) return renderFooter();
    if (viewAllHref && renderViewAllLink) {
      return (
        <div className="p-3">
          {renderViewAllLink({
            href: viewAllHref,
            children: (
              <span className="text-sm text-primary hover:underline">{viewAllLabel}</span>
            ),
          })}
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant={items.length === 0 ? 'ghost' : 'inverted'}
            className="relative h-14 w-14 rounded-full shadow-lg"
            aria-label={
              items.length === 0
                ? 'Upload activity (no recent uploads)'
                : activeCount > 0
                ? `Upload activity: ${activeCount} in progress`
                : `Upload activity: ${items.length} item${items.length === 1 ? '' : 's'}`
            }
          >
            {activeCount > 0 ? (
              <Loader2 className="icon-md animate-spin" />
            ) : (
              <Cloud className="icon-md" />
            )}
            {items.length > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center"
                aria-hidden="true"
              >
                {items.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="app-popover p-0 w-80">
          <div className="flex items-center justify-between p-3">
            <h2 className="text-sm font-semibold">Upload Activity</h2>
            <span className="text-xs text-muted-foreground">
              {items.length === 0
                ? 'No recent uploads'
                : activeCount > 0
                ? `${activeCount} in progress`
                : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <Separator />
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent uploads.
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id}>
                    <UploadActivityTrayRow
                      item={item}
                      nowMs={nowMs}
                      onClear={isTerminalUpload(item) ? () => clearMutation.mutate(item.id) : undefined}
                      isClearPending={clearMutation.isPending && clearMutation.variables === item.id}
                    />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
          {footerContent !== null && (
            <>
              <Separator />
              {footerContent}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
