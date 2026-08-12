export type HistoryStatus = 'completed' | 'partial' | 'failed';

export interface HistoryFile {
  title: string;
  filename: string | null;
  status: 'completed' | 'failed';
  duration: number | null;
  resolution: string | null;
  error: string | null;
}

export interface HistorySession {
  id: string;
  createdAt: string;
  completedAt: string;
  sourceUrl: string;
  title: string;
  type: 'video' | 'audio' | 'playlist' | 'short' | string;
  format: 'video' | 'audio' | string;
  resolution: string | null;
  requestedIndices: number[] | null;
  status: HistoryStatus;
  total: number;
  successful: number;
  failed: number;
  downloadLocation: string;
  thumbnail?: string | null;
  files: HistoryFile[];
}
