import { Layers, Settings, Video, Music, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MediaThumbnail } from './MediaThumbnail';
import { PlaylistSelector } from './PlaylistSelector';
import type { ResolvedMedia } from '../types/download';

interface MediaConfiguratorProps {
  resolvedData: ResolvedMedia;
  formatType: string;
  resolution: string;
  selectedIndices: number[];
  onFormatChange: (format: string) => void;
  onResolutionChange: (resolution: string) => void;
  onSelectAll: () => void;
  onToggleIndex: (index: number) => void;
  onDownload: () => void;
  isDownloading: boolean;
}

export function MediaConfigurator({
  resolvedData,
  formatType,
  resolution,
  selectedIndices,
  onFormatChange,
  onResolutionChange,
  onSelectAll,
  onToggleIndex,
  onDownload,
  isDownloading
}: MediaConfiguratorProps) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isStartDisabled =
    isDownloading ||
    (resolvedData.content_type === 'playlist' && selectedIndices.length === 0);

  return (
    <div
      className={`transition-all duration-300 transform ${
        prefersReducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-4'
      }`}
    >
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <Badge variant="secondary" className="px-2 py-0.5 rounded-md">Step 2</Badge>
              <span>Configure Media</span>
            </div>
            <Badge variant="outline" className="capitalize text-xs font-semibold px-2.5 py-0.5">
              {resolvedData.content_type}
            </Badge>
          </div>
          <CardTitle className="text-lg font-bold tracking-tight text-foreground line-clamp-2">
            {resolvedData.title}
          </CardTitle>
          <CardDescription>
            Configure download specifications, codec formats, and choose download targets.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Single Video / Audio Cover Preview */}
          {resolvedData.content_type !== 'playlist' && (
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-border/80 bg-muted select-none">
              <MediaThumbnail
                src={resolvedData.thumbnail}
                alt={resolvedData.title}
                className="w-full h-full"
              />
            </div>
          )}

          {/* Format Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-4 text-primary" /> Format Type
            </span>
            <Tabs
              defaultValue="video"
              value={formatType}
              onValueChange={onFormatChange}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full max-w-sm rounded-xl">
                <TabsTrigger value="video" className="gap-2 rounded-lg py-1.5">
                  <Video className="size-4" /> Video (MP4)
                </TabsTrigger>
                <TabsTrigger value="audio" className="gap-2 rounded-lg py-1.5">
                  <Music className="size-4" /> Audio Only (MP3)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Resolution Selector (Video only) */}
          {formatType === 'video' && resolvedData.available_resolutions && resolvedData.available_resolutions.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Settings className="size-4 text-primary" /> Video Resolution
              </span>
              <div className="w-full max-w-xs">
                <Select value={resolution} onValueChange={(val) => onResolutionChange(val || '')}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="Select quality..." />
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
            </div>
          )}

          {/* Playlist Selection Table */}
          {resolvedData.content_type === 'playlist' && resolvedData.entries && (
            <PlaylistSelector
              entries={resolvedData.entries}
              selectedIndices={selectedIndices}
              onSelectAll={onSelectAll}
              onToggleIndex={onToggleIndex}
            />
          )}
        </CardContent>

        <CardFooter className="border-t border-border/40 pt-4 flex justify-between items-center gap-4 bg-muted/10">
          <div className="text-xs text-muted-foreground">
            Ready to download format: <span className="font-semibold text-foreground capitalize">{formatType}</span>
            {formatType === 'video' && resolution && (
              <> at <span className="font-semibold text-foreground">{resolution}</span></>
            )}
          </div>
          <Button
            onClick={onDownload}
            disabled={isStartDisabled}
            className="rounded-xl font-semibold gap-2 shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="size-4" />
            Start Download
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
