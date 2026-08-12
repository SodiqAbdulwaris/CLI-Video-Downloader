import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  FolderDown,
  RotateCcw,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileVideo,
  FileAudio,
} from 'lucide-react';
import { Button } from './ui/button';
import { DownloadStatusBadge } from './DownloadStatusBadge';
import { formatDuration, formatDate } from './HistoryEntry';
import type { HistorySession } from '../types/history';

interface HistoryDetailsProps {
  session: HistorySession;
  onBack?: () => void;
  onRedownload?: (session: HistorySession) => void;
  onDelete?: (id: string) => void;
}

export function HistoryDetails({
  session,
  onBack,
  onRedownload,
  onDelete,
}: HistoryDetailsProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isAudio = session.format === 'audio';

  const handleCopyUrl = () => {
    if (!session.sourceUrl) return;
    navigator.clipboard.writeText(session.sourceUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 text-foreground">
      {/* Top Bar with Back button */}
      {onBack && (
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            <span>Back to history</span>
          </Button>
        </div>
      )}

      {/* Main Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
        {session.thumbnail ? (
          <img
            src={session.thumbnail}
            alt={session.title}
            className="size-20 sm:size-24 rounded-xl object-cover shrink-0 border border-border/60 shadow-sm"
          />
        ) : (
          <div className="size-20 sm:size-24 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border/60">
            {isAudio ? (
              <FileAudio className="size-10 text-muted-foreground" />
            ) : (
              <FileVideo className="size-10 text-muted-foreground" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-2">
              {session.title || 'Untitled Session'}
            </h3>
            <DownloadStatusBadge status={session.status} className="shrink-0 mt-0.5" />
          </div>

          <p className="text-xs text-muted-foreground">
            Downloaded on {formatDate(session.completedAt || session.createdAt)}
          </p>

          {/* Source URL display */}
          {session.sourceUrl && (
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <span className="text-xs text-muted-foreground truncate flex-1 font-mono bg-background/60 px-2.5 py-1 rounded-lg border border-border/40">
                {session.sourceUrl}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyUrl}
                className="size-7 rounded-lg shrink-0"
                title="Copy original URL"
              >
                {copiedUrl ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </Button>
              <a
                href={session.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Open in new tab"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Summary Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card p-3 rounded-xl border border-border/60 flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Format</span>
          <span className="text-sm font-semibold text-foreground uppercase">{session.format}</span>
        </div>

        <div className="bg-card p-3 rounded-xl border border-border/60 flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Quality</span>
          <span className="text-sm font-semibold text-foreground">{session.resolution || 'Default'}</span>
        </div>

        <div className="bg-card p-3 rounded-xl border border-border/60 flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Items</span>
          <span className="text-sm font-semibold text-foreground">
            {session.successful} / {session.total} succeeded
          </span>
        </div>

        <div className="bg-card p-3 rounded-xl border border-border/60 flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Saved To</span>
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <FolderDown className="size-3.5 text-primary shrink-0" />
            <span className="truncate">{session.downloadLocation || 'Downloads/'}</span>
          </span>
        </div>
      </div>

      {/* Downloaded Files List */}
      <div className="flex flex-col gap-2.5">
        <h4 className="font-semibold text-sm text-foreground flex items-center justify-between">
          <span>Downloaded Files ({session.files?.length || 0})</span>
          <span className="text-xs font-normal text-muted-foreground">
            Files saved in <span className="font-medium text-foreground">{session.downloadLocation || 'Downloads/'}</span>
          </span>
        </h4>

        <div className="max-h-60 overflow-y-auto rounded-xl border border-border/60 bg-card divide-y divide-border/40">
          {!session.files || session.files.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No file details recorded.</div>
          ) : (
            session.files.map((file, idx) => {
              const isDone = file.status === 'completed';
              return (
                <div key={idx} className="p-3 flex flex-col gap-1 text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isDone ? (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-red-500 shrink-0" />
                      )}
                      <span className="font-medium truncate text-foreground">
                        {file.title}
                      </span>
                    </div>

                    {file.duration && (
                      <span className="text-muted-foreground font-mono shrink-0">
                        {formatDuration(file.duration)}
                      </span>
                    )}
                  </div>

                  {file.filename && (
                    <p className="text-[11px] font-mono text-muted-foreground pl-6 truncate">
                      Filename: {file.filename}
                    </p>
                  )}

                  {file.error && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 pl-6 mt-0.5">
                      Error: {file.error}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40">
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(session.id)}
            className="text-xs text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            <span>Delete Entry</span>
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onRedownload && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onRedownload(session)}
              disabled={!session.sourceUrl}
              className="rounded-xl text-xs"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              <span>Redownload</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
