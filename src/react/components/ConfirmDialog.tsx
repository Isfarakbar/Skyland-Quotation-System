import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', busy, onCancel, onConfirm }: { open: boolean; title: string; message: string; confirmLabel?: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog.Root open={open} onOpenChange={value => !value && onCancel()}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog dialog--small" aria-describedby="confirm-description">
    <div className="dialog__icon"><AlertTriangle/></div><Dialog.Title>{title}</Dialog.Title><Dialog.Description id="confirm-description">{message}</Dialog.Description>
    <div className="dialog__actions"><Button tone="secondary" onClick={onCancel}>Cancel</Button><Button tone="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</Button></div>
    <Dialog.Close className="dialog__close" aria-label="Close"><X/></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
