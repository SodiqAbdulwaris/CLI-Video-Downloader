import { useState } from 'react';
import { 
  ListVideo, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Loader2, 
  Clock, 
  FolderDown, 
  Terminal, 
  Download
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { JobStatus, JobItem, SocketStatus, ResolvedMedia } from '../types/download';

interface DownloadsViewProps {
  jobId: string | null;
  jobStatus: JobStatus | null;
  jobError: string | null;
  jobItems: JobItem[];
  progressMap: Record<string, number>;
  socketStatus: SocketStatus;
  socketLogs: string[];
  resolvedData: ResolvedMedia | null;
  selectedIndices: number[];
  onReset: () => void;
  onNavigateToDownload: () => void;
}

export function DownloadsView({
  jobId,
  jobStatus,
  jobError,
  jobItems,
  progressMap,
  socketStatus,
  socketLogs,
  resolvedData,
  onReset,
  onNavigateToDownload
}: DownloadsViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showLogs, setShowLogs] = useState(false);

  // Compute overall progress
  const getOverallProgress = () => {
    if (!resolvedData && jobItems.length === 0) return 0;

    if (resolvedData?.content_type !== 'playlist' && jobItems.length <= 1) {
      return progressMap['single'] || (jobStatus === 'completed' ? 100 : 0);
    }

    const totalItems = jobItems.length || 1;
    let completedWeight = 0;

    jobItems.forEach(item => {
      if (item.state === 'done') {
        completedWeight += 100;
      } else if (item.state === 'downloading') {
        const itemProg = progressMap[String(item.index)] || 0;
        completedWeight += itemProg;
      }
    });

    return Math.round(completedWeight / totalItems);
  };

  const overallProgress = getOverallProgress();
  const activeItemsCount = jobItems.filter(i => i.state === 'downloading' || i.state === 'queued').length;
  const completedItemsCount = jobItems.filter(i => i.state === 'done').length;
  const failedItemsCount = jobItems.filter(i => i.state === 'failed').length;

  const filteredItems = jobItems.filter(item => {
    if (filter === 'active') return item.state === 'downloading' || item.state === 'queued';
    if (filter === 'completed') return item.state === 'done';
    return true;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListVideo className="size-5 text-primary" />
            <span>Downloads Queue</span>
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">
              Active session download manager and progress tracking
            </p>
            {jobId && (
              <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground">
                Job #{jobId.slice(0, 8)} ({socketStatus})
              </span>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === 'all' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({jobItems.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === 'active' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active ({activeItemsCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === 'completed' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Completed ({completedItemsCount})
          </button>
        </div>
      </div>

      {/* If No Active Job exists */}
      {!jobStatus && jobItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-border/60 bg-card text-center gap-3">
          <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Download className="size-6" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="font-semibold text-base text-foreground">No active downloads</h3>
            <p className="text-xs text-muted-foreground">
              Paste a YouTube URL in the Download tab to start downloading videos, playlists, or audio.
            </p>
          </div>
          <Button
            onClick={onNavigateToDownload}
            className="rounded-xl font-semibold text-xs px-5 py-2 mt-2 gap-1.5 shadow-sm"
          >
            <Download className="size-3.5" />
            <span>Start Download</span>
          </Button>
        </div>
      ) : (
        <>
          {/* Overall Batch Progress Card */}
          {(jobStatus === 'running' || jobStatus === 'queued') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-2.5 py-0.5 rounded-lg text-xs font-semibold animate-pulse">
                    Downloading...
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {completedItemsCount + failedItemsCount} of {jobItems.length} items processed
                  </span>
                </div>

                <span className="font-mono text-sm font-bold text-primary">
                  {overallProgress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted/80 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <FolderDown className="size-3.5 text-primary" />
                    <span>Saving to: </span>
                    <code className="font-mono font-bold text-foreground">Downloads/</code>
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span>Status: <strong className="text-foreground capitalize">{jobStatus}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Job Completion Summary Banners */}
          {jobStatus === 'completed' && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 shrink-0" />
                <div>
                  <span className="font-bold text-sm">Download Job Completed</span>
                  <p className="text-xs opacity-90">All {jobItems.length} item(s) downloaded successfully to your local folder.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              >
                <RefreshCw className="size-3" />
                <span>New Download</span>
              </Button>
            </div>
          )}

          {jobStatus === 'failed' && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="size-5 shrink-0" />
                <div>
                  <span className="font-bold text-sm">Download Failed</span>
                  <p className="text-xs opacity-90">{jobError || 'An error occurred while downloading.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLogs(!showLogs)}
                  className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Terminal className="size-3" />
                  <span>{showLogs ? 'Hide Details' : 'Details'}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={onReset}
                  className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5"
                >
                  <RefreshCw className="size-3" />
                  <span>Retry</span>
                </Button>
              </div>
            </div>
          )}

          {/* Download Queue Items List */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Download Items ({filteredItems.length})
            </span>

            <div className="flex flex-col gap-2.5">
              {filteredItems.map((item, idx) => {
                const itemProgress = progressMap[String(item.index ?? 'single')] || (item.state === 'done' ? 100 : 0);
                const isDone = item.state === 'done';
                const isFailed = item.state === 'failed';
                const isDownloading = item.state === 'downloading';

                return (
                  <div
                    key={idx}
                    className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-2xs flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {isDone ? (
                            <div className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <CheckCircle2 className="size-4" />
                            </div>
                          ) : isFailed ? (
                            <div className="size-7 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                              <XCircle className="size-4" />
                            </div>
                          ) : isDownloading ? (
                            <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center animate-spin">
                              <Loader2 className="size-4" />
                            </div>
                          ) : (
                            <div className="size-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                              <Clock className="size-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <h4 className="font-semibold text-sm text-foreground truncate leading-tight">
                            {item.title}
                          </h4>
                          {item.error && (
                            <p className="text-xs text-destructive mt-1 font-mono">
                              Error: {item.error}
                            </p>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant={isDone ? 'default' : isFailed ? 'destructive' : 'secondary'}
                        className="capitalize font-semibold text-xs py-0.5 px-2.5 shrink-0"
                      >
                        {isDownloading ? `${itemProgress}%` : item.state}
                      </Badge>
                    </div>

                    {/* Item progress bar */}
                    {isDownloading && (
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-primary h-full transition-all duration-200 rounded-full"
                          style={{ width: `${itemProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diagnostics Log Details */}
          {(showLogs || socketLogs.length > 0) && (
            <details open={showLogs} className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-xs">
              <summary className="font-semibold cursor-pointer select-none text-muted-foreground hover:text-foreground flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                <span>Technical Connection & Download Diagnostics</span>
              </summary>
              <div className="mt-3 font-mono text-[11px] bg-black/5 dark:bg-black/30 p-3 rounded-xl max-h-40 overflow-y-auto divide-y divide-border/20 text-muted-foreground">
                {socketLogs.map((log, i) => (
                  <div key={i} className="py-1 leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
