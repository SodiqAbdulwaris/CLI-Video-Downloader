import type { ResolvedMedia, StartDownloadRequest, StartDownloadResponse } from '../types/download';
import type { HistorySession } from '../types/history';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
