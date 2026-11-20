import type { TaskLogStatus, TaskStatus } from '../api/types';
import { Icon, type IconName } from './Icon';

type Status = TaskStatus | TaskLogStatus;

const STYLES: Record<Status, { label: string; icon: IconName; className: string }> = {
  active: { label: 'Active', icon: 'dot', className: 'badge-success' },
  success: { label: 'Success', icon: 'check', className: 'badge-success' },
  paused: { label: 'Paused', icon: 'pause', className: 'badge-neutral' },
  retrying: { label: 'Retrying', icon: 'retry', className: 'badge-warning' },
  failed: { label: 'Failed', icon: 'x', className: 'badge-danger' },
};

/** Text plus icon, so the state never depends on color alone. */
export function StatusBadge({ status }: { status: Status }) {
  const style = STYLES[status];
  return (
    <span className={`badge ${style.className}`}>
      <Icon name={style.icon} className="size-3" />
      {style.label}
    </span>
  );
}

/** Discord's response code: green for 2xx, red otherwise, dash when no response arrived. */
export function HttpBadge({ status }: { status: number | null }) {
  if (status === null) {
    return (
      <span className="badge badge-neutral font-mono" title="No response (network error or timeout)">
        —<span className="sr-only">No response</span>
      </span>
    );
  }
  const ok = status >= 200 && status < 300;
  return (
    <span className={`badge font-mono ${ok ? 'badge-success' : 'badge-danger'}`}>
      <Icon name={ok ? 'checkCircle' : 'xCircle'} className="size-3.5" />
      {status}
    </span>
  );
}
