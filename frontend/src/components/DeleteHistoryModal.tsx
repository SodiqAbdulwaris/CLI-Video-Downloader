import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from './ui/dialog';

interface DeleteHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle?: string;
  onConfirmDelete: () => void;
}

export function DeleteHistoryModal({
  open,
  onOpenChange,
  sessionTitle,
  onConfirmDelete,
}: DeleteHistoryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md w-full p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive shrink-0 mt-0.5">
              <AlertCircle className="size-6" />
            </div>

            <div className="flex flex-col gap-1">
              <DialogTitle className="text-xl">Delete history record?</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                This removes the session from your history log. Your downloaded files on disk will <strong className="text-foreground">NOT</strong> be deleted.
              </DialogDescription>
            </div>
          </div>

          {sessionTitle && (
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-xs font-semibold text-foreground line-clamp-2">
              "{sessionTitle}"
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onConfirmDelete();
              }}
              className="rounded-xl px-4 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Record</span>
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
