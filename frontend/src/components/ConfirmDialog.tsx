import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export type ConfirmTone = 'warning' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const labelledBy = 'confirm-dialog-title';

  return (
    <Modal open={open} onClose={onCancel} title={title} labelledBy={labelledBy}>
      <div className="confirm-dialog">
        <div className={`confirm-dialog__icon confirm-dialog__icon--${tone}`} aria-hidden="true">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="confirm-dialog__description">{description}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`confirm-dialog__confirm confirm-dialog__confirm--${tone}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
