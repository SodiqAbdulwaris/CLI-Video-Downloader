import { RotateCcw, Info, Trash2, Video, Music, Library, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { DownloadStatusBadge } from './DownloadStatusBadge';
import type { HistorySession } from '../types/history';

interface HistoryEntryProps {
  session: HistorySession;
  onRedownload?: (session: HistorySession) => void;
  onViewDetails?: (session: HistorySession) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateString;
  }
}

export function HistoryEntry({
  session,
  onRedownload,
  onViewDetails,
  onDelete,
  compact = false,
}: HistoryEntryProps) {
  const isPlaylist = session.type === 'playlist';
  const isAudio = session.format === 'audio';

  const formatDisplay = (session.format || 'video').toUpperCase();
  const resolutionDisplay = session.resolution || '';
  const dateDisplay = formatDate(session.completedAt || session.createdAt);

  // For single file duration if available
  const singleFileDuration =
    !isPlaylist && session.files && session.files[0]?.duration
      ? formatDuration(session.files[0].duration)
      : '';

  // Metadata parts string
  const metaParts: string[] = [];
  if (isPlaylist) {
    metaParts.push('Playlist');
    metaParts.push(`${session.successful}/${session.total} successful`);
  } else {
    metaParts.push(formatDisplay);
    if (resolutionDisplay) metaParts.push(resolutionDisplay);
    if (singleFileDuration) metaParts.push(singleFileDuration);
  }
  if (dateDisplay) metaParts.push(dateDisplay);

  const canRedownload = Boolean(session.sourceUrl);

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition-all duration-200 gap-3">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Media Icon or Thumbnail */}
        <div className="relative size-10 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 overflow-hidden border border-border/40">
          {session.thumbnail ? (
            <img
              src={session.thumbnail}
              alt={session.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to icon if thumbnail fails to load
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : isPlaylist ? (
            <Library className="size-5 text-neutral-500" />
          ) : isAudio ? (
            <Music className="size-5 text-neutral-500" />
          ) : session.type === 'short' ? (
            <Sparkles className="size-5 text-neutral-500" />
          ) : (
            <Video className="size-5 text-neutral-500" />
          )}
        </div>

        {/* Title & Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm truncate text-foreground leading-tight">
              {session.title || 'Untitled Media'}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {metaParts.map((part, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <span className="opacity-40">·</span>}
                <span>{part}</span>
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
        <DownloadStatusBadge status={session.status} />

        <div className="flex items-center gap-1">
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(session)}
              className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              title="View Download Details"
              aria-label="View Details"
            >
              <Info className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Details</span>
            </Button>
          )}

          {onRedownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRedownload(session)}
              disabled={!canRedownload}
              className="h-8 px-2.5 rounded-xl text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              title={canRedownload ? 'Download again using same settings' : 'Missing original URL'}
              aria-label="Redownload"
            >
              <RotateCcw className="size-3.5 mr-1" />
              <span>Redownload</span>
            </Button>
          )}

          {onDelete && !compact && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(session.id)}
              className="size-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete from history"
              aria-label="Delete history entry"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
