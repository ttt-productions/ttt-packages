import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, warn, error } from '../src/utils/log';

describe('log utilities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log()', () => {
    it('calls console.log with "[media-processing]" prefix', () => {
      log('hello');
      expect(console.log).toHaveBeenCalledWith('[media-processing]', 'hello');
    });

    it('passes through additional arguments', () => {
      log('a', 'b', 123);
      expect(console.log).toHaveBeenCalledWith('[media-processing]', 'a', 'b', 123);
    });

    it('works with no arguments beyond prefix', () => {
      log();
      expect(console.log).toHaveBeenCalledWith('[media-processing]');
    });
  });

  describe('warn()', () => {
    it('calls console.warn with "[media-processing]" prefix', () => {
      warn('something risky');
      expect(console.warn).toHaveBeenCalledWith('[media-processing]', 'something risky');
    });

    it('passes through additional arguments', () => {
      warn('code', 42, { key: 'val' });
      expect(console.warn).toHaveBeenCalledWith('[media-processing]', 'code', 42, { key: 'val' });
    });
  });

  describe('error()', () => {
    it('calls console.error with "[media-processing]" prefix', () => {
      error('something failed');
      expect(console.error).toHaveBeenCalledWith('[media-processing]', 'something failed');
    });

    it('passes through additional arguments including Error objects', () => {
      const err = new Error('oops');
      error('caught error:', err);
      expect(console.error).toHaveBeenCalledWith('[media-processing]', 'caught error:', err);
    });
  });
});
