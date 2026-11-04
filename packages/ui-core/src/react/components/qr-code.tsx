'use client';

import { useMemo } from 'react';
import { encode } from 'uqr';

import { cn } from '../../lib/utils.js';

export interface QrCodeProps {
  value: string;
  label: string;
  className?: string;
}

// The four-module quiet zone phone cameras need to find the code.
const QR_QUIET_ZONE_MODULES = 4;

function qrModulePath(modules: readonly (readonly boolean[])[]): string {
  const squares: string[] = [];
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) squares.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return squares.join('');
}

// Dark modules on a light ground in every theme: a scanner may not read an inverted code.
function QrCode({ value, label, className }: QrCodeProps) {
  const qr = useMemo(() => encode(value, { border: QR_QUIET_ZONE_MODULES }), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className={cn('h-48 w-48', className)}
    >
      <rect width={qr.size} height={qr.size} className="fill-[hsl(var(--neutral-white))]" />
      <path d={qrModulePath(qr.data)} className="fill-[hsl(var(--neutral-black))]" />
    </svg>
  );
}

export { QrCode };
