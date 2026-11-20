import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { TaskDetail } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { DetailList, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toasts';
import { describeCron } from '../../lib/cron';
import { formatDateTime, formatRelative } from '../../lib/format';
import { LogsTable } from '../logs/LogsTable';
import { useLogs } from '../logs/queries';
import { useTask, useTaskActions } from './queries';
import { TaskQuickActions } from './TaskActions';

const CRON_FIELDS = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];
const RUNS_PAGE_SIZE = 15;

/** Layout follows the reference "Cron job sheet": header with actions, Overview / Runs tabs. */
export function TaskDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'runs' ? 'runs' : 'overview';
  const task = useTask(id);
  const runs = useLogs({ taskId: id, page: 1, pageSize: 1 });

  if (task.isPending) return <LoadingState label="Loading task…" />;
  if (task.error || !task.data) {
    return <ErrorState message={task.error?.message ?? 'Task not found.'} onRetry={() => task.refetch()} />;
  }
  const data = task.data;

  return (
    <>
      <TaskHeader task={data} />

      <nav aria-label="Task sections" className="mb-5 border-b border-line">
        <ul className="-mb-px flex gap-5">
          <TabLink to={`/tasks/${id}`} active={tab === 'overview'}>
            Overview
          </TabLink>
          <TabLink to={`/tasks/${id}?tab=runs`} active={tab === 'runs'}>
            Runs
            {runs.data && (
              <span className="ms-1.5 rounded-md bg-surface-2 px-1.5 py-px text-xs tabular-nums text-muted">
                {runs.data.meta.total}
              </span>
            )}
          </TabLink>
        </ul>
      </nav>

      {tab === 'overview' ? <Overview task={data} /> : <Runs taskId={id} />}
    </>
  );
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <li>
      {/* Link, not NavLink: both tabs share the path and differ only in the query string. */}
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex items-center border-b-2 pb-2.5 font-medium ${
          active ? 'border-ink text-fg' : 'border-transparent text-muted hover:text-fg'
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

function TaskHeader({ task }: { task: TaskDetail }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { remove } = useTaskActions();
  const [confirming, setConfirming] = useState(false);

  const confirmDelete = useCallback(() => {
    remove.mutate(task.id, {
      onSuccess: () => {
        notify(`Task "${task.name}" deleted.`, 'success');
        navigate('/tasks');
      },
      onError: (err) => notify(`Could not delete "${task.name}": ${err.message}`, 'error'),
    });
  }, [remove, task.id, task.name, notify, navigate]);
  const closeDialog = useCallback(() => setConfirming(false), []);

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link to="/tasks" className="inline-flex items-center gap-1 hover:text-fg">
              <Icon name="back" className="size-3.5" /> Tasks
            </Link>
            <span aria-hidden="true">/</span>
            <code title={task.id}>TASK-{task.id.slice(0, 8).toUpperCase()}</code>
          </div>
        }
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {task.name}
            <StatusBadge status={task.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
            <code className="text-fg">{task.cronSchedule}</code>
            <span aria-hidden="true">·</span>
            <span>{describeCron(task.cronSchedule) ?? 'Custom schedule'}</span>
            <span aria-hidden="true">·</span>
            <span>{task.timezone}</span>
          </span>
        }
        actions={
          <>
            <TaskQuickActions task={task} />
            <Link to={`/tasks/${task.id}/edit`} className="btn btn-sm">
              <Icon name="edit" /> Edit
            </Link>
            <button type="button" className="btn btn-sm text-danger" onClick={() => setConfirming(true)}>
              <Icon name="trash" /> Delete <span className="sr-only">{task.name}</span>
            </button>
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        title={`Delete "${task.name}"?`}
        description="Its schedule stops and all of its execution logs are deleted. This cannot be undone."
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onClose={closeDialog}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4 first:border-t-0" aria-label={title}>
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Overview({ task }: { task: TaskDetail }) {
  const lastFailure = useLogs({ taskId: task.id, status: 'failed', page: 1, pageSize: 1 });
  const failure = task.status === 'failed' ? lastFailure.data?.data[0] : undefined;
  const fields = task.cronSchedule.trim().split(/\s+/);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="card overflow-hidden">
        {failure && (
          <div className="m-5 mb-1 flex gap-3 rounded-lg border border-danger/40 bg-danger-soft p-3.5 text-danger">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[0.8125rem] font-medium">
                {failure.httpStatus ? `HTTP ${failure.httpStatus}` : 'No response'}
              </p>
              <p className="mt-0.5 wrap-break-word">{failure.message}</p>
              <p className="mt-0.5 text-xs opacity-80">{formatDateTime(failure.executedAt)}</p>
            </div>
            <Link to={`/tasks/${task.id}?tab=runs`} className="btn btn-sm self-start">
              View runs
            </Link>
          </div>
        )}

        <Section title="Schedule">
          <dl className="grid grid-cols-5 gap-2">
            {CRON_FIELDS.map((label, i) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-mono text-[0.9375rem]">{fields[i] ?? '*'}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Details">
          <DetailList
            items={[
              { label: 'Runs', value: <>{describeCron(task.cronSchedule) ?? task.cronSchedule} <span className="text-muted">{task.timezone}</span></> },
              {
                label: 'Next run',
                value: task.nextRunAt ? (
                  <>
                    {formatDateTime(task.nextRunAt)} <span className="text-muted">{formatRelative(task.nextRunAt)}</span>
                  </>
                ) : (
                  <span className="text-muted">Paused</span>
                ),
              },
              {
                label: 'Last run',
                value: task.lastRunAt ? formatDateTime(task.lastRunAt) : <span className="text-muted">Never</span>,
              },
              {
                label: 'Retries',
                value: (
                  <>
                    {task.maxRetry} <span className="text-muted">{task.retryDelayMs / 1000}s apart</span>
                  </>
                ),
              },
              { label: 'Webhook', value: <code className="text-[0.8125rem]">{task.webhookUrl}</code> },
              { label: 'Created', value: formatDateTime(task.createdAt) },
              { label: 'Updated', value: formatDateTime(task.updatedAt) },
            ]}
          />
        </Section>

        <Section title={`Next ${task.nextRuns.length || 5} runs`}>
          {task.nextRuns.length === 0 ? (
            <p className="text-muted">Paused: resume the task to schedule runs again.</p>
          ) : (
            <ol className="space-y-1.5">
              {task.nextRuns.map((iso) => (
                <li key={iso} className="flex justify-between gap-4">
                  <time dateTime={iso}>{formatDateTime(iso)}</time>
                  <span className="text-muted">{formatRelative(iso)}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <div className="card self-start overflow-hidden">
        <Section title="Payload">
          <pre className="max-h-112 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap wrap-anywhere">
            {JSON.stringify(task.payload, null, 2)}
          </pre>
          <p className="mt-2 text-xs text-muted">Sent as is to Discord with every run.</p>
        </Section>
      </div>
    </div>
  );
}

function Runs({ taskId }: { taskId: string }) {
  const [page, setPage] = useState(1);
  const logs = useLogs({ taskId, page, pageSize: RUNS_PAGE_SIZE });

  return (
    <div className="card overflow-hidden">
      {logs.isPending ? (
        <LoadingState label="Loading runs…" />
      ) : logs.error ? (
        <ErrorState message={logs.error.message} onRetry={() => logs.refetch()} />
      ) : logs.data.data.length === 0 ? (
        <EmptyState title="No runs yet">Press Run now to try it, or wait for the next scheduled run.</EmptyState>
      ) : (
        <>
          <LogsTable logs={logs.data.data} caption="Runs of this task, newest first" captionId="runs-caption" showTask={false} />
          <Pagination page={logs.data.meta.page} totalPages={logs.data.meta.totalPages} total={logs.data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
