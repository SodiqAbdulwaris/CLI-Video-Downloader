import { useState, useEffect, useRef, useCallback } from 'react';
import type { JobItem, JobStatus, JobItemState, SocketStatus, SocketEvent } from '../types/download';
import { API_BASE_URL, getWsUrl } from '../lib/api';

const MAX_RECONNECT_ATTEMPTS = 5;

export function useDownloadSocket(initialJobId: string | null = null) {
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [socketLogs, setSocketLogs] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobStatusRef = useRef<JobStatus | null>(jobStatus);

  // Keep jobStatusRef synced with latest state to prevent stale closure in ws.onclose
  useEffect(() => {
    jobStatusRef.current = jobStatus;
  }, [jobStatus]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectCountRef.current = 0;
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocketStatus('disconnected');
  }, [clearReconnectTimer]);

  const resetSocketState = useCallback(() => {
    disconnect();
    setJobId(null);
    setJobStatus(null);
    setJobError(null);
    setJobItems([]);
    setProgressMap({});
    setSocketLogs([]);
  }, [disconnect]);

  const handleSocketEvent = useCallback((event: SocketEvent) => {
    if (!event || !event.type) return;

    if (event.type === 'job') {
      setJobStatus(event.status);
      jobStatusRef.current = event.status;
      if (event.status === 'failed') {
        setJobError(event.error || 'The download job failed.');
      }
      setSocketLogs(prev => [...prev, `[Job] Status updated to: ${event.status}`]);
    } else if (event.type === 'item') {
      const idx = event.index ?? null;
      const title = event.title || event.item || '';
      const state: JobItemState = event.state || event.status || 'queued';
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
  }, []);

  const connect = useCallback((id: string, isReconnecting = false) => {
    clearReconnectTimer();
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
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

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message: SocketEvent = JSON.parse(event.data);
        handleSocketEvent(message);
      } catch (err: unknown) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      setSocketStatus('disconnected');
      setSocketLogs(prev => [...prev, `[Disconnected] Connection closed (code: ${event.code})`]);

      const currentJobStatus = jobStatusRef.current;
      if (
        currentJobStatus !== 'completed' &&
        currentJobStatus !== 'failed' &&
        reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 10000);
        setSocketLogs(prev => [...prev, `[Reconnect] Attempting to reconnect in ${delay / 1000}s... (Attempt ${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS})`]);
        reconnectTimerRef.current = setTimeout(() => {
          connect(id, true);
        }, delay);
      }
    };

    ws.onerror = (err: Event) => {
      console.error('WebSocket error', err);
      setSocketLogs(prev => [...prev, `[Error] WebSocket error occurred`]);
    };
  }, [clearReconnectTimer, handleSocketEvent]);

  // Clean socket on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
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
    disconnect,
    resetSocketState
  };
}
