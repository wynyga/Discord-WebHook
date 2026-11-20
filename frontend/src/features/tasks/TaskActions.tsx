import type { Task } from '../../api/types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toasts';
import { useTaskActions } from './queries';

/**
 * Run now and pause/resume. `compact` renders square icon buttons for table rows; the accessible
 * name always includes the task, e.g. "Run Daily report now".
 */
export function TaskQuickActions({ task, compact = false }: { task: Task; compact?: boolean }) {
  const actions = useTaskActions();
  const { notify } = useToast();
  const paused = task.status === 'paused';

  const run = () =>
    actions.runNow.mutate(task.id, {
      onSuccess: () => notify(`Run of "${task.name}" queued. The result appears in its runs.`, 'info'),
      onError: (err) => notify(`Could not run "${task.name}": ${err.message}`, 'error'),
    });

  const togglePause = () => {
    const mutation = paused ? actions.resume : actions.pause;
    mutation.mutate(task.id, {
      onSuccess: () => notify(`Task "${task.name}" ${paused ? 'resumed' : 'paused'}.`, 'success'),
      onError: (err) => notify(`Could not update "${task.name}": ${err.message}`, 'error'),
    });
  };

  const size = compact ? 'btn-sm btn-icon btn-ghost' : 'btn-sm';
  return (
    <>
      {/* Spaces sit outside the hidden spans: some name computations trim them. */}
      <button
        type="button"
        className={`btn ${compact ? size : 'btn-sm btn-primary'}`}
        title={compact ? 'Run now' : undefined}
        disabled={actions.runNow.isPending}
        onClick={run}
      >
        {/* "send", not "play": a paused row also shows Resume, which uses play. */}
        <Icon name="send" />
        {compact ? (
          <span className="sr-only">Run {task.name} now</span>
        ) : (
          <>
            Run now <span className="sr-only">{task.name}</span>
          </>
        )}
      </button>
      <button
        type="button"
        className={`btn ${size}`}
        title={compact ? (paused ? 'Resume' : 'Pause') : undefined}
        disabled={actions.pause.isPending || actions.resume.isPending}
        onClick={togglePause}
      >
        <Icon name={paused ? 'play' : 'pause'} />
        {compact ? (
          <span className="sr-only">
            {paused ? 'Resume' : 'Pause'} {task.name}
          </span>
        ) : (
          <>
            {paused ? 'Resume' : 'Pause'} <span className="sr-only">{task.name}</span>
          </>
        )}
      </button>
    </>
  );
}
