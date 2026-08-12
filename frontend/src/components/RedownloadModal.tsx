import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from './ui/dialog';
import type { HistorySession } from '../types/history';

interface RedownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: HistorySession | null;
  onConfirmRedownload: (session: HistorySession) => void;
}

export function RedownloadModal({
  open,
  onOpenChange,
  session,
  onConfirmRedownload,
}: RedownloadModalProps) {
  if (!session) return null;

  const isPlaylist = session.type === 'playlist';
  const formatDisplay = (session.format || 'video').toUpperCase();
  const qualityDisplay = session.resolution || 'Source / Best Quality';
  const countDisplay = isPlaylist
    ? `${session.requestedIndices?.length || session.total} videos`
    : '1 video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md w-full p-6">
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <RotateCcw className="size-6" />
            </div>

            <div className="flex flex-col gap-1">
              <DialogTitle className="text-xl">Redownload Session</DialogTitle>
              <DialogDescription className="text-xs">
                Original download configuration has been restored.
              </DialogDescription>
            </div>
          </div>

          {/* Session Overview Card */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex flex-col gap-3">
            <h4 className="font-semibold text-sm text-foreground line-clamp-2">
              {session.title || 'Untitled Session'}
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-card p-2.5 rounded-xl border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Format</span>
                <span className="font-semibold text-foreground">{formatDisplay}</span>
              </div>

              <div className="bg-card p-2.5 rounded-xl border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Quality</span>
                <span className="font-semibold text-foreground truncate">{qualityDisplay}</span>
              </div>

              <div className="bg-card p-2.5 rounded-xl border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold font-mono">Selected</span>
                <span className="font-semibold text-foreground">{countDisplay}</span>
              </div>

              <div className="bg-card p-2.5 rounded-xl border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Destination</span>
                <span className="font-semibold text-foreground truncate">Downloads/</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
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
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onConfirmRedownload(session);
              }}
              className="rounded-xl px-5 text-xs font-bold gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="size-3.5" />
              <span>Start Redownload</span>
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
