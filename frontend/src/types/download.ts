export interface PlaylistEntry {
  index: number;
  title: string;
  duration: number | null;
  thumbnail?: string | null;
}

export interface ResolvedMedia {
  content_type: 'playlist' | 'video' | 'audio';
  title: string;
  available_resolutions: string[];
  thumbnail?: string | null;
  entries?: PlaylistEntry[];
}

export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'partial' | 'failed';
export type JobItemState = 'queued' | 'downloading' | 'paused' | 'done' | 'failed' | 'cancelled';
// 'failed' here means reconnect attempts were exhausted — the backend appears unreachable.
export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface JobItem {
  task_id: string | null;
  index: number | null;
  title: string;
  state: JobItemState;
  error: string | null;
}

export type SocketEvent =
  | {
      type: 'job';
      status: JobStatus;
      job_id?: string;
      error?: string;
      completed?: number;
      failed?: number;
      failures?: unknown;
    }
  | {
      type: 'item';
      task_id?: string | null;
      index: number | null;
      title?: string;
      item?: string;
      state?: JobItemState;
      status?: JobItemState;
      error?: string | null;
    }
  | {
      type: 'progress';
      task_id?: string | null;
      item?: string;
      index?: number | null;
      status?: string;
      percent?: number;
    };

export interface StartDownloadRequest {
  url: string;
  format_type: string;
  resolution: string | null;
  indices: number[] | null;
}

export interface StartDownloadResponse {
  job_id: string;
}
