import { Check, AlertCircle, Loader2, RefreshCw, Clock, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress, ProgressLabel, ProgressValue } from './ui/progress';
import { JobProgress } from './JobProgress';
import type { JobStatus, JobItem, SocketStatus, ResolvedMedia } from '../types/download';

interface DownloadMonitorProps {
  jobId: string | null;
  jobStatus: JobStatus;
  jobError: string | null;
  jobItems: JobItem[];
  progressMap: Record<string, number>;
  socketStatus: SocketStatus;
  socketLogs: string[];
  resolvedData: ResolvedMedia | null;
  selectedIndices: number[];
  onReset: () => void;
}

export function DownloadMonitor({
  jobId,
  jobStatus,
  jobError,
  jobItems,
  progressMap,
  socketStatus,
  socketLogs,
  resolvedData,
  selectedIndices,
  onReset
}: DownloadMonitorProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getOverallProgress = () => {
    if (!resolvedData) return 0;

    // Single video download
    if (resolvedData.content_type !== 'playlist') {
      return progressMap['single'] || 0;
    }

    // Playlist download progress calculation
    const totalItems = selectedIndices.length || resolvedData.entries?.length || 1;
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

  return (
    <div
      className={`transition-all duration-300 transform ${
        prefersReducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-4'
      }`}
    >
      <Card className="border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <Badge variant="secondary" className="px-2 py-0.5 rounded-md">Step 3</Badge>
              <span>Monitor Download</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Connection status indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                <span
                  className={`inline-block size-2 rounded-full ${
                    socketStatus === 'connected'
                      ? 'bg-green-500'
                      : socketStatus === 'connecting' || socketStatus === 'reconnecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
                <span className="capitalize">{socketStatus}</span>
              </div>

              {/* Job level state badge */}
              <Badge
                variant={
                  jobStatus === 'completed'
                    ? 'default'
                    : jobStatus === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
                className={`capitalize font-semibold text-xs py-0.5 px-2.5 ${
                  jobStatus === 'running' || jobStatus === 'queued' ? 'animate-pulse' : ''
                }`}
              >
                {jobStatus}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-xl tracking-tight">Active Download Queue</CardTitle>
          <CardDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>Follow progress and retrieve downloaded assets.</span>
            {jobId && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Job ID: {jobId}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Overall progress bar */}
          <JobProgress
            jobStatus={jobStatus}
            overallProgress={overallProgress}
            jobItems={jobItems}
            socketStatus={socketStatus}
          />

          {/* Job Errors */}
          {jobError && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed items-start">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Download error: </span>
                {jobError}
              </div>
            </div>
          )}

          {/* Items Queue list */}
          {jobItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Files in Job
              </span>
              <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40 bg-muted/10 max-h-56 overflow-y-auto">
                {jobItems.map((item, index) => {
                  const itemProgress = progressMap[String(item.index ?? 'single')] || 0;
                  return (
                    <div key={index} className="p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-2.5 items-start">
                          <div className="mt-0.5 shrink-0">
                            {item.state === 'done' ? (
                              <div className="bg-green-500/20 text-green-600 dark:text-green-400 p-1 rounded-md">
                                <Check className="size-3.5" />
                              </div>
                            ) : item.state === 'failed' ? (
                              <div className="bg-destructive/20 text-destructive p-1 rounded-md">
                                <AlertCircle className="size-3.5" />
                              </div>
                            ) : item.state === 'downloading' ? (
                              <div className="bg-primary/20 text-primary p-1 rounded-md animate-spin">
                                <RefreshCw className="size-3.5" />
                              </div>
                            ) : (
                              <div className="bg-muted text-muted-foreground p-1 rounded-md">
                                <Clock className="size-3.5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-foreground line-clamp-1 truncate max-w-md">
                              {item.title}
                            </h4>
                            {item.error && (
                              <p className="text-xs text-destructive mt-0.5 leading-normal">
                                {item.error}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                              item.state === 'done'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : item.state === 'failed'
                                ? 'bg-red-500/10 text-red-600'
                                : item.state === 'downloading'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {item.state === 'downloading' ? `${itemProgress}%` : item.state}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar per downloading item */}
                      {item.state === 'downloading' && (
                        <Progress value={itemProgress} className="h-1.5 mt-1">
                          <ProgressLabel className="sr-only">Item progress</ProgressLabel>
                          <ProgressValue className="sr-only" />
                        </Progress>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Socket Logs (collapsible / for troubleshooting) */}
          <details className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-xl border border-border/40">
            <summary className="cursor-pointer font-semibold py-1 hover:text-foreground select-none flex items-center gap-1.5">
              <HelpCircle className="size-3.5" /> Socket Connection Diagnostics
            </summary>
            <div className="mt-2 font-mono divide-y divide-border/20 max-h-32 overflow-y-auto bg-black/5 dark:bg-black/20 p-2 rounded-md">
              {socketLogs.length > 0 ? (
                socketLogs.map((log, i) => (
                  <div key={i} className="py-1">
                    {log}
                  </div>
                ))
              ) : (
                <div className="py-1 text-muted-foreground italic">No logs yet.</div>
              )}
            </div>
          </details>
        </CardContent>

        <CardFooter className="border-t border-border/40 pt-4 flex justify-between items-center bg-muted/10">
          <div className="text-xs text-muted-foreground">
            {jobStatus === 'running' || jobStatus === 'queued' ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin text-primary" />
                Assets are written to the{' '}
                <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">
                  Downloads
                </code>{' '}
                directory
              </span>
            ) : jobStatus === 'completed' ? (
              <span className="text-green-600 dark:text-green-400 font-semibold">
                All files downloaded successfully!
              </span>
            ) : (
              <span>Job status finished</span>
            )}
          </div>

          {(jobStatus === 'completed' || jobStatus === 'failed') && (
            <Button
              variant="outline"
              onClick={onReset}
              className="rounded-xl text-xs font-semibold gap-1.5 shrink-0"
            >
              <RefreshCw className="size-3.5" />
              Download Another
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
