export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export const TOAST_EVENT = 'spanish-whisper-toast';

export interface ToastDetail {
  message: string;
  tone?: ToastTone;
}

declare global {
  interface WindowEventMap {
    'spanish-whisper-toast': CustomEvent<ToastDetail>;
  }
}

export function notify(message: string, tone: ToastTone = 'info'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { message, tone },
    })
  );
}
