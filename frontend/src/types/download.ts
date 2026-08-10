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

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type JobItemState = 'queued' | 'downloading' | 'done' | 'failed';
export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface JobItem {
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
      index: number | null;
      title?: string;
      item?: string;
      state?: JobItemState;
      status?: JobItemState;
      error?: string | null;
    }
  | {
      type: 'progress';
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
