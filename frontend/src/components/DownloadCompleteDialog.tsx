import { CheckCircle2, AlertTriangle, XCircle, FolderOpen, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import type { JobItem, JobStatus } from '../types/download';

interface DownloadCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobStatus: JobStatus | null;
  jobItems: JobItem[];
  onDownloadAnother: () => void;
}

export function DownloadCompleteDialog({
  open,
  onOpenChange,
  jobItems,
  onDownloadAnother
}: DownloadCompleteDialogProps) {
  const totalCount = jobItems.length;
  const successfulCount = jobItems.filter(item => item.state === 'done').length;
  const failedItems = jobItems.filter(item => item.state === 'failed');
  const failedCount = failedItems.length;

  const isAllSuccess = successfulCount > 0 && failedCount === 0;
  const isPartialSuccess = successfulCount > 0 && failedCount > 0;
  const isAllFailed = successfulCount === 0;

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDownloadAnother = () => {
    onOpenChange(false);
    onDownloadAnother();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <div className="flex flex-col gap-5 pt-1">
          {/* Header Icon + Title */}
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 mt-0.5">
              {isAllSuccess ? (
                <div className="p-2.5 rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="size-7" />
                </div>
              ) : isPartialSuccess ? (
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-7" />
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive">
                  <XCircle className="size-7" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <DialogTitle className="text-xl">
                {isAllSuccess
                  ? 'Download Complete'
                  : isPartialSuccess
                  ? 'Download Completed with Errors'
                  : 'Download Failed'}
              </DialogTitle>

              <DialogDescription className="text-sm">
                {isAllSuccess ? (
                  totalCount === 1
                    ? 'Your file was downloaded successfully.'
                    : `${successfulCount} files downloaded successfully.`
                ) : isPartialSuccess ? (
                  `${successfulCount} ${successfulCount === 1 ? 'file' : 'files'} downloaded successfully, ${failedCount} failed.`
                ) : (
                  'No files were downloaded successfully.'
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/40 shadow-2xs">
              <div className="size-2 rounded-full bg-green-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium">Successful</span>
                <span className="text-base font-bold font-mono text-foreground">{successfulCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/40 shadow-2xs">
              <div className={`size-2 rounded-full ${failedCount > 0 ? 'bg-destructive' : 'bg-muted-foreground/30'}`} />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium">Failed</span>
                <span className={`text-base font-bold font-mono ${failedCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {failedCount}
                </span>
              </div>
            </div>
          </div>

          {/* Save Location Banner */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
            <FolderOpen className="size-5 text-primary shrink-0" />
            <div>
              <span>{successfulCount > 0 ? 'Downloaded files can be found in:' : 'Files are saved to:'} </span>
              <code className="font-mono font-bold text-foreground bg-background px-1.5 py-0.5 rounded border border-border/60">
                Downloads/
              </code>
            </div>
          </div>

          {/* Failed Items List (if any failures exist) */}
          {failedItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                Failed Downloads ({failedItems.length})
              </span>
              <div className="border border-destructive/20 rounded-xl overflow-hidden divide-y divide-border/40 bg-destructive/5 max-h-36 overflow-y-auto p-1">
                {failedItems.map((item, idx) => (
                  <div key={idx} className="p-2 text-xs flex flex-col gap-0.5">
                    <span className="font-medium text-foreground line-clamp-1">{item.title}</span>
                    <span className="text-destructive font-mono text-[11px]">{item.error || 'Download failed'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              onClick={handleClose}
              className="rounded-xl text-xs font-semibold px-4"
            >
              Close
            </Button>
            <Button
              onClick={handleDownloadAnother}
              className="rounded-xl text-xs font-semibold px-4 gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" />
              {isAllFailed ? 'Try Again' : 'Download Another'}
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
