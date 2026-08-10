import { Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { MediaThumbnail } from './MediaThumbnail';
import type { PlaylistEntry } from '../types/download';
import { formatDuration } from '../lib/utils';

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
  onToggleIndex
}: PlaylistSelectorProps) {
  const isAllSelected = selectedIndices.length === entries.length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Layers className="size-4 text-primary" /> Playlist Items ({selectedIndices.length} / {entries.length} Selected)
        </span>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onSelectAll}
          className="text-xs h-7 px-2.5 text-primary hover:bg-primary/10 rounded-lg"
        >
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <div className="border border-border/60 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-muted/20">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/50 text-xs font-semibold text-muted-foreground sticky top-0 backdrop-blur-md">
              <th className="p-3 w-10 text-center">Select</th>
              <th className="p-3 w-12 text-center">#</th>
              <th className="p-3">Title</th>
              <th className="p-3 w-20 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {entries.map((entry) => {
              const isChecked = selectedIndices.includes(entry.index);
              return (
                <tr
                  key={entry.index}
                  onClick={() => onToggleIndex(entry.index)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onToggleIndex(entry.index)}
                        aria-label={`Select ${entry.title}`}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-center text-muted-foreground font-mono">
                    {entry.index + 1}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <MediaThumbnail
                        src={entry.thumbnail}
                        alt={entry.title}
                        className="size-10 rounded-lg shrink-0 border border-border/40"
                      />
                      <span className="font-medium line-clamp-1 truncate max-w-sm animate-none">
                        {entry.title}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-muted-foreground font-mono text-xs">
                    {formatDuration(entry.duration)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
