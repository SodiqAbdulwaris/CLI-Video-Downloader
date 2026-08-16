import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { Progress, ProgressLabel, ProgressValue } from './ui/progress';
import type { JobStatus, JobItem, SocketStatus } from '../types/download';

interface JobProgressProps {
  jobStatus: JobStatus;
  overallProgress: number;
  jobItems: JobItem[];
  socketStatus: SocketStatus;
}

export function JobProgress({
  jobStatus,
  overallProgress,
  jobItems,
  socketStatus
}: JobProgressProps) {
  const completedCount = jobItems.filter(i => i.state === 'done').length;

  return (
    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/20 border border-border/50">
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="flex items-center gap-2 text-foreground/80">
          {jobStatus === 'completed' ? (
            <Check className="size-4 text-green-500" />
          ) : jobStatus === 'partial' || jobStatus === 'failed' ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (
            <Loader2 className="size-4 text-primary animate-spin" />
          )}
          {jobStatus === 'completed' ? 'Processing Complete' :
            jobStatus === 'partial' ? 'Completed with Errors' :
              jobStatus === 'failed' ? 'Job Failed' :
                jobStatus === 'running' ? 'Downloading items...' : 'In Queue...'}
        </span>
        <span className="font-mono text-primary text-base">{overallProgress}%</span>
      </div>

      <Progress value={overallProgress} className="h-2.5">
        <ProgressLabel className="sr-only">Overall Progress</ProgressLabel>
        <ProgressValue className="sr-only" />
      </Progress>

      <div className="text-xs text-muted-foreground mt-1 flex justify-between">
        <span>
          {jobItems.length > 0 ? (
            `${completedCount} of ${jobItems.length} items completed`
          ) : 'Pending items list...'}
        </span>
        {socketStatus === 'reconnecting' && (
          <span className="text-yellow-600 dark:text-yellow-400 animate-pulse font-medium">
            Reconnection active...
          </span>
        )}
      </div>
    </div>
  );
}
