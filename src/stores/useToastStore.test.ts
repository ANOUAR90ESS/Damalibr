import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore, showToast } from './useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast and hides it after its duration', () => {
    showToast('Guardado', 'success', 1000);
    expect(useToastStore.getState().toasts).toMatchObject([{ message: 'Guardado', tone: 'success' }]);

    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('keeps a toast with duration 0 until it is dismissed', () => {
    const id = showToast('Sin conexión', 'error', 0);
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('keeps only the three most recent toasts', () => {
    ['a', 'b', 'c', 'd'].forEach(m => showToast(m));
    expect(useToastStore.getState().toasts.map(t => t.message)).toEqual(['b', 'c', 'd']);
  });
});
