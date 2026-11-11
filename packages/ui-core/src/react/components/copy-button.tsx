'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from './button.js';
import { toast, type ToasterToast } from '../hooks/use-toast.js';
import { useAsyncAction } from '../hooks/use-async-action.js';

export type CopyToast = Omit<ToasterToast, 'id'>;

export interface CopyButtonWording {
  title: string;
  copiedToast: CopyToast;
  failedToast: CopyToast;
}

export interface CopyButtonProps extends CopyButtonWording {
  value: string;
  className?: string;
}

const COPY_FRESH_MS = 2_000;

async function writeToClipboard(value: string): Promise<void> {
  // An insecure page or a browser that withholds the clipboard has no `navigator.clipboard` at all.
  if (!navigator.clipboard) throw new Error('This page cannot write to the clipboard.');
  await navigator.clipboard.writeText(value);
}

function CopyButton({ value, title, copiedToast, failedToast, className }: CopyButtonProps) {
  const [fresh, setFresh] = React.useState(false);
  const freshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(freshTimer.current), []);

  const copy = useAsyncAction(
    async () => {
      await writeToClipboard(value);
      clearTimeout(freshTimer.current);
      setFresh(true);
      freshTimer.current = setTimeout(() => setFresh(false), COPY_FRESH_MS);
      toast(copiedToast);
    },
    {
      onError: () => {
        clearTimeout(freshTimer.current);
        setFresh(false);
        toast(failedToast);
      },
    },
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={`Copy ${title}`}
      pending={copy.pending}
      onClick={() => void copy.run()}
    >
      {fresh ? (
        <Check className="icon-xs" aria-hidden="true" />
      ) : (
        <Copy className="icon-xs" aria-hidden="true" />
      )}
    </Button>
  );
}

export { CopyButton };
