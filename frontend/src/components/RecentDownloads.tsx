import { History, ArrowRight, Download } from 'lucide-react';
import { Button } from './ui/button';
import { HistoryEntry } from './HistoryEntry';
import type { HistorySession } from '../types/history';

interface RecentDownloadsProps {
  recentHistory: HistorySession[];
  onOpenFullHistory: () => void;
  onRedownload: (session: HistorySession) => void;
  onViewDetails: (session: HistorySession) => void;
  isLoading?: boolean;
}

export function RecentDownloads({
  recentHistory,
  onOpenFullHistory,
  onRedownload,
  onViewDetails,
  isLoading = false,
}: RecentDownloadsProps) {
  return (
    <section className="w-full flex flex-col gap-3 my-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-bold text-sm tracking-tight text-foreground">
            Recent Downloads
          </h3>
        </div>

        {recentHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFullHistory}
            className="text-xs text-muted-foreground hover:text-foreground font-medium rounded-xl hover:bg-muted flex items-center gap-1 group"
          >
            <span>View all</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-6 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border/50">
          Loading recent downloads...
        </div>
      ) : recentHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-border/60 bg-card/60 text-center gap-1.5">
          <div className="size-10 rounded-2xl bg-muted/60 flex items-center justify-center mb-1 text-muted-foreground">
            <Download className="size-5" />
          </div>
          <p className="font-semibold text-sm text-foreground">No downloads yet</p>
          <p className="text-xs text-muted-foreground">
            Your completed downloads will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {recentHistory.map((session) => (
            <HistoryEntry
              key={session.id}
              session={session}
              onRedownload={onRedownload}
              onViewDetails={onViewDetails}
              compact
            />
          ))}
        </div>
      )}
    </section>
  );
}
