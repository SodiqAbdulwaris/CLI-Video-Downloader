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
import { useDownloadSocket } from './hooks/useDownloadSocket';
import { useDownloadHistory } from './hooks/useDownloadHistory';
import { resolveMedia, startDownload, getSettings, updateDownloadDirectory, API_BASE_URL } from './lib/api';
import type { ResolvedMedia } from './types/download';
import type { HistorySession } from './types/history';

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

  // Download location (persisted backend setting)
  const [downloadDirectory, setDownloadDirectory] = useState<string | null>(null);
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
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedData, setResolvedData] = useState<ResolvedMedia | null>(null);

  // Download Config State
  const [formatType, setFormatType] = useState<string>('video');
  const [resolution, setResolution] = useState<string>('');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Completion Dialog State
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const completedJobIdRef = useRef<string | null>(null);

  // WebSocket / Download Hook
  const {
    jobId,
    setJobId,
    jobStatus,
    setJobStatus,
    jobError,
    setJobError,
    jobItems,
    setJobItems,
    progressMap,
    setProgressMap,
    socketStatus,
    socketLogs,
    setSocketLogs,
    connect,
    resetSocketState
  } = useDownloadSocket();

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

  // Load persisted download location; require setup when none is configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await getSettings();
        if (cancelled) return;
        setDownloadDirectory(settings.download_directory);
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

  // Auto completion dialog & history refresh when job finishes
  useEffect(() => {
    if (jobId && (jobStatus === 'completed' || jobStatus === 'failed')) {
      if (completedJobIdRef.current !== jobId) {
        completedJobIdRef.current = jobId;
        refetchHistory();
        const timer = setTimeout(() => {
          setShowCompletionDialog(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [jobId, jobStatus, refetchHistory]);

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
    completedJobIdRef.current = null;
    setShowCompletionDialog(false);

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

  // Start Download Job
  const handleDownload = async () => {
    if (!resolvedData) return;

    completedJobIdRef.current = null;
    setShowCompletionDialog(false);
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
      const { job_id } = await startDownload(payload);
      setJobId(job_id);
      connect(job_id);
      // Automatically switch to Downloads queue manager view
      setActiveTab('downloads');
    } catch (err: unknown) {
      setJobStatus('failed');
      const message = err instanceof Error ? err.message : 'Failed to start download.';
      setJobError(message);
    }
  };

  // Redownload Session from History
  const handleRedownloadSession = async (session: HistorySession) => {
    if (!session.sourceUrl) return;

    const targetUrl = session.sourceUrl;
    setUrl(targetUrl);
    setIsResolving(true);
    setResolveError(null);
    setResolvedData(null);
    completedJobIdRef.current = null;
    setShowCompletionDialog(false);
    resetSocketState();

    try {
      const data = await resolveMedia(targetUrl);
      setResolvedData(data);

      const targetFormat = session.format || 'video';
      const targetRes = session.resolution || (data.available_resolutions?.[0] ?? null);
      const targetIndices = session.requestedIndices ?? (data.entries ? data.entries.map(e => e.index) : null);

      setFormatType(targetFormat);
      setResolution(targetRes || '');
      setSelectedIndices(targetIndices || []);

      setJobStatus('queued');
      setJobError(null);
      setJobItems([]);
      setProgressMap({});
      setSocketLogs([]);

      const payload = {
        url: targetUrl,
        format_type: targetFormat,
        resolution: targetFormat === 'video' ? targetRes : null,
        indices: data.content_type === 'playlist' ? targetIndices : null
      };

      const { job_id } = await startDownload(payload);
      setJobId(job_id);
      connect(job_id);
      setActiveTab('downloads');
    } catch (err: unknown) {
      setJobStatus('failed');
      const message = err instanceof Error ? err.message : 'Failed to start redownload job.';
      setJobError(message);
    } finally {
      setIsResolving(false);
    }
  };

  // Reset overall state for a new download
  const handleReset = () => {
    completedJobIdRef.current = null;
    setShowCompletionDialog(false);
    setUrl('');
    setResolvedData(null);
    setResolution('');
    setSelectedIndices([]);
    setResolveError(null);
    resetSocketState();
    setActiveTab('download');
  };

  // Active jobs count badge for sidebar
  const activeJobsCount = (jobStatus === 'running' || jobStatus === 'queued') ? 1 : 0;

  // Location dialog: forced setup on first run, editable later from Settings.
  const isSetupDialog = downloadDirectory === null && !isSettingsLoading;
  const isChangeDialog = showLocationDialog && downloadDirectory !== null;

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
                isDisabled={jobStatus === 'running' || jobStatus === 'queued'}
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
                  isDownloading={jobStatus === 'running' || jobStatus === 'queued'}
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
              jobId={jobId}
              jobStatus={jobStatus}
              jobError={jobError}
              jobItems={jobItems}
              progressMap={progressMap}
              socketStatus={socketStatus}
              socketLogs={socketLogs}
              resolvedData={resolvedData}
              selectedIndices={selectedIndices}
              onReset={handleReset}
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

      {/* Completion Modal */}
      <DownloadCompleteDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        jobStatus={jobStatus}
        jobItems={jobItems}
        onDownloadAnother={handleReset}
        downloadDirectory={downloadDirectory}
      />
    </div>
  );
}
