import { apiRequest } from './client';
import type {
  DashboardSummary,
  LoginResult,
  Paged,
  Task,
  TaskInput,
  TaskLog,
  TaskLogStatus,
  TaskStatus,
  TaskUpdate,
} from './types';

export interface TaskListParams {
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
}

export interface LogListParams {
  taskId?: string;
  status?: TaskLogStatus;
  page?: number;
  pageSize?: number;
}

type One<T> = { data: T };
const unwrap = <T>(response: One<T>) => response.data;

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<One<LoginResult>>('/auth/login', { method: 'POST', body: { username, password }, auth: false }).then(
      unwrap,
    ),
};

export const tasksApi = {
  list: (params: TaskListParams = {}) => apiRequest<Paged<Task>>('/tasks', { query: { ...params } }),
  get: (id: string) => apiRequest<One<Task>>(`/tasks/${id}`).then(unwrap),
  create: (input: TaskInput) => apiRequest<One<Task>>('/tasks', { method: 'POST', body: input }).then(unwrap),
  update: (id: string, changes: TaskUpdate) =>
    apiRequest<One<Task>>(`/tasks/${id}`, { method: 'PATCH', body: changes }).then(unwrap),
  remove: (id: string) => apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' }),
  pause: (id: string) => apiRequest<One<Task>>(`/tasks/${id}/pause`, { method: 'POST' }).then(unwrap),
  resume: (id: string) => apiRequest<One<Task>>(`/tasks/${id}/resume`, { method: 'POST' }).then(unwrap),
  runNow: (id: string) => apiRequest<One<{ taskId: string; status: 'queued' }>>(`/tasks/${id}/run`, { method: 'POST' }),
};

export const logsApi = {
  list: (params: LogListParams = {}) => apiRequest<Paged<TaskLog>>('/logs', { query: { ...params } }),
};

export const dashboardApi = {
  summary: () => apiRequest<One<DashboardSummary>>('/dashboard/summary').then(unwrap),
};
