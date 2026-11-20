import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { dashboardApi } from '../../api/endpoints';
import type { DashboardSummary, HourlyActivity, TaskLog } from '../../api/types';
import { ActivityChart } from '../../components/ActivityChart';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/Layout';
import { Sparkline } from '../../components/Sparkline';
import { HttpBadge } from '../../components/StatusBadge';
import { formatCount, formatDateTime, formatRelative } from '../../lib/format';
import { useLogs } from '../logs/queries';

const REFRESH_MS = 15_000;

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary, refetchInterval: REFRESH_MS });
  const recent = useLogs({ page: 1, pageSize: 6 });

  return (
    <>
      <PageHeader
        title="Overview"
        description="Delivery activity of the last 24 hours."
        actions={
          <Link to="/tasks/new" className="btn btn-primary">
            <Icon name="plus" /> New task
          </Link>
        }
      />

      {summary.isPending ? (
        <LoadingState label="Loading summary…" />
      ) : summary.error ? (
        <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <ExecutionStats summary={summary.data} />
          <TaskCounts tasks={summary.data.tasks} />
        </>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-label="Hourly activity">
          {summary.data ? (
            <ActivityChart data={summary.data.activity24h} title="Hourly activity" />
          ) : (
            <LoadingState label="Loading activity…" />
          )}
        </section>

        <section className="card flex flex-col" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 id="recent-heading" className="font-medium">
              Recent executions
            </h2>
            <Link to="/logs" className="text-[0.8125rem] text-muted hover:text-fg hover:underline">
              View all
            </Link>
          </div>
          {recent.isPending ? (
            <LoadingState label="Loading recent executions…" />
          ) : recent.error ? (
            <ErrorState message={recent.error.message} onRetry={() => recent.refetch()} />
          ) : recent.data.data.length === 0 ? (
            <EmptyState title="Nothing has run yet">Create a task, or press Run on one to try it.</EmptyState>
          ) : (
            <RecentList logs={recent.data.data} />
          )}
        </section>
      </div>
    </>
  );
}

function series(activity: HourlyActivity[], pick: (h: HourlyActivity) => number) {
  return activity.map(pick);
}

/** One strip of figures with trends, as in the reference "Webhooks" overview. */
function ExecutionStats({ summary }: { summary: DashboardSummary }) {
  const { executions24h: e, activity24h: a } = summary;
  const rate = e.total === 0 ? null : Math.round((e.success / e.total) * 100);
  const stats = [
    { label: 'Attempts', value: formatCount(e.total), trend: series(a, (h) => h.success + h.retrying + h.failed), to: '/logs' },
    { label: 'Delivered', value: formatCount(e.success), trend: series(a, (h) => h.success), to: '/logs?status=success' },
    { label: 'Failed', value: formatCount(e.failed), trend: series(a, (h) => h.failed), to: '/logs?status=failed' },
    { label: 'Retried', value: formatCount(e.retrying), trend: series(a, (h) => h.retrying), to: '/logs?status=retrying' },
    { label: 'Success rate', value: rate === null ? '—' : `${rate}%`, trend: null, to: undefined },
  ];

  return (
    <section aria-label="Executions in the last 24 hours" className="card">
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const body = (
            <>
              <span className="text-[0.8125rem] text-muted">{stat.label}</span>{' '}
              <span className="mt-1 flex items-end justify-between gap-2">
                <span className="text-2xl font-semibold tracking-tight">{stat.value}</span>
                {stat.trend && <Sparkline values={stat.trend} />}
              </span>
            </>
          );
          return (
            <li key={stat.label} className="border-line [&:not(:last-child)]:border-e max-lg:[&:nth-child(n+3)]:border-t">
              {stat.to ? (
                <Link to={stat.to} className="flex h-full flex-col rounded-[inherit] p-4 hover:bg-surface-2">
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The brief's dashboard summary (total, active, failed tasks), as a compact row of links. */
function TaskCounts({ tasks }: { tasks: DashboardSummary['tasks'] }) {
  const items = [
    { label: 'Total tasks', value: tasks.total, to: '/tasks', dot: 'var(--line-strong)' },
    { label: 'Active', value: tasks.active, to: '/tasks?status=active', dot: 'var(--status-good)' },
    { label: 'Paused', value: tasks.paused, to: '/tasks?status=paused', dot: 'var(--muted)' },
    { label: 'Failed', value: tasks.failed, to: '/tasks?status=failed', dot: 'var(--status-critical)' },
  ];
  return (
    <section aria-label="Tasks" className="mt-4 flex flex-wrap items-center gap-2">
      <h2 className="eyebrow me-1">Tasks</h2>
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[0.8125rem] hover:border-line-strong"
        >
          <span className="size-1.5 rounded-full" style={{ background: item.dot }} aria-hidden="true" />
          {/* Explicit space: name computation joins adjacent spans without one ("4Total tasks"). */}
          <span className="font-semibold tabular-nums">{item.value}</span>{' '}
          <span className="text-muted">{item.label}</span>
        </Link>
      ))}
    </section>
  );
}

function RecentList({ logs }: { logs: TaskLog[] }) {
  return (
    <ul className="divide-y divide-line border-t border-line" aria-label="Six most recent executions">
      {logs.map((log) => (
        <li key={log.id}>
          <Link
            to={`/tasks/${log.taskId}?tab=runs`}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2"
          >
            <HttpBadge status={log.httpStatus} />
            <span className="min-w-0 flex-1 truncate">{log.taskName}</span>
            <time dateTime={log.executedAt} title={formatDateTime(log.executedAt)} className="shrink-0 text-xs text-muted">
              {formatRelative(log.executedAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
