import { useState } from 'react';
import { History, Trash2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { HistoryEntry } from './HistoryEntry';
import { HistoryDetails } from './HistoryDetails';
import type { HistorySession } from '../types/history';

interface DownloadHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistorySession[];
  onRedownload: (session: HistorySession) => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  isLoading?: boolean;
}

export function DownloadHistoryDialog({
  open,
  onOpenChange,
  history,
  onRedownload,
  onDeleteSession,
  onClearHistory,
  isLoading = false,
}: DownloadHistoryDialogProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const selectedSession = history.find((s) => s.id === selectedSessionId);

  const handleClose = () => {
    setSelectedSessionId(null);
    setShowConfirmClear(false);
    onOpenChange(false);
  };

  const handleRedownloadSession = (session: HistorySession) => {
    handleClose();
    onRedownload(session);
  };

  const handleDeleteEntry = (id: string) => {
    if (selectedSessionId === id) {
      setSelectedSessionId(null);
    }
    onDeleteSession(id);
  };

  const handleConfirmClear = () => {
    onClearHistory();
    setShowConfirmClear(false);
    setSelectedSessionId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPopup className="max-w-2xl w-full max-h-[85vh] flex flex-col p-6 overflow-hidden">
        {/* VIEW 1: Clear History Confirmation */}
        {showConfirmClear ? (
          <div className="flex flex-col gap-5 py-2">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive shrink-0">
                <AlertCircle className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-xl">Clear download history?</DialogTitle>
                <DialogDescription className="text-sm">
                  This will remove your download history records. Your downloaded files will not be deleted.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmClear(false)}
                className="rounded-xl px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmClear}
                className="rounded-xl px-4 text-xs font-semibold gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Clear History</span>
              </Button>
            </div>
          </div>
        ) : selectedSession ? (
          /* VIEW 2: Session Details View */
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <HistoryDetails
              session={selectedSession}
              onBack={() => setSelectedSessionId(null)}
              onRedownload={handleRedownloadSession}
              onDelete={handleDeleteEntry}
            />
          </div>
        ) : (
          /* VIEW 3: Full History Sessions List */
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-muted text-foreground">
                  <History className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Download History</DialogTitle>
                  <DialogDescription className="text-xs">
                    {history.length} {history.length === 1 ? 'download session' : 'download sessions'} recorded
                  </DialogDescription>
                </div>
              </div>

              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmClear(true)}
                  className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  title="Clear all history entries"
                >
                  <Trash2 className="size-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Clear History</span>
                </Button>
              )}
            </div>

            {/* Scrollable list of entries */}
            <div className="flex-1 overflow-y-auto min-h-48 max-h-[55vh] pr-1 flex flex-col gap-2.5">
              {isLoading ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                  <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <History className="size-6" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">No history records</p>
                  <p className="text-xs max-w-xs">
                    Completed downloads will be saved locally and appear here.
                  </p>
                </div>
              ) : (
                history.map((session) => (
                  <HistoryEntry
                    key={session.id}
                    session={session}
                    onRedownload={handleRedownloadSession}
                    onViewDetails={(s) => setSelectedSessionId(s.id)}
                    onDelete={handleDeleteEntry}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
