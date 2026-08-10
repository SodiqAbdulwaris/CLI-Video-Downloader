import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { UrlResolver } from './components/UrlResolver';
import { MediaConfigurator } from './components/MediaConfigurator';
import { DownloadMonitor } from './components/DownloadMonitor';
import { DownloadCompleteDialog } from './components/DownloadCompleteDialog';
import { Footer } from './components/Footer';
import { useDownloadSocket } from './hooks/useDownloadSocket';
import { resolveMedia, startDownload } from './lib/api';
import type { ResolvedMedia } from './types/download';

export default function App() {
  // Theme state: default to Light Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // UI / Media State
  const [url, setUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedData, setResolvedData] = useState<ResolvedMedia | null>(null);

  // Download Config State
  const [formatType, setFormatType] = useState<string>('video');
  const [resolution, setResolution] = useState<string>('');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Completion dialog state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const completedJobIdRef = useRef<string | null>(null);

  // WebSocket / Job state hook
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

  // Trigger completion modal when job finishes
  useEffect(() => {
    if (jobId && (jobStatus === 'completed' || jobStatus === 'failed')) {
      if (completedJobIdRef.current !== jobId) {
        completedJobIdRef.current = jobId;
        const timer = setTimeout(() => {
          setShowCompletionDialog(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [jobId, jobStatus]);

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
    resetSocketState();

    try {
      const data = await resolveMedia(url.trim());
      setResolvedData(data);
      setSelectedIndices(data.entries ? data.entries.map(e => e.index) : []);
      // Default to highest resolution if available
      if (data.available_resolutions && data.available_resolutions.length > 0) {
        setResolution(data.available_resolutions[0]);
      } else {
        setResolution('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while resolving the URL. Please verify the URL and try again.';
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
    } catch (err: unknown) {
      setJobStatus('failed');
      const message = err instanceof Error ? err.message : 'Failed to start download. Please try again.';
      setJobError(message);
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
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200 flex flex-col">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 flex flex-col flex-1 gap-6">
        <Header isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />

        <Hero />

        <main className="flex-1 flex flex-col gap-6">
          <UrlResolver
            url={url}
            onUrlChange={setUrl}
            onResolve={handleResolve}
            isResolving={isResolving}
            resolveError={resolveError}
            isDisabled={jobStatus === 'running' || jobStatus === 'queued'}
          />

          {resolvedData && (
            <MediaConfigurator
              resolvedData={resolvedData}
              formatType={formatType}
              resolution={resolution}
              selectedIndices={selectedIndices}
              onFormatChange={setFormatType}
              onResolutionChange={setResolution}
              onSelectAll={handleSelectAll}
              onToggleIndex={handleToggleIndex}
              onDownload={handleDownload}
              isDownloading={jobStatus === 'running' || jobStatus === 'queued'}
            />
          )}

          {jobStatus && (
            <DownloadMonitor
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
            />
          )}
        </main>

        <Footer />
      </div>

      <DownloadCompleteDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        jobStatus={jobStatus}
        jobItems={jobItems}
        onDownloadAnother={handleReset}
      />
    </div>
  );
}
