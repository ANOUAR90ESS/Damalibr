// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { storageService } from './supabase';

describe('storageService', () => {
  beforeEach(() => localStorage.clear());

  it('returns the default value when the key is missing', () => {
    expect(storageService.get('missing', 42)).toBe(42);
  });

  it('stores values as JSON under the lamina_ prefix', () => {
    storageService.set('coins', 100);
    expect(localStorage.getItem('lamina_coins')).toBe('100');
    expect(storageService.get('coins', 0)).toBe(100);
  });

  it('returns the default value when the stored JSON is corrupt', () => {
    localStorage.setItem('lamina_broken', '{not json');
    expect(storageService.get('broken', 'fallback')).toBe('fallback');
  });

  it('removes values', () => {
    storageService.set('temp', 'x');
    storageService.remove('temp');
    expect(localStorage.getItem('lamina_temp')).toBeNull();
  });
});
