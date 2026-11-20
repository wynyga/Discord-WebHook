import type { TaskLogStatus, TaskStatus } from '../api/types';
import { Icon, type IconName } from './Icon';

type Status = TaskStatus | TaskLogStatus;

const STYLES: Record<Status, { label: string; icon: IconName; className: string }> = {
  active: { label: 'Active', icon: 'dot', className: 'bg-success-soft text-success' },
  success: { label: 'Success', icon: 'check', className: 'bg-success-soft text-success' },
  paused: { label: 'Paused', icon: 'pause', className: 'bg-warning-soft text-warning' },
  retrying: { label: 'Retrying', icon: 'retry', className: 'bg-warning-soft text-warning' },
  failed: { label: 'Failed', icon: 'x', className: 'bg-danger-soft text-danger' },
};

/** Text plus icon, so the state never depends on color alone. */
export function StatusBadge({ status }: { status: Status }) {
  const style = STYLES[status];
  return (
    <span className={`badge ${style.className}`}>
      <Icon name={style.icon} className="size-3.5" />
      {style.label}
    </span>
  );
}
