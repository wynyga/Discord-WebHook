/** Shapes returned by the backend API (see backend presenters). */

export type TaskStatus = 'active' | 'paused' | 'failed';
export type TaskLogStatus = 'success' | 'retrying' | 'failed';

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
}

export interface Task {
  id: string;
  name: string;
  cronSchedule: string;
  timezone: string;
  /** Masked by the API: the token is never sent to the browser. */
  webhookUrl: string;
  payload: DiscordPayload;
  maxRetry: number;
  retryDelayMs: number;
  status: TaskStatus;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  name: string;
  cronSchedule: string;
  timezone: string;
  webhookUrl: string;
  payload: DiscordPayload;
  maxRetry: number;
  retryDelayMs: number;
}

export type TaskUpdate = Partial<TaskInput>;

export interface TaskLog {
  id: string;
  taskId: string;
  taskName: string;
  executedAt: string;
  status: TaskLogStatus;
  retryCount: number;
  httpStatus: number | null;
  durationMs: number | null;
  message: string;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export interface DashboardSummary {
  tasks: Record<TaskStatus, number> & { total: number };
  executions24h: Record<TaskLogStatus, number> & { total: number };
}

export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
}

export interface FieldIssue {
  path: string;
  message: string;
}
