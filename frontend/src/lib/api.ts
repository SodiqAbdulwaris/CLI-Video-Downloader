import type { ResolvedMedia, StartDownloadRequest, StartDownloadResponse } from '../types/download';

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
