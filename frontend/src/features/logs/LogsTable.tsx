import { Fragment, useState } from 'react';
import type { TaskLog } from '../../api/types';
import { Icon } from '../../components/Icon';
import { TableRegion } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime, formatDuration, formatRelative } from '../../lib/format';

interface LogsTableProps {
  logs: TaskLog[];
  caption: string;
  captionId: string;
  /** Hide the task column when every row belongs to the same task. */
  showTask?: boolean;
}

/** One row per attempt; the full message and timing open in a detail row below it. */
export function LogsTable({ logs, caption, captionId, showTask = true }: LogsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const columns = showTask ? 7 : 6;

  return (
    <TableRegion labelledBy={captionId}>
      <table className="data-table">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col">Executed</th>
            {showTask && <th scope="col">Task</th>}
            <th scope="col">Status</th>
            <th scope="col">Attempt</th>
            <th scope="col">HTTP</th>
            <th scope="col">Duration</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const open = expanded === log.id;
            const detailId = `log-detail-${log.id}`;
            return (
              <Fragment key={log.id}>
                <tr>
                  <th scope="row" className="font-normal">
                    <time dateTime={log.executedAt} title={formatDateTime(log.executedAt)}>
                      {formatRelative(log.executedAt)}
                    </time>
                  </th>
                  {showTask && <td data-label="Task">{log.taskName}</td>}
                  <td data-label="Status">
                    <StatusBadge status={log.status} />
                  </td>
                  <td data-label="Attempt">{log.retryCount === 0 ? 'First' : `Retry ${log.retryCount}`}</td>
                  <td data-label="HTTP" className="font-mono text-sm">
                    {log.httpStatus ?? '—'}
                  </td>
                  <td data-label="Duration">{formatDuration(log.durationMs)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-expanded={open}
                      aria-controls={detailId}
                      onClick={() => setExpanded(open ? null : log.id)}
                    >
                      <Icon name="chevron" className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                      Details
                    </button>
                  </td>
                </tr>
                <tr id={detailId} hidden={!open}>
                  <td colSpan={columns} className="bg-surface-2">
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                      <dt className="font-semibold text-muted">Message</dt>
                      <dd className="break-words">{log.message}</dd>
                      <dt className="font-semibold text-muted">Executed at</dt>
                      <dd>{formatDateTime(log.executedAt)}</dd>
                      <dt className="font-semibold text-muted">Log id</dt>
                      <dd className="font-mono text-xs">{log.id}</dd>
                    </dl>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableRegion>
  );
}
