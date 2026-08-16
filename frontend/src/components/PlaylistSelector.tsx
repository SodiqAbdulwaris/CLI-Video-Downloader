import { CheckSquare, Square, Library, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { formatDuration } from './HistoryEntry';
import type { PlaylistEntry } from '../types/download';

interface PlaylistSelectorProps {
  entries: PlaylistEntry[];
  selectedIndices: number[];
  onSelectAll: () => void;
  onToggleIndex: (index: number) => void;
}

export function PlaylistSelector({
  entries,
  selectedIndices,
  onSelectAll,
  onToggleIndex,
}: PlaylistSelectorProps) {
  const isAllSelected = selectedIndices.length === entries.length;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header bar with selection controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Library className="size-4 text-primary" />
          <span>Playlist Videos ({entries.length})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border/60">
            {selectedIndices.length} / {entries.length} selected
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            className="h-7 px-2.5 rounded-lg text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground gap-1.5"
          >
            {isAllSelected ? (
              <>
                <Square className="size-3.5" />
                <span>Clear selection</span>
              </>
            ) : (
              <>
                <CheckSquare className="size-3.5 text-primary" />
                <span>Select all</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Playlist Videos Table / Scrollable List */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card divide-y divide-border/40 max-h-72 overflow-y-auto">
        {entries.map((entry) => {
          const isSelected = selectedIndices.includes(entry.index);
          return (
            <div
              key={entry.index}
              onClick={() => onToggleIndex(entry.index)}
              className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer select-none transition-colors ${
                isSelected
                  ? 'bg-primary/5 hover:bg-primary/10'
                  : 'hover:bg-muted/40 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Checkbox */}
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleIndex(entry.index)}
                    className="rounded-md"
                  />
                </div>

                {/* Index badge */}
                <span className="font-mono text-[11px] text-muted-foreground w-6 shrink-0 text-right">
                  #{entry.index}
                </span>

                {/* Thumbnail if available */}
                {entry.thumbnail ? (
                  <img
                    src={entry.thumbnail}
                    alt=""
                    className="size-9 rounded-md object-cover shrink-0 border border-border/40"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div className="size-9 rounded-md bg-muted/60 flex items-center justify-center shrink-0 border border-border/40">
                    <Library className="size-4 text-muted-foreground" />
                  </div>
                )}

                {/* Video title */}
                <span className="font-medium text-foreground truncate min-w-0 flex-1 text-xs">
                  {entry.title}
                </span>
              </div>

              {/* Duration */}
              {entry.duration !== null && entry.duration !== undefined && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground shrink-0">
                  <Clock className="size-3" />
                  <span>{formatDuration(entry.duration)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
