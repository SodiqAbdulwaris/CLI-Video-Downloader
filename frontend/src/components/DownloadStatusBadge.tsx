import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { HistoryStatus } from '../types/history';

interface DownloadStatusBadgeProps {
  status: HistoryStatus;
  className?: string;
}

export function DownloadStatusBadge({ status, className = '' }: DownloadStatusBadgeProps) {
  if (status === 'completed') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
      >
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>Completed</span>
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>Partial</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 ${className}`}
    >
      <XCircle className="size-3.5 shrink-0" />
      <span>Failed</span>
    </span>
  );
}
