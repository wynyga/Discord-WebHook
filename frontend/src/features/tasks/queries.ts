import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type TaskListParams } from '../../api/endpoints';
import type { TaskInput, TaskUpdate } from '../../api/types';

/** Statuses change in the background (scheduled runs), so lists refresh on their own. */
export const REFRESH_MS = 15_000;

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: TaskListParams) => ['tasks', 'list', params] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksApi.get(id!),
    enabled: Boolean(id),
  });
}

/** Every change can move dashboard counts and logs, so all three are refreshed. */
function useInvalidateAll() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: taskKeys.all }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
      client.invalidateQueries({ queryKey: ['logs'] }),
    ]);
}

export function useTaskActions() {
  const invalidate = useInvalidateAll();
  const options = { onSuccess: invalidate };
  return {
    create: useMutation({ mutationFn: (input: TaskInput) => tasksApi.create(input), ...options }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: TaskUpdate }) => tasksApi.update(id, changes),
      ...options,
    }),
    remove: useMutation({ mutationFn: (id: string) => tasksApi.remove(id), ...options }),
    pause: useMutation({ mutationFn: (id: string) => tasksApi.pause(id), ...options }),
    resume: useMutation({ mutationFn: (id: string) => tasksApi.resume(id), ...options }),
    runNow: useMutation({ mutationFn: (id: string) => tasksApi.runNow(id), ...options }),
  };
}
