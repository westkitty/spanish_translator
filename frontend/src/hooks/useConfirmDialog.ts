import { useCallback, useState } from 'react';
import type { ConfirmTone } from '../components/ConfirmDialog';

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ActiveConfirmRequest extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

export function useConfirmDialog() {
  const [request, setRequest] = useState<ActiveConfirmRequest | null>(null);

  const confirm = useCallback((nextRequest: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...nextRequest, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    setRequest((current) => {
      current?.resolve(false);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setRequest((current) => {
      current?.resolve(true);
      return null;
    });
  }, []);

  return {
    request,
    confirm,
    handleCancel,
    handleConfirm,
  };
}
