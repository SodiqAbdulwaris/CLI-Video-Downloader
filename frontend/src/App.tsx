import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { UrlResolver } from './components/UrlResolver';
import { MediaConfigurator } from './components/MediaConfigurator';
import { RecentDownloads } from './components/RecentDownloads';
import { DownloadsView } from './components/DownloadsView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { DownloadCompleteDialog } from './components/DownloadCompleteDialog';
import { DownloadLocationDialog } from './components/DownloadLocationDialog';
import { useDownloadJobs } from './hooks/useDownloadJobs';
import { useDownloadHistory } from './hooks/useDownloadHistory';
import { resolveMedia, startDownload, getSettings, updateDownloadDirectory, updateMaxConcurrentDownloads, API_BASE_URL } from './lib/api';
import type { ResolvedMedia } from './types/download';
import type { HistorySession } from './types/history';

const TERMINAL_JOB_STATUSES = ['completed', 'partial', 'failed'];

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // App Shell navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('download');

  // Server Connection Status
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Download location / concurrency (persisted backend settings)
  const [downloadDirectory, setDownloadDirectory] = useState<string | null>(null);
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState<number>(2);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [showLocationDialog, setShowLocationDialog] = useState(false);

  // History state
  const {
    history,
    recentHistory,
    isLoading: isHistoryLoading,
    refetchHistory,
    removeSession,
    clearAllHistory,
  } = useDownloadHistory();

  // Media / Resolve State
  const [url, setUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isSubmittingDownload, setIsSubmittingDownload] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedData, setResolvedData] = useState<ResolvedMedia | null>(null);

  // Download Config State
  const [formatType, setFormatType] = useState<string>('video');
  const [resolution, setResolution] = useState<string>('');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Completion Dialog State — shows once per job, for whichever job most
  // recently reached a terminal state.
  const [completionJobId, setCompletionJobId] = useState<string | null>(null);
  const shownCompletionIds = useRef<Set<string>>(new Set());

  // Download jobs — several can run at once, each with its own live connection.
  const { jobs, jobList, startJob, removeJob, retryConnection } = useDownloadJobs();

  // Apply Dark/Light theme class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Check Backend Server Health
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setServerStatus('connected');
      } else {
        setServerStatus('disconnected');
      }
    } catch {
      setServerStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Load persisted settings; require download-location setup when none is configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await getSettings();
        if (cancelled) return;
        setDownloadDirectory(settings.download_directory);
        setMaxConcurrentDownloads(settings.max_concurrent_downloads);
      } catch {
        // Backend unreachable — the server status indicator covers this; do not
        // block the UI on a settings fetch failure.
      } finally {
        if (!cancelled) setIsSettingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveDownloadDirectory = async (path: string) => {
    const settings = await updateDownloadDirectory(path);
    setDownloadDirectory(settings.download_directory);
    if (settings.download_directory !== null) {
      setShowLocationDialog(false);
    }
  };

  const saveMaxConcurrentDownloads = async (value: number) => {
    const settings = await updateMaxConcurrentDownloads(value);
    setMaxConcurrentDownloads(settings.max_concurrent_downloads);
  };

  // Auto completion dialog & history refresh when any job finishes. Keyed on
  // a status signature, not jobList itself: jobList is a fresh array every
  // render (including on unrelated progress/log updates), which would
  // re-run this effect constantly and cancel the timer via its cleanup
  // before it ever fired — confirmed live, a socketLogs update landing
  // right after "completed" cancelled the dialog every time.
  const statusSignature = jobList.map(job => `${job.jobId}:${job.status}`).join(',');
  useEffect(() => {
    const justFinished = jobList.find(
      job => job.status && TERMINAL_JOB_STATUSES.includes(job.status) && !shownCompletionIds.current.has(job.jobId)
    );
    if (!justFinished) return;

    shownCompletionIds.current.add(justFinished.jobId);
    refetchHistory();
    const timer = setTimeout(() => setCompletionJobId(justFinished.jobId), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusSignature, refetchHistory]);

  // Playlist selection helpers
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

    try {
      const data = await resolveMedia(url.trim());
      setResolvedData(data);
      setSelectedIndices(data.entries ? data.entries.map(e => e.index) : []);
      if (data.available_resolutions && data.available_resolutions.length > 0) {
        setResolution(data.available_resolutions[0]);
      } else {
        setResolution('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while resolving the URL.';
      setResolveError(message);
    } finally {
      setIsResolving(false);
    }
  };

  const startDownloadJob = async (payload: Parameters<typeof startDownload>[0]) => {
    setIsSubmittingDownload(true);
    try {
      const { job_id } = await startDownload(payload);
      startJob(job_id);
      setActiveTab('downloads');
    } finally {
      setIsSubmittingDownload(false);
    }
  };

  // Start Download Job
  const handleDownload = async () => {
    if (!resolvedData) return;
    await startDownloadJob({
      url: url.trim(),
      format_type: formatType,
      resolution: formatType === 'video' ? (resolution || null) : null,
      indices: resolvedData.content_type === 'playlist' ? selectedIndices : null,
    });
  };

  // Redownload Session from History
  const handleRedownloadSession = async (session: HistorySession) => {
    if (!session.sourceUrl) return;

    const targetUrl = session.sourceUrl;
    setUrl(targetUrl);
    setIsResolving(true);
    setResolveError(null);
    setResolvedData(null);

    try {
      const data = await resolveMedia(targetUrl);
      setResolvedData(data);

      const targetFormat = session.format || 'video';
      const targetRes = session.resolution || (data.available_resolutions?.[0] ?? null);
      const targetIndices = session.requestedIndices ?? (data.entries ? data.entries.map(e => e.index) : null);

      setFormatType(targetFormat);
      setResolution(targetRes || '');
      setSelectedIndices(targetIndices || []);

      await startDownloadJob({
        url: targetUrl,
        format_type: targetFormat,
        resolution: targetFormat === 'video' ? targetRes : null,
        indices: data.content_type === 'playlist' ? targetIndices : null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start redownload job.';
      setResolveError(message);
    } finally {
      setIsResolving(false);
    }
  };

  // Reset the resolve/configure form to start a new download. Existing jobs
  // keep running independently — this doesn't touch them.
  const handleReset = () => {
    setUrl('');
    setResolvedData(null);
    setResolution('');
    setSelectedIndices([]);
    setResolveError(null);
    setActiveTab('download');
  };

  const activeJobsCount = jobList.filter(job => job.status === 'running' || job.status === 'queued').length;

  // Location dialog: forced setup on first run, editable later from Settings.
  const isSetupDialog = downloadDirectory === null && !isSettingsLoading;
  const isChangeDialog = showLocationDialog && downloadDirectory !== null;

  const completionJob = completionJobId ? jobs[completionJobId] : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-200">
      {/* Desktop Persistent Sidebar & Mobile Drawer */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        serverStatus={serverStatus}
        activeJobsCount={activeJobsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          serverStatus={serverStatus}
        />

        <main className="flex-1 p-4 sm:p-8 pb-24 md:pb-8 max-w-5xl w-full mx-auto flex flex-col gap-6">
          {/* TAB 1: DOWNLOAD (Dashboard view) */}
          {activeTab === 'download' && (
            <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Download from YouTube
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Videos, playlists & audio — downloaded directly to your local machine.
                </p>
              </div>

              {/* Primary URL Input Resolver */}
              <UrlResolver
                url={url}
                onUrlChange={setUrl}
                onResolve={handleResolve}
                isResolving={isResolving}
                resolveError={resolveError}
                isDisabled={isSubmittingDownload}
              />

              {/* Resolved Media Configurator */}
              {resolvedData && (
                <MediaConfigurator
                  resolvedData={resolvedData}
                  sourceUrl={url}
                  formatType={formatType}
                  resolution={resolution}
                  selectedIndices={selectedIndices}
                  onFormatChange={setFormatType}
                  onResolutionChange={setResolution}
                  onSelectAll={handleSelectAll}
                  onToggleIndex={handleToggleIndex}
                  onDownload={handleDownload}
                  isDownloading={isSubmittingDownload}
                  downloadDirectory={downloadDirectory}
                />
              )}

              {/* Recent Downloads Section */}
              <RecentDownloads
                recentHistory={recentHistory}
                onOpenFullHistory={() => setActiveTab('history')}
                onRedownload={handleRedownloadSession}
                onViewDetails={() => setActiveTab('history')}
                isLoading={isHistoryLoading}
              />
            </div>
          )}

          {/* TAB 2: DOWNLOADS (Active & Completed Download Manager) */}
          {activeTab === 'downloads' && (
            <DownloadsView
              jobs={jobList}
              onDismissJob={removeJob}
              onRetryConnection={retryConnection}
              onNavigateToDownload={() => setActiveTab('download')}
            />
          )}

          {/* TAB 3: HISTORY (Full History Screen) */}
          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onRedownloadSession={handleRedownloadSession}
              onDeleteSession={removeSession}
              onClearHistory={clearAllHistory}
              isLoading={isHistoryLoading}
            />
          )}

          {/* TAB 4: SETTINGS (Application Settings Screen) */}
          {activeTab === 'settings' && (
            <SettingsView
              isDarkMode={isDarkMode}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
              serverStatus={serverStatus}
              onCheckServerHealth={checkHealth}
              downloadDirectory={downloadDirectory}
              onChangeDownloadLocation={() => setShowLocationDialog(true)}
              maxConcurrentDownloads={maxConcurrentDownloads}
              onChangeMaxConcurrentDownloads={saveMaxConcurrentDownloads}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar (sidebar's counterpart below md) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveDownloads={activeJobsCount > 0}
      />

      {/* Download location setup / change dialog */}
      <DownloadLocationDialog
        open={isSetupDialog || isChangeDialog}
        dismissible={isChangeDialog}
        onOpenChange={(open) => {
          if (!open && !isSetupDialog) setShowLocationDialog(false);
        }}
        onSave={saveDownloadDirectory}
      />

      {/* Completion Modal — shown once per job, for whichever job just finished */}
      <DownloadCompleteDialog
        open={completionJob !== null}
        onOpenChange={(open) => {
          if (!open) setCompletionJobId(null);
        }}
        jobStatus={completionJob?.status ?? null}
        jobItems={completionJob?.items ?? []}
        onDownloadAnother={handleReset}
        downloadDirectory={downloadDirectory}
      />
    </div>
  );
}
