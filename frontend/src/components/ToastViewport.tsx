import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { TOAST_EVENT, type ToastDetail, type ToastTone } from '../lib/toast';

interface ToastItem extends ToastDetail {
  id: number;
  tone: ToastTone;
}

const ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
} satisfies Record<ToastTone, typeof Info>;

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const handleToast = (event: WindowEventMap[typeof TOAST_EVENT]) => {
      const id = nextId.current++;
      const item: ToastItem = {
        id,
        message: event.detail.message,
        tone: event.detail.tone ?? 'info',
      };
      setItems((current) => [...current.slice(-2), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((toast) => toast.id !== id));
      }, 3600);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite" aria-atomic="true">
      {items.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <div key={item.id} className={`toast-card toast-card--${item.tone}`}>
            <Icon className="toast-card__icon" aria-hidden="true" />
            <span>{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}
