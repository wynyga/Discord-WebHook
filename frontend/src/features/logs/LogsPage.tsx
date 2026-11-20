import { useId } from 'react';
import { useSearchParams } from 'react-router';
import type { TaskLogStatus } from '../../api/types';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SegmentedFilter,
} from '../../components/Layout';
import { useTasks } from '../tasks/queries';
import { LogsTable } from './LogsTable';
import { useLogs } from './queries';

type Filter = 'all' | TaskLogStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'failed', label: 'Failed' },
];
const PAGE_SIZE = 20;

export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const taskSelectId = useId();
  const status = (FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'all') as Filter;
  const taskId = params.get('taskId') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const logs = useLogs({ status: status === 'all' ? undefined : status, taskId: taskId || undefined, page, pageSize: PAGE_SIZE });
  const tasks = useTasks({ page: 1, pageSize: 100 });

  const setQuery = (next: { status?: Filter; taskId?: string; page?: number }) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      const nextStatus = next.status ?? status;
      const nextTask = next.taskId ?? taskId;
      if (nextStatus === 'all') updated.delete('status');
      else updated.set('status', nextStatus);
      if (nextTask) updated.set('taskId', nextTask);
      else updated.delete('taskId');
      updated.set('page', String(next.page ?? 1));
      return updated;
    });
  };

  return (
    <>
      <PageHeader title="Execution logs" description="Every delivery attempt, newest first. Refreshes every 10 seconds." />

      <search className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedFilter
          legend="Filter logs by status"
          name="log-status"
          value={status}
          options={FILTERS}
          onChange={(value) => setQuery({ status: value })}
        />
        <div className="flex items-center gap-2">
          <label htmlFor={taskSelectId} className="text-[0.8125rem] text-muted">
            Task
          </label>
          <select
            id={taskSelectId}
            className="min-h-9! w-56! py-1!"
            value={taskId}
            onChange={(e) => setQuery({ taskId: e.target.value })}
          >
            <option value="">All tasks</option>
            {tasks.data?.data.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </div>
      </search>

      <div className="card overflow-hidden">
        {logs.isPending ? (
          <LoadingState label="Loading logs…" />
        ) : logs.error ? (
          <ErrorState message={logs.error.message} onRetry={() => logs.refetch()} />
        ) : logs.data.data.length === 0 ? (
          <EmptyState title="No executions yet">Runs appear here as soon as a task fires or you press Run.</EmptyState>
        ) : (
          <>
            <LogsTable logs={logs.data.data} caption="Execution logs, newest first" captionId="logs-caption" />
            <Pagination
              page={logs.data.meta.page}
              totalPages={logs.data.meta.totalPages}
              total={logs.data.meta.total}
              onChange={(next) => setQuery({ page: next })}
            />
          </>
        )}
      </div>
    </>
  );
}
