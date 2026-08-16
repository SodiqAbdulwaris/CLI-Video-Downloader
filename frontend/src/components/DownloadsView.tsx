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
  Download,
  Pause,
  Play,
  X,
  WifiOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { JobItem, JobStatus } from '../types/download';
import type { JobState } from '../hooks/useDownloadJobs';
import { pauseTask, resumeTask, cancelTask, cancelJob } from '../lib/api';

interface DownloadsViewProps {
  jobs: JobState[];
  onDismissJob: (jobId: string) => void;
  onRetryConnection: (jobId: string) => void;
  onNavigateToDownload: () => void;
}

export function DownloadsView({ jobs, onDismissJob, onRetryConnection, onNavigateToDownload }: DownloadsViewProps) {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      <div className="border-b border-border/60 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ListVideo className="size-5 text-primary" />
          <span>Downloads Queue</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Active and recently finished download jobs — {jobs.length} in this session.
        </p>
      </div>

      {jobs.length === 0 ? (
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
        <div className="flex flex-col gap-4">
          {[...jobs].reverse().map(job => (
            <JobCard
              key={job.jobId}
              job={job}
              onDismiss={() => onDismissJob(job.jobId)}
              onRetryConnection={() => onRetryConnection(job.jobId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function overallProgress(job: JobState): number {
  if (job.items.length === 0) return job.status === 'completed' ? 100 : 0;
  let completedWeight = 0;
  job.items.forEach(item => {
    if (item.state === 'done') {
      completedWeight += 100;
    } else if (item.state === 'downloading') {
      const key = item.task_id ?? String(item.index ?? 'single');
      completedWeight += job.progressMap[key] || 0;
    }
  });
  return Math.round(completedWeight / job.items.length);
}

function isTerminal(status: JobStatus | null): boolean {
  return status === 'completed' || status === 'partial' || status === 'failed';
}

function JobCard({ job, onDismiss, onRetryConnection }: { job: JobState; onDismiss: () => void; onRetryConnection: () => void }) {
  const [showLogs, setShowLogs] = useState(false);
  const progress = overallProgress(job);
  const activeCount = job.items.filter(i => i.state === 'downloading' || i.state === 'queued').length;
  const doneCount = job.items.filter(i => i.state === 'done').length;
  const failedCount = job.items.filter(i => i.state === 'failed' || i.state === 'cancelled').length;
  const connectionLost = job.socketStatus === 'failed';

  const handleCancelJob = () => {
    cancelJob(job.jobId).catch(() => {});
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground shrink-0">
            #{job.jobId.slice(0, 8)}
          </span>
          <Badge
            variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}
            className={`capitalize font-semibold text-xs py-0.5 px-2.5 shrink-0 ${
              job.status === 'running' || job.status === 'queued' ? 'animate-pulse' : ''
            }`}
          >
            {job.status ?? 'queued'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isTerminal(job.status) && activeCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelJob}
              className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X className="size-3" />
              <span>Cancel all</span>
            </Button>
          )}
          {isTerminal(job.status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {/* Backend-unreachable banner */}
      {connectionLost && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 shrink-0" />
            <span>Lost connection to the backend — it may have stopped or restarted. Progress shown may be out of date.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryConnection}
            className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
          >
            <RefreshCw className="size-3" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Overall progress */}
      {!isTerminal(job.status) && job.status !== 'paused' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{doneCount + failedCount} of {job.items.length || '?'} items processed</span>
            <span className="font-mono font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-muted/80 h-2.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Terminal status banners */}
      {job.status === 'completed' && (
        <StatusBanner tone="success" icon={<CheckCircle2 className="size-5 shrink-0" />} title="Download Job Completed"
          message={`All ${job.items.length} item(s) downloaded successfully.`} />
      )}
      {job.status === 'partial' && (
        <StatusBanner tone="warning" icon={<AlertTriangle className="size-5 shrink-0" />} title="Completed with Errors"
          message={`${doneCount} succeeded, ${failedCount} failed.`} />
      )}
      {job.status === 'failed' && (
        <StatusBanner tone="danger" icon={<AlertTriangle className="size-5 shrink-0" />} title="Download Failed"
          message={job.error || 'An error occurred while downloading.'} />
      )}

      {/* Items */}
      {job.items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {job.items.map((item, idx) => (
            <ItemRow key={item.task_id ?? idx} item={item} percent={job.progressMap[item.task_id ?? String(item.index ?? 'single')] || 0} />
          ))}
        </div>
      )}

      {/* Diagnostics */}
      {(showLogs || job.socketLogs.length > 0) && (
        <details open={showLogs} className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
          <summary
            className="font-semibold cursor-pointer select-none text-muted-foreground hover:text-foreground flex items-center gap-2"
            onClick={(e) => { e.preventDefault(); setShowLogs(v => !v); }}
          >
            <Terminal className="size-4 text-primary" />
            <span>Connection & Download Diagnostics</span>
          </summary>
          <div className="mt-3 font-mono text-[11px] bg-black/5 dark:bg-black/30 p-3 rounded-xl max-h-32 overflow-y-auto divide-y divide-border/20 text-muted-foreground">
            {job.socketLogs.map((log, i) => (
              <div key={i} className="py-1 leading-relaxed">{log}</div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
        <FolderDown className="size-3.5 text-primary" />
        <span>Saving to your configured download folder</span>
      </div>
    </div>
  );
}

function StatusBanner({ tone, icon, title, message }: { tone: 'success' | 'warning' | 'danger'; icon: React.ReactNode; title: string; message: string }) {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    danger: 'bg-destructive/10 border-destructive/20 text-destructive',
  }[tone];
  return (
    <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${styles}`}>
      {icon}
      <div>
        <span className="font-bold text-sm block">{title}</span>
        <p className="opacity-90">{message}</p>
      </div>
    </div>
  );
}

function ItemRow({ item, percent }: { item: JobItem; percent: number }) {
  const [pending, setPending] = useState(false);
  const isDone = item.state === 'done';
  const isFailed = item.state === 'failed';
  const isCancelled = item.state === 'cancelled';
  const isPaused = item.state === 'paused';
  const isDownloading = item.state === 'downloading';
  const isQueued = item.state === 'queued';

  const run = (action: (taskId: string) => Promise<unknown>) => {
    if (!item.task_id || pending) return;
    setPending(true);
    action(item.task_id).catch(() => {}).finally(() => setPending(false));
  };

  return (
    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/70 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">
            {isDone ? (
              <IconBadge tone="success"><CheckCircle2 className="size-4" /></IconBadge>
            ) : isFailed || isCancelled ? (
              <IconBadge tone="danger"><XCircle className="size-4" /></IconBadge>
            ) : isPaused ? (
              <IconBadge tone="muted"><Pause className="size-4" /></IconBadge>
            ) : isDownloading ? (
              <IconBadge tone="primary"><Loader2 className="size-4 animate-spin" /></IconBadge>
            ) : (
              <IconBadge tone="muted"><Clock className="size-4" /></IconBadge>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="font-semibold text-sm text-foreground truncate leading-tight">{item.title}</h4>
            {item.error && <p className="text-xs text-destructive mt-1 font-mono truncate">Error: {item.error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDownloading && item.task_id && (
            <IconButton title="Pause" disabled={pending} onClick={() => run(pauseTask)}><Pause className="size-3.5" /></IconButton>
          )}
          {isPaused && item.task_id && (
            <IconButton title="Resume" disabled={pending} onClick={() => run(resumeTask)}><Play className="size-3.5" /></IconButton>
          )}
          {(isDownloading || isQueued || isPaused) && item.task_id && (
            <IconButton title="Cancel" disabled={pending} onClick={() => run(cancelTask)}><X className="size-3.5" /></IconButton>
          )}
          <Badge
            variant={isDone ? 'default' : isFailed || isCancelled ? 'destructive' : 'secondary'}
            className="capitalize font-semibold text-xs py-0.5 px-2.5"
          >
            {isDownloading ? `${percent}%` : item.state}
          </Badge>
        </div>
      </div>

      {isDownloading && (
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function IconBadge({ tone, children }: { tone: 'success' | 'danger' | 'muted' | 'primary'; children: React.ReactNode }) {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    danger: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
  }[tone];
  return <div className={`size-7 rounded-xl flex items-center justify-center ${styles}`}>{children}</div>;
}

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
