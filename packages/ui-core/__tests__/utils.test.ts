import { describe, it, expect } from 'vitest';
import { cn } from '../src/lib/utils';

describe('cn', () => {
  it('joins two class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles a single class name', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('filters out undefined values', () => {
    expect(cn(undefined, 'foo', undefined)).toBe('foo');
  });

  it('filters out null values', () => {
    expect(cn(null, 'foo', null)).toBe('foo');
  });

  it('filters out false values', () => {
    expect(cn(false, 'foo')).toBe('foo');
  });

  it('handles conditional classes with object syntax', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('handles mixed conditional and string classes', () => {
    expect(cn('base', { active: true })).toBe('base active');
    expect(cn('base', { active: false })).toBe('base');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conflicting padding variants', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('merges conflicting text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('does not merge non-conflicting Tailwind classes', () => {
    const result = cn('flex', 'items-center', 'p-4');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('p-4');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles empty string', () => {
    expect(cn('', 'foo')).toBe('foo');
  });
});
