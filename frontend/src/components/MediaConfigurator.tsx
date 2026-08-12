import { Video, Music, Settings, Download, Sparkles, FolderDown, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MediaThumbnail } from './MediaThumbnail';
import { PlaylistSelector } from './PlaylistSelector';
import type { ResolvedMedia } from '../types/download';

interface MediaConfiguratorProps {
  resolvedData: ResolvedMedia;
  sourceUrl?: string;
  formatType: string;
  resolution: string;
  selectedIndices: number[];
  onFormatChange: (format: string) => void;
  onResolutionChange: (resolution: string) => void;
  onSelectAll: () => void;
  onToggleIndex: (index: number) => void;
  onDownload: () => void;
  isDownloading: boolean;
  downloadDirectory?: string | null;
}

export function MediaConfigurator({
  resolvedData,
  sourceUrl = '',
  formatType,
  resolution,
  selectedIndices,
  onFormatChange,
  onResolutionChange,
  onSelectAll,
  onToggleIndex,
  onDownload,
  isDownloading,
  downloadDirectory
}: MediaConfiguratorProps) {
  const isPlaylist = resolvedData.content_type === 'playlist';
  const isShort = !isPlaylist && (sourceUrl.includes('/shorts/') || resolvedData.title.toLowerCase().includes('#shorts'));

  const isStartDisabled =
    isDownloading ||
    (isPlaylist && selectedIndices.length === 0);

  // Estimate total size hint for playlists or single video
  const totalCount = isPlaylist ? (resolvedData.entries?.length || 0) : 1;
  const selectedCount = isPlaylist ? selectedIndices.length : 1;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase tracking-wider">
                {isPlaylist ? 'Playlist Detected' : isShort ? 'Short Detected' : 'Video Resolved'}
              </Badge>
              {isShort && (
                <Badge className="bg-red-600/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg text-[11px] font-bold tracking-wide uppercase flex items-center gap-1">
                  <Sparkles className="size-3" /> SHORT
                </Badge>
              )}
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              {isPlaylist ? `${selectedCount} / ${totalCount} selected` : 'Single file'}
            </span>
          </div>

          <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground line-clamp-2 mt-1">
            {resolvedData.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-5">
          {/* Single Video Preview Header */}
          {!isPlaylist && (
            <div className="flex flex-col sm:flex-row gap-4 items-start bg-muted/30 p-3.5 rounded-xl border border-border/50">
              <div className="w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-muted border border-border/60 shrink-0 relative">
                <MediaThumbnail
                  src={resolvedData.thumbnail}
                  alt={resolvedData.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <h4 className="font-semibold text-sm text-foreground line-clamp-2">
                  {resolvedData.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {sourceUrl || 'YouTube Link'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FolderDown className="size-3.5 text-primary" /> Save to:
                  </span>
                  <code className="text-[11px] font-mono bg-background px-2 py-0.5 rounded border border-border/60 text-foreground truncate">
                    {downloadDirectory || 'Not configured'}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Format & Quality Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Format Type (Video MP4 / Audio MP3) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" /> Format
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => onFormatChange('video')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    formatType === 'video'
                      ? 'bg-card text-foreground shadow-2xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Video className={`size-4 ${formatType === 'video' ? 'text-primary' : ''}`} />
                  <span>Video (MP4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onFormatChange('audio')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    formatType === 'audio'
                      ? 'bg-card text-foreground shadow-2xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Music className={`size-4 ${formatType === 'audio' ? 'text-primary' : ''}`} />
                  <span>Audio (MP3)</span>
                </button>
              </div>
            </div>

            {/* Quality / Resolution Selector */}
            {formatType === 'video' && resolvedData.available_resolutions && resolvedData.available_resolutions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="size-3.5 text-primary" /> Quality
                </label>
                <Select value={resolution} onValueChange={(val) => onResolutionChange(val || '')}>
                  <SelectTrigger className="w-full rounded-xl bg-card border-border">
                    <SelectValue placeholder="Select video resolution..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl shadow-lg border border-border">
                    {resolvedData.available_resolutions.map((res) => (
                      <SelectItem key={res} value={res}>
                        {res}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Audio Quality
                </label>
                <div className="h-10 px-3 rounded-xl bg-muted/40 border border-border/60 flex items-center text-xs font-mono text-muted-foreground">
                  320 kbps High Quality MP3
                </div>
              </div>
            )}
          </div>

          {/* Playlist Videos Selector Table */}
          {isPlaylist && resolvedData.entries && (
            <PlaylistSelector
              entries={resolvedData.entries}
              selectedIndices={selectedIndices}
              onSelectAll={onSelectAll}
              onToggleIndex={onToggleIndex}
            />
          )}
        </CardContent>

        {/* Sticky Action Footer */}
        <CardFooter className="border-t border-border/50 pt-4 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <span>Download target: </span>
            <span className="font-semibold text-foreground uppercase">{formatType}</span>
            {formatType === 'video' && resolution && (
              <> at <span className="font-semibold text-foreground">{resolution}</span></>
            )}
            {isPlaylist && (
              <span className="ml-1 text-muted-foreground font-mono">
                ({selectedCount} video{selectedCount === 1 ? '' : 's'})
              </span>
            )}
          </div>

          <Button
            onClick={onDownload}
            disabled={isStartDisabled}
            className="w-full sm:w-auto rounded-xl font-bold px-6 py-2.5 shadow-md bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-sm"
          >
            <Download className="size-4" />
            <span>
              {isPlaylist
                ? `Download ${selectedCount} Video${selectedCount === 1 ? '' : 's'}`
                : 'Download Now'}
            </span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
