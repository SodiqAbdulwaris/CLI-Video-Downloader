import { useState, useEffect, useCallback } from 'react';
import { getHistory, deleteHistorySession, clearHistory } from '../lib/api';
import type { HistorySession } from '../types/history';

export function useDownloadHistory() {
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [recentHistory, setRecentHistory] = useState<HistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHistory();
      setHistory(data);
      setRecentHistory(data.slice(0, 5));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load download history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeSession = useCallback(async (id: string) => {
    try {
      await deleteHistorySession(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      setRecentHistory(prev => prev.filter(item => item.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete history item';
      setError(msg);
      throw err;
    }
  }, []);

  const clearAllHistory = useCallback(async () => {
    try {
      await clearHistory();
      setHistory([]);
      setRecentHistory([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear history';
      setError(msg);
      throw err;
    }
  }, []);

  useEffect(() => {
    refetchHistory();
  }, [refetchHistory]);

  return {
    history,
    recentHistory,
    isLoading,
    error,
    refetchHistory,
    removeSession,
    clearAllHistory,
  };
}
