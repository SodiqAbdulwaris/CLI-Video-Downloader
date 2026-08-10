import React, { useState, useEffect, useRef } from 'react'
import {
  Download,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Loader2,
  Video,
  Music,
  Layers,
  Settings,
  Sun,
  Moon,
  RefreshCw,
  Clock,
  HelpCircle
} from 'lucide-react'

// shadcn / base-ui components
import { Button } from './components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from './components/ui/card'
import {
  Progress,
  ProgressLabel,
  ProgressValue
} from './components/ui/progress'
import { Badge } from './components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { Checkbox } from './components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select'

interface PlaylistEntry {
  index: number;
  title: string;
  duration: number | null;
  thumbnail?: string | null;
}

interface ResolvedMedia {
  content_type: 'playlist' | 'video' | 'audio';
  title: string;
  available_resolutions: string[];
  thumbnail?: string | null;
  entries?: PlaylistEntry[];
}

interface JobItem {
  index: number | null;
  title: string;
  state: 'queued' | 'downloading' | 'done' | 'failed';
  error: string | null;
}

// In production (Docker + nginx), VITE_API_BASE_URL is intentionally left empty so
// HTTP requests use relative paths (/api/...) — nginx same-origin proxies them.
// In development, set VITE_API_BASE_URL=http://localhost:8000 in frontend/.env.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const getWsUrl = (baseUrl: string, jobId: string) => {
  if (!baseUrl) {
    // Production: derive WebSocket URL from the current page origin
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProto}://${window.location.host}/api/ws/${jobId}`;
  }
  const wsProto = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const cleanUrl = baseUrl.replace(/^https?:\/\//, '');
  return `${wsProto}://${cleanUrl}/api/ws/${jobId}`;
};

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Graceful thumbnail loader with placeholder fallback
function MediaThumbnail({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center text-muted-foreground/60 gap-1 select-none ${className}`}>
        <Video className="size-5 opacity-40" />
        <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">No Preview</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setHasError(true)}
    />
  );
}

export default function App() {
  // Theme state: default to Light Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // UI state
  const [url, setUrl] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [resolvedData, setResolvedData] = useState<ResolvedMedia | null>(null)

  // Download config state
  const [formatType, setFormatType] = useState<string>('video')
  const [resolution, setResolution] = useState<string>('')
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  // Download job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<'queued' | 'running' | 'completed' | 'failed' | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [jobItems, setJobItems] = useState<JobItem[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected')
  const [socketLogs, setSocketLogs] = useState<string[]>([])

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const maxReconnectAttempts = 5

  // Apply theme class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle playlist select all toggles
  const handleSelectAll = () => {
    if (!resolvedData?.entries) return;
    if (selectedIndices.length === resolvedData.entries.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(resolvedData.entries.map(e => e.index));
    }
  };

  const handleToggleIndex = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Resolve URL
  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsResolving(true);
    setResolveError(null);
    setResolvedData(null);
    setJobId(null);
    setJobStatus(null);
    setJobItems([]);
    setProgressMap({});
    setSocketLogs([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Resolve failed with status ${response.status}`);
      }

      const data: ResolvedMedia = await response.json();
      setResolvedData(data);
      setSelectedIndices(data.entries ? data.entries.map(e => e.index) : []);
      // Default to highest resolution if available
      if (data.available_resolutions && data.available_resolutions.length > 0) {
        setResolution(data.available_resolutions[0]);
      } else {
        setResolution('');
      }
    } catch (err: any) {
      setResolveError(err.message || 'An unexpected error occurred while resolving the URL. Please verify the URL and try again.');
    } finally {
      setIsResolving(false);
    }
  };

  // Start Download Job
  const handleDownload = async () => {
    if (!resolvedData) return;

    setJobStatus('queued');
    setJobError(null);
    setJobItems([]);
    setProgressMap({});
    setSocketLogs([]);

    const payload = {
      url: url.trim(),
      format_type: formatType,
      resolution: formatType === 'video' ? (resolution || null) : null,
      indices: resolvedData.content_type === 'playlist' ? selectedIndices : null
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Download initiation failed.');
      }

      const { job_id } = await response.json();
      setJobId(job_id);
      connectWebSocket(job_id);
    } catch (err: any) {
      setJobStatus('failed');
      setJobError(err.message || 'Failed to start download. Please try again.');
    }
  };

  // WebSocket Connection & Reconnection
  const connectWebSocket = (id: string, isReconnecting = false) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setSocketStatus(isReconnecting ? 'reconnecting' : 'connecting');
    const wsUrl = getWsUrl(API_BASE_URL, id);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketStatus('connected');
      reconnectCountRef.current = 0;
      setSocketLogs(prev => [...prev, `[Connected] Connected to websocket for job ${id}`]);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSocketEvent(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = (event) => {
      setSocketStatus('disconnected');
      setSocketLogs(prev => [...prev, `[Disconnected] Connection closed (code: ${event.code})`]);

      // If job is not complete/failed, and we haven't reached max retries, try reconnecting
      if (
        jobStatus !== 'completed' &&
        jobStatus !== 'failed' &&
        reconnectCountRef.current < maxReconnectAttempts
      ) {
        reconnectCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 10000);
        setSocketLogs(prev => [...prev, `[Reconnect] Attempting to reconnect in ${delay / 1000}s... (Attempt ${reconnectCountRef.current}/${maxReconnectAttempts})`]);
        setTimeout(() => {
          connectWebSocket(id, true);
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      setSocketLogs(prev => [...prev, `[Error] WebSocket error occurred`]);
    };
  };

  // Parse websocket events
  const handleSocketEvent = (event: any) => {
    if (!event || !event.type) return;

    if (event.type === 'job') {
      setJobStatus(event.status);
      if (event.status === 'failed') {
        setJobError(event.error || 'The download job failed.');
      }
      setSocketLogs(prev => [...prev, `[Job] Status updated to: ${event.status}`]);
    } else if (event.type === 'item') {
      const idx = event.index;
      const title = event.title || event.item;
      const state = event.state || event.status || 'queued';
      const error = event.error || null;

      setJobItems(prev => {
        const existingIndex = prev.findIndex(item => item.index === idx);
        const updatedItem: JobItem = {
          index: idx,
          title: title,
          state: state,
          error: error
        };

        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex] = updatedItem;
          return updated;
        } else {
          return [...prev, updatedItem];
        }
      });
      setSocketLogs(prev => [...prev, `[Item] "${title}" status updated to: ${state}`]);
    } else if (event.type === 'progress') {
      const idx = event.index !== undefined && event.index !== null ? event.index : 'single';
      const percent = event.percent !== undefined && event.percent !== null ? event.percent : 0;
      setProgressMap(prev => ({
        ...prev,
        [String(idx)]: percent
      }));
    }
  };

  // Clean socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Compute Overall Progress Percent
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

  // Reset all flow
  const handleReset = () => {
    setUrl('');
    setResolvedData(null);
    setJobId(null);
    setJobStatus(null);
    setJobError(null);
    setJobItems([]);
    setProgressMap({});
    setSocketLogs([]);
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  // Helper check for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Main Container — editorial centered column */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex items-center justify-between py-6 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight select-none">YT Video Downloader</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-xl hover:bg-muted/80"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun className="size-5 text-yellow-400" /> : <Moon className="size-5 text-neutral-800 dark:text-neutral-200" />}
          </Button>
        </header>

        {/* Hero Section with Editorial Bold Display Typography */}
        <div className="py-8 md:py-12 flex flex-col gap-3 text-left">
          <h1 className="editorial-headline text-foreground leading-none">
            YT Video Downloader
          </h1>
          <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-xl">
            High-Speed Video & Playlist Downloader
          </p>
        </div>

        {/* Dashboard Flow */}
        <main className="flex flex-col gap-6">

          {/* STEP 1: Pill URL Input (Redesigned from Separate Card) */}
          <div className="w-full">
            <form onSubmit={handleResolve} className="pill-input-container w-full bg-card border-2 border-primary focus-within:ring-4 focus-within:ring-neutral-200 dark:focus-within:ring-neutral-800 transition-all">
              <div className="flex items-center flex-1 pl-4">
                <LinkIcon className="size-5 text-muted-foreground shrink-0" />
                <input
                  type="url"
                  placeholder="Paste YouTube video or playlist link..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isResolving || jobStatus === 'running' || jobStatus === 'queued'}
                  className="w-full bg-transparent border-0 outline-none px-3 py-3 text-sm md:text-base text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isResolving || !url.trim() || jobStatus === 'running' || jobStatus === 'queued'}
                className="rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity px-6 h-11 text-sm font-semibold shrink-0"
              >
                {isResolving ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" />
                    Resolving
                  </span>
                ) : (
                  "Resolve"
                )}
              </Button>
            </form>

            {resolveError && (
              <div className="mt-4 flex gap-2.5 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed items-start">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Unable to resolve URL: </span>
                  {resolveError}
                </div>
              </div>
            )}
          </div>


          {/* STEP 2: Configure Download (Conditional) */}
          {resolvedData && (
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
                      onValueChange={(val) => setFormatType(val)}
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
                  {formatType === 'video' && resolvedData.available_resolutions?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Settings className="size-4 text-primary" /> Video Resolution
                      </span>
                      <div className="w-full max-w-xs">
                        <Select value={resolution} onValueChange={(val) => setResolution(val || '')}>
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
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Layers className="size-4 text-primary" /> Playlist Items ({selectedIndices.length} / {resolvedData.entries.length} Selected)
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          type="button" 
                          onClick={handleSelectAll}
                          className="text-xs h-7 px-2.5 text-primary hover:bg-primary/10 rounded-lg"
                        >
                          {selectedIndices.length === resolvedData.entries.length ? 'Deselect All' : 'Select All'}
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
                            {resolvedData.entries.map((entry) => {
                              const isChecked = selectedIndices.includes(entry.index);
                              return (
                                <tr 
                                  key={entry.index}
                                  onClick={() => handleToggleIndex(entry.index)}
                                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                                >
                                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center">
                                      <Checkbox 
                                        checked={isChecked}
                                        onCheckedChange={() => handleToggleIndex(entry.index)}
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
                    onClick={handleDownload} 
                    disabled={jobStatus === 'running' || jobStatus === 'queued' || (resolvedData.content_type === 'playlist' && selectedIndices.length === 0)}
                    className="rounded-xl font-semibold gap-2 shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="size-4" />
                    Start Download
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}


          {/* STEP 3: Progress & Job status */}
          {jobStatus && (
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
                        <span className={`inline-block size-2 rounded-full ${
                          socketStatus === 'connected' ? 'bg-green-500' :
                          socketStatus === 'connecting' || socketStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                        }`} />
                        <span className="capitalize">{socketStatus}</span>
                      </div>

                      {/* Job level state badge */}
                      <Badge 
                        variant={
                          jobStatus === 'completed' ? 'default' :
                          jobStatus === 'failed' ? 'destructive' : 'secondary'
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
                    {jobId && <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Job ID: {jobId}</span>}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex flex-col gap-5">
                  {/* Overall progress bar */}
                  <div className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/20 border border-border/50">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span className="flex items-center gap-2 text-foreground/80">
                        {jobStatus === 'completed' ? (
                          <Check className="size-4 text-green-500" />
                        ) : jobStatus === 'failed' ? (
                          <AlertCircle className="size-4 text-destructive" />
                        ) : (
                          <Loader2 className="size-4 text-primary animate-spin" />
                        )}
                        {jobStatus === 'completed' ? 'Processing Complete' :
                         jobStatus === 'failed' ? 'Job Failed' :
                         jobStatus === 'running' ? 'Downloading items...' : 'In Queue...'}
                      </span>
                      <span className="font-mono text-primary text-base">{getOverallProgress()}%</span>
                    </div>

                    <Progress value={getOverallProgress()} className="h-2.5">
                      <ProgressLabel className="sr-only">Overall Progress</ProgressLabel>
                      <ProgressValue className="sr-only" />
                    </Progress>

                    <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                      <span>
                        {jobItems.length > 0 ? (
                          `${jobItems.filter(i => i.state === 'done').length} of ${jobItems.length} items completed`
                        ) : 'Pending items list...'}
                      </span>
                      {socketStatus === 'reconnecting' && (
                        <span className="text-yellow-600 dark:text-yellow-400 animate-pulse font-medium">
                          Reconnection active...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Errors */}
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
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                                    item.state === 'done' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                    item.state === 'failed' ? 'bg-red-500/10 text-red-600' :
                                    item.state === 'downloading' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                  }`}>
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
                        Assets are written to the <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Downloads</code> directory
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
                      onClick={handleReset}
                      className="rounded-xl text-xs font-semibold gap-1.5 shrink-0"
                    >
                      <RefreshCw className="size-3.5" />
                      Download Another
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-8 border-t border-border/40 mt-6 flex justify-between">
          <p>YT Video Downloader by S.A</p>
          <div className="flex gap-4">
            <a href="https://github.com/SodiqAbdulwaris/CLI-Video-Downloader" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </footer>

      </div>
    </div>
  )
}
