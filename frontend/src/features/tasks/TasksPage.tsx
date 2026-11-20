import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Task, TaskStatus } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SegmentedFilter,
  TableRegion,
} from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toasts';
import { describeCron } from '../../lib/cron';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useTaskActions, useTasks } from './queries';

type Filter = 'all' | TaskStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
];
const PAGE_SIZE = 10;

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'all') as Filter;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useTasks({
    status: filter === 'all' ? undefined : filter,
    page,
    pageSize: PAGE_SIZE,
  });
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const actions = useTaskActions();
  const { notify } = useToast();

  const setQuery = (next: { status?: Filter; page?: number }) => {
    const status = next.status ?? filter;
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (status === 'all') updated.delete('status');
      else updated.set('status', status);
      updated.set('page', String(next.page ?? 1));
      return updated;
    });
  };

  const confirmDelete = useCallback(() => {
    const task = pendingDelete;
    if (!task) return;
    actions.remove.mutate(task.id, {
      onSuccess: () => notify(`Task "${task.name}" deleted.`, 'success'),
      onError: (err) => notify(`Could not delete "${task.name}": ${err.message}`, 'error'),
    });
  }, [pendingDelete, actions.remove, notify]);
  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const run = (task: Task) =>
    actions.runNow.mutate(task.id, {
      onSuccess: () => notify(`Run of "${task.name}" queued. The result appears in its logs.`, 'info'),
      onError: (err) => notify(`Could not run "${task.name}": ${err.message}`, 'error'),
    });

  const togglePause = (task: Task) => {
    const pausing = task.status !== 'paused';
    const mutation = pausing ? actions.pause : actions.resume;
    mutation.mutate(task.id, {
      onSuccess: () => notify(`Task "${task.name}" ${pausing ? 'paused' : 'resumed'}.`, 'success'),
      onError: (err) => notify(`Could not update "${task.name}": ${err.message}`, 'error'),
    });
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Scheduled messages and their current state."
        actions={
          <Link to="/tasks/new" className="btn btn-primary">
            <Icon name="plus" /> New task
          </Link>
        }
      />

      <search className="mb-4">
        <SegmentedFilter
          legend="Filter tasks by status"
          name="status"
          value={filter}
          options={FILTERS}
          onChange={(value) => setQuery({ status: value, page: 1 })}
        />
      </search>

      <div className="card overflow-hidden">
        {isPending ? (
          <LoadingState label="Loading tasks…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState title={filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}>
            {filter === 'all' && (
              <Link to="/tasks/new" className="text-accent underline">
                Create your first task
              </Link>
            )}
          </EmptyState>
        ) : (
          <>
            <TableRegion labelledBy="tasks-caption">
              <table className="data-table">
                <caption id="tasks-caption" className="sr-only">
                  Tasks, newest first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last run</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((task) => (
                    <tr key={task.id}>
                      <th scope="row">
                        <Link to={`/logs?taskId=${task.id}`} className="hover:underline">
                          {task.name}
                        </Link>
                      </th>
                      <td data-label="Schedule">
                        <code className="font-mono text-sm">{task.cronSchedule}</code>
                        <p className="text-sm text-muted">
                          {describeCron(task.cronSchedule) ?? 'Custom'} · {task.timezone}
                        </p>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={task.status} />
                      </td>
                      <td data-label="Last run">
                        {task.lastRunAt ? (
                          <time dateTime={task.lastRunAt} title={formatDateTime(task.lastRunAt)}>
                            {formatRelative(task.lastRunAt)}
                          </time>
                        ) : (
                          <span className="text-muted">Never</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(task)}>
                            {/* Spaces sit outside the hidden spans: some name computations trim them. */}
                            <Icon name="play" /> Run <span className="sr-only">{task.name} now</span>
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => togglePause(task)}>
                            <Icon name={task.status === 'paused' ? 'play' : 'pause'} />
                            {task.status === 'paused' ? 'Resume' : 'Pause'} <span className="sr-only">{task.name}</span>
                          </button>
                          <Link to={`/tasks/${task.id}/edit`} className="btn btn-ghost btn-sm">
                            <Icon name="edit" /> Edit <span className="sr-only">{task.name}</span>
                          </Link>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => setPendingDelete(task)}
                          >
                            <Icon name="trash" /> Delete <span className="sr-only">{task.name}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              onChange={(next) => setQuery({ page: next })}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        description="Its schedule stops and all of its execution logs are deleted. This cannot be undone."
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </>
  );
}
