import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encode } from 'uqr';
import { QrCode } from '../src/react/components/qr-code.js';

function darkModules(value: string): number {
  return encode(value, { border: 4 })
    .data.flat()
    .filter((dark) => dark).length;
}

describe('QrCode', () => {
  it('is an image named by its label', () => {
    render(<QrCode value="https://example.test/v/AbC234" label="QR code for the invite" />);
    expect(screen.getByRole('img', { name: 'QR code for the invite' })).toBeInTheDocument();
  });

  it('draws one square per dark module of the encoded value, inside a four-module quiet zone', () => {
    const value = 'https://example.test/v/AbC234';
    const { container } = render(<QrCode value={value} label="QR" />);
    const svg = container.querySelector('svg')!;
    const size = encode(value, { border: 4 }).size;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${size} ${size}`);
    const path = container.querySelector('path')!.getAttribute('d')!;
    expect(path.match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(darkModules(value));
  });

  it('draws dark modules on a light ground whatever the theme', () => {
    const { container } = render(<QrCode value="x" label="QR" />);
    expect(container.querySelector('rect')).toHaveClass('fill-[hsl(var(--neutral-white))]');
    expect(container.querySelector('path')).toHaveClass('fill-[hsl(var(--neutral-black))]');
  });

  it('draws a different code for a different value', () => {
    const { container, rerender } = render(<QrCode value="first" label="QR" />);
    const first = container.querySelector('path')!.getAttribute('d');
    rerender(<QrCode value="second" label="QR" />);
    expect(container.querySelector('path')!.getAttribute('d')).not.toBe(first);
  });
});
