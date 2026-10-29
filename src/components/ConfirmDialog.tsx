'use client';

import { COPY } from './copy';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog';

/** Accessible yes/no question (delete, replace project, start over). */
export function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} className="shadow-lg">
        <DialogTitle className="text-base">{message}</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{COPY.cancel}</Button>
          <Button onClick={onConfirm}>{COPY.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
