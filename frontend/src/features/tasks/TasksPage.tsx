import { Link, useSearchParams } from 'react-router';
import type { TaskStatus } from '../../api/types';
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
import { describeCron } from '../../lib/cron';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useTasks } from './queries';
import { TaskQuickActions } from './TaskActions';

type Filter = 'all' | TaskStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
];
const PAGE_SIZE = 10;

function When({ iso, empty }: { iso: string | null; empty: string }) {
  if (!iso) return <span className="text-muted">{empty}</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </time>
  );
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'all') as Filter;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useTasks({
    status: filter === 'all' ? undefined : filter,
    page,
    pageSize: PAGE_SIZE,
  });

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

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Scheduled Discord messages. Open a task for its schedule, details and runs."
        actions={
          <Link to="/tasks/new" className="btn btn-primary">
            <Icon name="plus" /> New task
          </Link>
        }
      />

      <search className="mb-3">
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
              <Link to="/tasks/new" className="text-fg underline">
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
                    <th scope="col">Task</th>
                    <th scope="col">Status</th>
                    <th scope="col">Next run</th>
                    <th scope="col">Last run</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((task) => (
                    <tr key={task.id}>
                      <th scope="row" className="min-w-56">
                        <Link to={`/tasks/${task.id}`} className="hover:underline">
                          {task.name}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-normal text-muted">
                          <code className="text-fg">{task.cronSchedule}</code>
                          <span>
                            {describeCron(task.cronSchedule) ?? 'Custom'} · {task.timezone}
                          </span>
                        </p>
                      </th>
                      <td data-label="Status">
                        <StatusBadge status={task.status} />
                      </td>
                      <td data-label="Next run" className="whitespace-nowrap">
                        <When iso={task.nextRunAt} empty="Paused" />
                      </td>
                      <td data-label="Last run" className="whitespace-nowrap">
                        <When iso={task.lastRunAt} empty="Never" />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <TaskQuickActions task={task} compact />
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
    </>
  );
}
