import { useState } from 'react';
import {
  Settings as SettingsIcon,
  FolderDown,
  Sun,
  Moon,
  KeyRound,
  Server,
  ShieldAlert,
  Upload,
  Check,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { API_BASE_URL } from '../lib/api';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  serverStatus: 'connected' | 'disconnected' | 'checking';
  onCheckServerHealth: () => void;
  downloadDirectory: string | null;
  onChangeDownloadLocation: () => void;
}

export function SettingsView({
  isDarkMode,
  onToggleTheme,
  serverStatus,
  onCheckServerHealth,
  downloadDirectory,
  onChangeDownloadLocation,
}: SettingsViewProps) {
  const [openFolderAfter, setOpenFolderAfter] = useState<boolean>(() => {
    return localStorage.getItem('auto_open_folder') === 'true';
  });

  const [cookieStatus, setCookieStatus] = useState<'idle' | 'uploading' | 'imported' | 'error'>('idle');
  const [cookieFileName, setCookieFileName] = useState<string | null>(null);
  const [cookieFileSize, setCookieFileSize] = useState<number | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);


  const handleToggleAutoOpen = (checked: boolean) => {
    setOpenFolderAfter(checked);
    localStorage.setItem('auto_open_folder', checked ? 'true' : 'false');
  };

  // const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   setCookieFileName(file.name);
  //   const reader = new FileReader();
  //   reader.onload = (event) => {
  //     const content = event.target?.result as string;
  //     if (content) {
  //       setCookieText(content);
  //       setCookieStatus('imported');
  //     }
  //   };
  //   reader.readAsText(file);
  // };

  // const handleFileUpload = async (
  //   e: React.ChangeEvent<HTMLInputElement>
  // ) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   setCookieFileName(file.name);
  //   // setCookieText(content);
  //   setCookieStatus('uploading');

  //   try {
  //     const formData = new FormData();
  //     formData.append('file', file);

  //     // const response = await fetch('/api/cookies', {
  //     //   method: 'POST',
  //     //   body: formData,
  //     // });
  //     const response = await fetch(`${API_BASE_URL}/api/cookies`, {
  //       method: 'POST',
  //       body: formData,
  //     });

  //     if (!response.ok) {
  //       throw new Error('Failed to upload cookies file');
  //     }

  //     setCookieStatus('imported');
  //   } catch (error) {
  //     console.error('Cookie upload failed:', error);
  //     setCookieStatus('error');
  //   }
  // };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCookieFileName(file.name);
    setCookieStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/cookies`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cookie upload failed (${response.status}): ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error('Backend did not confirm cookie import');
      }

      setCookieStatus('imported');
      setCookieFileSize(file.size);
    } catch (error) {
      console.error('Cookie upload failed:', error);
      setCookieStatus('error');
    }
  };



  const handlePingHealth = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await onCheckServerHealth();
      const duration = Math.round(performance.now() - start);
      setPingLatency(duration);
    } catch {
      setPingLatency(null);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-border/60 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="size-5 text-primary" />
          <span>Settings</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage local storage paths, visual appearance, server status, and cookies configuration
        </p>
      </div>

      {/* SECTION 1: Download Location */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FolderDown className="size-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Download Location</h3>
        </div>

        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-foreground">Download location</span>
              <span className="text-[11px] text-muted-foreground">
                Future downloads are saved here. Changing it never moves or deletes existing files.
              </span>
            </div>
            <code className="font-mono text-xs bg-background px-2.5 py-1 rounded-lg border border-border/60 font-semibold text-primary shrink-0 max-w-full truncate">
              {downloadDirectory || 'Not configured'}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-foreground">Change where downloads are saved</span>
              <span className="text-[11px] text-muted-foreground">
                Videos, Shorts and playlists are all saved directly into this single folder.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeDownloadLocation}
              className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5 shrink-0"
            >
              <FolderDown className="size-3" />
              <span>Change location</span>
            </Button>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 cursor-pointer select-none">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">Open download folder after completion</span>
              <span className="text-[11px] text-muted-foreground">Automatically open target folder when a download finishes</span>
            </div>
            <input
              type="checkbox"
              checked={openFolderAfter}
              onChange={(e) => handleToggleAutoOpen(e.target.checked)}
              className="size-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* SECTION 2: Appearance */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sun className="size-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Appearance</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <button
            onClick={() => {
              if (isDarkMode) onToggleTheme();
            }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${!isDarkMode
              ? 'border-primary bg-primary/5 text-primary font-bold shadow-2xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
          >
            <Sun className="size-5" />
            <span>Light Mode</span>
          </button>

          <button
            onClick={() => {
              if (!isDarkMode) onToggleTheme();
            }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${isDarkMode
              ? 'border-primary bg-primary/5 text-primary font-bold shadow-2xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
          >
            <Moon className="size-5" />
            <span>Dark Mode</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: Advanced (Cookies.txt) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Advanced — YouTube Cookies</h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            cookies.txt
          </Badge>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5 leading-relaxed">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Security Notice: </span>
            Importing a <code className="font-mono bg-background/50 px-1 py-0.5 rounded">cookies.txt</code> file enables yt-dlp to access age-restricted or private YouTube videos. Cookies contain sensitive authentication session tokens — handle with care.
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="border-2 border-dashed border-border/70 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-muted/20 transition-colors">
            <Upload className="size-6 text-muted-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-xs text-foreground">
                {cookieFileName ? cookieFileName : 'Import Netscape format cookies.txt'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Select a valid cookies file exported from browser extensions
              </span>
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer hover:bg-primary/90 shadow-2xs transition-opacity">
              <FileText className="size-3.5" />
              <span>Choose File</span>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {cookieStatus === 'imported' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="size-4" />
                <span className="font-semibold">Cookies imported successfully ({cookieFileName})</span>
              </div>
              {cookieFileSize !== null && (
                <span className="text-[11px] font-mono opacity-80">
                  {cookieFileSize.toLocaleString()} bytes
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Local Server Status */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Local Backend Server</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`size-2 rounded-full ${serverStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : serverStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
                }`}
            />
            <span className="font-semibold capitalize">
              {serverStatus === 'connected' ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-bold text-foreground">
              {API_BASE_URL || window.location.origin}
            </span>
            <span className="text-[11px] text-muted-foreground">
              FastAPI backend running locally with JSON history persistence
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pingLatency !== null && (
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {pingLatency} ms
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePingHealth}
              disabled={isPinging}
              className="h-8 px-3 rounded-xl text-xs font-semibold gap-1.5"
            >
              <RefreshCw className={`size-3 ${isPinging ? 'animate-spin' : ''}`} />
              <span>Ping /health</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
