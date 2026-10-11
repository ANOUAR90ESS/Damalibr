import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const DEFAULT_DURATION_MS = 3500;
// Older toasts are dropped so a burst of actions never covers the screen.
const MAX_VISIBLE = 3;

interface ToastState {
  toasts: Toast[];
  /** Shows a toast that hides itself after `durationMs` (0 keeps it until dismissed). */
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => number;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message, tone = 'info', durationMs = DEFAULT_DURATION_MS) => {
    const id = nextId++;
    set(state => ({ toasts: [...state.toasts, { id, message, tone }].slice(-MAX_VISIBLE) }));
    if (durationMs > 0) {
      setTimeout(() => get().dismissToast(id), durationMs);
    }
    return id;
  },

  dismissToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));

/** Shortcut for callers outside React components. */
export const showToast = (message: string, tone?: ToastTone, durationMs?: number) =>
  useToastStore.getState().showToast(message, tone, durationMs);
