import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error' | 'notify';

export interface Toast {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
  avatarUrl?: string | null;
  avatarName?: string;
  onPress?: () => void;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number }) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    const item: Toast = { tone: 'info', duration: 3600, ...toast, id };
    // Keep at most three on screen; newest on top.
    set((state) => ({ toasts: [item, ...state.toasts].slice(0, 3) }));
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Shortcut usable outside React components. */
export const toast = {
  info: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'info' }),
  success: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'success' }),
  error: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'error', duration: 5000 }),
  show: (options: Parameters<ToastState['show']>[0]) => useToasts.getState().show(options),
};
