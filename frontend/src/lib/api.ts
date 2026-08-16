import type { ResolvedMedia, StartDownloadRequest, StartDownloadResponse } from '../types/download';
import type { HistorySession } from '../types/history';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface AppSettings {
  download_directory: string | null;
  max_concurrent_downloads: number;
}

export function getWsUrl(baseUrl: string, jobId: string): string {
  if (!baseUrl) {
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProto}://${window.location.host}/api/ws/${jobId}`;
  }
  const wsProto = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const cleanUrl = baseUrl.replace(/^https?:\/\//, '');
  return `${wsProto}://${cleanUrl}/api/ws/${jobId}`;
}

export async function resolveMedia(url: string): Promise<ResolvedMedia> {
  const response = await fetch(`${API_BASE_URL}/api/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Resolve failed with status ${response.status}`);
  }

  return response.json();
}

export async function startDownload(payload: StartDownloadRequest): Promise<StartDownloadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Download initiation failed.');
  }

  return response.json();
}

export async function getHistory(): Promise<HistorySession[]> {
  const response = await fetch(`${API_BASE_URL}/api/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch download history.');
  }
  return response.json();
}

export async function getRecentHistory(limit = 5): Promise<HistorySession[]> {
  const response = await fetch(`${API_BASE_URL}/api/history/recent?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recent download history.');
  }
  return response.json();
}

export async function getHistorySession(id: string): Promise<HistorySession> {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch history session details.');
  }
  return response.json();
}

export async function deleteHistorySession(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete history entry.');
  }
}

export async function clearHistory(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to clear download history.');
  }
}

export async function getSettings(): Promise<AppSettings> {
  const response = await fetch(`${API_BASE_URL}/api/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch application settings.');
  }
  return response.json();
}

export async function updateDownloadDirectory(download_directory: string): Promise<AppSettings> {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ download_directory })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update the download location.');
  }

  return response.json();
}

export async function updateMaxConcurrentDownloads(max_concurrent_downloads: number): Promise<AppSettings> {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_concurrent_downloads })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update the concurrent download limit.');
  }

  return response.json();
}

async function postTaskAction(path: string): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Request failed.');
  }
  return response.json();
}

export const pauseTask = (taskId: string) => postTaskAction(`/api/tasks/${taskId}/pause`);
export const resumeTask = (taskId: string) => postTaskAction(`/api/tasks/${taskId}/resume`);
export const cancelTask = (taskId: string) => postTaskAction(`/api/tasks/${taskId}/cancel`);
export const cancelJob = (jobId: string) => postTaskAction(`/api/jobs/${jobId}/cancel`);
