import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { dashboardApi } from '../../api/endpoints';
import { Icon, type IconName } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/Layout';
import { formatCount } from '../../lib/format';
import { LogsTable } from '../logs/LogsTable';
import { useLogs } from '../logs/queries';

const REFRESH_MS = 15_000;

interface Stat {
  label: string;
  value: number;
  icon: IconName;
  tone: string;
  to?: string;
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary, refetchInterval: REFRESH_MS });
  const recent = useLogs({ page: 1, pageSize: 5 });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How your scheduled messages are doing."
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
          <section aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Tasks
            </h2>
            <StatGrid
              stats={[
                { label: 'Total tasks', value: summary.data.tasks.total, icon: 'list', tone: 'text-accent bg-accent-soft', to: '/tasks' },
                { label: 'Active', value: summary.data.tasks.active, icon: 'dot', tone: 'text-success bg-success-soft', to: '/tasks?status=active' },
                { label: 'Paused', value: summary.data.tasks.paused, icon: 'pause', tone: 'text-warning bg-warning-soft', to: '/tasks?status=paused' },
                { label: 'Failed', value: summary.data.tasks.failed, icon: 'x', tone: 'text-danger bg-danger-soft', to: '/tasks?status=failed' },
              ]}
            />
          </section>

          <section aria-labelledby="executions-heading" className="mt-8">
            <h2 id="executions-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Executions in the last 24 hours
            </h2>
            <StatGrid
              stats={[
                { label: 'Attempts', value: summary.data.executions24h.total, icon: 'clock', tone: 'text-accent bg-accent-soft', to: '/logs' },
                { label: 'Delivered', value: summary.data.executions24h.success, icon: 'check', tone: 'text-success bg-success-soft', to: '/logs?status=success' },
                { label: 'Retried', value: summary.data.executions24h.retrying, icon: 'retry', tone: 'text-warning bg-warning-soft', to: '/logs?status=retrying' },
                { label: 'Failed', value: summary.data.executions24h.failed, icon: 'x', tone: 'text-danger bg-danger-soft', to: '/logs?status=failed' },
              ]}
            />
          </section>
        </>
      )}

      <section aria-labelledby="recent-heading" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent executions
          </h2>
          <Link to="/logs" className="text-sm font-semibold text-accent hover:underline">
            View all logs
          </Link>
        </div>
        <div className="card overflow-hidden">
          {recent.isPending ? (
            <LoadingState label="Loading recent executions…" />
          ) : recent.error ? (
            <ErrorState message={recent.error.message} onRetry={() => recent.refetch()} />
          ) : recent.data.data.length === 0 ? (
            <EmptyState title="Nothing has run yet">Create a task, or press Run on one to try it.</EmptyState>
          ) : (
            <LogsTable logs={recent.data.data} caption="Five most recent executions" captionId="recent-caption" />
          )}
        </div>
      </section>
    </>
  );
}

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const body = (
          <>
            <span className={`grid size-10 place-items-center rounded-xl ${stat.tone}`}>
              <Icon name={stat.icon} className="size-5" />
            </span>
            <span className="mt-4 block text-3xl font-bold tabular-nums">{formatCount(stat.value)}</span>
            <span className="text-sm text-muted">{stat.label}</span>
          </>
        );
        return (
          <li key={stat.label}>
            {stat.to ? (
              <Link to={stat.to} className="card block p-5 transition-colors hover:border-line-strong">
                {body}
              </Link>
            ) : (
              <div className="card p-5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
