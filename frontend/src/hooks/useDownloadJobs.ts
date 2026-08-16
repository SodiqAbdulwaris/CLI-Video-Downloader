import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobItem, JobStatus, JobItemState, SocketStatus, SocketEvent } from '../types/download';
import { API_BASE_URL, getWsUrl } from '../lib/api';

const MAX_RECONNECT_ATTEMPTS = 5;
const TERMINAL_STATUSES: JobStatus[] = ['completed', 'partial', 'failed'];

export interface JobState {
  jobId: string;
  status: JobStatus | null;
  error: string | null;
  items: JobItem[];
  progressMap: Record<string, number>;
  socketStatus: SocketStatus;
  socketLogs: string[];
}

function createInitialJobState(jobId: string): JobState {
  return {
    jobId,
    status: 'queued',
    error: null,
    items: [],
    progressMap: {},
    socketStatus: 'connecting',
    socketLogs: [],
  };
}

/** One job's own connect/reconnect/backoff behavior, applied per job id so
 * several jobs can each hold their own live WebSocket connection at once. */
export function useDownloadJobs() {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});

  const socketsRef = useRef<Record<string, WebSocket>>({});
  const reconnectCountRef = useRef<Record<string, number>>({});
  const reconnectTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const statusRef = useRef<Record<string, JobStatus | null>>({});

  const updateJob = useCallback((jobId: string, updater: (prev: JobState) => JobState) => {
    setJobs(prev => {
      const current = prev[jobId] ?? createInitialJobState(jobId);
      return { ...prev, [jobId]: updater(current) };
    });
  }, []);

  const disconnectJob = useCallback((jobId: string) => {
    const timer = reconnectTimerRef.current[jobId];
    if (timer !== undefined) {
      clearTimeout(timer);
      delete reconnectTimerRef.current[jobId];
    }
    const ws = socketsRef.current[jobId];
    if (ws) {
      ws.onclose = null;
      ws.close();
      delete socketsRef.current[jobId];
    }
    reconnectCountRef.current[jobId] = 0;
  }, []);

  const handleSocketEvent = useCallback((jobId: string, event: SocketEvent) => {
    if (!event || !event.type) return;

    if (event.type === 'job') {
      // Set synchronously here, not inside the setJobs updater below: React
      // doesn't guarantee that updater function runs before this call
      // returns, and the WebSocket's onclose can fire right after a terminal
      // message (the server closes the connection once it sends one) —
      // confirmed live: onclose read a stale ref and reconnected a job that
      // had already completed.
      statusRef.current[jobId] = event.status;
      updateJob(jobId, prev => {
        const items = event.status === 'failed'
          ? prev.items.map(item =>
              item.state === 'downloading' || item.state === 'queued'
                ? { ...item, state: 'failed' as JobItemState, error: item.error || event.error || 'Job failed' }
                : item
            )
          : prev.items;
        return {
          ...prev,
          status: event.status,
          error: event.status === 'failed' ? (event.error || 'The download job failed.') : prev.error,
          items,
          socketLogs: [...prev.socketLogs, `[Job] Status updated to: ${event.status}`],
        };
      });
    } else if (event.type === 'item') {
      const taskId = event.task_id ?? null;
      const idx = event.index ?? null;
      const title = event.title || event.item || '';
      const state: JobItemState = event.state || event.status || 'queued';
      const error = event.error || null;

      updateJob(jobId, prev => {
        const existingIndex = prev.items.findIndex(item => (taskId ? item.task_id === taskId : item.index === idx));
        const updatedItem: JobItem = { task_id: taskId, index: idx, title, state, error };
        const items = existingIndex > -1
          ? prev.items.map((item, i) => (i === existingIndex ? updatedItem : item))
          : [...prev.items, updatedItem];
        return {
          ...prev,
          items,
          socketLogs: [...prev.socketLogs, `[Item] "${title}" status updated to: ${state}`],
        };
      });
    } else if (event.type === 'progress') {
      const key = event.task_id ?? (event.index ?? 'single');
      const percent = event.percent ?? 0;
      updateJob(jobId, prev => ({ ...prev, progressMap: { ...prev.progressMap, [String(key)]: percent } }));
    }
  }, [updateJob]);

  const connectJob = useCallback((jobId: string, isReconnecting = false) => {
    disconnectJob(jobId);
    updateJob(jobId, prev => ({ ...prev, socketStatus: isReconnecting ? 'reconnecting' : 'connecting' }));

    const ws = new WebSocket(getWsUrl(API_BASE_URL, jobId));
    socketsRef.current[jobId] = ws;

    ws.onopen = () => {
      reconnectCountRef.current[jobId] = 0;
      updateJob(jobId, prev => ({
        ...prev,
        socketStatus: 'connected',
        socketLogs: [...prev.socketLogs, `[Connected] Connected to websocket for job ${jobId}`],
      }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        handleSocketEvent(jobId, JSON.parse(event.data));
      } catch (err: unknown) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      const currentStatus = statusRef.current[jobId] ?? null;
      const isTerminal = currentStatus !== null && TERMINAL_STATUSES.includes(currentStatus);
      const attempts = reconnectCountRef.current[jobId] ?? 0;

      if (!isTerminal && attempts < MAX_RECONNECT_ATTEMPTS) {
        const nextAttempt = attempts + 1;
        reconnectCountRef.current[jobId] = nextAttempt;
        const delay = Math.min(1000 * Math.pow(2, nextAttempt), 10000);
        updateJob(jobId, prev => ({
          ...prev,
          socketStatus: 'reconnecting',
          socketLogs: [...prev.socketLogs, `[Reconnect] Attempting to reconnect in ${delay / 1000}s... (Attempt ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})`],
        }));
        reconnectTimerRef.current[jobId] = setTimeout(() => connectJob(jobId, true), delay);
      } else if (!isTerminal) {
        // Reconnect attempts exhausted — the backend may have stopped or
        // restarted. Distinct from 'disconnected' so the UI can show a
        // persistent "lost connection" banner instead of going quiet.
        updateJob(jobId, prev => ({
          ...prev,
          socketStatus: 'failed',
          socketLogs: [...prev.socketLogs, `[Disconnected] Lost connection to the backend (code: ${event.code}).`],
        }));
      } else {
        updateJob(jobId, prev => ({
          ...prev,
          socketStatus: 'disconnected',
          socketLogs: [...prev.socketLogs, `[Disconnected] Connection closed (code: ${event.code})`],
        }));
      }
    };

    ws.onerror = (err: Event) => {
      console.error('WebSocket error', err);
      updateJob(jobId, prev => ({ ...prev, socketLogs: [...prev.socketLogs, '[Error] WebSocket error occurred'] }));
    };
  }, [disconnectJob, handleSocketEvent, updateJob]);

  const startJob = useCallback((jobId: string) => {
    setJobs(prev => ({ ...prev, [jobId]: createInitialJobState(jobId) }));
    statusRef.current[jobId] = 'queued';
    connectJob(jobId);
  }, [connectJob]);

  const retryConnection = useCallback((jobId: string) => {
    reconnectCountRef.current[jobId] = 0;
    connectJob(jobId, true);
  }, [connectJob]);

  const removeJob = useCallback((jobId: string) => {
    disconnectJob(jobId);
    setJobs(prev => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, [disconnectJob]);

  // Disconnect every open socket on unmount.
  useEffect(() => {
    const sockets = socketsRef.current;
    return () => {
      Object.keys(sockets).forEach(disconnectJob);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    jobs,
    jobList: Object.values(jobs),
    startJob,
    removeJob,
    retryConnection,
  };
}
